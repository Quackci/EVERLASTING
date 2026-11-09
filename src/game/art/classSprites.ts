/**
 * One hand-authored look per student class.
 *
 * The body skeleton is shared so the four classes animate identically, but each
 * class recolours it and paints a signature detail over the top: the Field
 * Tripper's blazer badge and pack straps, the Arrow-Demic's hood and pencil
 * quiver, the Hall Monitor's cap, shoulder pads and badge, and the Class
 * Cutter's hood shadow and scarf.
 *
 * The skeleton is drawn in nine tones rather than three: hair, a hair highlight,
 * skin, eyes, collar, blazer, blazer shadow, trousers and shoes. That is enough
 * to read a face and a stride at 16x16 without adding colours outside the locked
 * palette.
 *
 * This module deliberately imports no Phaser so the pixel data and the key
 * helpers can be validated by plain unit tests.
 */
import { PALETTE, type PaletteName } from './palette';

export type FacingDir = 'down' | 'up' | 'side';

export const FACING_DIRS: readonly FacingDir[] = ['down', 'up', 'side'];
export const FRAMES_PER_DIRECTION = 3;
export const FALLBACK_CLASS_ID = 'field_tripper';

/** Shared 16x16 skeletons. Characters map through each class's colour table. */
export const BASE_PLAYER_MAPS: Record<FacingDir, readonly string[]> = {
  down: [
    '................',
    '....kkkkkkkk....',
    '....khhhhhhk....',
    '....khHhhhhk....',
    '....khCCCChk....',
    '....kCeCCeCk....',
    '....kCCCCCCk....',
    '.....kCCCCk.....',
    '....kbbbbbbk....',
    '...kuuuuuuuuk...',
    '..kuUuuuuuuUuk..',
    '..kuCuuuuuuCuk..',
    '..kuCuuuuuuCuk..',
    '...kddddddddk...',
    '....kdd..ddk....',
    '....kDD..DDk....',
  ],
  up: [
    '................',
    '....kkkkkkkk....',
    '....khhhhhhk....',
    '....khhhhhhk....',
    '....khhhhhhk....',
    '....khhhhhhk....',
    '....khhhhhhk....',
    '.....khhhhk.....',
    '....kbbbbbbk....',
    '...kuuuuuuuuk...',
    '..kuUuuuuuuUuk..',
    '..kuCuuuuuuCuk..',
    '..kuCuuuuuuCuk..',
    '...kddddddddk...',
    '....kdd..ddk....',
    '....kDD..DDk....',
  ],
  side: [
    '................',
    '....kkkkkkk.....',
    '...khhhhhhk.....',
    '...khhHhhhk.....',
    '...khhCCCk......',
    '...khhCeCk......',
    '...khCCCCk......',
    '....kCCCk.......',
    '....kbbbk.......',
    '...kuuuuuk......',
    '..kuUuuuuuk.....',
    '..kuCuuuuuk.....',
    '..kuCuuuuuk.....',
    '...kdddddk......',
    '....kddddk......',
    '....kDDDDk......',
  ],
};

/** A single pixel painted over the skeleton, in map coordinates. */
export interface DecorPixel {
  x: number;
  y: number;
  ch: string;
}

export interface ClassLook {
  id: string;
  /** Used by menus and the save list, so a class reads the same everywhere. */
  accent: PaletteName;
  colors: Readonly<Record<string, PaletteName>>;
  decor: Readonly<Partial<Record<FacingDir, readonly DecorPixel[]>>>;
  /** The Hall Monitor lumbers; the Class Cutter scuttles. */
  walkFrameRate: number;
}

/** Tones every skeleton shares. Each class overrides the ones that identify it. */
const SHARED = {
  k: 'ink900',
  e: 'ink900',
  D: 'grey900',
} as const;

const CLASS_LOOKS: readonly ClassLook[] = [
  {
    id: 'field_tripper',
    accent: 'chalk',
    walkFrameRate: 9,
    colors: {
      ...SHARED,
      h: 'cork',
      H: 'wood',
      C: 'chalkLight',
      b: 'bone',
      u: 'blue',
      U: 'blueDark',
      d: 'ink700',
      j: 'ink800',
      o: 'cork',
      B: 'ink700',
      y: 'yellow',
    },
    decor: {
      // Backpack straps over the blazer, plus the school badge.
      down: [
        { x: 5, y: 9, ch: 'o' },
        { x: 5, y: 10, ch: 'o' },
        { x: 10, y: 9, ch: 'o' },
        { x: 10, y: 10, ch: 'o' },
        { x: 9, y: 12, ch: 'y' },
      ],
      // From behind only the pack shows: a dark slab with two brass clasps.
      up: [
        { x: 5, y: 9, ch: 'B' },
        { x: 6, y: 9, ch: 'B' },
        { x: 7, y: 9, ch: 'B' },
        { x: 8, y: 9, ch: 'B' },
        { x: 9, y: 9, ch: 'B' },
        { x: 10, y: 9, ch: 'B' },
        { x: 5, y: 10, ch: 'B' },
        { x: 6, y: 10, ch: 'B' },
        { x: 7, y: 10, ch: 'B' },
        { x: 8, y: 10, ch: 'B' },
        { x: 9, y: 10, ch: 'B' },
        { x: 10, y: 10, ch: 'B' },
        { x: 5, y: 11, ch: 'B' },
        { x: 6, y: 11, ch: 'B' },
        { x: 7, y: 11, ch: 'B' },
        { x: 8, y: 11, ch: 'B' },
        { x: 9, y: 11, ch: 'B' },
        { x: 10, y: 11, ch: 'B' },
        { x: 6, y: 10, ch: 'y' },
        { x: 9, y: 10, ch: 'y' },
      ],
      side: [
        { x: 4, y: 9, ch: 'o' },
        { x: 5, y: 10, ch: 'o' },
        { x: 8, y: 12, ch: 'y' },
      ],
    },
  },
  {
    id: 'arrow_demic',
    accent: 'teal',
    walkFrameRate: 11,
    colors: {
      ...SHARED,
      h: 'corkDark',
      H: 'cork',
      C: 'paperShade',
      b: 'bone',
      u: 'teal',
      U: 'greenDark',
      d: 'greenDark',
      j: 'teal',
      T: 'greenDark',
      y: 'yellow',
    },
    decor: {
      // Rubber-band sling across the hoodie.
      down: [
        { x: 5, y: 9, ch: 'y' },
        { x: 6, y: 10, ch: 'y' },
        { x: 7, y: 11, ch: 'y' },
        { x: 8, y: 12, ch: 'y' },
      ],
      // Pencil quiver: a dark pack with five pencil ends poking out.
      up: [
        { x: 5, y: 9, ch: 'T' },
        { x: 6, y: 9, ch: 'y' },
        { x: 7, y: 9, ch: 'T' },
        { x: 8, y: 9, ch: 'y' },
        { x: 9, y: 9, ch: 'T' },
        { x: 10, y: 9, ch: 'y' },
        { x: 5, y: 10, ch: 'T' },
        { x: 6, y: 10, ch: 'T' },
        { x: 7, y: 10, ch: 'T' },
        { x: 8, y: 10, ch: 'T' },
        { x: 9, y: 10, ch: 'T' },
        { x: 10, y: 10, ch: 'T' },
        { x: 6, y: 11, ch: 'y' },
        { x: 9, y: 11, ch: 'y' },
      ],
      side: [
        { x: 5, y: 9, ch: 'y' },
        { x: 6, y: 10, ch: 'y' },
        { x: 7, y: 11, ch: 'y' },
      ],
    },
  },
  {
    id: 'hall_monitor',
    accent: 'steel',
    walkFrameRate: 7,
    colors: {
      ...SHARED,
      h: 'grey300',
      H: 'grey100',
      C: 'chalkLight',
      b: 'bone',
      u: 'steel',
      U: 'grey500',
      d: 'grey700',
      j: 'slate',
      a: 'grey100',
      y: 'yellow',
    },
    decor: {
      // Cap with a brim, shoulder pads and the monitor's badge.
      down: [
        { x: 5, y: 1, ch: 'a' },
        { x: 6, y: 1, ch: 'a' },
        { x: 7, y: 1, ch: 'a' },
        { x: 8, y: 1, ch: 'a' },
        { x: 9, y: 1, ch: 'a' },
        { x: 10, y: 1, ch: 'a' },
        { x: 4, y: 3, ch: 'a' },
        { x: 11, y: 3, ch: 'a' },
        { x: 3, y: 10, ch: 'a' },
        { x: 12, y: 10, ch: 'a' },
        { x: 9, y: 12, ch: 'y' },
      ],
      up: [
        { x: 5, y: 1, ch: 'a' },
        { x: 6, y: 1, ch: 'a' },
        { x: 7, y: 1, ch: 'a' },
        { x: 8, y: 1, ch: 'a' },
        { x: 9, y: 1, ch: 'a' },
        { x: 10, y: 1, ch: 'a' },
        { x: 4, y: 3, ch: 'a' },
        { x: 11, y: 3, ch: 'a' },
        { x: 3, y: 10, ch: 'a' },
        { x: 12, y: 10, ch: 'a' },
      ],
      side: [
        { x: 5, y: 1, ch: 'a' },
        { x: 6, y: 1, ch: 'a' },
        { x: 7, y: 1, ch: 'a' },
        { x: 7, y: 2, ch: 'a' },
        { x: 8, y: 2, ch: 'a' },
        { x: 8, y: 12, ch: 'y' },
      ],
    },
  },
  {
    id: 'class_cutter',
    accent: 'purple',
    walkFrameRate: 12,
    colors: {
      ...SHARED,
      h: 'ink700',
      H: 'ink600',
      C: 'chalk',
      b: 'ink800',
      u: 'purple',
      U: 'ink700',
      d: 'ink900',
      j: 'purple',
      x: 'pink',
      y: 'yellow',
    },
    decor: {
      // Hood pulled forward: the face sits in shadow, and the scarf is a short
      // knotted tail rather than a band across the whole collar.
      down: [
        { x: 4, y: 3, ch: 'U' },
        { x: 11, y: 3, ch: 'U' },
        { x: 4, y: 4, ch: 'U' },
        { x: 11, y: 4, ch: 'U' },
        { x: 7, y: 8, ch: 'x' },
        { x: 8, y: 8, ch: 'x' },
        { x: 9, y: 8, ch: 'x' },
        { x: 9, y: 9, ch: 'x' },
      ],
      up: [
        { x: 4, y: 3, ch: 'U' },
        { x: 11, y: 3, ch: 'U' },
        { x: 4, y: 4, ch: 'U' },
        { x: 11, y: 4, ch: 'U' },
      ],
      side: [
        { x: 4, y: 3, ch: 'U' },
        { x: 4, y: 4, ch: 'U' },
        { x: 6, y: 8, ch: 'x' },
        { x: 7, y: 8, ch: 'x' },
      ],
    },
  },
];

function fallbackLook(): ClassLook {
  const look = CLASS_LOOKS.find((candidate) => candidate.id === FALLBACK_CLASS_ID) ?? CLASS_LOOKS[0];
  if (!look) throw new Error('No class looks are defined');
  return look;
}

/** The look for a class id, falling back to the Field Tripper's. */
export function classLook(classId: string): ClassLook {
  return CLASS_LOOKS.find((candidate) => candidate.id === classId) ?? fallbackLook();
}

export function classLookIds(): string[] {
  return CLASS_LOOKS.map((look) => look.id);
}

export function playerTextureKey(classId: string, dir: FacingDir, frame: number): string {
  return `player-${classLook(classId).id}-${dir}-${frame}`;
}

export function playerAnimKey(classId: string, dir: FacingDir): string {
  return `walk-${classLook(classId).id}-${dir}`;
}

/** True when the class has its own art rather than the fallback. */
export function hasOwnLook(classId: string): boolean {
  return CLASS_LOOKS.some((candidate) => candidate.id === classId);
}

/** Exposed for tests: every decor colour must exist in the locked palette. */
export function lookColors(look: ClassLook): PaletteName[] {
  const names = new Set<PaletteName>(Object.values(look.colors));
  for (const pixels of Object.values(look.decor)) {
    for (const pixel of pixels ?? []) {
      const name = look.colors[pixel.ch];
      if (name) names.add(name);
    }
  }
  return [...names].filter((name) => name in PALETTE);
}
