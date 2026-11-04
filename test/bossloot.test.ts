import { describe, expect, it } from 'vitest';
import { BALANCE, ITEMS } from '../src/game/content';
import { createRng } from '../src/game/core/rng';
import { RARITY_BY_TIER, bossLootTier, rollBossLoot } from '../src/game/systems/loot';

describe('boss loot tier', () => {
  it('starts at the bottom and climbs with the stage', () => {
    expect(bossLootTier(1, BALANCE)).toBe(1);
    const tiers: number[] = [];
    for (let floor = 1; floor <= 10; floor += 1) tiers.push(bossLootTier(floor, BALANCE));
    for (let index = 1; index < tiers.length; index += 1) {
      expect(tiers[index]!).toBeGreaterThanOrEqual(tiers[index - 1]!);
    }
    expect(bossLootTier(10, BALANCE)).toBeGreaterThan(bossLootTier(1, BALANCE));
  });

  it('never asks for a tier the content does not have', () => {
    for (const floor of [0, 1, 5, 9, 10, 50]) {
      const tier = bossLootTier(floor, BALANCE);
      expect(tier).toBeGreaterThanOrEqual(1);
      expect(tier).toBeLessThanOrEqual(5);
      expect(RARITY_BY_TIER[tier]).toBeDefined();
    }
  });
});

describe('boss loot roll', () => {
  it('always hands over a weapon of the stage band', () => {
    const rng = createRng(2026);
    for (let floor = 1; floor <= 10; floor += 1) {
      const loot = rollBossLoot(rng, floor, BALANCE, ITEMS);
      expect(loot.tier).toBe(bossLootTier(floor, BALANCE));
      expect(loot.items.length).toBeGreaterThanOrEqual(1);
      expect(loot.items.length).toBeLessThanOrEqual(BALANCE.loot.boss.itemsMax);
      expect(loot.items.some((item) => item.kind === 'weapon')).toBe(true);
      expect(RARITY_BY_TIER[loot.tier]).toBe(loot.rarity);
    }
  });

  it('never repeats an item inside one drop', () => {
    const rng = createRng(91);
    for (let floor = 1; floor <= 10; floor += 1) {
      const ids = rollBossLoot(rng, floor, BALANCE, ITEMS).items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('is deterministic for a seed', () => {
    const first = rollBossLoot(createRng(5), 7, BALANCE, ITEMS);
    const second = rollBossLoot(createRng(5), 7, BALANCE, ITEMS);
    expect(second.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
    expect(second.tier).toBe(first.tier);
  });

  it('survives an empty item pool instead of throwing', () => {
    const loot = rollBossLoot(createRng(3), 4, BALANCE, []);
    expect(loot.items).toEqual([]);
    expect(loot.tier).toBe(bossLootTier(4, BALANCE));
  });
});
