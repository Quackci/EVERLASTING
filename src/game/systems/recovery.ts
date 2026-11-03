/**
 * Health recovery rules.
 *
 * Pure functions with no Phaser imports: the scene supplies the state and the
 * numbers come from `balance.json`, so the cadence and rounding stay testable.
 */
export interface RecoveryRules {
  killsPerHeal: number;
  killHealPercent: number;
  roomClearHealPercent: number;
}

/** Percent of max HP, rounded, and never below a single point. */
export function healForPercent(maxHp: number, percent: number): number {
  if (!Number.isFinite(maxHp) || maxHp <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.max(1, Math.round(maxHp * percent));
}

/** True when this kill completes a batch and pays out. */
export function killHealDue(kills: number, rules: RecoveryRules): boolean {
  const cadence = Math.floor(rules.killsPerHeal);
  if (!Number.isFinite(cadence) || cadence < 1) return false;
  if (!Number.isFinite(kills) || kills < 1) return false;
  return kills % cadence === 0;
}

/** Applying a heal never takes HP away and never overfills the bar. */
export function applyHeal(hp: number, maxHp: number, amount: number): number {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 0;
  if (!Number.isFinite(amount) || amount <= 0) return Math.min(hp, maxHp);
  return Math.max(0, Math.min(maxHp, hp + amount));
}
