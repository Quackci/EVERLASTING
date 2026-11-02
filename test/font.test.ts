import { describe, expect, it } from 'vitest';
import {
  FONT_CHARACTERS,
  GLYPH_HEIGHT,
  hasGlyph,
  measureText,
  rasterizeText,
  textHeight,
  wrapText,
} from '../src/game/art/font';

describe('bitmap font', () => {
  it('has glyphs for every printable character the UI uses', () => {
    const sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 .,:;!?\'"-+/()%#*=<>_';
    for (const character of sample) {
      if (character === ' ') continue;
      expect(hasGlyph(character), character).toBe(true);
    }
  });

  it('rasterises to a mask with the expected dimensions', () => {
    const raster = rasterizeText('ABC', 1);
    expect(raster.width).toBe(measureText('ABC', 1));
    expect(raster.height).toBe(GLYPH_HEIGHT);
    expect(raster.pixels.some((value) => value === 1)).toBe(true);
  });

  it('scales the raster by the requested factor', () => {
    const small = rasterizeText('A', 1);
    const large = rasterizeText('A', 3);
    expect(large.width).toBe(small.width * 3);
    expect(large.height).toBe(small.height * 3);
  });

  it('measures multi-line text height', () => {
    expect(textHeight('A\nB', 1)).toBeGreaterThan(textHeight('A', 1));
  });

  it('wraps text without exceeding the requested width', () => {
    const lines = wrapText('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG', 80, 1);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, 1)).toBeLessThanOrEqual(80);
    }
    expect(lines.join(' ')).toBe('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG');
  });

  it('falls back to a visible glyph for unknown characters', () => {
    const raster = rasterizeText('\u2764', 1);
    expect(raster.pixels.some((value) => value === 1)).toBe(true);
  });

  it('exposes a stable glyph table', () => {
    expect(FONT_CHARACTERS.length).toBeGreaterThan(50);
    expect(new Set(FONT_CHARACTERS).size).toBe(FONT_CHARACTERS.length);
  });
});
