import { describe, expect, it } from 'vitest';
import { BALANCE, PERKS } from '../src/game/content';
import type { PerkDef } from '../src/game/content/types';
import {
  aggregatePerkEffects,
  computeDamage,
  emptyEffects,
  isGuaranteedCrit,
  type DamageContext,
} from '../src/game/systems/combat';

const perkIndex: ReadonlyMap<string, PerkDef> = new Map(PERKS.map((perk) => [perk.id, perk]));

function context(overrides: Partial<DamageContext> = {}): DamageContext {
  return {
    baseDamage: 10,
    effects: emptyEffects(),
    globalMult: 0,
    flatBonus: 0,
    targetArmor: 0,
    targetResist: 0,
    isRanged: false,
    targetStunned: false,
    targetAtFullHp: false,
    attackerHpPct: 1,
    streak: 0,
    firstHitAfterWrong: false,
    critRoll: 0.99,
    critChance: 0,
    armorScale: BALANCE.combat.armorScale,
    minDamage: BALANCE.combat.minDamage,
    ...overrides,
  };
}

describe('damage math', () => {
  it('returns base damage with no modifiers', () => {
    expect(computeDamage(context()).amount).toBe(10);
  });

  it('subtracts armor but never below the minimum', () => {
    expect(computeDamage(context({ targetArmor: 4 })).amount).toBe(6);
    expect(computeDamage(context({ targetArmor: 999, baseDamage: 3 })).amount).toBe(BALANCE.combat.minDamage);
  });

  it('applies percentage resistance after armor', () => {
    const result = computeDamage(context({ targetArmor: 2, targetResist: 0.5 }));
    expect(result.amount).toBe(4);
    expect(result.resisted).toBe(4);
  });

  it('crits only when the roll is under the chance', () => {
    const crit = computeDamage(context({ critChance: 0.5, critRoll: 0.2 }));
    expect(crit.crit).toBe(true);
    expect(crit.amount).toBe(15);
    const normal = computeDamage(context({ critChance: 0.5, critRoll: 0.8 }));
    expect(normal.crit).toBe(false);
    expect(normal.amount).toBe(10);
  });

  it('applies the sharp_point crit multiplier bonus', () => {
    const effects = aggregatePerkEffects(['sharp_point'], perkIndex);
    const result = computeDamage(context({ effects, critChance: 1, critRoll: 0 }));
    expect(result.crit).toBe(true);
    expect(result.amount).toBe(18);
  });

  it('ignores a quarter of enemy armor with loose_leaf', () => {
    const effects = aggregatePerkEffects(['loose_leaf'], perkIndex);
    const result = computeDamage(context({ effects, targetArmor: 8 }));
    // 8 armor -> 6 effective, so 10 damage - 6 = 4.
    expect(result.amount).toBe(4);
  });

  it('adds stunned and full-HP bonuses', () => {
    const effects = aggregatePerkEffects(['detention', 'late_pass'], perkIndex);
    const result = computeDamage(context({ effects, targetStunned: true, targetAtFullHp: true }));
    expect(result.amount).toBe(16);
  });

  it('adds streak damage up to five stacks', () => {
    const effects = aggregatePerkEffects(['study_buddy'], perkIndex);
    expect(computeDamage(context({ effects, streak: 9 })).amount).toBe(15);
  });

  it('applies the correction bonus only after a wrong answer', () => {
    const effects = aggregatePerkEffects(['correction'], perkIndex);
    expect(computeDamage(context({ effects, firstHitAfterWrong: true })).amount).toBe(15);
    expect(computeDamage(context({ effects, firstHitAfterWrong: false })).amount).toBe(10);
  });

  it('makes every Nth hit a guaranteed crit', () => {
    const effects = aggregatePerkEffects(['triple_point'], perkIndex);
    expect(isGuaranteedCrit(3, effects)).toBe(true);
    expect(isGuaranteedCrit(6, effects)).toBe(true);
    expect(isGuaranteedCrit(4, effects)).toBe(false);
  });

  it('stacks effects from multiple perks', () => {
    const effects = aggregatePerkEffects(['lightweight', 'margin_notes', 'reinforced_spine'], perkIndex);
    expect(effects.speedBonus).toBeCloseTo(0.12);
    expect(effects.critChanceBonus).toBeCloseTo(0.08);
    expect(effects.armorBonus).toBe(3);
  });

  it('ignores unknown perk ids instead of crashing', () => {
    const effects = aggregatePerkEffects(['does_not_exist'], perkIndex);
    expect(effects).toEqual(emptyEffects());
  });

  it('reports splash and bleed flags from effects', () => {
    const effects = aggregatePerkEffects(['detonator', 'red_ink'], perkIndex);
    const result = computeDamage(context({ effects }));
    expect(result.appliedBleed).toBe(true);
    expect(result.splash).toBe(3);
  });
});
