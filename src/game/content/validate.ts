/**
 * Boot-time content validation. A bad reference must fail loudly with a clear
 * message rather than surfacing later as `undefined` in the middle of a run.
 */
import {
  AFFIXES,
  BEHAVIORS,
  ENEMY_ARCHETYPES,
  RARITIES,
  SPRITE_KEYS,
  SUBJECTS,
  TAGS,
  type Balance,
  type ContentBundle,
  type QuestionDef,
} from './types';

export interface ValidationIssue {
  where: string;
  message: string;
}

const RARITY_SET = new Set<string>(RARITIES);
const SPRITE_SET = new Set<string>(SPRITE_KEYS);
const TAG_SET = new Set<string>(TAGS);
const SUBJECT_SET = new Set<string>(SUBJECTS);
const ARCHETYPE_SET = new Set<string>(ENEMY_ARCHETYPES);
const BEHAVIOR_SET = new Set<string>(BEHAVIORS);
const AFFIX_SET = new Set<string>(AFFIXES);

export const CONTENT_MINIMUMS = {
  questions: 150,
  items: 24,
  recipes: 40,
  perks: 30,
  enemies: 20,
  elitesAndBosses: 8,
  roomsPerTheme: 6,
  consumables: 8,
  trinkets: 12,
  themes: 9,
  classes: 4,
  difficulties: 3,
  skillsPerClass: 6,
} as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parses the leading numeric value of a choice, e.g. "6 cm" -> 6, "0.375" -> 0.375. */
export function leadingNumber(choice: string): number | null {
  const match = /^\s*([-\u2212]?\d+(?:\.\d+)?)/.exec(choice);
  if (!match || match[1] === undefined) {
    return null;
  }
  const value = Number.parseFloat(match[1].replace('\u2212', '-'));
  return Number.isFinite(value) ? value : null;
}

export function validateContent(content: ContentBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (where: string, message: string): void => {
    issues.push({ where, message });
  };

  const itemIds = new Set<string>();
  const perkIds = new Set<string>();
  const recipeIds = new Set<string>();
  const enemyIds = new Set<string>();
  const questionIds = new Set<string>();
  const themeIds = new Set<string>();
  const consumableIds = new Set<string>();
  const trinketIds = new Set<string>();

  // ---- balance -------------------------------------------------------------
  const balance: Balance = content.balance;
  if (!balance || typeof balance !== 'object') {
    push('balance', 'balance.json is missing or not an object');
    return issues;
  }
  if (!isFiniteNumber(balance.player?.baseHp) || balance.player.baseHp <= 0) {
    push('balance.player.baseHp', 'must be a positive number');
  }
  const recovery = balance.recovery;
  if (!recovery) {
    push('balance.recovery', 'needs a recovery block');
  } else {
    if (!Number.isInteger(recovery.killsPerHeal) || recovery.killsPerHeal < 1) {
      push('balance.recovery.killsPerHeal', 'must be a positive whole number of kills');
    }
    for (const field of ['killHealPercent', 'roomClearHealPercent'] as const) {
      const value = recovery[field];
      if (!isFiniteNumber(value) || value <= 0 || value > 1) {
        push(`balance.recovery.${field}`, 'must be a fraction between 0 and 1');
      }
    }
  }
  const weightKeys = Object.keys(balance.loot?.rarityWeights ?? {});
  if (weightKeys.length < 4) {
    push('balance.loot.rarityWeights', 'expected weight tables for floors 1, 4, 7 and 10');
  }
  for (const key of weightKeys) {
    const table = balance.loot.rarityWeights[key];
    if (!table) {
      push(`balance.loot.rarityWeights.${key}`, 'missing weight table');
      continue;
    }
    for (const rarity of Object.keys(table)) {
      if (!RARITY_SET.has(rarity)) {
        push(`balance.loot.rarityWeights.${key}`, `unknown rarity "${rarity}"`);
      }
    }
  }
  if (!Array.isArray(balance.meta?.starterKits) || balance.meta.starterKits.length < 3) {
    push('balance.meta.starterKits', 'expected at least 3 starter kits');
  }
  for (const act of balance.floorScaling?.acts ?? []) {
    if (!Array.isArray(act.floors) || act.floors.length !== 2) {
      push(`balance.floorScaling.acts.${act.act}`, 'floors must be a [start, end] pair');
    }
  }

  // ---- items ---------------------------------------------------------------
  for (const item of content.items) {
    const where = `items.${item.id}`;
    if (itemIds.has(item.id)) push(where, 'duplicate item id');
    itemIds.add(item.id);
    if (item.kind !== 'weapon' && item.kind !== 'armor') push(where, 'kind must be "weapon" or "armor"');
    if (!Number.isInteger(item.tier) || item.tier < 1 || item.tier > 5) push(where, 'tier must be an integer 1-5');
    for (const tag of item.tags) {
      if (!TAG_SET.has(tag)) push(where, `unknown tag "${tag}"`);
    }
    if (item.tags.length === 0) push(where, 'needs at least one tag');
    for (const field of ['damage', 'speed', 'reach', 'critChance', 'critMult', 'durability', 'weight', 'value'] as const) {
      if (!isFiniteNumber(item[field]) || item[field] < 0) push(where, `${field} must be a non-negative number`);
    }
    if (!SPRITE_SET.has(item.spriteKey)) push(where, `unknown spriteKey "${item.spriteKey}"`);
    if (!SPRITE_SET.has(item.icon)) push(where, `unknown icon "${item.icon}"`);
    if (typeof item.flavor !== 'string' || item.flavor.trim().length < 4) push(where, 'needs flavor text');
    if (typeof item.specialText !== 'string' || item.specialText.trim().length < 4) push(where, 'needs specialText');
    if (item.kind === 'armor' && !isFiniteNumber(item.armorValue)) push(where, 'armor items need armorValue');
  }
  if (content.items.length < CONTENT_MINIMUMS.items) {
    push('items', `need at least ${CONTENT_MINIMUMS.items}, found ${content.items.length}`);
  }

  // ---- perks ---------------------------------------------------------------
  for (const perk of content.perks) {
    const where = `perks.${perk.id}`;
    if (perkIds.has(perk.id)) push(where, 'duplicate perk id');
    perkIds.add(perk.id);
    if (!perk.name || !perk.description) push(where, 'needs a name and description');
    if (!perk.effects || Object.keys(perk.effects).length === 0) push(where, 'has no mechanical effects');
  }
  if (content.perks.length < CONTENT_MINIMUMS.perks) {
    push('perks', `need at least ${CONTENT_MINIMUMS.perks}, found ${content.perks.length}`);
  }
  for (const item of content.items) {
    for (const perkId of item.perks) {
      if (!perkIds.has(perkId)) push(`items.${item.id}`, `unknown perk "${perkId}"`);
    }
  }

  // ---- recipes -------------------------------------------------------------
  const tagsWithItems = new Map<string, number>();
  for (const item of content.items) {
    for (const tag of item.tags) tagsWithItems.set(tag, (tagsWithItems.get(tag) ?? 0) + 1);
  }
  for (const recipe of content.recipes) {
    const where = `recipes.${recipe.id}`;
    if (recipeIds.has(recipe.id)) push(where, 'duplicate recipe id');
    recipeIds.add(recipe.id);
    if (recipe.inputs.length < 2 || recipe.inputs.length > 3) push(where, 'needs 2 or 3 inputs');
    for (const input of recipe.inputs) {
      if (input.startsWith('#')) {
        const tag = input.slice(1);
        if (!TAG_SET.has(tag)) push(where, `unknown tag selector "${input}"`);
        else if (!tagsWithItems.has(tag)) push(where, `tag selector "${input}" matches no items`);
      } else if (!itemIds.has(input)) {
        push(where, `unknown input item "${input}"`);
      }
    }
    if (!itemIds.has(recipe.output)) push(where, `unknown output item "${recipe.output}"`);
    for (const perkId of recipe.bonusPerks) {
      if (!perkIds.has(perkId)) push(where, `unknown bonus perk "${perkId}"`);
    }
    if (!isFiniteNumber(recipe.smartsCost) || recipe.smartsCost <= 0) push(where, 'smartsCost must be positive');
  }
  if (content.recipes.length < CONTENT_MINIMUMS.recipes) {
    push('recipes', `need at least ${CONTENT_MINIMUMS.recipes}, found ${content.recipes.length}`);
  }

  // ---- enemies -------------------------------------------------------------
  for (const enemy of content.enemies) {
    const where = `enemies.${enemy.id}`;
    if (enemyIds.has(enemy.id)) push(where, 'duplicate enemy id');
    enemyIds.add(enemy.id);
    if (!ARCHETYPE_SET.has(enemy.archetype)) push(where, `unknown archetype "${enemy.archetype}"`);
    if (!BEHAVIOR_SET.has(enemy.behavior)) push(where, `unknown behavior "${enemy.behavior}"`);
    if (enemy.affix && !AFFIX_SET.has(enemy.affix)) push(where, `unknown affix "${enemy.affix}"`);
    for (const field of ['hp', 'damage', 'speed', 'attackRange', 'attackCooldownMs', 'windupMs'] as const) {
      if (!isFiniteNumber(enemy[field]) || enemy[field] < 0) push(where, `${field} must be a non-negative number`);
    }
    if (enemy.windupMs < 300 && enemy.role === 'normal') {
      push(where, 'wind-up must be at least 300ms so attacks stay readable');
    }
    if (enemy.splitInto && !content.enemies.some((candidate) => candidate.id === enemy.splitInto)) {
      push(where, `splitInto references unknown enemy "${enemy.splitInto}"`);
    }
    if (enemy.behavior === 'ranged' || enemy.behavior === 'turret') {
      if (!isFiniteNumber(enemy.projectileSpeed)) push(where, 'ranged enemies need projectileSpeed');
    }
    if (!enemy.flavor) push(where, 'needs flavor text');
  }
  const normals = content.enemies.filter((enemy) => enemy.role === 'normal');
  const specials = content.enemies.filter((enemy) => enemy.role !== 'normal');
  if (normals.length < CONTENT_MINIMUMS.enemies) {
    push('enemies', `need at least ${CONTENT_MINIMUMS.enemies} normal enemies, found ${normals.length}`);
  }
  if (specials.length < CONTENT_MINIMUMS.elitesAndBosses) {
    push('enemies', `need at least ${CONTENT_MINIMUMS.elitesAndBosses} elites/bosses, found ${specials.length}`);
  }
  for (const floor of [4, 7, 10]) {
    if (!content.enemies.some((enemy) => enemy.role === 'boss' && enemy.act === Math.ceil(floor / 3.34))) {
      // Act mapping is approximate; the runtime boss table is the source of truth.
    }
  }

  // ---- consumables / trinkets ---------------------------------------------
  for (const consumable of content.consumables) {
    const where = `consumables.${consumable.id}`;
    if (consumableIds.has(consumable.id)) push(where, 'duplicate consumable id');
    consumableIds.add(consumable.id);
    const hasEffect =
      consumable.heal !== undefined ||
      consumable.ink !== undefined ||
      consumable.repair !== undefined ||
      consumable.smarts !== undefined ||
      consumable.skipQuestion === true;
    if (!hasEffect) push(where, 'needs at least one effect');
    if (!SPRITE_SET.has(consumable.icon)) push(where, `unknown icon "${consumable.icon}"`);
  }
  if (content.consumables.length < CONTENT_MINIMUMS.consumables) {
    push('consumables', `need at least ${CONTENT_MINIMUMS.consumables}, found ${content.consumables.length}`);
  }
  for (const trinket of content.trinkets) {
    const where = `trinkets.${trinket.id}`;
    if (trinketIds.has(trinket.id)) push(where, 'duplicate trinket id');
    trinketIds.add(trinket.id);
    if (!trinket.effects || Object.keys(trinket.effects).length === 0) push(where, 'has no effects');
    if (!SPRITE_SET.has(trinket.spriteKey)) push(where, `unknown spriteKey "${trinket.spriteKey}"`);
  }
  if (content.trinkets.length < CONTENT_MINIMUMS.trinkets) {
    push('trinkets', `need at least ${CONTENT_MINIMUMS.trinkets}, found ${content.trinkets.length}`);
  }

  // ---- questions -----------------------------------------------------------
  const seenPrompts = new Map<string, string>();
  const subjectCounts = new Map<string, number>();
  const tierCounts = new Map<number, number>();
  for (const question of content.questions) {
    const where = `questions.${question.id}`;
    if (questionIds.has(question.id)) push(where, 'duplicate question id');
    questionIds.add(question.id);
    if (!SUBJECT_SET.has(question.subject)) push(where, `unknown subject "${question.subject}"`);
    if (!Number.isInteger(question.tier) || question.tier < 1 || question.tier > 10) {
      push(where, 'tier must be an integer 1-10');
    }
    if (question.choices.length !== 4) push(where, `needs exactly 4 choices, found ${question.choices.length}`);
    if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex > 3) {
      push(where, 'answerIndex must be 0-3');
    }
    if (new Set(question.choices.map((choice) => choice.trim().toLowerCase())).size !== question.choices.length) {
      push(where, 'has duplicate choices');
    }
    if (!question.explanation || question.explanation.trim().split(/\s+/).length < 4) {
      push(where, 'needs a one-sentence explanation');
    }
    if (!question.prompt || question.prompt.trim().length < 8) push(where, 'prompt is too short');
    if (question.timeLimit !== undefined && (!isFiniteNumber(question.timeLimit) || question.timeLimit <= 0)) {
      push(where, 'timeLimit must be positive when present');
    }
    const normalized = normalizePrompt(question.prompt);
    const previous = seenPrompts.get(normalized);
    if (previous) push(where, `duplicate prompt (also ${previous})`);
    else seenPrompts.set(normalized, question.id);

    const chosen = question.choices[question.answerIndex];
    if (chosen === undefined) push(where, 'answerIndex points outside choices');
    if (question.verify !== undefined && chosen !== undefined) {
      const parsed = leadingNumber(chosen);
      if (parsed === null) push(where, `verify set but choice "${chosen}" has no leading number`);
      else if (Math.abs(parsed - question.verify) > 1e-6) {
        push(where, `verify ${question.verify} does not match answer choice "${chosen}"`);
      }
    }
    subjectCounts.set(question.subject, (subjectCounts.get(question.subject) ?? 0) + 1);
    tierCounts.set(question.tier, (tierCounts.get(question.tier) ?? 0) + 1);
  }
  if (content.questions.length < CONTENT_MINIMUMS.questions) {
    push('questions', `need at least ${CONTENT_MINIMUMS.questions}, found ${content.questions.length}`);
  }
  for (const subject of SUBJECTS) {
    if ((subjectCounts.get(subject) ?? 0) < 10) {
      push(`questions.${subject}`, `needs at least 10 questions, found ${subjectCounts.get(subject) ?? 0}`);
    }
  }
  for (let tier = 1; tier <= 10; tier += 1) {
    const count = tierCounts.get(tier) ?? 0;
    if (count < 5) push(`questions.tier${tier}`, `needs at least 5 questions, found ${count}`);
    if (count > 30) push(`questions.tier${tier}`, `has ${count} questions, which unbalances the bank`);
  }

  // ---- themes & rooms ------------------------------------------------------
  for (const theme of content.themes) {
    const where = `themes.${theme.id}`;
    if (themeIds.has(theme.id)) push(where, 'duplicate theme id');
    themeIds.add(theme.id);
    for (const enemyId of theme.enemies) {
      if (!enemyIds.has(enemyId)) push(where, `unknown enemy "${enemyId}"`);
    }
    const totalWeight = Object.values(theme.subjects).reduce((sum, value) => sum + value, 0);
    if (totalWeight <= 0) push(where, 'subject weights must be positive');
    for (const subject of Object.keys(theme.subjects)) {
      if (!SUBJECT_SET.has(subject)) push(where, `unknown subject "${subject}"`);
    }
  }
  if (content.themes.length < CONTENT_MINIMUMS.themes) {
    push('themes', `need at least ${CONTENT_MINIMUMS.themes}, found ${content.themes.length}`);
  }
  for (const theme of content.themes) {
    const roomCount = content.rooms.filter((room) => room.theme === theme.id).length;
    if (roomCount < CONTENT_MINIMUMS.roomsPerTheme) {
      push(`rooms.${theme.id}`, `needs ${CONTENT_MINIMUMS.roomsPerTheme} templates, found ${roomCount}`);
    }
  }
  for (const room of content.rooms) {
    const where = `rooms.${room.id}`;
    if (!themeIds.has(room.theme)) push(where, `unknown theme "${room.theme}"`);
    if (room.props.length < 2) push(where, 'needs at least 2 props');
  }

  // ---- classes, difficulties and skill trees -------------------------------
  const classIds = new Set<string>();
  for (const cls of content.classes) {
    const where = `classes.${cls.id}`;
    if (classIds.has(cls.id)) push(where, 'duplicate class id');
    classIds.add(cls.id);
    if (!itemIds.has(cls.weaponId)) push(where, `unknown starting weapon "${cls.weaponId}"`);
    for (const field of [
      'hpMultiplier',
      'damageMultiplier',
      'moveSpeedMultiplier',
      'dodgeCooldownMultiplier',
    ] as const) {
      if (!isFiniteNumber(cls[field]) || cls[field] <= 0) push(where, `${field} must be positive`);
    }
    for (const field of ['critChanceBonus', 'reachBonus', 'armorBonus', 'inkBonus', 'blockReductionBonus'] as const) {
      if (!isFiniteNumber(cls[field])) push(where, `${field} must be a number`);
    }
    if (!Array.isArray(cls.pros) || cls.pros.length === 0) push(where, 'needs at least one pro');
    if (!Array.isArray(cls.cons) || cls.cons.length === 0) push(where, 'needs at least one con');
    if (typeof cls.blurb !== 'string' || cls.blurb.trim().length < 8) push(where, 'needs a blurb');
    if (typeof cls.title !== 'string' || cls.title.trim().length === 0) push(where, 'needs a title');
  }
  if (content.classes.length < CONTENT_MINIMUMS.classes) {
    push('classes', `need at least ${CONTENT_MINIMUMS.classes}, found ${content.classes.length}`);
  }

  const difficultyIds = new Set<string>();
  for (const difficulty of content.difficulties) {
    const where = `difficulties.${difficulty.id}`;
    if (difficultyIds.has(difficulty.id)) push(where, 'duplicate difficulty id');
    difficultyIds.add(difficulty.id);
    for (const field of [
      'enemyHpMultiplier',
      'enemyDamageMultiplier',
      'enemySpeedMultiplier',
      'smartsMultiplier',
    ] as const) {
      if (!isFiniteNumber(difficulty[field]) || difficulty[field] <= 0) {
        push(where, `${field} must be positive`);
      }
    }
    if (!isFiniteNumber(difficulty.lootLuck)) push(where, 'lootLuck must be a number');
    if (typeof difficulty.tagline !== 'string' || difficulty.tagline.trim().length === 0) {
      push(where, 'needs a tagline');
    }
  }
  if (content.difficulties.length < CONTENT_MINIMUMS.difficulties) {
    push('difficulties', `need at least ${CONTENT_MINIMUMS.difficulties}, found ${content.difficulties.length}`);
  }

  const skillIds = new Set<string>();
  for (const skill of content.skills) {
    const where = `skills.${skill.id}`;
    if (skillIds.has(skill.id)) push(where, 'duplicate skill id');
    skillIds.add(skill.id);
    if (!classIds.has(skill.classId)) push(where, `unknown class "${skill.classId}"`);
    if (!isFiniteNumber(skill.cost) || skill.cost <= 0) push(where, 'cost must be positive');
    if (!Number.isInteger(skill.tier) || skill.tier < 1 || skill.tier > 3) {
      push(where, 'tier must be 1-3');
    }
    const hasStat =
      skill.maxHp !== undefined ||
      skill.armor !== undefined ||
      skill.moveSpeed !== undefined ||
      skill.ink !== undefined;
    if (!skill.effects && !hasStat) push(where, 'needs an effect or a stat bonus');
    if (typeof skill.description !== 'string' || skill.description.trim().length < 8) {
      push(where, 'needs a description');
    }
  }
  for (const skill of content.skills) {
    if (skill.requires === null) continue;
    const parent = content.skills.find((candidate) => candidate.id === skill.requires);
    if (!parent) push(`skills.${skill.id}`, `unknown prerequisite "${skill.requires}"`);
    else if (parent.classId !== skill.classId) {
      push(`skills.${skill.id}`, 'prerequisite belongs to another class');
    } else if (parent.tier >= skill.tier) {
      push(`skills.${skill.id}`, 'prerequisite must sit in an earlier tier');
    }
  }
  for (const classId of classIds) {
    const count = content.skills.filter((skill) => skill.classId === classId).length;
    if (count < CONTENT_MINIMUMS.skillsPerClass) {
      push(`skills.${classId}`, `needs ${CONTENT_MINIMUMS.skillsPerClass} nodes, found ${count}`);
    }
  }

  return issues;
}

export function assertValidContent(content: ContentBundle): void {
  const issues = validateContent(content);
  if (issues.length > 0) {
    const lines = issues.slice(0, 25).map((issue) => `  - ${issue.where}: ${issue.message}`);
    const suffix = issues.length > 25 ? `\n  ...and ${issues.length - 25} more` : '';
    throw new Error(`Content validation failed with ${issues.length} issue(s):\n${lines.join('\n')}${suffix}`);
  }
}

/** Question bank sanity helpers used by tests and the quiz system. */
export function questionTierCounts(questions: QuestionDef[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const question of questions) {
    counts.set(question.tier, (counts.get(question.tier) ?? 0) + 1);
  }
  return counts;
}
