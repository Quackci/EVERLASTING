/**
 * Pure loot rules for desks and lockers: which rarity a container rolls, which
 * item that rarity maps to, and what a bonus question does to it. No Phaser
 * imports, so the numbers are unit-testable.
 */
import type { Balance, ItemDef, QuestionDef, Rarity } from '../content/types';
import { weightedPick, type Rng } from '../core/rng';
import type { PaletteName } from '../art/palette';

/** Rarity is a stat band: it decides which item tier the container can hold. */
export const RARITY_TIER: Readonly<Record<Rarity, number>> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  custom: 4,
  cursed: 5,
};

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'custom', 'cursed'];

/** Palette accent per rarity, so a ring, its label and its tag share one colour. */
export const RARITY_ACCENT: Readonly<Record<Rarity, PaletteName>> = {
  common: 'grey100',
  uncommon: 'chalk',
  rare: 'blue',
  custom: 'purple',
  cursed: 'red',
};

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
  bonusLuck = 0,
): LootRoll {
  const containerLuck = chest.rarity === 'rare' ? 0.6 : chest.rarity === 'locked' ? 0.3 : 0;
  const luck = containerLuck + bonusLuck;
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

/** Reverse of RARITY_TIER, for naming the band a boss drop belongs to. */
export const RARITY_BY_TIER: Readonly<Record<number, Rarity>> = {
  1: 'common',
  2: 'uncommon',
  3: 'rare',
  4: 'custom',
  5: 'cursed',
};

/**
 * The item tier a boss invests in. Depth is the only input, so a floor 7 boss
 * hands out gear the next act can actually use instead of reskinned floor 1
 * loot that the player has already outgrown.
 */
export function bossLootTier(floor: number, balance: Balance): number {
  const growth = Math.max(0, floor - 1) * balance.loot.boss.tierPerFloor;
  return Math.max(1, Math.min(5, Math.round(1 + growth)));
}

export interface BossLootRoll extends LootRoll {
  tier: number;
}

/**
 * Rolls a boss payout: one guaranteed weapon of the stage's tier plus enough
 * extra pieces to feel like a reward. Items are unique within the drop.
 */
export function rollBossLoot(
  rng: Rng,
  floor: number,
  balance: Balance,
  items: readonly ItemDef[],
): BossLootRoll {
  const tier = bossLootTier(floor, balance);
  const config = balance.loot.boss;
  const wanted = rng.range(config.itemsMin, Math.max(config.itemsMin, config.itemsMax));
  const pool = itemsForTier(tier, items);
  const exact = pool.filter((item) => item.tier === tier);
  const source = exact.length > 0 ? exact : pool;
  const picked: ItemDef[] = [];

  const weapons = source.filter((item) => item.kind === 'weapon');
  if (weapons.length > 0) {
    const [first] = weapons.splice(rng.int(weapons.length), 1);
    if (first) picked.push(first);
  }

  const rest = source.filter((item) => !picked.includes(item));
  while (picked.length < wanted && rest.length > 0) {
    const [item] = rest.splice(rng.int(rest.length), 1);
    if (item) picked.push(item);
  }

  return {
    rarity: RARITY_BY_TIER[tier] ?? 'rare',
    smarts: 0,
    items: picked,
    tier,
  };
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

/** One backpack on the reward screen: a rarity ring, a tier and what is inside. */
export interface RewardChoice {
  rarity: Rarity;
  tier: number;
  smarts: number;
  items: ItemDef[];
}

export interface RewardRollOptions {
  luck?: number;
  boss?: boolean;
  count?: number;
}

function clampTier(value: number): number {
  return Math.max(1, Math.min(5, value));
}

/**
 * The student's run level. It is a readout of progress rather than a hidden
 * stat: depth plus learned skill nodes, so the reward screen can honestly say
 * the loot scaled with the player and not only with the room.
 */
export function runLevel(floor: number, learnedSkills: number, balance: Balance): number {
  return (
    1 +
    Math.floor(Math.max(0, floor - 1) / balance.loot.levelPerFloors) +
    Math.floor(Math.max(0, learnedSkills) / balance.loot.levelPerSkills)
  );
}

/** Rarity band plus depth and level bonuses decide the item tier behind a ring. */
export function tierForRoll(rarity: Rarity, floor: number, level: number, balance: Balance): number {
  return clampTier(
    RARITY_TIER[rarity] +
      Math.floor(Math.max(0, floor - 1) / balance.loot.depthTierEvery) +
      Math.floor(Math.max(0, level - 1) / balance.loot.levelTierEvery),
  );
}

function pickChoiceItems(
  rng: Rng,
  tier: number,
  items: readonly ItemDef[],
  wanted: number,
  requireWeapon: boolean,
): ItemDef[] {
  const pool = itemsForTier(tier, items);
  const weapons = pool.filter((item) => item.kind === 'weapon');
  const source = [...(weapons.length > 0 ? weapons : pool)];
  const picked: ItemDef[] = [];
  while (picked.length < wanted && source.length > 0) {
    const [item] = source.splice(rng.int(source.length), 1);
    if (item) picked.push(item);
  }
  if (picked.length < wanted) {
    // A thin tier still owes a full pack, so top up from the rest of the bag.
    const spare = items.filter((item) => !picked.includes(item));
    while (picked.length < wanted && spare.length > 0) {
      const [item] = spare.splice(rng.int(spare.length), 1);
      if (item) picked.push(item);
    }
  }
  if (requireWeapon && !picked.some((item) => item.kind === 'weapon')) {
    const fallback = items.filter((item) => item.kind === 'weapon' && !picked.includes(item));
    if (fallback.length > 0) {
      const [weapon] = fallback.splice(rng.int(fallback.length), 1);
      if (weapon) picked.unshift(weapon);
    }
  }
  return picked;
}

/**
 * Rolls the backpacks a container offers. Only when every roll lands on the same
 * band does the last pack step up one band, so the three rings still read as a
 * choice without turning every desk into a guaranteed rare. Contents scale with
 * the floor and the run level, and a boss pack still always carries a weapon.
 */
export function rollRewardChoices(
  rng: Rng,
  floor: number,
  level: number,
  balance: Balance,
  items: readonly ItemDef[],
  options: RewardRollOptions = {},
): RewardChoice[] {
  const count = Math.max(1, Math.round(options.count ?? balance.loot.choiceCount));
  const boss = options.boss === true;
  const rarities: Rarity[] = [];
  for (let index = 0; index < count; index += 1) {
    rarities.push(rollRarity(rng, floor, balance, (options.luck ?? 0) + (boss ? 0.6 : 0)));
  }
  if (count > 1 && rarities.every((rarity) => rarity === rarities[0])) {
    const start = RARITY_ORDER.indexOf(rarities[count - 1] ?? 'common');
    const lifted = RARITY_ORDER[Math.min(3, Math.max(0, start + 1))];
    if (lifted) rarities[count - 1] = lifted;
  }

  const bossFloorTier = boss ? bossLootTier(floor, balance) : 1;
  const choices: RewardChoice[] = [];
  rarities.forEach((rarity) => {
    const tier = boss
      ? clampTier(Math.max(tierForRoll(rarity, floor, level, balance), bossFloorTier - 1))
      : tierForRoll(rarity, floor, level, balance);
    const wanted = boss
      ? rng.range(
          balance.loot.boss.itemsMin,
          Math.max(balance.loot.boss.itemsMin, balance.loot.boss.itemsMax),
        )
      : rarity === 'common'
        ? 1
        : rng.chance(0.5)
          ? 2
          : 1;
    const smarts = boss ? 0 : rng.range(balance.smarts.chestMin, balance.smarts.chestMax);
    choices.push({ rarity, tier, smarts, items: pickChoiceItems(rng, tier, items, wanted, boss) });
  });
  return choices;
}
