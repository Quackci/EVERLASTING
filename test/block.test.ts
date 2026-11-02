import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/game/content';
import { resolveBlock } from '../src/game/systems/combat';
import { shouldAggroInRoom, shouldDisengageRoom } from '../src/game/systems/enemy';

describe('block and parry', () => {
  it('negates a hit inside the parry window', () => {
    const outcome = resolveBlock(20, 0, BALANCE);
    expect(outcome.parried).toBe(true);
    expect(outcome.damage).toBe(0);
  });

  it('still parries exactly on the window edge', () => {
    const outcome = resolveBlock(20, BALANCE.combat.parryWindowMs, BALANCE);
    expect(outcome.parried).toBe(true);
    expect(outcome.damage).toBe(0);
  });

  it('only reduces damage once the window has closed', () => {
    const incoming = 40;
    const outcome = resolveBlock(incoming, BALANCE.combat.parryWindowMs + 1, BALANCE);
    expect(outcome.parried).toBe(false);
    expect(outcome.blocked).toBe(true);
    expect(outcome.damage).toBe(
      Math.round(incoming * (1 - BALANCE.combat.blockDamageReduction)),
    );
    expect(outcome.damage).toBeGreaterThan(0);
    expect(outcome.damage).toBeLessThan(incoming);
  });

  it('never lets a block reduce a hit below the minimum damage', () => {
    const outcome = resolveBlock(1, BALANCE.combat.parryWindowMs + 500, BALANCE);
    expect(outcome.damage).toBe(BALANCE.combat.minDamage);
  });

  it('passes the hit through untouched when no block is up', () => {
    const outcome = resolveBlock(17, -1, BALANCE);
    expect(outcome.blocked).toBe(false);
    expect(outcome.parried).toBe(false);
    expect(outcome.damage).toBe(17);
  });

  it('keeps the parry window short enough to be a timing test', () => {
    expect(BALANCE.combat.parryWindowMs).toBeGreaterThan(0);
    expect(BALANCE.combat.parryWindowMs).toBeLessThanOrEqual(500);
  });
});

describe('room-scoped aggro', () => {
  const radius = BALANCE.combat.enemyAlertRadius;

  it('wakes an enemy only when the player is in its room and close', () => {
    expect(shouldAggroInRoom(3, 3, 40, radius)).toBe(true);
    expect(shouldAggroInRoom(3, 4, 40, radius)).toBe(false);
    expect(shouldAggroInRoom(3, 3, radius + 1, radius)).toBe(false);
  });

  it('treats a corridor as nobody\'s room', () => {
    expect(shouldAggroInRoom(null, 3, 10, radius)).toBe(false);
  });

  it('disengages as soon as the player leaves the room', () => {
    expect(shouldDisengageRoom(3, 3)).toBe(false);
    expect(shouldDisengageRoom(4, 3)).toBe(true);
    expect(shouldDisengageRoom(null, 3)).toBe(true);
  });
});
