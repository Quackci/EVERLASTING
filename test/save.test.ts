import { describe, expect, it } from 'vitest';
import {
  SAVE_KEY_PREFIX,
  SAVE_SLOTS,
  SAVE_VERSION,
  clearSlot,
  listSlots,
  loadSlot,
  makeSave,
  parseSave,
  writeSlot,
  type RunSave,
  type SaveStorage,
} from '../src/game/systems/save';

function memoryStorage(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function sampleSave(slot = 1): RunSave {
  return makeSave({
    slot,
    seed: 4242,
    floor: 3,
    classId: 'class_cutter',
    difficultyId: 'midterm',
    smarts: 55,
    unlocked: ['cc_hall_pass', 'cc_hall_pass'],
    hp: 61,
    maxHp: 80,
    updatedAt: 1700000000000,
  });
}

describe('save slots', () => {
  it('round-trips a slot and de-duplicates unlocked skills', () => {
    const storage = memoryStorage();
    const save = sampleSave(2);
    expect(writeSlot(save, storage)).toBe(true);
    const loaded = loadSlot(2, storage);
    expect(loaded?.seed).toBe(4242);
    expect(loaded?.unlocked).toEqual(['cc_hall_pass']);
    expect(loaded?.floor).toBe(3);
  });

  it('writes one key per slot', () => {
    const storage = memoryStorage();
    writeSlot(sampleSave(1), storage);
    writeSlot(sampleSave(3), storage);
    expect([...storage.data.keys()].sort()).toEqual([
      `${SAVE_KEY_PREFIX}1`,
      `${SAVE_KEY_PREFIX}3`,
    ]);
  });

  it('reads empty slots as null', () => {
    const storage = memoryStorage();
    expect(loadSlot(1, storage)).toBeNull();
    expect(listSlots(storage)).toEqual([null, null, null]);
  });

  it('lists exactly the configured number of slots', () => {
    const storage = memoryStorage();
    writeSlot(sampleSave(2), storage);
    const slots = listSlots(storage);
    expect(slots).toHaveLength(SAVE_SLOTS);
    expect(slots[1]?.slot).toBe(2);
  });

  it('clears a slot without touching the others', () => {
    const storage = memoryStorage();
    writeSlot(sampleSave(1), storage);
    writeSlot(sampleSave(2), storage);
    clearSlot(1, storage);
    expect(loadSlot(1, storage)).toBeNull();
    expect(loadSlot(2, storage)?.slot).toBe(2);
  });
});

describe('save validation', () => {
  it('rejects junk values instead of trusting storage', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave({})).toBeNull();
    expect(parseSave({ ...sampleSave(), version: SAVE_VERSION + 1 })).toBeNull();
    expect(parseSave({ ...sampleSave(), slot: 9 })).toBeNull();
    expect(parseSave({ ...sampleSave(), floor: 0 })).toBeNull();
    expect(parseSave({ ...sampleSave(), floor: 11 })).toBeNull();
    expect(parseSave({ ...sampleSave(), seed: -1 })).toBeNull();
    expect(parseSave({ ...sampleSave(), classId: '' })).toBeNull();
    expect(parseSave({ ...sampleSave(), unlocked: ['ok', 7] })).toBeNull();
    expect(parseSave({ ...sampleSave(), maxHp: 0 })).toBeNull();
  });

  it('refuses a corrupt record and leaves the slot empty', () => {
    const storage = memoryStorage();
    storage.setItem(`${SAVE_KEY_PREFIX}1`, 'not json at all');
    expect(loadSlot(1, storage)).toBeNull();
  });

  it('refuses to write an invalid save', () => {
    const storage = memoryStorage();
    expect(writeSlot({ ...sampleSave(), floor: 99 }, storage)).toBe(false);
    expect(storage.data.size).toBe(0);
  });

  it('ignores invalid slot numbers', () => {
    const storage = memoryStorage();
    expect(loadSlot(0, storage)).toBeNull();
    expect(loadSlot(4, storage)).toBeNull();
    expect(writeSlot(sampleSave(0), storage)).toBe(false);
  });
});
