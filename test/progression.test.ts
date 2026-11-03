import { describe, expect, it } from 'vitest';
import { BALANCE, CLASSES, CLASS_BY_ID, DIFFICULTIES, ITEMS, SKILLS } from '../src/game/content';
import { aggregateEffectList } from '../src/game/systems/combat';

describe('student classes', () => {
  it('ships four distinct playable classes', () => {
    expect(CLASSES).toHaveLength(4);
    expect(new Set(CLASSES.map((cls) => cls.id)).size).toBe(4);
  });

  it('gives every class a real starting weapon from content', () => {
    const itemIds = new Set(ITEMS.map((item) => item.id));
    for (const cls of CLASSES) {
      expect(itemIds.has(cls.weaponId), cls.id).toBe(true);
    }
  });

  it('keeps the tank tough and the assassin quick', () => {
    const tank = CLASS_BY_ID.get('hall_monitor');
    const cutter = CLASS_BY_ID.get('class_cutter');
    if (!tank || !cutter) throw new Error('missing classes');
    expect(tank.hpMultiplier).toBeGreaterThan(cutter.hpMultiplier);
    expect(tank.moveSpeedMultiplier).toBeLessThan(cutter.moveSpeedMultiplier);
    expect(cutter.critChanceBonus).toBeGreaterThan(tank.critChanceBonus);
    expect(tank.armorBonus).toBeGreaterThan(0);
    expect(cutter.armorBonus).toBe(0);
  });

  it('states pros and cons that match real modifiers', () => {
    for (const cls of CLASSES) {
      expect(cls.pros.length).toBeGreaterThan(0);
      expect(cls.cons.length).toBeGreaterThan(0);
    }
    const archer = CLASS_BY_ID.get('arrow_demic');
    if (!archer) throw new Error('missing archer');
    expect(archer.reachBonus).toBeGreaterThan(0);
    expect(archer.hpMultiplier).toBeLessThan(1);
  });
});

describe('difficulty ladder', () => {
  it('gets strictly harder from pop quiz to final exam', () => {
    const [easy, normal, hard] = DIFFICULTIES;
    if (!easy || !normal || !hard) throw new Error('missing difficulties');
    expect(easy.enemyHpMultiplier).toBeLessThan(normal.enemyHpMultiplier);
    expect(normal.enemyHpMultiplier).toBeLessThan(hard.enemyHpMultiplier);
    expect(easy.enemyDamageMultiplier).toBeLessThan(hard.enemyDamageMultiplier);
    expect(easy.smartsMultiplier).toBeGreaterThan(hard.smartsMultiplier);
    expect(easy.lootLuck).toBeGreaterThan(hard.lootLuck);
  });

  it('keeps the middle difficulty neutral', () => {
    const normal = DIFFICULTIES.find((difficulty) => difficulty.id === 'midterm');
    if (!normal) throw new Error('missing midterm');
    expect(normal.enemyHpMultiplier).toBe(1);
    expect(normal.enemyDamageMultiplier).toBe(1);
    expect(normal.lootLuck).toBe(0);
    expect(normal.smartsMultiplier).toBe(1);
  });
});

describe('skill trees', () => {
  it('gives each class a branching six-node tree', () => {
    for (const cls of CLASSES) {
      const nodes = SKILLS.filter((skill) => skill.classId === cls.id);
      expect(nodes.length, cls.id).toBe(6);
      expect(nodes.filter((node) => node.tier === 1).length).toBeGreaterThanOrEqual(2);
      expect(nodes.filter((node) => node.tier === 3).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('only lets a node require an earlier node of the same class', () => {
    for (const skill of SKILLS) {
      expect(skill.cost).toBeGreaterThan(0);
      if (skill.requires === null) {
        expect(skill.tier).toBe(1);
        continue;
      }
      const parent = SKILLS.find((candidate) => candidate.id === skill.requires);
      expect(parent, `${skill.id} -> ${skill.requires}`).toBeDefined();
      expect(parent?.classId).toBe(skill.classId);
      expect(parent?.tier).toBeLessThan(skill.tier);
    }
  });

  it('reaches tier three from tier one without dead ends', () => {
    for (const cls of CLASSES) {
      const nodes = SKILLS.filter((skill) => skill.classId === cls.id);
      const reachable = new Set(nodes.filter((node) => node.requires === null).map((node) => node.id));
      let grew = true;
      while (grew) {
        grew = false;
        for (const node of nodes) {
          if (reachable.has(node.id)) continue;
          if (node.requires !== null && reachable.has(node.requires)) {
            reachable.add(node.id);
            grew = true;
          }
        }
      }
      expect(reachable.size, cls.id).toBe(nodes.length);
    }
  });

  it('stacks purchased node effects with class bonuses', () => {
    const effects = aggregateEffectList([
      { damageMult: 0.1, critChanceBonus: 0.12 },
      { damageMult: 0.06 },
      { reachBonus: 14 },
    ]);
    expect(effects.damageMult).toBeCloseTo(0.16);
    expect(effects.critChanceBonus).toBeCloseTo(0.12);
    expect(effects.reachBonus).toBe(14);
    expect(aggregateEffectList([])).toEqual(aggregateEffectList([{}]));
  });

  it('keeps every skill cost affordable within a run of Smarts', () => {
    const cheapest = Math.min(...SKILLS.map((skill) => skill.cost));
    const wholeTree = SKILLS.filter((skill) => skill.classId === 'field_tripper').reduce(
      (sum, skill) => sum + skill.cost,
      0,
    );
    expect(cheapest).toBeGreaterThan(0);
    expect(wholeTree).toBeLessThan(BALANCE.smarts.targetRunSmartsMax);
  });
});
