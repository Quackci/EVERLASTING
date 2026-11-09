/** Content schema. Everything in src/game/content is validated against these types at boot. */

export const TAGS = [
  'edge',
  'blunt',
  'ranged',
  'elastic',
  'metal',
  'paper',
  'adhesive',
  'chemical',
  'glass',
  'precision',
  'bulk',
  'noise',
] as const;
export type Tag = (typeof TAGS)[number];

export const SUBJECTS = ['math', 'science', 'history', 'geography', 'language', 'school_life'] as const;
export type Subject = (typeof SUBJECTS)[number];

export const RARITIES = ['common', 'uncommon', 'rare', 'custom', 'cursed'] as const;
export type Rarity = (typeof RARITIES)[number];

export const SPRITE_KEYS = [
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
] as const;
export type SpriteKey = (typeof SPRITE_KEYS)[number];

export const ENEMY_ARCHETYPES = ['paper', 'golem', 'humanoid', 'machine', 'blob', 'ghost', 'beast'] as const;
export type EnemyArchetype = (typeof ENEMY_ARCHETYPES)[number];

export const BEHAVIORS = ['swarm', 'patrol', 'ranged', 'charger', 'turret', 'ambush', 'splitter', 'chase', 'support', 'boss'] as const;
export type Behavior = (typeof BEHAVIORS)[number];

export const AFFIXES = ['shielded', 'teleporting', 'splitting', 'vampiric'] as const;
export type Affix = (typeof AFFIXES)[number];

export interface PerkEffects {
  everyNthHitCrit?: number;
  bonusQuestionChance?: number;
  enemyAccuracyDown?: number;
  bleedStacks?: number;
  bleedDamage?: number;
  firstHitAfterWrongBonus?: number;
  slowOnHit?: number;
  debuffSeconds?: number;
  chainPercent?: number;
  chainRadius?: number;
  pierce?: number;
  armorPen?: number;
  killHaste?: number;
  bonusVsStunned?: number;
  throwsTwice?: boolean;
  critChanceBonus?: number;
  knockbackBonus?: number;
  inkOnHit?: number;
  streakDamage?: number;
  dodgeDust?: boolean;
  damageMult?: number;
  aggroBonus?: number;
  resistChemical?: number;
  armorBonus?: number;
  speedBonus?: number;
  reachBonus?: number;
  lowHpDamage?: number;
  critMultBonus?: number;
  everyNthHitDouble?: number;
  auraSlow?: number;
  smartsOnKill?: number;
  damageVsFullHp?: number;
  damageTakenBonus?: number;
  splashChance?: number;
  splashPercent?: number;
  critBleed?: boolean;
  rangedPierce?: number;
}

export interface PerkDef {
  id: string;
  name: string;
  description: string;
  effects: PerkEffects;
}

export interface ResistanceMap {
  edge?: number;
  blunt?: number;
  ranged?: number;
  chemical?: number;
  fire?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: 'weapon' | 'armor';
  tier: number;
  tags: Tag[];
  damage: number;
  speed: number;
  reach: number;
  critChance: number;
  critMult: number;
  durability: number;
  weight: number;
  value: number;
  perks: string[];
  specialText: string;
  spriteKey: SpriteKey;
  icon: SpriteKey;
  flavor: string;
  armorValue?: number;
  dodgePenalty?: number;
  resistance?: ResistanceMap;
}

export interface RecipeDef {
  id: string;
  inputs: string[];
  output: string;
  smartsCost: number;
  bonusPerks: string[];
  note: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  role: 'normal' | 'elite' | 'boss';
  archetype: EnemyArchetype;
  palette: string;
  hp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldownMs: number;
  behavior: Behavior;
  windupMs: number;
  projectileSpeed?: number;
  armor?: number;
  splitInto?: string;
  affix?: Affix;
  callsForHelp?: boolean;
  leavesHazard?: string;
  drainsSmarts?: number;
  alarm?: boolean;
  phases?: number;
  quizGate?: boolean;
  flavor: string;
  act: number;
}

export interface ConsumableDef {
  id: string;
  name: string;
  tier: number;
  heal?: number;
  ink?: number;
  repair?: number;
  smarts?: number;
  speedBuff?: number;
  damageBuff?: number;
  buffSeconds?: number;
  skipQuestion?: boolean;
  flavor: string;
  spriteKey: SpriteKey;
  icon: SpriteKey;
  value: number;
}

export interface TrinketEffects {
  portableForge?: number;
  critChanceBonus?: number;
  damageMult?: number;
  smartsOnKill?: number;
  smartsBonus?: number;
  quizTimeBonus?: number;
  inkOnHit?: number;
  dodgeCooldownMult?: number;
  hpPerFloor?: number;
  tagDamage?: { tag: Tag; bonus: number };
  healOnKill?: number;
  extraHints?: number;
  secondChance?: number;
}

export interface TrinketDef {
  id: string;
  name: string;
  tier: number;
  description: string;
  effects: TrinketEffects;
  spriteKey: SpriteKey;
  value: number;
  flavor: string;
}

export interface QuestionDef {
  id: string;
  subject: Subject;
  tier: number;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  figure?: string;
  timeLimit?: number;
  verify?: number;
}

/** A playable student archetype. All numbers are multipliers or flat bonuses. */
export interface ClassDef {
  id: string;
  name: string;
  title: string;
  blurb: string;
  weaponId: string;
  hpMultiplier: number;
  damageMultiplier: number;
  moveSpeedMultiplier: number;
  critChanceBonus: number;
  reachBonus: number;
  armorBonus: number;
  inkBonus: number;
  dodgeCooldownMultiplier: number;
  blockReductionBonus: number;
  pros: string[];
  cons: string[];
  accent: string;
}

export interface DifficultyDef {
  id: string;
  name: string;
  tagline: string;
  description: string;
  enemyHpMultiplier: number;
  enemyDamageMultiplier: number;
  enemySpeedMultiplier: number;
  lootLuck: number;
  smartsMultiplier: number;
  accent: string;
}

/** One purchasable node on a class's skill tree. */
export interface SkillDef {
  id: string;
  classId: string;
  name: string;
  description: string;
  cost: number;
  tier: number;
  requires: string | null;
  effects?: PerkEffects;
  maxHp?: number;
  armor?: number;
  moveSpeed?: number;
  ink?: number;
}

export interface RoomTemplateDef {
  id: string;
  theme: string;
  name: string;
  sizeHint: 'small' | 'medium' | 'large' | 'wide';
  props: string[];
  hazard: string;
  tags: string[];
}

export interface ThemeDef {
  id: string;
  name: string;
  act: number;
  floorColor: string;
  wallColor: string;
  accentColor: string;
  motif: string;
  hazard: string;
  enemies: string[];
  subjects: Record<string, number>;
  flavor: string;
}

export interface Balance {
  player: {
    baseHp: number;
    baseInk: number;
    inkRegenPerSecond: number;
    inkOnHit: number;
    moveSpeed: number;
    sprintMultiplier: number;
    sprintDurationMs: number;
    sprintCooldownMs: number;
    dodgeSpeed: number;
    dodgeDurationMs: number;
    dodgeInvulnMs: number;
    dodgeCooldownMs: number;
    smartsCap: number;
    beltSlots: number;
    baseArmor: number;
    hurtInvulnMs: number;
  };
  combat: {
    armorScale: number;
    minDamage: number;
    critShake: number;
    hitStopMs: number;
    critHitStopMs: number;
    hitStopDamageScale: number;
    knockbackBase: number;
    damageNumberRise: number;
    inkSplashParticles: number;
    maxParticles: number;
    enemyIframesMs: number;
    enemyAlertRadius: number;
    enemyLeashRadius: number;
    stunnedDamageBonus: number;
    thrownReturnDelayMs: number;
    blockMoveMultiplier: number;
    blockDamageReduction: number;
    parryWindowMs: number;
    parryStunMs: number;
    parryCounterMultiplier: number;
    parryInvulnMs: number;
  };
  recovery: {
    killsPerHeal: number;
    killHealPercent: number;
    roomClearHealPercent: number;
  };
  enemyScaling: {
    hpGrowthPerFloor: number;
    damageGrowthPerFloor: number;
    speedGrowthPerFloor: number;
    speedCap: number;
    eliteHpMultiplier: number;
    eliteDamageMultiplier: number;
    eliteChanceBase: number;
    eliteChancePerFloor: number;
    eliteChanceMax: number;
    affixPerAct: boolean;
  };
  floorScaling: {
    floors: number;
    acts: { act: number; name: string; floors: [number, number] }[];
    roomsMin: number;
    roomsMax: number;
    chestsMin: number;
    chestsMax: number;
    locksMin: number;
    locksMax: number;
    enemyPackMin: number;
    enemyPackMax: number;
  };
  quiz: {
    baseTimerSeconds: number;
    timerPerTier: number;
    minTimerSeconds: number;
    tierPerFloor: number;
    tierJitter: number;
    adaptiveWindow: number;
    adaptiveHighAccuracy: number;
    adaptiveLowAccuracy: number;
    adaptiveDelta: number;
    hintCostSmarts: number;
    maxHintsPerQuestion: number;
    streakForFreeHint: number;
    firstTrySmartsBase: number;
    lockFailChipDamage: number;
    lockFailSpawnEnemies: number;
    lockFailFreeHintAt: number;
    lockTutorDebuffAt: number;
    tutorDebuffSeconds: number;
    popQuizBuffSeconds: number;
    popQuizDamageBonus: number;
    bossGateQuestions: number;
  };
  smarts: {
    enemyDropMin: number;
    enemyDropMax: number;
    eliteDropMin: number;
    eliteDropMax: number;
    bossDrop: number;
    chestMin: number;
    chestMax: number;
    rewardFirstTryBonus: number;
    shopStockMax: number;
    repairCostPerDurability: number;
    studyNookCost: number;
    studyNookHeal: number;
    rerollCost: number;
    perkRerollCost: number;
    questionSkipCost: number;
    targetRunSmartsMin: number;
    targetRunSmartsMax: number;
  };
  fusion: {
    minIngredients: number;
    maxIngredients: number;
    damageBonus: number;
    speedBonus: number;
    costTierGrowth: number;
    roughPrototypePenalty: number;
    roughPrototypeCostDiscount: number;
    roughPrototypeChance: number;
    maxInheritedPerks: number;
    newPerkChance: number;
    durabilityBonus: number;
    armorFusionScale: number;
  };
  loot: {
    pityCommonsBeforeUncommon: number;
    /** How many backpacks the reward screen offers to choose between. */
    choiceCount: number;
    /** Floors per tier of extra loot quality, on top of the rarity band. */
    depthTierEvery: number;
    /** Run levels per tier of extra loot quality. */
    levelTierEvery: number;
    /** Floors per run level. */
    levelPerFloors: number;
    /** Learned skill nodes per run level. */
    levelPerSkills: number;
    rarityWeights: Record<string, Record<Rarity, number>>;
    boss: {
      itemsMin: number;
      itemsMax: number;
      tierPerFloor: number;
    };
    cursedHpPenalty: number;
    cursedStatBonus: number;
  };
  /** The post-boss room where gear is upgraded by answering questions. */
  lockerRoom: {
    questions: number;
  };
  meta: {
    reportCardThresholds: number[];
    reportCardBonus: number;
    starterKits: { id: string; name: string; unlockCorrectAnswers: number; items: string[]; smarts: number }[];
  };
  world: {
    tileSize: number;
    viewWidth: number;
    viewHeight: number;
    floorWidthTiles: number;
    floorHeightTiles: number;
    roomMinSize: number;
    roomMaxSize: number;
    corridorWidth: number;
    cameraLerp: number;
  };
  audio: { defaultMaster: number; defaultSfx: number; defaultMusic: number; maxVoices: number };
  accessibility: {
    defaultShake: number;
    defaultFlashReduction: boolean;
    defaultTimerEnabled: boolean;
    defaultTextScale: number;
    defaultReduceMotion: boolean;
  };
}

export interface ContentBundle {
  balance: Balance;
  items: ItemDef[];
  perks: PerkDef[];
  recipes: RecipeDef[];
  enemies: EnemyDef[];
  consumables: ConsumableDef[];
  trinkets: TrinketDef[];
  questions: QuestionDef[];
  rooms: RoomTemplateDef[];
  themes: ThemeDef[];
  classes: ClassDef[];
  difficulties: DifficultyDef[];
  skills: SkillDef[];
}
