/**
 * Pure loot rules for desks and lockers: which rarity a container rolls, which
 * item that rarity maps to, and what a bonus question does to it. No Phaser
 * imports, so the numbers are unit-testable.
 */
import type { Balance, ItemDef, QuestionDef, Rarity } from '../content/types';
import { weightedPick, type Rng } from '../core/rng';

/** Rarity is a stat band: it decides which item tier the container can hold. */
export const RARITY_TIER: Readonly<Record<Rarity, number>> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  custom: 4,
  cursed: 5,
};

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'custom', 'cursed'];

export interface ChestLike {
  rarity: 'common' | 'rare' | 'locked';
}

export interface LootRoll {
  rarity: Rarity;
  smarts: number;
  items: ItemDef[];
}

export interface PresentedQuestion {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  subject: string;
}

/** Which weight table from balance.json applies at this depth. */
export function weightTableId(floor: number): string {
  if (floor >= 10) return 'floor10';
  if (floor >= 7) return 'floor7';
  if (floor >= 4) return 'floor4';
  return 'floor1';
}

function weightTable(floor: number, balance: Balance): Record<string, number> {
  const table = balance.loot.rarityWeights[weightTableId(floor)];
  return table ?? { common: 100 };
}

/**
 * Rolls a rarity. `luck` biases towards the rarer bands without ever making the
 * common band impossible, so a lucky container is a nice surprise rather than a
 * different game.
 */
export function rollRarity(rng: Rng, floor: number, balance: Balance, luck = 0): Rarity {
  const table = weightTable(floor, balance);
  const entries = RARITY_ORDER.map((rarity, index) => ({
    value: rarity,
    weight: Math.max(0, (table[rarity] ?? 0) * (1 + Math.max(0, luck) * index)),
  }));
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return 'common';
  return weightedPick(rng, entries);
}

/** Items of a tier, falling back to the closest tier when one is empty. */
export function itemsForTier(tier: number, items: readonly ItemDef[]): ItemDef[] {
  const exact = items.filter((item) => item.tier === tier);
  if (exact.length > 0) return exact;
  let best = Number.POSITIVE_INFINITY;
  for (const item of items) {
    best = Math.min(best, Math.abs(item.tier - tier));
  }
  return items.filter((item) => Math.abs(item.tier - tier) === best);
}

/**
 * Rolls one container's contents. A raised `rarity` on the chest (the "rare"
 * containers the generator places) only biases the roll; it never guarantees a
 * specific item, which keeps runs from being scripted.
 */
export function rollChestLoot(
  rng: Rng,
  chest: ChestLike,
  floor: number,
  balance: Balance,
  items: readonly ItemDef[],
): LootRoll {
  const luck = chest.rarity === 'rare' ? 0.6 : chest.rarity === 'locked' ? 0.3 : 0;
  const rarity = rollRarity(rng, floor, balance, luck);
  const tier = RARITY_TIER[rarity];
  const weapons = itemsForTier(tier, items).filter((item) => item.kind === 'weapon');
  const pool = weapons.length > 0 ? weapons : itemsForTier(tier, items);
  const available = [...pool];
  const count = rarity === 'common' ? 1 : rng.chance(0.5) ? 2 : 1;
  const picked: ItemDef[] = [];
  for (let i = 0; i < count && available.length > 0; i += 1) {
    const index = rng.int(available.length);
    const [item] = available.splice(index, 1);
    if (item) picked.push(item);
  }
  const smarts = rng.range(balance.smarts.chestMin, balance.smarts.chestMax);
  return { rarity, smarts, items: picked };
}

/** The reward for a correct bonus question: one tier, and the stats that follow. */
export function upgradeItem(item: ItemDef): ItemDef {
  const tier = Math.min(5, item.tier + 1);
  return {
    ...item,
    tier,
    damage: item.kind === 'weapon' ? Math.round(item.damage * 1.25) + 1 : item.damage,
    speed: Math.round(item.speed * 1.06 * 100) / 100,
    reach: item.reach + 1,
    critChance: Math.min(0.5, Math.round((item.critChance + 0.03) * 100) / 100),
    durability: item.durability + 10,
    value: item.value + 8,
    armorValue: item.armorValue === undefined ? undefined : item.armorValue + 2,
  };
}

/** Picks a question for a container, preferring the floor's subject mix. */
export function pickBonusQuestion(
  rng: Rng,
  questions: readonly QuestionDef[],
  subject?: string,
): QuestionDef {
  if (questions.length === 0) {
    throw new Error('pickBonusQuestion needs a non-empty question bank');
  }
  const pool = subject ? questions.filter((question) => question.subject === subject) : [];
  return rng.pick(pool.length > 0 ? pool : questions);
}

/** Shuffles the four choices so the correct one is not always in the same slot. */
export function presentQuestion(rng: Rng, question: QuestionDef): PresentedQuestion {
  const order = rng.shuffle(question.choices.map((_choice, index) => index));
  const choices = order.map((index) => question.choices[index] ?? '');
  const answerIndex = Math.max(0, order.indexOf(question.answerIndex));
  return {
    prompt: question.prompt,
    choices,
    answerIndex,
    explanation: question.explanation,
    subject: question.subject,
  };
}

/** The item a correct bonus answer should upgrade: the most valuable one found. */
export function upgradeTarget(items: readonly ItemDef[]): ItemDef | null {
  let best: ItemDef | null = null;
  for (const item of items) {
    if (!best || item.value > best.value || (item.value === best.value && item.tier > best.tier)) {
      best = item;
    }
  }
  return best;
}
