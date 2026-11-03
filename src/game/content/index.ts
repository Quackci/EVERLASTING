import balanceJson from './balance.json';
import itemsJson from './items.json';
import perksJson from './perks.json';
import recipesJson from './recipes.json';
import enemiesJson from './enemies.json';
import consumablesJson from './consumables.json';
import trinketsJson from './trinkets.json';
import questionsJson from './questions.json';
import roomsJson from './rooms.json';
import themesJson from './themes.json';
import classesJson from './classes.json';
import difficultiesJson from './difficulties.json';
import skillsJson from './skills.json';

import { assertValidContent } from './validate';
import type {
  Balance,
  ClassDef,
  ConsumableDef,
  ContentBundle,
  DifficultyDef,
  EnemyDef,
  ItemDef,
  PerkDef,
  QuestionDef,
  RecipeDef,
  RoomTemplateDef,
  SkillDef,
  ThemeDef,
  TrinketDef,
} from './types';

const raw: ContentBundle = {
  balance: balanceJson as unknown as Balance,
  items: itemsJson as unknown as ItemDef[],
  perks: perksJson as unknown as PerkDef[],
  recipes: recipesJson as unknown as RecipeDef[],
  enemies: enemiesJson as unknown as EnemyDef[],
  consumables: consumablesJson as unknown as ConsumableDef[],
  trinkets: trinketsJson as unknown as TrinketDef[],
  questions: questionsJson as unknown as QuestionDef[],
  rooms: roomsJson as unknown as RoomTemplateDef[],
  themes: themesJson as unknown as ThemeDef[],
  classes: classesJson as unknown as ClassDef[],
  difficulties: difficultiesJson as unknown as DifficultyDef[],
  skills: skillsJson as unknown as SkillDef[],
};

/** Validated, indexed content. Importing this module validates the whole bundle once. */
export const CONTENT: ContentBundle = raw;

export const BALANCE: Balance = raw.balance;

export const ITEMS: ItemDef[] = raw.items;
export const PERKS: PerkDef[] = raw.perks;
export const RECIPES: RecipeDef[] = raw.recipes;
export const ENEMIES: EnemyDef[] = raw.enemies;
export const CONSUMABLES: ConsumableDef[] = raw.consumables;
export const TRINKETS: TrinketDef[] = raw.trinkets;
export const QUESTIONS: QuestionDef[] = raw.questions;
export const ROOMS: RoomTemplateDef[] = raw.rooms;
export const THEMES: ThemeDef[] = raw.themes;
export const CLASSES: ClassDef[] = raw.classes;
export const DIFFICULTIES: DifficultyDef[] = raw.difficulties;
export const SKILLS: SkillDef[] = raw.skills;

export const ITEM_BY_ID: ReadonlyMap<string, ItemDef> = new Map(ITEMS.map((item) => [item.id, item]));
export const PERK_BY_ID: ReadonlyMap<string, PerkDef> = new Map(PERKS.map((perk) => [perk.id, perk]));
export const RECIPE_BY_ID: ReadonlyMap<string, RecipeDef> = new Map(RECIPES.map((recipe) => [recipe.id, recipe]));
export const ENEMY_BY_ID: ReadonlyMap<string, EnemyDef> = new Map(ENEMIES.map((enemy) => [enemy.id, enemy]));
export const CONSUMABLE_BY_ID: ReadonlyMap<string, ConsumableDef> = new Map(
  CONSUMABLES.map((consumable) => [consumable.id, consumable]),
);
export const TRINKET_BY_ID: ReadonlyMap<string, TrinketDef> = new Map(TRINKETS.map((trinket) => [trinket.id, trinket]));
export const THEME_BY_ID: ReadonlyMap<string, ThemeDef> = new Map(THEMES.map((theme) => [theme.id, theme]));
export const CLASS_BY_ID: ReadonlyMap<string, ClassDef> = new Map(CLASSES.map((cls) => [cls.id, cls]));
export const DIFFICULTY_BY_ID: ReadonlyMap<string, DifficultyDef> = new Map(
  DIFFICULTIES.map((difficulty) => [difficulty.id, difficulty]),
);
export const SKILL_BY_ID: ReadonlyMap<string, SkillDef> = new Map(SKILLS.map((skill) => [skill.id, skill]));

export const CURRICULUM_SUBJECTS = [
  'math',
  'science',
  'history',
  'geography',
  'language',
  'school_life',
] as const;

/** Boss per floor, as specified: floors 4, 7 and 10. */
export const BOSS_BY_FLOOR: ReadonlyMap<number, string> = new Map([
  [4, 'the_substitute'],
  [7, 'the_gym_coach'],
  [10, 'the_principal'],
]);

export function assertContentReady(): void {
  assertValidContent(raw);
}

assertValidContent(raw);
