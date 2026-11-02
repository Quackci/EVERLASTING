import { describe, expect, it } from 'vitest';
import { CONTENT, ROOMS } from '../src/game/content';
import { CONTENT_MINIMUMS, leadingNumber, validateContent } from '../src/game/content/validate';
import { SUBJECTS } from '../src/game/content/types';

describe('content bundle', () => {
  it('validates with zero issues', () => {
    expect(validateContent(CONTENT)).toEqual([]);
  });

  it('meets every ship-blocking content minimum', () => {
    expect(CONTENT.questions.length).toBeGreaterThanOrEqual(CONTENT_MINIMUMS.questions);
    expect(CONTENT.items.length).toBeGreaterThanOrEqual(CONTENT_MINIMUMS.items);
    expect(CONTENT.recipes.length).toBeGreaterThanOrEqual(CONTENT_MINIMUMS.recipes);
    expect(CONTENT.perks.length).toBeGreaterThanOrEqual(CONTENT_MINIMUMS.perks);
    expect(CONTENT.enemies.filter((e) => e.role === 'normal').length).toBeGreaterThanOrEqual(
      CONTENT_MINIMUMS.enemies,
    );
    expect(CONTENT.enemies.filter((e) => e.role !== 'normal').length).toBeGreaterThanOrEqual(
      CONTENT_MINIMUMS.elitesAndBosses,
    );
    expect(CONTENT.consumables.length).toBeGreaterThanOrEqual(CONTENT_MINIMUMS.consumables);
    expect(CONTENT.trinkets.length).toBeGreaterThanOrEqual(CONTENT_MINIMUMS.trinkets);
    expect(CONTENT.themes.length).toBeGreaterThanOrEqual(CONTENT_MINIMUMS.themes);
    for (const theme of CONTENT.themes) {
      const rooms = ROOMS.filter((room) => room.theme === theme.id);
      expect(rooms.length, `theme ${theme.id}`).toBeGreaterThanOrEqual(CONTENT_MINIMUMS.roomsPerTheme);
    }
  });

  it('covers all six subjects with at least ten questions each', () => {
    for (const subject of SUBJECTS) {
      const count = CONTENT.questions.filter((question) => question.subject === subject).length;
      expect(count, subject).toBeGreaterThanOrEqual(10);
    }
  });

  it('has a valid answer key for every question', () => {
    for (const question of CONTENT.questions) {
      expect(question.choices).toHaveLength(4);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(4);
      expect(question.choices[question.answerIndex]).toBeTruthy();
      expect(question.explanation.length).toBeGreaterThan(10);
    }
  });

  it('recomputes every numeric math answer instead of trusting the key', () => {
    const numeric = CONTENT.questions.filter((question) => question.verify !== undefined);
    expect(numeric.length).toBeGreaterThan(10);
    for (const question of numeric) {
      const choice = question.choices[question.answerIndex] ?? '';
      const parsed = leadingNumber(choice);
      expect(parsed, `${question.id}: "${choice}"`).not.toBeNull();
      expect(parsed, `${question.id}`).toBeCloseTo(question.verify as number, 6);
    }
  });

  it('normalises and rejects duplicate prompts', () => {
    const seen = new Set<string>();
    for (const question of CONTENT.questions) {
      const key = question.prompt.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
      expect(seen.has(key), `duplicate: ${question.id}`).toBe(false);
      seen.add(key);
    }
  });

  it('has unique ids across every content collection', () => {
    for (const collection of [
      CONTENT.items,
      CONTENT.perks,
      CONTENT.recipes,
      CONTENT.enemies,
      CONTENT.questions,
      CONTENT.rooms,
      CONTENT.themes,
      CONTENT.consumables,
      CONTENT.trinkets,
    ]) {
      const ids = collection.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('every item perk and recipe output resolves', () => {
    const perkIds = new Set(CONTENT.perks.map((perk) => perk.id));
    const itemIds = new Set(CONTENT.items.map((item) => item.id));
    for (const item of CONTENT.items) {
      for (const perk of item.perks) expect(perkIds.has(perk), `${item.id} -> ${perk}`).toBe(true);
    }
    for (const recipe of CONTENT.recipes) {
      expect(itemIds.has(recipe.output), `${recipe.id} -> ${recipe.output}`).toBe(true);
      for (const perk of recipe.bonusPerks) expect(perkIds.has(perk), `${recipe.id} -> ${perk}`).toBe(true);
    }
  });

  it('keeps all sprite keys within the generated art registry', () => {
    // Art is generated in code from the locked palette, so the equivalent of an
    // "asset exists with exact case" test is that every key is registered.
    const keys = new Set<string>([
      'pencil',
      'pen',
      'blade',
      'gun',
      'stick',
      'box',
      'bottle',
      'book',
      'board',
      'clip',
      'ring',
      'ball',
      'tray',
      'paper',
      'ticket',
    ]);
    for (const item of CONTENT.items) {
      expect(keys.has(item.spriteKey), item.id).toBe(true);
      expect(keys.has(item.icon), item.id).toBe(true);
    }
    for (const consumable of CONTENT.consumables) expect(keys.has(consumable.icon)).toBe(true);
    for (const trinket of CONTENT.trinkets) expect(keys.has(trinket.spriteKey)).toBe(true);
  });
});
