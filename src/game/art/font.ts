/**
 * Original 5x7 bitmap font, generated in code. No system font is ever loaded,
 * which keeps text identical on every OS and matches the locked palette.
 * Each glyph row is a 5-bit mask (bit 4 = leftmost pixel).
 */

const GLYPHS: Record<string, readonly number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [15, 16, 16, 16, 16, 16, 15],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 31, 16, 16, 31],
  F: [31, 16, 16, 31, 16, 16, 16],
  G: [15, 16, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [31, 4, 4, 4, 4, 4, 31],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  "'": [4, 4, 0, 0, 0, 0, 0],
  '"': [10, 10, 0, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '/': [1, 1, 2, 4, 8, 16, 16],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '%': [17, 1, 2, 4, 8, 16, 17],
  '#': [10, 31, 10, 10, 31, 10, 0],
  '*': [0, 21, 14, 31, 14, 10, 0],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '<': [2, 4, 8, 16, 8, 4, 2],
  '>': [16, 8, 4, 2, 4, 8, 16],
  _: [0, 0, 0, 0, 0, 0, 31],
  '°': [6, 10, 12, 0, 0, 0, 0],
};

export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;
export const GLYPH_SPACING = 1;
export const LINE_SPACING = 2;

const FALLBACK = GLYPHS['?'] as readonly number[];

export function glyphFor(character: string): readonly number[] {
  return GLYPHS[character.toUpperCase()] ?? FALLBACK;
}

export function hasGlyph(character: string): boolean {
  return GLYPHS[character.toUpperCase()] !== undefined;
}

export function measureText(text: string, scale = 1): number {
  const longest = text.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
  if (longest === 0) return 0;
  return longest * (GLYPH_WIDTH + GLYPH_SPACING) * scale - GLYPH_SPACING * scale;
}

export function textHeight(text: string, scale = 1): number {
  const lines = text.split('\n').length;
  return lines * GLYPH_HEIGHT * scale + (lines - 1) * LINE_SPACING * scale;
}

export interface TextRaster {
  width: number;
  height: number;
  /** One byte per pixel: 0 = transparent, 1 = opaque. */
  pixels: Uint8Array;
}

/** Rasterises text into a plain pixel mask; rendering into a canvas happens elsewhere. */
export function rasterizeText(text: string, scale = 1): TextRaster {
  const upper = text.toUpperCase();
  const lines = upper.split('\n');
  const width = Math.max(1, measureText(upper, scale));
  const height = Math.max(1, textHeight(upper, scale));
  const pixels = new Uint8Array(width * height);

  let cursorY = 0;
  for (const line of lines) {
    let cursorX = 0;
    for (const character of line) {
      const rows = glyphFor(character);
      for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
        const mask = rows[row] ?? 0;
        for (let column = 0; column < GLYPH_WIDTH; column += 1) {
          const bit = (mask >> (GLYPH_WIDTH - 1 - column)) & 1;
          if (!bit) continue;
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) {
              const px = cursorX + column * scale + sx;
              const py = cursorY + row * scale + sy;
              if (px >= 0 && py >= 0 && px < width && py < height) {
                pixels[py * width + px] = 1;
              }
            }
          }
        }
      }
      cursorX += (GLYPH_WIDTH + GLYPH_SPACING) * scale;
    }
    cursorY += (GLYPH_HEIGHT + LINE_SPACING) * scale;
  }

  return { width, height, pixels };
}

/** Greedy word wrap measured in the bitmap font's units. */
export function wrapText(text: string, maxWidth: number, scale = 1): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (measureText(candidate, scale) <= maxWidth || current.length === 0) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

export const FONT_CHARACTERS = Object.keys(GLYPHS);
