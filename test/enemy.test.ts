import { describe, expect, it } from 'vitest';
import { BALANCE, ENEMIES, ENEMY_BY_ID } from '../src/game/content';
import { createRng } from '../src/game/core/rng';
import {
  aggroAt,
  aimVector,
  isRangedEnemy,
  MIN_WINDUP_MS,
  preferredRange,
  scaleEnemyStats,
  shouldLeash,
  smartsDrop,
  windupMs,
} from '../src/game/systems/enemy';

function enemy(id: string) {
  const def = ENEMY_BY_ID.get(id);
  if (!def) throw new Error(`Missing enemy ${id}`);
  return def;
}

describe('enemy scaling', () => {
  it('uses the definition unchanged on floor 1', () => {
    const def = enemy('detention_slip');
    const stats = scaleEnemyStats(def, 1, BALANCE);
    expect(stats.hp).toBe(def.hp);
    expect(stats.damage).toBe(def.damage);
    expect(stats.speed).toBe(def.speed);
  });

  it('grows hp and damage with floor depth', () => {
    const def = enemy('homework_golem');
    const floor1 = scaleEnemyStats(def, 1, BALANCE);
    const floor5 = scaleEnemyStats(def, 5, BALANCE);
    const floor10 = scaleEnemyStats(def, 10, BALANCE);
    expect(floor5.hp).toBeGreaterThan(floor1.hp);
    expect(floor10.hp).toBeGreaterThan(floor5.hp);
    expect(floor10.damage).toBeGreaterThan(floor5.damage);
  });

  it('matches the documented growth formula', () => {
    const def = enemy('bully');
    const floor = 6;
    const stats = scaleEnemyStats(def, floor, BALANCE);
    const expected = Math.round(def.hp * (1 + (floor - 1) * BALANCE.enemyScaling.hpGrowthPerFloor));
    expect(stats.hp).toBe(expected);
  });

  it('speeds enemies up with depth but never past the cap', () => {
    const def = enemy('gym_sock_sprite');
    const floor1 = scaleEnemyStats(def, 1, BALANCE);
    const floor10 = scaleEnemyStats(def, 10, BALANCE);
    expect(floor10.speed).toBeGreaterThan(floor1.speed);
    expect(floor10.speed).toBeLessThanOrEqual(Math.round(def.speed * BALANCE.enemyScaling.speedCap));
  });

  it('clamps a fast definition to the configured speed cap', () => {
    const def = { ...enemy('gym_sock_sprite'), speed: 400 };
    const scaling = BALANCE.enemyScaling;
    // Deep enough for linear growth to overshoot the cap, so the clamp is exercised.
    const floor = 13;
    const multiplier = Math.min(scaling.speedCap, 1 + (floor - 1) * scaling.speedGrowthPerFloor);
    const stats = scaleEnemyStats(def, floor, BALANCE);
    expect(multiplier).toBe(scaling.speedCap);
    expect(stats.speed).toBe(Math.round(400 * scaling.speedCap));
  });

  it('applies elite multipliers on top of floor growth', () => {
    const def = enemy('the_janitor');
    const normal = scaleEnemyStats(def, 3, BALANCE, false);
    const elite = scaleEnemyStats(def, 3, BALANCE, true);
    expect(elite.hp).toBeGreaterThan(normal.hp);
    expect(elite.damage).toBeGreaterThan(normal.damage);
    expect(elite.armor).toBeGreaterThanOrEqual(normal.armor);
  });

  it('never scales below a single point of damage', () => {
    const def = { ...enemy('detention_slip'), damage: 0, hp: 0 };
    const stats = scaleEnemyStats(def, 1, BALANCE);
    expect(stats.damage).toBeGreaterThanOrEqual(1);
    expect(stats.hp).toBeGreaterThanOrEqual(1);
  });
});

describe('enemy readability', () => {
  it('keeps every wind-up at or above the readability floor', () => {
    for (const def of ENEMIES) {
      expect(windupMs(def)).toBeGreaterThanOrEqual(MIN_WINDUP_MS);
    }
  });

  it('raises a too-short wind-up to the floor instead of trusting content', () => {
    const def = { ...enemy('detention_slip'), windupMs: 80 };
    expect(windupMs(def)).toBe(MIN_WINDUP_MS);
  });

  it('leaves already-readable wind-ups untouched', () => {
    const def = { ...enemy('detention_slip'), windupMs: 420 };
    expect(windupMs(def)).toBe(420);
  });
});

describe('enemy behaviour helpers', () => {
  it('aggros inside the radius and not outside it', () => {
    expect(aggroAt(10, BALANCE.combat.enemyAlertRadius)).toBe(true);
    expect(aggroAt(BALANCE.combat.enemyAlertRadius, BALANCE.combat.enemyAlertRadius)).toBe(true);
    expect(aggroAt(BALANCE.combat.enemyAlertRadius + 1, BALANCE.combat.enemyAlertRadius)).toBe(false);
  });

  it('leashes only past the leash radius', () => {
    expect(shouldLeash(BALANCE.combat.enemyLeashRadius, BALANCE.combat.enemyLeashRadius)).toBe(false);
    expect(shouldLeash(BALANCE.combat.enemyLeashRadius + 20, BALANCE.combat.enemyLeashRadius)).toBe(true);
  });

  it('stops closing at 80% of attack range', () => {
    const def = enemy('homework_golem');
    expect(preferredRange(def)).toBeCloseTo(def.attackRange * 0.8);
  });

  it('detects projectile enemies from behaviour or projectile speed', () => {
    expect(isRangedEnemy(enemy('paper_airplane_swarm'))).toBe(true);
    expect(isRangedEnemy(enemy('rogue_vending_machine'))).toBe(true);
    expect(isRangedEnemy(enemy('bully'))).toBe(false);
  });

  it('aims at a fixed speed regardless of distance', () => {
    const near = aimVector({ x: 0, y: 0 }, { x: 3, y: 4 }, 100);
    const far = aimVector({ x: 0, y: 0 }, { x: 30, y: 40 }, 100);
    expect(Math.hypot(near.x, near.y)).toBeCloseTo(100);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(100);
    expect(near.x).toBeCloseTo(far.x);
    expect(near.y).toBeCloseTo(far.y);
  });

  it('returns rest for a zero-length aim', () => {
    expect(aimVector({ x: 5, y: 5 }, { x: 5, y: 5 }, 120)).toEqual({ x: 0, y: 0 });
  });
});

describe('enemy rewards', () => {
  it('pays the fixed boss reward', () => {
    const rng = createRng(1);
    expect(smartsDrop(enemy('the_principal'), rng, BALANCE)).toBe(BALANCE.smarts.bossDrop);
  });

  it('keeps normal drops inside the configured band', () => {
    const rng = createRng(99);
    for (let i = 0; i < 50; i += 1) {
      const drop = smartsDrop(enemy('detention_slip'), rng, BALANCE);
      expect(drop).toBeGreaterThanOrEqual(BALANCE.smarts.enemyDropMin);
      expect(drop).toBeLessThanOrEqual(BALANCE.smarts.enemyDropMax);
    }
  });

  it('keeps elite drops inside the configured band', () => {
    const rng = createRng(1234);
    for (let i = 0; i < 50; i += 1) {
      const drop = smartsDrop(enemy('vice_principal'), rng, BALANCE);
      expect(drop).toBeGreaterThanOrEqual(BALANCE.smarts.eliteDropMin);
      expect(drop).toBeLessThanOrEqual(BALANCE.smarts.eliteDropMax);
    }
  });

  it('is deterministic for a given seed', () => {
    const first = smartsDrop(enemy('bully'), createRng(42), BALANCE);
    const second = smartsDrop(enemy('bully'), createRng(42), BALANCE);
    expect(first).toBe(second);
  });
});
