import { describe, expect, it } from 'vitest';
import { BALANCE, ITEMS, QUESTIONS } from '../src/game/content';
import { createRng } from '../src/game/core/rng';
import {
  RARITY_ORDER,
  RARITY_TIER,
  itemsForTier,
  pickBonusQuestion,
  presentQuestion,
  rollChestLoot,
  rollRarity,
  upgradeItem,
  upgradeTarget,
  weightTableId,
} from '../src/game/systems/loot';

describe('loot rarity', () => {
  it('maps depth to the authored weight tables', () => {
    expect(weightTableId(1)).toBe('floor1');
    expect(weightTableId(4)).toBe('floor4');
    expect(weightTableId(7)).toBe('floor7');
    expect(weightTableId(10)).toBe('floor10');
    expect(weightTableId(11)).toBe('floor10');
  });

  it('only ever returns a real rarity', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i += 1) {
      expect(RARITY_ORDER).toContain(rollRarity(rng, 5, BALANCE));
    }
  });

  it('is deterministic for a seed', () => {
    expect(rollRarity(createRng(42), 6, BALANCE)).toBe(rollRarity(createRng(42), 6, BALANCE));
  });

  it('leans rarer when a container is lucky', () => {
    const plain = createRng(3);
    const lucky = createRng(3);
    let plainRare = 0;
    let luckyRare = 0;
    for (let i = 0; i < 400; i += 1) {
      if (rollRarity(plain, 1, BALANCE, 0) !== 'common') plainRare += 1;
      if (rollRarity(lucky, 1, BALANCE, 2.5) !== 'common') luckyRare += 1;
    }
    expect(luckyRare).toBeGreaterThan(plainRare);
  });
});

describe('container loot', () => {
  it('rolls the same contents for the same seed', () => {
    const first = rollChestLoot(createRng(11), { rarity: 'common' }, 1, BALANCE, ITEMS);
    const second = rollChestLoot(createRng(11), { rarity: 'common' }, 1, BALANCE, ITEMS);
    expect(second.rarity).toBe(first.rarity);
    expect(second.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
    expect(second.smarts).toBe(first.smarts);
  });

  it('always yields at least one item and smarts inside the band', () => {
    const rng = createRng(2026);
    for (let i = 0; i < 100; i += 1) {
      const loot = rollChestLoot(rng, { rarity: i % 3 === 0 ? 'rare' : 'common' }, 1 + (i % 10), BALANCE, ITEMS);
      expect(loot.items.length).toBeGreaterThan(0);
      expect(loot.items.length).toBeLessThanOrEqual(2);
      expect(loot.smarts).toBeGreaterThanOrEqual(BALANCE.smarts.chestMin);
      expect(loot.smarts).toBeLessThanOrEqual(BALANCE.smarts.chestMax);
      for (const item of loot.items) {
        expect(item.kind).toBe('weapon');
        expect(item.tier).toBeGreaterThanOrEqual(1);
        expect(item.tier).toBeLessThanOrEqual(5);
        // The item band matches the rolled rarity, or is the closest available tier.
        const exact = itemsForTier(RARITY_TIER[loot.rarity], ITEMS);
        expect(Math.abs(item.tier - RARITY_TIER[loot.rarity])).toBe(
          Math.abs((exact[0]?.tier ?? item.tier) - RARITY_TIER[loot.rarity]),
        );
      }
    }
  });

  it('never repeats the same item twice from one container', () => {
    const rng = createRng(9);
    for (let i = 0; i < 60; i += 1) {
      const loot = rollChestLoot(rng, { rarity: 'rare' }, 10, BALANCE, ITEMS);
      const ids = loot.items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('bonus question upgrade', () => {
  it('raises the tier and the weapon stats', () => {
    const pencil = ITEMS.find((item) => item.id === 'pencil');
    if (!pencil) throw new Error('missing pencil');
    const upgraded = upgradeItem(pencil);
    expect(upgraded.tier).toBe(pencil.tier + 1);
    expect(upgraded.damage).toBeGreaterThan(pencil.damage);
    expect(upgraded.durability).toBeGreaterThan(pencil.durability);
    expect(upgraded.value).toBeGreaterThan(pencil.value);
  });

  it('caps at tier five instead of inventing a sixth', () => {
    const top = ITEMS.find((item) => item.tier === 5);
    if (!top) throw new Error('missing tier five item');
    expect(upgradeItem(top).tier).toBe(5);
    expect(upgradeItem(upgradeItem(top)).tier).toBe(5);
  });

  it('upgrades the most valuable item found', () => {
    const [a, b] = ITEMS;
    if (!a || !b) throw new Error('missing items');
    const cheap = { ...a, value: 1 };
    const rich = { ...b, value: 99 };
    expect(upgradeTarget([cheap, rich])?.id).toBe(rich.id);
    expect(upgradeTarget([])).toBeNull();
  });

  it('picks a question from the requested subject when one exists', () => {
    const question = pickBonusQuestion(createRng(5), QUESTIONS, 'math');
    expect(question.subject).toBe('math');
  });

  it('falls back to the whole bank when a subject has no questions', () => {
    const question = pickBonusQuestion(createRng(5), QUESTIONS.slice(0, 3), 'science');
    expect(question).toBeDefined();
  });

  it('shuffles choices while keeping the right answer correct', () => {
    const base = QUESTIONS[0];
    if (!base) throw new Error('missing question');
    const presented = presentQuestion(createRng(77), base);
    expect(presented.choices[presented.answerIndex]).toBe(base.choices[base.answerIndex]);
    expect(presented.choices).toHaveLength(4);

    const positions = new Set<number>();
    for (let seed = 0; seed < 24; seed += 1) {
      positions.add(presentQuestion(createRng(seed), base).answerIndex);
    }
    expect(positions.size).toBeGreaterThan(1);
  });
});
