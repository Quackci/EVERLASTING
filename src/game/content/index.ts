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

import { assertValidContent } from './validate';
import type {
  Balance,
  ConsumableDef,
  ContentBundle,
  EnemyDef,
  ItemDef,
  PerkDef,
  QuestionDef,
  RecipeDef,
  RoomTemplateDef,
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

export const ITEM_BY_ID: ReadonlyMap<string, ItemDef> = new Map(ITEMS.map((item) => [item.id, item]));
export const PERK_BY_ID: ReadonlyMap<string, PerkDef> = new Map(PERKS.map((perk) => [perk.id, perk]));
export const RECIPE_BY_ID: ReadonlyMap<string, RecipeDef> = new Map(RECIPES.map((recipe) => [recipe.id, recipe]));
export const ENEMY_BY_ID: ReadonlyMap<string, EnemyDef> = new Map(ENEMIES.map((enemy) => [enemy.id, enemy]));
export const CONSUMABLE_BY_ID: ReadonlyMap<string, ConsumableDef> = new Map(
  CONSUMABLES.map((consumable) => [consumable.id, consumable]),
);
export const TRINKET_BY_ID: ReadonlyMap<string, TrinketDef> = new Map(TRINKETS.map((trinket) => [trinket.id, trinket]));
export const THEME_BY_ID: ReadonlyMap<string, ThemeDef> = new Map(THEMES.map((theme) => [theme.id, theme]));

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
