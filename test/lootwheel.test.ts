import { describe, expect, it } from 'vitest';
import { BALANCE, ITEMS } from '../src/game/content';
import { PALETTE } from '../src/game/art/palette';
import { createRng } from '../src/game/core/rng';
import {
  RARITY_ACCENT,
  RARITY_ORDER,
  rollRewardChoices,
  runLevel,
  tierForRoll,
} from '../src/game/systems/loot';

function choicesFor(seed: number, floor = 1, level = 1) {
  return rollRewardChoices(createRng(seed).fork('loot-1'), floor, level, BALANCE, ITEMS);
}

describe('reward backpacks', () => {
  it('offers three choices by default', () => {
    expect(choicesFor(7)).toHaveLength(BALANCE.loot.choiceCount);
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const a = choicesFor(41);
    const b = choicesFor(41);
    expect(a.map((choice) => choice.rarity)).toEqual(b.map((choice) => choice.rarity));
    expect(a.map((choice) => choice.items.map((item) => item.id))).toEqual(
      b.map((choice) => choice.items.map((item) => item.id)),
    );
    const signatures = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        choicesFor(seed)
          .map((choice) => `${choice.rarity}:${choice.items.map((item) => item.id).join('+')}`)
          .join('|'),
      ),
    );
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('keeps up to the requested number of packs and never repeats a ring exactly', () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      const choices = choicesFor(seed, 3, 3);
      expect(choices).toHaveLength(3);
      expect(new Set(choices.map((choice) => choice.rarity)).size).toBeGreaterThan(1);
      for (const choice of choices) {
        expect(RARITY_ORDER).toContain(choice.rarity);
        expect(choice.items.length).toBeGreaterThan(0);
      }
    }
    expect(choicesFor(5).length).toBe(3);
  });

  it('scales item tiers with the floor and the run level', () => {
    expect(tierForRoll('common', 1, 1, BALANCE)).toBe(1);
    const shallow = tierForRoll('common', 1, 1, BALANCE);
    const deep = tierForRoll('common', 10, 1, BALANCE);
    const levelled = tierForRoll('common', 1, 9, BALANCE);
    expect(deep).toBeGreaterThan(shallow);
    expect(levelled).toBeGreaterThan(shallow);
    expect(tierForRoll('cursed', 10, 9, BALANCE)).toBe(5);
  });

  it('derives the run level from depth and learned skills only', () => {
    expect(runLevel(1, 0, BALANCE)).toBe(1);
    expect(runLevel(3, 0, BALANCE)).toBeGreaterThan(1);
    expect(runLevel(1, 4, BALANCE)).toBeGreaterThan(1);
    expect(runLevel(6, 4, BALANCE)).toBeGreaterThan(runLevel(3, 2, BALANCE));
  });

  it('rolls smarts inside the chest band for desks and none for bosses', () => {
    for (const choice of choicesFor(13, 4, 2)) {
      expect(choice.smarts).toBeGreaterThanOrEqual(BALANCE.smarts.chestMin);
      expect(choice.smarts).toBeLessThanOrEqual(BALANCE.smarts.chestMax);
    }
    const boss = rollRewardChoices(createRng(9).fork('loot-1'), 6, 4, BALANCE, ITEMS, { boss: true });
    expect(boss).toHaveLength(3);
    for (const choice of boss) {
      expect(choice.smarts).toBe(0);
      expect(choice.items.some((item) => item.kind === 'weapon')).toBe(true);
      expect(choice.items.length).toBeGreaterThanOrEqual(BALANCE.loot.boss.itemsMin);
    }
  });

  it('gives every rarity a locked-palette accent', () => {
    for (const rarity of RARITY_ORDER) {
      expect(PALETTE[RARITY_ACCENT[rarity]]).toBeDefined();
    }
    expect(new Set(RARITY_ORDER.map((rarity) => RARITY_ACCENT[rarity])).size).toBe(5);
  });
});
