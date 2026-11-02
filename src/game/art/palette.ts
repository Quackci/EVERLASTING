/**
 * The one locked palette. Every sprite, tile, particle and UI panel in the game
 * samples from these 32 colours, which is what makes code-generated art read as
 * a single deliberate style instead of mixed placeholders.
 */

export const PALETTE = {
  void: '#0b0f12',
  ink900: '#11181f',
  ink800: '#1a2430',
  ink700: '#233040',
  ink600: '#2f4055',
  slate: '#3c5169',
  steel: '#4f6a86',
  chalk: '#a9c4a0',
  chalkLight: '#cfe3c0',
  bone: '#eef3e6',
  paper: '#f3ecd8',
  paperShade: '#d9cfb4',
  cork: '#8a6242',
  corkDark: '#654630',
  wood: '#a87c50',
  red: '#c8453f',
  redDark: '#8f2b30',
  redLight: '#e8736a',
  orange: '#d9853f',
  yellow: '#e7c65b',
  green: '#6fae5f',
  greenDark: '#417a45',
  teal: '#3f8f86',
  blue: '#4a76b8',
  blueDark: '#2c4a7d',
  purple: '#7b5aa6',
  pink: '#d97fa2',
  grey100: '#b9c0c4',
  grey300: '#8c949a',
  grey500: '#5f686f',
  grey700: '#3a4148',
  grey900: '#232a30',
} as const;

export type PaletteName = keyof typeof PALETTE;
export type PaletteHex = (typeof PALETTE)[PaletteName];

export const PALETTE_SIZE = Object.keys(PALETTE).length;
export const PALETTE_NAMES = Object.keys(PALETTE) as PaletteName[];

export function color(name: PaletteName): string {
  return PALETTE[name];
}

export function colorNumber(name: PaletteName): number {
  return Number.parseInt(PALETTE[name].slice(1), 16);
}

/** Single-character aliases used by the compact pixel-art maps. */
export const PIXEL_ALIASES: Record<string, PaletteName> = {
  '.': 'void',
  ' ': 'void',
  k: 'ink900',
  j: 'ink800',
  i: 'ink700',
  h: 'ink600',
  s: 'slate',
  S: 'steel',
  c: 'chalk',
  C: 'chalkLight',
  b: 'bone',
  p: 'paper',
  P: 'paperShade',
  o: 'cork',
  O: 'corkDark',
  w: 'wood',
  r: 'red',
  R: 'redDark',
  e: 'redLight',
  n: 'orange',
  y: 'yellow',
  g: 'green',
  G: 'greenDark',
  t: 'teal',
  u: 'blue',
  U: 'blueDark',
  v: 'purple',
  x: 'pink',
  a: 'grey100',
  d: 'grey300',
  f: 'grey500',
  F: 'grey700',
  z: 'grey900',
};

export function isTransparent(ch: string): boolean {
  return ch === '.' || ch === ' ';
}

export function resolveAlias(ch: string): PaletteHex {
  const name = PIXEL_ALIASES[ch];
  if (!name) {
    throw new Error(`Unknown palette alias "${ch}" in pixel art map`);
  }
  return PALETTE[name];
}
