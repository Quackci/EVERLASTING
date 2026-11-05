import { describe, expect, it } from 'vitest';
import {
  sigilHeadline,
  sigilPattern,
  sigilPrompt,
  sigilRetryHint,
  sigilRng,
} from '../src/game/systems/sigils';

describe('sigil runes', () => {
  it('keeps every rune inside the drawing bounds', () => {
    for (let gate = 0; gate < 24; gate += 1) {
      const pattern = sigilPattern(4242, 3, gate, 26);
      expect(pattern.radius).toBe(26);
      expect(pattern.spokes).toBeGreaterThanOrEqual(3);
      expect(pattern.spokes).toBeLessThanOrEqual(7);
      expect(pattern.marks).toBeGreaterThanOrEqual(0);
      expect(pattern.marks).toBeLessThanOrEqual(6);
      expect(pattern.rotation).toBeGreaterThanOrEqual(0);
      expect(pattern.rotation).toBeLessThan(Math.PI * 2);
    }
  });

  it('draws the same rune for the same floor and gate', () => {
    expect(sigilPattern(99, 2, 1)).toEqual(sigilPattern(99, 2, 1));
  });

  it('does not give every gate on a floor the same rune', () => {
    const runes = [0, 1, 2, 3, 4].map((gate) => JSON.stringify(sigilPattern(99, 2, gate)));
    expect(new Set(runes).size).toBeGreaterThan(1);
  });

  it('separates the random channels by floor and by gate', () => {
    const first = sigilRng(7, 4, 0).next();
    expect(sigilRng(7, 4, 0).next()).toBe(first);
    expect(sigilRng(7, 4, 1).next()).not.toBe(first);
    expect(sigilRng(7, 5, 0).next()).not.toBe(first);
  });

  it('clamps a nonsense radius instead of drawing nothing', () => {
    expect(sigilPattern(1, 1, 1, 0).radius).toBe(6);
  });

  it('words the prompt and the retry without promising a free door', () => {
    expect(sigilPrompt(false, 'E')).toContain('E');
    expect(sigilPrompt(false, 'E')).toContain('SIGIL');
    expect(sigilPrompt(true, 'E')).not.toContain('READ');
    expect(sigilHeadline(true)).toContain('OPENS');
    expect(sigilHeadline(false)).toContain('DARK');
    expect(sigilRetryHint(false)).toContain('ANOTHER');
    expect(sigilRetryHint(true)).toContain('STEP THROUGH');
  });
});
