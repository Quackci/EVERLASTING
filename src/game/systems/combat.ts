/**
 * Pure damage math and perk aggregation. No Phaser imports: the balance harness
 * and unit tests exercise exactly the same numbers the game uses.
 */
import type { Balance, ItemDef, PerkDef, PerkEffects, TrinketDef } from '../content/types';
import type { Rng } from '../core/rng';

export interface AggregatedEffects {
  damageMult: number;
  critChanceBonus: number;
  critMultBonus: number;
  armorPen: number;
  armorBonus: number;
  speedBonus: number;
  reachBonus: number;
  inkOnHit: number;
  pierce: number;
  rangedPierce: number;
  bonusVsStunned: number;
  damageVsFullHp: number;
  lowHpDamage: number;
  damageTakenBonus: number;
  knockbackBonus: number;
  chainPercent: number;
  chainRadius: number;
  splashChance: number;
  splashPercent: number;
  bleedStacks: number;
  bleedDamage: number;
  slowOnHit: number;
  debuffSeconds: number;
  killHaste: number;
  everyNthHitCrit: number;
  everyNthHitDouble: number;
  bonusQuestionChance: number;
  enemyAccuracyDown: number;
  streakDamage: number;
  smartsOnKill: number;
  auraSlow: number;
  resistChemical: number;
  critBleed: boolean;
  throwsTwice: boolean;
  dodgeDust: boolean;
  firstHitAfterWrongBonus: number;
}

const EMPTY: AggregatedEffects = {
  damageMult: 0,
  critChanceBonus: 0,
  critMultBonus: 0,
  armorPen: 0,
  armorBonus: 0,
  speedBonus: 0,
  reachBonus: 0,
  inkOnHit: 0,
  pierce: 0,
  rangedPierce: 0,
  bonusVsStunned: 0,
  damageVsFullHp: 0,
  lowHpDamage: 0,
  damageTakenBonus: 0,
  knockbackBonus: 0,
  chainPercent: 0,
  chainRadius: 0,
  splashChance: 0,
  splashPercent: 0,
  bleedStacks: 0,
  bleedDamage: 0,
  slowOnHit: 0,
  debuffSeconds: 0,
  killHaste: 0,
  everyNthHitCrit: 0,
  everyNthHitDouble: 0,
  bonusQuestionChance: 0,
  enemyAccuracyDown: 0,
  streakDamage: 0,
  smartsOnKill: 0,
  auraSlow: 0,
  resistChemical: 0,
  critBleed: false,
  throwsTwice: false,
  dodgeDust: false,
  firstHitAfterWrongBonus: 0,
};

function addEffects(target: AggregatedEffects, effects: PerkEffects): void {
  target.damageMult += effects.damageMult ?? 0;
  target.critChanceBonus += effects.critChanceBonus ?? 0;
  target.critMultBonus += effects.critMultBonus ?? 0;
  target.armorPen += effects.armorPen ?? 0;
  target.armorBonus += effects.armorBonus ?? 0;
  target.speedBonus += effects.speedBonus ?? 0;
  target.reachBonus += effects.reachBonus ?? 0;
  target.inkOnHit += effects.inkOnHit ?? 0;
  target.pierce += effects.pierce ?? 0;
  target.rangedPierce += effects.rangedPierce ?? 0;
  target.bonusVsStunned += effects.bonusVsStunned ?? 0;
  target.damageVsFullHp += effects.damageVsFullHp ?? 0;
  target.lowHpDamage += effects.lowHpDamage ?? 0;
  target.damageTakenBonus += effects.damageTakenBonus ?? 0;
  target.knockbackBonus += effects.knockbackBonus ?? 0;
  target.chainPercent += effects.chainPercent ?? 0;
  target.chainRadius = Math.max(target.chainRadius, effects.chainRadius ?? 0);
  target.splashChance += effects.splashChance ?? 0;
  target.splashPercent += effects.splashPercent ?? 0;
  target.bleedStacks = Math.max(target.bleedStacks, effects.bleedStacks ?? 0);
  target.bleedDamage = Math.max(target.bleedDamage, effects.bleedDamage ?? 0);
  target.slowOnHit = Math.max(target.slowOnHit, effects.slowOnHit ?? 0);
  target.debuffSeconds = Math.max(target.debuffSeconds, effects.debuffSeconds ?? 0);
  target.killHaste = Math.max(target.killHaste, effects.killHaste ?? 0);
  target.everyNthHitCrit = Math.max(target.everyNthHitCrit, effects.everyNthHitCrit ?? 0);
  target.everyNthHitDouble = Math.max(target.everyNthHitDouble, effects.everyNthHitDouble ?? 0);
  target.bonusQuestionChance += effects.bonusQuestionChance ?? 0;
  target.enemyAccuracyDown = Math.max(target.enemyAccuracyDown, effects.enemyAccuracyDown ?? 0);
  target.streakDamage += effects.streakDamage ?? 0;
  target.smartsOnKill += effects.smartsOnKill ?? 0;
  target.auraSlow = Math.max(target.auraSlow, effects.auraSlow ?? 0);
  target.resistChemical += effects.resistChemical ?? 0;
  target.critBleed = target.critBleed || effects.critBleed === true;
  target.throwsTwice = target.throwsTwice || effects.throwsTwice === true;
  target.dodgeDust = target.dodgeDust || effects.dodgeDust === true;
  target.firstHitAfterWrongBonus = Math.max(target.firstHitAfterWrongBonus, effects.firstHitAfterWrongBonus ?? 0);
}

export function aggregatePerkEffects(perkIds: readonly string[], perkIndex: ReadonlyMap<string, PerkDef>): AggregatedEffects {
  const total: AggregatedEffects = { ...EMPTY };
  for (const id of perkIds) {
    const perk = perkIndex.get(id);
    if (perk) addEffects(total, perk.effects);
  }
  return total;
}

export function aggregateTrinketEffects(
  trinkets: readonly TrinketDef[],
  base: AggregatedEffects = { ...EMPTY },
): AggregatedEffects {
  const total: AggregatedEffects = { ...base };
  for (const trinket of trinkets) {
    const effects = trinket.effects;
    total.critChanceBonus += effects.critChanceBonus ?? 0;
    total.damageMult += effects.damageMult ?? 0;
    total.smartsOnKill += effects.smartsOnKill ?? 0;
    total.inkOnHit += effects.inkOnHit ?? 0;
  }
  return total;
}

export interface DamageContext {
  baseDamage: number;
  effects: AggregatedEffects;
  globalMult: number;
  flatBonus: number;
  targetArmor: number;
  targetResist: number;
  isRanged: boolean;
  targetStunned: boolean;
  targetAtFullHp: boolean;
  attackerHpPct: number;
  streak: number;
  firstHitAfterWrong: boolean;
  critRoll: number;
  critChance: number;
  armorScale: number;
  minDamage: number;
  forcedCrit?: boolean;
}

export interface DamageResult {
  amount: number;
  crit: boolean;
  absorbed: number;
  resisted: number;
  appliedBleed: boolean;
  appliedSlow: boolean;
  splash: number;
  knockback: number;
}

export function computeDamage(context: DamageContext): DamageResult {
  const effects = context.effects;
  let damage = Math.max(0, context.baseDamage + context.flatBonus);
  damage *= 1 + effects.damageMult + context.globalMult;

  const critChance = Math.min(0.95, Math.max(0, context.critChance + effects.critChanceBonus));
  const crit = context.forcedCrit === true || (critChance > 0 && context.critRoll < critChance);
  if (crit) {
    damage *= 1.5 + effects.critMultBonus;
  }
  if (context.targetStunned) damage *= 1 + effects.bonusVsStunned;
  if (context.targetAtFullHp) damage *= 1 + effects.damageVsFullHp;
  if (context.attackerHpPct < 0.35) damage *= 1 + effects.lowHpDamage;
  if (context.firstHitAfterWrong) damage *= 1 + effects.firstHitAfterWrongBonus;

  const streakBonus = Math.min(5, Math.max(0, context.streak)) * effects.streakDamage;
  const absorbable = Math.min(damage * 0.8, Math.max(0, context.targetArmor * (1 - Math.min(0.9, effects.armorPen))));
  const absorbed = Math.min(absorbable, damage);
  const afterArmor = damage - absorbed;
  const resist = Math.min(0.9, Math.max(0, context.targetResist));
  const resisted = afterArmor * resist;
  const amount = Math.max(
    context.minDamage,
    Math.round((afterArmor - resisted + streakBonus) * (crit ? 1 : 1)),
  );

  return {
    amount,
    crit,
    absorbed: Math.round(absorbed),
    resisted: Math.round(resisted),
    appliedBleed: effects.bleedStacks > 0,
    appliedSlow: effects.slowOnHit > 0,
    splash: Math.round(amount * effects.splashPercent),
    knockback: 90 * (1 + effects.knockbackBonus),
  };
}

/** True when this hit index triggers a guaranteed crit (Triple Point and friends). */
export function isGuaranteedCrit(hitIndex: number, effects: AggregatedEffects): boolean {
  return effects.everyNthHitCrit > 0 && hitIndex > 0 && hitIndex % effects.everyNthHitCrit === 0;
}

export function critChanceOf(item: ItemDef, effects: AggregatedEffects): number {
  return Math.min(0.95, Math.max(0, item.critChance + effects.critChanceBonus));
}

export function attackSpeedOf(item: ItemDef, effects: AggregatedEffects): number {
  return Math.max(0.2, item.speed * (1 + effects.speedBonus));
}

export function reachOf(item: ItemDef, effects: AggregatedEffects): number {
  return item.reach + effects.reachBonus;
}

export function hitStopMsFor(crit: boolean, balance: Balance): number {
  return crit ? balance.combat.critHitStopMs : balance.combat.hitStopMs;
}

export function damageTakenMultiplier(effects: AggregatedEffects, damageType: string): number {
  let multiplier = 1 + effects.damageTakenBonus;
  if (damageType === 'chemical') multiplier *= 1 - Math.min(0.8, effects.resistChemical);
  return multiplier;
}

/** Rolls the optional perk procs for one landed hit. Deterministic via the passed rng. */
export interface HitProcs {
  chain: boolean;
  splash: boolean;
  bonusQuestion: boolean;
  doubleHit: boolean;
  bonusSmarts: number;
}

export function rollHitProcs(effects: AggregatedEffects, hitIndex: number, rng: Rng): HitProcs {
  return {
    chain: effects.chainPercent > 0 && rng.chance(0.25),
    splash: effects.splashChance > 0 && rng.chance(effects.splashChance),
    bonusQuestion: effects.bonusQuestionChance > 0 && rng.chance(effects.bonusQuestionChance),
    doubleHit: effects.everyNthHitDouble > 0 && hitIndex % effects.everyNthHitDouble === 0,
    bonusSmarts: effects.smartsOnKill,
  };
}

export function emptyEffects(): AggregatedEffects {
  return { ...EMPTY };
}

export interface BlockOutcome {
  damage: number;
  parried: boolean;
  blocked: boolean;
}

/**
 * Resolves an incoming hit against a raised block. A strike inside the parry
 * window is negated outright; a strike later in the hold is only reduced. The
 * window is measured from the moment the block was raised, which is what makes
 * the timing skill-testing instead of a permanent damage reduction.
 */
export function resolveBlock(damage: number, elapsedMs: number, balance: Balance): BlockOutcome {
  const cfg = balance.combat;
  if (elapsedMs < 0) {
    return { damage, parried: false, blocked: false };
  }
  if (elapsedMs <= cfg.parryWindowMs) {
    return { damage: 0, parried: true, blocked: true };
  }
  const reduction = Math.min(0.95, Math.max(0, cfg.blockDamageReduction));
  return {
    damage: Math.max(cfg.minDamage, Math.round(damage * (1 - reduction))),
    parried: false,
    blocked: true,
  };
}
