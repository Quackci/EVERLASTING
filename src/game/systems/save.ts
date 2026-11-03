/**
 * Run saves. One record per slot, written to local storage so the browser build
 * and the Electron build behave identically with no IPC or filesystem access.
 * Everything here validates on read: storage is user-writable, so a malformed
 * record must never reach the run.
 */

export const SAVE_VERSION = 1;
export const SAVE_SLOTS = 3;
export const SAVE_KEY_PREFIX = 'everlasting.save.v1.slot-';

export interface RunSave {
  version: number;
  slot: number;
  seed: number;
  floor: number;
  classId: string;
  difficultyId: string;
  smarts: number;
  unlocked: string[];
  hp: number;
  maxHp: number;
  updatedAt: number;
}

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveStorage(): SaveStorage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

export function isValidSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 1 && slot <= SAVE_SLOTS;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Rejects anything that could put the run in an unreachable state. */
export function parseSave(raw: unknown): RunSave | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== SAVE_VERSION) return null;
  if (!isFiniteNumber(value.slot) || !isValidSlot(value.slot)) return null;
  if (!isFiniteNumber(value.seed) || value.seed < 0) return null;
  if (!isFiniteNumber(value.floor) || value.floor < 1 || value.floor > 10) return null;
  if (typeof value.classId !== 'string' || value.classId.length === 0) return null;
  if (typeof value.difficultyId !== 'string' || value.difficultyId.length === 0) return null;
  if (!isFiniteNumber(value.smarts) || value.smarts < 0) return null;
  if (!Array.isArray(value.unlocked) || value.unlocked.some((id) => typeof id !== 'string')) return null;
  if (!isFiniteNumber(value.hp) || value.hp < 0) return null;
  if (!isFiniteNumber(value.maxHp) || value.maxHp <= 0) return null;
  if (!isFiniteNumber(value.updatedAt)) return null;

  return {
    version: SAVE_VERSION,
    slot: Math.trunc(value.slot),
    seed: Math.trunc(value.seed) >>> 0,
    floor: Math.trunc(value.floor),
    classId: value.classId,
    difficultyId: value.difficultyId,
    smarts: Math.max(0, Math.trunc(value.smarts)),
    unlocked: [...new Set(value.unlocked as string[])],
    hp: Math.max(0, Math.trunc(value.hp)),
    maxHp: Math.trunc(value.maxHp),
    updatedAt: value.updatedAt,
  };
}

export function slotKey(slot: number): string {
  return `${SAVE_KEY_PREFIX}${Math.trunc(slot)}`;
}

export function loadSlot(slot: number, storage: SaveStorage | null = saveStorage()): RunSave | null {
  if (!storage || !isValidSlot(slot)) return null;
  try {
    const stored = storage.getItem(slotKey(slot));
    if (!stored) return null;
    return parseSave(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function writeSlot(save: RunSave, storage: SaveStorage | null = saveStorage()): boolean {
  if (!storage || !isValidSlot(save.slot)) return false;
  const validated = parseSave(save);
  if (!validated) return false;
  try {
    storage.setItem(slotKey(save.slot), JSON.stringify(validated));
    return true;
  } catch {
    return false;
  }
}

export function clearSlot(slot: number, storage: SaveStorage | null = saveStorage()): void {
  if (!storage || !isValidSlot(slot)) return;
  try {
    storage.removeItem(slotKey(slot));
  } catch {
    // A blocked storage simply means there was nothing to clear.
  }
}

export function listSlots(storage: SaveStorage | null = saveStorage()): (RunSave | null)[] {
  const slots: (RunSave | null)[] = [];
  for (let slot = 1; slot <= SAVE_SLOTS; slot += 1) {
    slots.push(loadSlot(slot, storage));
  }
  return slots;
}

/** Current Smarts total is the run's spendable currency, so saves never go negative. */
export function makeSave(input: Omit<RunSave, 'version' | 'unlocked'> & { unlocked: readonly string[] }): RunSave {
  return {
    ...input,
    version: SAVE_VERSION,
    unlocked: [...new Set(input.unlocked)],
  };
}
