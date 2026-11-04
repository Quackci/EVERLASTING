import { describe, expect, it } from 'vitest';
import {
  BIND_ACTIONS,
  DEFAULT_KEYBINDS,
  MOUSE_LEFT,
  MOUSE_RIGHT,
  assignBind,
  conflictOf,
  defaultKeybinds,
  isBindableCode,
  keyName,
  loadKeybinds,
  resetKeybinds,
  sanitizeKeybinds,
  saveKeybinds,
  type KeybindStorage,
} from '../src/game/systems/keybinds';

function memoryStorage(): KeybindStorage & { data: Map<string, string> } {
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

describe('keybinds', () => {
  it('ships defaults with no two actions on the same key', () => {
    const codes = BIND_ACTIONS.map((action) => DEFAULT_KEYBINDS[action]);
    expect(new Set(codes).size).toBe(BIND_ACTIONS.length);
  });

  it('names keys the player actually recognises', () => {
    expect(keyName(87)).toBe('W');
    expect(keyName(37)).toBe('LEFT');
    expect(keyName(32)).toBe('SPACE');
    expect(keyName(MOUSE_LEFT)).toBe('LEFT CLICK');
    expect(keyName(120)).toBe('F9');
  });

  it('rejects codes that can never be bound', () => {
    expect(isBindableCode(0)).toBe(false);
    expect(isBindableCode(-7)).toBe(false);
    expect(isBindableCode(65.5)).toBe(false);
    expect(isBindableCode('65')).toBe(false);
    expect(isBindableCode(65)).toBe(true);
    expect(isBindableCode(MOUSE_LEFT)).toBe(true);
  });

  it('binds an unused key without touching the other actions', () => {
    const before = defaultKeybinds();
    const result = assignBind(before, 'interact', 81);
    expect(result.accepted).toBe(true);
    expect(result.conflict).toBeNull();
    expect(result.binds.interact).toBe(81);
    expect(result.binds.attack).toBe(before.attack);
    // The original object is never mutated.
    expect(before.interact).toBe(69);
  });

  it('refuses to steal a key another action already owns', () => {
    const binds = defaultKeybinds();
    const result = assignBind(binds, 'up', binds.attack);
    expect(result.accepted).toBe(false);
    expect(result.conflict).toBe('attack');
    expect(result.binds).toEqual(binds);
    expect(conflictOf(binds, 'up', binds.attack)).toBe('attack');
    expect(conflictOf(binds, 'up', binds.up)).toBeNull();
  });

  it('repairs junk and duplicates coming out of storage', () => {
    const sanitized = sanitizeKeybinds({ up: 'nope', down: 83, attack: 83, dodge: null });
    expect(sanitized.up).toBe(87);
    expect(sanitized.down).toBe(83);
    expect(sanitized.attack).toBe(74);
    expect(sanitized.dodge).toBe(32);
  });

  it('falls back to defaults for a missing or corrupt record', () => {
    expect(sanitizeKeybinds(undefined)).toEqual(defaultKeybinds());
    expect(sanitizeKeybinds([1, 2, 3])).toEqual(defaultKeybinds());
    const storage = memoryStorage();
    storage.setItem('everlasting.keybinds.v1', '{ not json');
    expect(loadKeybinds(storage)).toEqual(defaultKeybinds());
  });

  it('round-trips a rebind through storage', () => {
    const storage = memoryStorage();
    const binds = assignBind(defaultKeybinds(), 'inventory', 9).binds;
    saveKeybinds(binds, storage);
    expect(loadKeybinds(storage)).toEqual(binds);
  });

  it('restores defaults and clears the stored record', () => {
    const storage = memoryStorage();
    saveKeybinds(assignBind(defaultKeybinds(), 'attack', 81).binds, storage);
    const restored = resetKeybinds(storage);
    expect(restored).toEqual(defaultKeybinds());
    expect(storage.data.size).toBe(0);
    expect(loadKeybinds(storage)).toEqual(defaultKeybinds());
  });
});

describe('mouse bindings', () => {
  it('names and accepts both mouse buttons', () => {
    expect(keyName(MOUSE_LEFT)).toBe('LEFT CLICK');
    expect(keyName(MOUSE_RIGHT)).toBe('RIGHT CLICK');
    expect(isBindableCode(MOUSE_RIGHT)).toBe(true);
  });

  it('lets an action move onto the right button without duplicating it', () => {
    const result = assignBind(defaultKeybinds(), 'attack', MOUSE_RIGHT);
    expect(result.accepted).toBe(true);
    expect(result.binds.attack).toBe(MOUSE_RIGHT);
    expect(assignBind(result.binds, 'dodge', MOUSE_RIGHT).conflict).toBe('attack');
  });
});
