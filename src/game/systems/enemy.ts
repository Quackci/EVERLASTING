/**
 * Pure enemy rules: stat scaling, aggro, projectile aim and rewards. No Phaser
 * imports, so the balance harness and unit tests use exactly the numbers the
 * game runs on.
 */
import type { Balance, EnemyDef } from '../content/types';
import type { Rng } from '../core/rng';

/** Every enemy wind-up must stay readable; the validator enforces the same floor. */
export const MIN_WINDUP_MS = 300;

export interface ScaledEnemyStats {
  hp: number;
  damage: number;
  speed: number;
  armor: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Applies per-floor growth to an enemy definition. Growth is linear and
 * additive per floor rather than compounding, so floor 10 does not become a
 * wall of bullet sponges.
 */
export interface EnemyDifficultyModifiers {
  hpMultiplier?: number;
  damageMultiplier?: number;
  speedMultiplier?: number;
}

export function scaleEnemyStats(
  def: EnemyDef,
  floor: number,
  balance: Balance,
  elite = false,
  difficulty: EnemyDifficultyModifiers = {},
): ScaledEnemyStats {
  const growth = Math.max(0, floor - 1);
  const scaling = balance.enemyScaling;
  const hpMultiplier = (1 + growth * scaling.hpGrowthPerFloor) * (difficulty.hpMultiplier ?? 1);
  const damageMultiplier =
    (1 + growth * scaling.damageGrowthPerFloor) * (difficulty.damageMultiplier ?? 1);
  const speedMultiplier = Math.min(
    scaling.speedCap,
    (1 + growth * scaling.speedGrowthPerFloor) * (difficulty.speedMultiplier ?? 1),
  );
  const eliteHp = elite ? scaling.eliteHpMultiplier : 1;
  const eliteDamage = elite ? scaling.eliteDamageMultiplier : 1;

  return {
    hp: Math.max(1, Math.round(def.hp * hpMultiplier * eliteHp)),
    damage: Math.max(1, Math.round(def.damage * damageMultiplier * eliteDamage)),
    speed: Math.max(0, Math.round(def.speed * speedMultiplier)),
    armor: Math.max(0, Math.round((def.armor ?? 0) * (elite ? 1.5 : 1))),
  };
}

/** Clamps a definition's wind-up to the readability floor. */
export function windupMs(def: EnemyDef): number {
  return Math.max(MIN_WINDUP_MS, def.windupMs);
}

/** True once the player is inside the alert radius. */
export function aggroAt(distance: number, alertRadius: number): boolean {
  return distance <= alertRadius;
}

/**
 * Room-scoped aggro. An enemy only wakes when the player is in the same room as
 * it and close enough to notice: walking past a doorway must not pull the whole
 * floor. `null` means the player is in a corridor, which counts as nobody's
 * room.
 */
export function shouldAggroInRoom(
  playerRoomId: number | null,
  enemyRoomId: number,
  distance: number,
  alertRadius: number,
): boolean {
  if (playerRoomId === null || playerRoomId !== enemyRoomId) return false;
  return aggroAt(distance, alertRadius);
}

/** True once the player has left the enemy's room; the enemy then goes home. */
export function shouldDisengageRoom(playerRoomId: number | null, enemyRoomId: number): boolean {
  return playerRoomId !== enemyRoomId;
}

/** True when the player has dragged the enemy past its leash. */
export function shouldLeash(distance: number, leashRadius: number): boolean {
  return distance > leashRadius;
}

/** Unit-ish velocity towards a target, scaled to `speed`. Zero length yields rest. */
export function aimVector(from: Point, to: Point, speed: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 0, y: 0 };
  return { x: (dx / length) * speed, y: (dy / length) * speed };
}

/** Distance under which an enemy should stop closing and start swinging. */
export function preferredRange(def: EnemyDef): number {
  return def.attackRange * 0.8;
}

/** Projectile enemies keep their distance; melee enemies walk into yours. */
export function isRangedEnemy(def: EnemyDef): boolean {
  return def.behavior === 'ranged' || def.behavior === 'turret' || (def.projectileSpeed ?? 0) > 0;
}

/** Smarts awarded for a kill, by role. Deterministic through the passed rng. */
export function smartsDrop(def: EnemyDef, rng: Rng, balance: Balance): number {
  if (def.role === 'boss') return balance.smarts.bossDrop;
  if (def.role === 'elite') return rng.range(balance.smarts.eliteDropMin, balance.smarts.eliteDropMax);
  return rng.range(balance.smarts.enemyDropMin, balance.smarts.enemyDropMax);
}

/** How long a kill takes to fade out, purely presentational. */
export function deathFadeMs(role: EnemyDef['role']): number {
  if (role === 'boss') return 900;
  if (role === 'elite') return 500;
  return 260;
}

/** Knockback direction for a hit, always away from the attacker. */
export function knockbackVector(from: Point, target: Point, strength: number): Point {
  return aimVector(from, target, strength);
}
