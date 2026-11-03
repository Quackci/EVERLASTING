import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/game/content';
import { applyHeal, healForPercent, killHealDue } from '../src/game/systems/recovery';

const RULES = BALANCE.recovery;

describe('recovery', () => {
  it('pays out every third kill and not before', () => {
    expect(killHealDue(1, RULES)).toBe(false);
    expect(killHealDue(2, RULES)).toBe(false);
    expect(killHealDue(3, RULES)).toBe(true);
    expect(killHealDue(6, RULES)).toBe(true);
    expect(killHealDue(9, RULES)).toBe(true);
  });

  it('treats a broken cadence as no healing', () => {
    expect(killHealDue(3, { ...RULES, killsPerHeal: 0 })).toBe(false);
    expect(killHealDue(3, { ...RULES, killsPerHeal: -2 })).toBe(false);
    expect(killHealDue(0, RULES)).toBe(false);
  });

  it('heals a fifth of the bar on a base student', () => {
    expect(healForPercent(100, RULES.killHealPercent)).toBe(20);
    expect(healForPercent(80, RULES.killHealPercent)).toBe(16);
    expect(healForPercent(135, RULES.killHealPercent)).toBe(27);
  });

  it('never rounds a heal down to nothing', () => {
    expect(healForPercent(3, 0.01)).toBe(1);
    expect(healForPercent(0, 0.2)).toBe(0);
    expect(healForPercent(100, 0)).toBe(0);
  });

  it('pays a tenth of the bar when a room is cleared', () => {
    expect(healForPercent(100, RULES.roomClearHealPercent)).toBe(10);
    expect(healForPercent(135, RULES.roomClearHealPercent)).toBe(14);
  });

  it('clamps at the top of the bar and never subtracts', () => {
    expect(applyHeal(90, 100, 20)).toBe(100);
    expect(applyHeal(10, 100, 5)).toBe(15);
    expect(applyHeal(10, 100, -5)).toBe(10);
    expect(applyHeal(10, 100, 0)).toBe(10);
  });
});
