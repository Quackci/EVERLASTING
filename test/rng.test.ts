import { describe, expect, it } from 'vitest';
import { createRng, createSeededRng, weightedPick } from '../src/game/core/rng';

describe('seeded rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const first = Array.from({ length: 50 }, () => a.next());
    const second = Array.from({ length: 50 }, () => b.next());
    expect(first).toEqual(second);
  });

  it('produces different streams for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(Array.from({ length: 10 }, () => a.next())).not.toEqual(Array.from({ length: 10 }, () => b.next()));
  });

  it('stays inside [0, 1)', () => {
    const rng = createSeededRng('everlasting');
    for (let i = 0; i < 5000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('forks independent but reproducible streams', () => {
    const parent = createRng(99);
    const first = parent.fork('combat');
    const second = parent.fork('loot');
    expect(first.seed).not.toBe(second.seed);
    const again = createRng(99).fork('combat');
    expect(Array.from({ length: 20 }, () => first.next())).toEqual(Array.from({ length: 20 }, () => again.next()));
  });

  it('picks only valid entries and throws on empty input', () => {
    const rng = createRng(7);
    expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']));
    expect(() => rng.pick([])).toThrow(/empty/);
  });

  it('shuffles without losing or duplicating entries', () => {
    const rng = createRng(31);
    const source = Array.from({ length: 40 }, (_, index) => index);
    const shuffled = rng.shuffle(source);
    expect(shuffled).toHaveLength(source.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(source);
  });

  it('respects weights in weightedPick', () => {
    const rng = createRng(5);
    const rolls = Array.from({ length: 4000 }, () =>
      weightedPick(rng, [
        { value: 'common', weight: 90 },
        { value: 'rare', weight: 10 },
      ]),
    );
    const rare = rolls.filter((value) => value === 'rare').length;
    expect(rare).toBeGreaterThan(250);
    expect(rare).toBeLessThan(550);
  });
});
