/**
 * Rebindable controls. Pure data plus helpers; scenes turn these numeric key
 * codes into Phaser keys. Codes match `KeyboardEvent.keyCode` (the same space
 * Phaser's `KeyCodes` uses), so capturing a rebind is a straight copy.
 */

export const BIND_ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'attack',
  'block',
  'dodge',
  'sprint',
  'interact',
  'inventory',
  'pause',
] as const;

export type BindAction = (typeof BIND_ACTIONS)[number];
export type Keybinds = Record<BindAction, number>;

/** Block is on the left mouse button by default, not a physical key. */
export const MOUSE_LEFT = -2;
/** A deliberate "nothing bound here" slot. */
export const UNBOUND = 0;
export const KEYBINDS_STORAGE_KEY = 'everlasting.keybinds.v1';

export const DEFAULT_KEYBINDS: Readonly<Keybinds> = {
  up: 87, // W
  down: 83, // S
  left: 65, // A
  right: 68, // D
  attack: 74, // J
  block: MOUSE_LEFT,
  dodge: 32, // Space
  sprint: 16, // Shift
  interact: 69, // E
  inventory: 73, // I
  pause: 27, // Escape
};

export const BIND_LABELS: Readonly<Record<BindAction, string>> = {
  up: 'MOVE UP',
  down: 'MOVE DOWN',
  left: 'MOVE LEFT',
  right: 'MOVE RIGHT',
  attack: 'SWING',
  block: 'BLOCK / PARRY',
  dodge: 'DODGE',
  sprint: 'SPRINT',
  interact: 'OPEN / USE',
  inventory: 'INVENTORY',
  pause: 'PAUSE / BACK',
};

const NAMED_CODES: Readonly<Record<number, string>> = {
  8: 'BACKSPACE',
  9: 'TAB',
  13: 'ENTER',
  16: 'SHIFT',
  17: 'CTRL',
  18: 'ALT',
  20: 'CAPS',
  27: 'ESC',
  32: 'SPACE',
  33: 'PGUP',
  34: 'PGDN',
  35: 'END',
  36: 'HOME',
  37: 'LEFT',
  38: 'UP',
  39: 'RIGHT',
  40: 'DOWN',
  45: 'INS',
  46: 'DEL',
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: "'",
  96: 'NUM0',
  97: 'NUM1',
  98: 'NUM2',
  99: 'NUM3',
  100: 'NUM4',
  101: 'NUM5',
  102: 'NUM6',
  103: 'NUM7',
  104: 'NUM8',
  105: 'NUM9',
  [MOUSE_LEFT]: 'LEFT CLICK',
  [UNBOUND]: 'UNBOUND',
};

/** Human-readable label for a key code, e.g. 87 -> "W", 37 -> "LEFT". */
export function keyName(code: number): string {
  const named = NAMED_CODES[code];
  if (named) return named;
  if (code >= 48 && code <= 57) return String.fromCharCode(code);
  if (code >= 65 && code <= 90) return String.fromCharCode(code);
  if (code >= 112 && code <= 123) return `F${code - 111}`;
  return `KEY ${code}`;
}

export function isBindableCode(code: unknown): code is number {
  return typeof code === 'number' && Number.isInteger(code) && (code === MOUSE_LEFT || code > 0);
}

export function defaultKeybinds(): Keybinds {
  return { ...DEFAULT_KEYBINDS };
}

/** Which other action already owns this code, if any. */
export function conflictOf(binds: Keybinds, action: BindAction, code: number): BindAction | null {
  for (const other of BIND_ACTIONS) {
    if (other !== action && binds[other] === code) return other;
  }
  return null;
}

export interface BindResult {
  binds: Keybinds;
  conflict: BindAction | null;
  accepted: boolean;
}

/**
 * Attempts to bind `code` to `action`. A code already used by another action is
 * rejected rather than silently stolen, so the player never ends up with two
 * actions that fire together.
 */
export function assignBind(binds: Keybinds, action: BindAction, code: number): BindResult {
  if (!isBindableCode(code)) {
    return { binds, conflict: null, accepted: false };
  }
  const conflict = conflictOf(binds, action, code);
  if (conflict) {
    return { binds, conflict, accepted: false };
  }
  return { binds: { ...binds, [action]: code }, conflict: null, accepted: true };
}

/** Drops junk from saved data and repairs duplicate or unusable bindings. */
export function sanitizeKeybinds(raw: unknown): Keybinds {
  const result = defaultKeybinds();
  if (!raw || typeof raw !== 'object') return result;
  const source = raw as Record<string, unknown>;
  const used = new Set<number>();
  for (const action of BIND_ACTIONS) {
    const candidate = source[action];
    const fallback = DEFAULT_KEYBINDS[action];
    let code = isBindableCode(candidate) ? candidate : fallback;
    if (used.has(code)) {
      code = used.has(fallback) ? UNBOUND : fallback;
    }
    result[action] = code;
    used.add(code);
  }
  return result;
}

export interface KeybindStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultStorage(): KeybindStorage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

export function loadKeybinds(storage: KeybindStorage | null = defaultStorage()): Keybinds {
  if (!storage) return defaultKeybinds();
  try {
    const stored = storage.getItem(KEYBINDS_STORAGE_KEY);
    if (!stored) return defaultKeybinds();
    return sanitizeKeybinds(JSON.parse(stored));
  } catch {
    return defaultKeybinds();
  }
}

export function saveKeybinds(binds: Keybinds, storage: KeybindStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(binds));
  } catch {
    // A full or blocked storage must not stop the player from playing.
  }
}

export function resetKeybinds(storage: KeybindStorage | null = defaultStorage()): Keybinds {
  if (storage) {
    try {
      storage.removeItem(KEYBINDS_STORAGE_KEY);
    } catch {
      // Ignore: defaults are returned regardless.
    }
  }
  return defaultKeybinds();
}
