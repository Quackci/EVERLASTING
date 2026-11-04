import Phaser from 'phaser';
import {
  BALANCE,
  CLASSES,
  CLASS_BY_ID,
  DIFFICULTIES,
  DIFFICULTY_BY_ID,
  ENEMY_BY_ID,
  ITEMS,
  ITEM_BY_ID,
  QUESTIONS,
  ROOMS,
  SKILLS,
  SKILL_BY_ID,
} from '../content';
import { chestTextureKey, ensureItemIcon, ensurePropTexture, enemyTextureKey } from '../art/sprites';
import { playerAnimKey, playerTextureKey } from '../art/classSprites';
import { PixelLabel } from '../art/text';
import { createRng, weightedPick, type Rng } from '../core/rng';
import type { DifficultyDef, EnemyDef, ItemDef, PerkEffects, SkillDef, Subject } from '../content/types';
import { buildFloor, roomAt, TILE_FLOOR, TILE_WALL, type ChestSpot, type FloorPlan } from '../world/dungeon';
import {
  aggregateEffectList,
  attackSpeedOf,
  computeDamage,
  damageTakenMultiplier,
  emptyEffects,
  reachOf,
  resolveBlock,
  type AggregatedEffects,
} from '../systems/combat';
import { applyHeal, healForPercent, killHealDue } from '../systems/recovery';
import {
  aimVector,
  deathFadeMs,
  isRangedEnemy,
  type EnemyDifficultyModifiers,
  knockbackVector,
  preferredRange,
  scaleEnemyStats,
  shouldAggroInRoom,
  shouldDisengageRoom,
  smartsDrop,
  windupMs,
} from '../systems/enemy';
import {
  BIND_ACTIONS,
  MOUSE_LEFT,
  MOUSE_RIGHT,
  keyName,
  loadKeybinds,
  type BindAction,
  type Keybinds,
} from '../systems/keybinds';
import {
  pickBonusQuestion,
  presentQuestion,
  rollBossLoot,
  rollChestLoot,
  upgradeItem,
  upgradeTarget,
  type PresentedQuestion,
} from '../systems/loot';
import { clearSlot, makeSave, writeSlot } from '../systems/save';
import { nearestFreeSpot, overlapsWall } from '../systems/collision';
import {
  BAG_SLOTS,
  bagPageCount,
  bagPageOf,
  bagSlotRect,
  moveBagSelection,
  type BagDirection,
} from '../ui/bag';

interface RunSceneData {
  seed: number;
  floor: number;
  classId?: string;
  difficultyId?: string;
  slot?: number;
  smarts?: number;
  unlocked?: string[];
  hp?: number;
  /** Gear survives the stairs, so these carry the bag between floors. */
  inventory?: ItemDef[];
  weapon?: ItemDef | null;
  armor?: ItemDef | null;
}

interface EnemyActor {
  def: EnemyDef;
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  armor: number;
  elite: boolean;
  roomId: number;
  aggroed: boolean;
  alive: boolean;
  windupUntil: number;
  nextAttackAt: number;
  stunnedUntil: number;
  homeX: number;
  homeY: number;
}

interface PickupActor {
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image | null;
  chest: ChestSpot;
  opened: boolean;
  furniture: 'desk' | 'locker';
}

interface PendingLoot {
  items: ItemDef[];
  smarts: number;
  rarity: string;
  furniture: 'desk' | 'locker';
}

interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  run: () => void;
}

type OverlayKind =
  | 'none'
  | 'paused'
  | 'inventory'
  | 'loot'
  | 'loot-question'
  | 'loot-result'
  | 'skills'
  | 'locker'
  | 'locker-question'
  | 'locker-result';

const TILE = BALANCE.world.tileSize;
const VIEW_W = BALANCE.world.viewWidth;
const VIEW_H = BALANCE.world.viewHeight;
const INVENTORY_ROWS = 8;

function starterWeapon(classId?: string): ItemDef {
  const classDef = classId ? CLASS_BY_ID.get(classId) : undefined;
  const preferred = classDef ? ITEM_BY_ID.get(classDef.weaponId) : undefined;
  if (preferred) return preferred;
  const weapon = ITEMS.find((item) => item.id === 'pencil') ?? ITEMS.find((item) => item.kind === 'weapon');
  if (!weapon) throw new Error('Content is missing a starter weapon');
  return weapon;
}

export class RunScene extends Phaser.Scene {
  #seed = 1;
  #floor = 1;
  #plan!: FloorPlan;
  #combatRng: Rng = createRng(1);
  #lootRng: Rng = createRng(1);
  #questionRng: Rng = createRng(1);
  #ambientRng: Rng = createRng(1);
  #slot = 1;
  #classId: string = CLASSES[0]?.id ?? 'field_tripper';
  #difficultyId = 'midterm';
  #unlocked: string[] = [];
  #skillIndex = 0;
  #maxHp = BALANCE.player.baseHp;
  #inkMax = BALANCE.player.baseInk;
  #moveSpeed = BALANCE.player.moveSpeed;
  #armorValue = 0;
  #blockReductionBonus = 0;
  #dodgeCooldownMult = 1;
  #smartsMultiplier = 1;
  #difficulty?: DifficultyDef;
  #player!: Phaser.Physics.Arcade.Sprite;
  #playerShadow!: Phaser.GameObjects.Image;
  #wallZones: Phaser.GameObjects.GameObject[] = [];
  #gates: { image: Phaser.GameObjects.Image; index: number; opened: boolean }[] = [];
  #stairs!: Phaser.GameObjects.Image;
  #enemies: EnemyActor[] = [];
  #pickups: PickupActor[] = [];
  #projectiles!: Phaser.Physics.Arcade.Group;
  #weapon: ItemDef = starterWeapon();
  #armor: ItemDef | null = null;
  #inventory: ItemDef[] = [];
  #effects: AggregatedEffects = emptyEffects();
  #nextSwingAt = 0;
  #hp = BALANCE.player.baseHp;
  #ink = BALANCE.player.baseInk;
  #smarts = 0;
  #kills = 0;
  #clearedRooms = new Set<number>();
  #sprintUntil = 0;
  #sprintReadyAt = 0;
  #dodgeUntil = 0;
  #dodgeReadyAt = 0;
  #invulnUntil = 0;
  #knockbackUntil = 0;
  #safeX = 0;
  #safeY = 0;
  #dead = false;
  #facingDir: 'down' | 'up' | 'side' = 'down';
  #facing = { x: 0, y: 1 };
  #idleFrame = true;
  #hudTimer = 0;
  #toastUntil = 0;
  #blurHandler?: () => void;

  #binds: Keybinds = loadKeybinds();
  #bindKeys: Partial<Record<BindAction, Phaser.Input.Keyboard.Key>> = {};
  #arrows!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  #menu!: Record<
    'confirm' | 'space' | 'c' | 'k' | 'one' | 'two' | 'three' | 'four',
    Phaser.Input.Keyboard.Key
  >;

  #blocking = false;
  #blockStartedAt = 0;
  #pointerBlocking = false;
  #blockArc?: Phaser.GameObjects.Graphics;

  #overlay: OverlayKind = 'none';
  #overlayGfx?: Phaser.GameObjects.Graphics;
  #overlayLabels: PixelLabel[] = [];
  #overlayImages: Phaser.GameObjects.Image[] = [];
  #hotspots: Hotspot[] = [];
  #invIndex = 0;
  #pendingLoot: PendingLoot | null = null;
  #presented: PresentedQuestion | null = null;

  #restoredInventory: ItemDef[] | null = null;
  #restoredWeapon: ItemDef | null = null;
  #restoredArmor: ItemDef | null = null;

  #lockerDoor: { sprite: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image | null } | null = null;
  #lockerUsed = false;
  #lockerAttempts = 0;
  #lockerIndex = 0;
  #lockerTarget: ItemDef | null = null;

  #hpBar!: Phaser.GameObjects.Graphics;
  #hpLabel!: PixelLabel;
  #inkBar!: Phaser.GameObjects.Graphics;
  #inkLabel!: PixelLabel;
  #weaponLabel!: PixelLabel;
  #statusLabel!: PixelLabel;
  #toastLabel!: PixelLabel;
  #floorLabel!: PixelLabel;

  constructor() {
    super('Run');
  }

  init(data: RunSceneData = { seed: 1, floor: 1 }): void {
    this.#seed = data.seed >>> 0;
    this.#floor = data.floor;
    this.#slot = Math.max(1, Math.min(3, data.slot ?? 1));
    this.#classId = data.classId ?? this.#classId;
    this.#difficultyId = data.difficultyId ?? this.#difficultyId;
    this.#unlocked = [...new Set(data.unlocked ?? [])];
    this.#skillIndex = 0;
    this.#combatRng = createRng(this.#seed).fork(`combat-${this.#floor}`);
    this.#lootRng = createRng(this.#seed).fork(`loot-${this.#floor}`);
    this.#questionRng = createRng(this.#seed).fork(`quiz-${this.#floor}`);
    this.#ambientRng = createRng(this.#seed).fork(`ambient-${this.#floor}`);
    this.#restoredInventory = data.inventory ? [...data.inventory] : null;
    this.#restoredWeapon = data.weapon ?? null;
    this.#restoredArmor = data.armor ?? null;
    this.#weapon = starterWeapon();
    this.#armor = null;
    this.#inventory = [this.#weapon];
    this.#invIndex = 0;
    this.#effects = emptyEffects();
    this.#hp = data.hp ?? 0;
    this.#ink = BALANCE.player.baseInk;
    this.#smarts = data.smarts ?? 0;
    this.#kills = 0;
    this.#clearedRooms = new Set<number>();
    this.#dead = false;
    this.#nextSwingAt = 0;
    this.#wallZones = [];
    this.#gates = [];
    this.#enemies = [];
    this.#pickups = [];
    this.#sprintUntil = 0;
    this.#sprintReadyAt = 0;
    this.#dodgeUntil = 0;
    this.#dodgeReadyAt = 0;
    this.#invulnUntil = 0;
    this.#knockbackUntil = 0;
    this.#hudTimer = 0;
    this.#toastUntil = 0;
    this.#idleFrame = true;
    this.#facingDir = 'down';
    this.#facing = { x: 0, y: 1 };
    this.#blocking = false;
    this.#pointerBlocking = false;
    this.#overlay = 'none';
    this.#overlayLabels = [];
    this.#overlayImages = [];
    this.#hotspots = [];
    this.#pendingLoot = null;
    this.#presented = null;
    this.#lockerDoor = null;
    this.#lockerUsed = false;
    this.#lockerAttempts = 0;
    this.#lockerIndex = 0;
    this.#lockerTarget = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0f12');
    this.#plan = buildFloor(this.#seed, this.#floor, ROOMS);
    this.#applyLoadout();
    this.#projectiles = this.physics.add.group();
    this.#buildFloorVisuals();
    this.#createPlayer();
    this.#spawnEnemies();
    this.#buildPickups();
    this.#spawnAmbient();
    this.#createHud();
    this.#applyBinds();
    this.#bindPointer();

    // Vignette sits under the HUD so numbers stay readable at the edges.
    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setScrollFactor(0).setDepth(980);

    this.#blurHandler = (): void => {
      this.#pointerBlocking = false;
      if (this.#overlay === 'none') this.#openPause();
    };
    this.game.events.on(Phaser.Core.Events.BLUR, this.#blurHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.#blurHandler) this.game.events.off(Phaser.Core.Events.BLUR, this.#blurHandler);
      this.#clearOverlayVisuals();
      this.#destroyHud();
      this.#enemies = [];
      this.#pickups = [];
    });

    this.cameras.main.setBounds(0, 0, this.#plan.width * TILE, this.#plan.height * TILE);
    this.cameras.main.startFollow(this.#player, true, BALANCE.world.cameraLerp, BALANCE.world.cameraLerp);
    this.cameras.main.setRoundPixels(true);
    this.physics.world.setBounds(0, 0, this.#plan.width * TILE, this.#plan.height * TILE);

    const classDef = CLASS_BY_ID.get(this.#classId) ?? CLASSES[0];
    const mode = this.#difficulty ? ` / ${this.#difficulty.name.toUpperCase()}` : '';
    const who = classDef ? `  ${classDef.name.toUpperCase()}` : '';
    this.#showToast(`FLOOR ${this.#floor} - ${this.#plan.theme.name.toUpperCase()}${who}${mode}`, 2600);

    if (this.#plan.bossId) {
      const boss = ENEMY_BY_ID.get(this.#plan.bossId);
      if (boss) {
        this.time.delayedCall(1500, () =>
          this.#showToast(`${boss.name.toUpperCase()} IS WAITING BY THE STAIRS.`, 3000),
        );
      }
    }

    this.#persist();
  }

  // -------------------------------------------------------------------------
  // World construction
  // -------------------------------------------------------------------------

  #buildFloorVisuals(): void {
    const plan = this.#plan;
    const themeId = plan.themeId;
    const baked = this.add.renderTexture(0, 0, plan.width * TILE, plan.height * TILE).setOrigin(0, 0).setDepth(0);

    for (let y = 0; y < plan.height; y += 1) {
      for (let x = 0; x < plan.width; x += 1) {
        const tile = plan.tiles[y * plan.width + x] ?? TILE_WALL;
        const worldX = x * TILE;
        const worldY = y * TILE;
        if (tile === TILE_WALL) {
          baked.draw(`tile-${themeId}-wall`, worldX, worldY);
        } else {
          const variant = (x * 7 + y * 13) % 4;
          baked.draw(`tile-${themeId}-floor-${variant}`, worldX, worldY);
        }
      }
    }

    // Ambient occlusion: floors under walls catch a shadow, which is what stops
    // the dungeon reading as a flat grid of squares.
    for (let y = 0; y < plan.height; y += 1) {
      for (let x = 0; x < plan.width; x += 1) {
        const tile = plan.tiles[y * plan.width + x] ?? TILE_WALL;
        if (tile !== TILE_FLOOR) continue;
        const above = y > 0 ? plan.tiles[(y - 1) * plan.width + x] : TILE_WALL;
        const left = x > 0 ? plan.tiles[y * plan.width + x - 1] : TILE_WALL;
        if (above === TILE_WALL) baked.draw('ao-top', x * TILE, y * TILE);
        if (left === TILE_WALL) baked.draw('ao-left', x * TILE, y * TILE);
      }
    }

    const chestTiles = new Set(plan.chests.map((chest) => chest.y * plan.width + chest.x));
    for (const prop of plan.props) {
      if (chestTiles.has(prop.y * plan.width + prop.x)) continue;
      const key = ensurePropTexture(this, prop.prop);
      const px = prop.x * TILE + TILE / 2;
      const py = prop.y * TILE + TILE / 2;
      this.add.image(px, py + 5, 'shadow').setDepth(1).setAlpha(0.4);
      this.add.image(px, py, key).setDepth(2).setAlpha(0.98);
      if (prop.prop === 'lamp') {
        this.add
          .image(px, py, 'glow')
          .setDepth(3)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.6)
          .setScale(1.5);
      }
    }

    this.#stairs = this.add
      .image(plan.stairs.x * TILE + TILE / 2, plan.stairs.y * TILE + TILE / 2, 'stairs')
      .setDepth(3);

    for (const gate of plan.gates) {
      const image = this.add.image(gate.x * TILE + TILE / 2, gate.y * TILE + TILE / 2, 'gate').setDepth(4);
      this.#gates.push({ image, index: gate.index, opened: gate.opened });
    }

    // Merge solid tiles into horizontal runs so physics stays cheap.
    for (let y = 0; y < plan.height; y += 1) {
      let runStart = -1;
      for (let x = 0; x <= plan.width; x += 1) {
        const solid = x < plan.width && (plan.tiles[y * plan.width + x] ?? TILE_WALL) === TILE_WALL;
        const touchesFloor = solid && this.#touchesFloor(x, y);
        if (touchesFloor && runStart < 0) {
          runStart = x;
        } else if (!touchesFloor && runStart >= 0) {
          const length = x - runStart;
          if (length > 0) this.#addWallZone(runStart, y, length);
          runStart = -1;
        }
      }
    }
  }

  #touchesFloor(x: number, y: number): boolean {
    const plan = this.#plan;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= plan.width || ny >= plan.height) continue;
        const tile = plan.tiles[ny * plan.width + nx] ?? TILE_WALL;
        if (tile === TILE_FLOOR) return true;
      }
    }
    return false;
  }

  #addWallZone(tileX: number, tileY: number, tilesWide: number): void {
    const zone = this.add.zone(
      tileX * TILE + (tilesWide * TILE) / 2,
      tileY * TILE + TILE / 2,
      tilesWide * TILE,
      TILE,
    );
    this.physics.add.existing(zone, true);
    this.#wallZones.push(zone);
  }

  #createPlayer(): void {
    const spawn = this.#plan.spawn;
    this.#playerShadow = this.add.image(spawn.x * TILE + TILE / 2, spawn.y * TILE + TILE / 2 + 5, 'shadow').setDepth(19).setAlpha(0.5);
    this.#player = this.physics.add
      .sprite(spawn.x * TILE + TILE / 2, spawn.y * TILE + TILE / 2, playerTextureKey(this.#classId, 'down', 0))
      .setDepth(20);
    this.#player.setSize(10, 8);
    this.#player.setOffset(3, 7);
    this.#player.setCollideWorldBounds(true);
    this.physics.add.collider(this.#player, this.#wallZones);
    // The wall guard snaps back here if a dodge or knockback is ever resolved
    // into geometry, so the player never ends up stuck inside a wall.
    this.#safeX = this.#player.x;
    this.#safeY = this.#player.y;
    this.#blockArc = this.add.graphics().setDepth(21).setVisible(false);

    // Enemy shots die on walls and on the player; both paths clean up the image.
    this.physics.add.collider(this.#projectiles, this.#wallZones, (projectile) => {
      const image = projectile as Phaser.Physics.Arcade.Image;
      if (image.active) image.destroy();
    });
    this.physics.add.overlap(this.#player, this.#projectiles, (_player, projectile) => {
      this.#projectileHit(projectile as Phaser.GameObjects.GameObject);
    });
  }

  #spawnEnemies(): void {
    const plan = this.#plan;
    for (const spawn of plan.enemySpawns) {
      const def = ENEMY_BY_ID.get(spawn.enemyId);
      if (!def) continue;
      // Keep the entrance safe: nothing may start within five tiles of the player.
      const farFromSpawn =
        Math.abs(spawn.x - plan.spawn.x) > 5 || Math.abs(spawn.y - plan.spawn.y) > 5;
      if (!farFromSpawn) continue;
      this.#addEnemy(def, spawn.x * TILE + TILE / 2, spawn.y * TILE + TILE / 2, spawn.elite, spawn.roomId);
    }

    if (plan.bossId && plan.bossSpawn) {
      const def = ENEMY_BY_ID.get(plan.bossId);
      const room = roomAt(plan, plan.bossSpawn.x, plan.bossSpawn.y);
      if (def) {
        this.#addEnemy(
          def,
          plan.bossSpawn.x * TILE + TILE / 2,
          plan.bossSpawn.y * TILE + TILE / 2,
          false,
          room?.id ?? -1,
        );
      }
    }
  }

  #addEnemy(def: EnemyDef, x: number, y: number, elite: boolean, roomId: number): void {
    const stats = scaleEnemyStats(def, this.#floor, BALANCE, elite, this.#difficultyModifiers());
    const shadow = this.add.image(x, y + 6, 'shadow').setDepth(Math.round(y) - 1).setAlpha(0.45);
    const sprite = this.physics.add.sprite(x, y, enemyTextureKey(def.archetype, def.palette)).setDepth(Math.round(y));
    sprite.setSize(12, 12);
    sprite.setOffset(2, 4);
    sprite.setCollideWorldBounds(true);
    if (def.role === 'boss') sprite.setScale(1.8);
    this.physics.add.collider(sprite, this.#wallZones);

    const actor: EnemyActor = {
      def,
      sprite,
      shadow,
      bar: this.add.graphics().setDepth(950),
      hp: stats.hp,
      maxHp: stats.hp,
      damage: stats.damage,
      speed: stats.speed,
      armor: stats.armor,
      elite,
      roomId,
      aggroed: false,
      alive: true,
      windupUntil: 0,
      nextAttackAt: this.time.now + 600,
      stunnedUntil: 0,
      homeX: x,
      homeY: y,
    };
    this.#enemies.push(actor);
    this.#drawEnemyBar(actor);
  }

  #buildPickups(): void {
    for (const chest of this.#plan.chests) {
      const x = chest.x * TILE + TILE / 2;
      const y = chest.y * TILE + TILE / 2;
      this.add.image(x, y + 5, 'shadow').setDepth(1).setAlpha(0.45);
      const sprite = this.add.image(x, y, chestTextureKey(chest.furniture, false)).setDepth(Math.round(y));
      let glow: Phaser.GameObjects.Image | null = null;
      if (chest.furniture === 'locker') {
        glow = this.add
          .image(x, y, 'glow')
          .setDepth(sprite.depth - 1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.6)
          .setScale(1.7);
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.35, to: 0.85 },
          duration: 900,
          yoyo: true,
          repeat: -1,
        });
      }
      this.#pickups.push({ sprite, glow, chest, opened: false, furniture: chest.furniture });
    }
  }

  #spawnAmbient(): void {
    for (let i = 0; i < 26; i += 1) {
      const x = this.#ambientRng.range(0, this.#plan.width * TILE);
      const y = this.#ambientRng.range(0, this.#plan.height * TILE);
      const mote = this.add.image(x, y, 'mote').setAlpha(0.25).setDepth(6);
      this.tweens.add({
        targets: mote,
        y: y - this.#ambientRng.range(8, 24),
        alpha: { from: 0.08, to: 0.4 },
        duration: this.#ambientRng.range(2400, 5200),
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  #createHud(): void {
    this.#hpBar = this.add.graphics().setScrollFactor(0).setDepth(990);
    this.#inkBar = this.add.graphics().setScrollFactor(0).setDepth(990);
    this.#hpLabel = new PixelLabel(this, 24, 7, {
      text: 'HP',
      color: '#eef3e6',
      width: 120,
      maxLines: 1,
    })
      .setScrollFactor(0)
      .setDepth(991);
    this.#inkLabel = new PixelLabel(this, 24, 20, {
      text: 'INK',
      color: '#eef3e6',
      width: 120,
      maxLines: 1,
    })
      .setScrollFactor(0)
      .setDepth(991);
    this.#weaponLabel = new PixelLabel(this, 6, 33, {
      text: '',
      color: '#cfe3c0',
      width: 240,
      maxLines: 1,
    })
      .setScrollFactor(0)
      .setDepth(991);
    this.#statusLabel = new PixelLabel(this, VIEW_W - 6, 7, {
      text: '',
      color: '#e7c65b',
      width: 170,
      maxLines: 2,
      align: 'right',
    })
      .setScrollFactor(0)
      .setDepth(991);
    this.#floorLabel = new PixelLabel(this, 6, VIEW_H - 13, {
      text: '',
      color: '#8c949a',
      width: VIEW_W - 12,
      maxLines: 1,
    })
      .setScrollFactor(0)
      .setDepth(991);
    this.#toastLabel = new PixelLabel(this, VIEW_W / 2, 58, {
      text: '',
      color: '#e7c65b',
      width: 460,
      maxLines: 2,
      align: 'center',
    })
      .setScrollFactor(0)
      .setDepth(992);
    this.#refreshHud();
  }

  #destroyHud(): void {
    this.#hpBar?.destroy();
    this.#inkBar?.destroy();
    this.#hpLabel?.destroy();
    this.#inkLabel?.destroy();
    this.#weaponLabel?.destroy();
    this.#statusLabel?.destroy();
    this.#floorLabel?.destroy();
    this.#toastLabel?.destroy();
  }

  #applyBinds(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is required to play');
    }
    this.#binds = loadKeybinds();
    this.#bindKeys = {};
    for (const action of BIND_ACTIONS) {
      const code = this.#binds[action];
      if (code > 0) this.#bindKeys[action] = keyboard.addKey(code);
    }
    const code = Phaser.Input.Keyboard.KeyCodes;
    this.#arrows = {
      up: keyboard.addKey(code.UP),
      down: keyboard.addKey(code.DOWN),
      left: keyboard.addKey(code.LEFT),
      right: keyboard.addKey(code.RIGHT),
    };
    this.#menu = {
      confirm: keyboard.addKey(code.ENTER),
      space: keyboard.addKey(code.SPACE),
      c: keyboard.addKey(code.C),
      k: keyboard.addKey(code.K),
      one: keyboard.addKey(code.ONE),
      two: keyboard.addKey(code.TWO),
      three: keyboard.addKey(code.THREE),
      four: keyboard.addKey(code.FOUR),
    };
  }

  #bindPointer(): void {
    // No browser context menu on right click: that button is the attack.
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.#overlay !== 'none') {
        this.#handleOverlayClick(pointer.x, pointer.y);
        return;
      }
      if (this.#dead) return;
      // The mouse follows the binds: an action moved onto a mouse button
      // fires there, and an unbound one stops responding on that button.
      if (pointer.leftButtonDown()) {
        if (this.#binds.attack === MOUSE_LEFT) this.#swing(this.time.now);
        else this.#pointerBlocking = true;
        return;
      }
      if (pointer.rightButtonDown()) {
        if (this.#binds.block === MOUSE_RIGHT) {
          this.#pointerBlocking = true;
          return;
        }
        if (!this.#blocking) this.#swing(this.time.now);
      }
    });
    this.input.on('pointerup', () => {
      this.#pointerBlocking = false;
    });
  }

  #showToast(text: string, durationMs: number): void {
    this.#toastLabel.setText(text);
    this.#toastUntil = this.time.now + durationMs;
  }

  #refreshHud(): void {
    const barX = 6;
    const barY = 6;
    const barWidth = 78;
    this.#hpBar.clear();
    this.#hpBar.fillStyle(0x11181f, 1).fillRect(barX - 1, barY - 1, barWidth + 2, 8);
    this.#hpBar.fillStyle(0x8f2b30, 1).fillRect(barX, barY, barWidth, 6);
    const hpRatio = Math.max(0, Math.min(1, this.#hp / this.#maxHp));
    this.#hpBar.fillStyle(0xc8453f, 1).fillRect(barX, barY, Math.round(barWidth * hpRatio), 6);

    this.#inkBar.clear();
    this.#inkBar.fillStyle(0x11181f, 1).fillRect(barX - 1, barY + 12, barWidth + 2, 6);
    this.#inkBar.fillStyle(0x2c4a7d, 1).fillRect(barX, barY + 13, barWidth, 4);
    const inkRatio = Math.max(0, Math.min(1, this.#ink / this.#inkMax));
    this.#inkBar.fillStyle(0x4a76b8, 1).fillRect(barX, barY + 13, Math.round(barWidth * inkRatio), 4);

    const alive = this.#enemies.filter((enemy) => enemy.alive).length;
    this.#hpLabel.setText(`HP ${Math.max(0, Math.round(this.#hp))}`);
    this.#inkLabel.setText(`INK ${Math.max(0, Math.round(this.#ink))}`);
    const armor = this.#armor ? `  ARM ${this.#armor.armorValue ?? 0}` : '';
    this.#weaponLabel.setText(`${this.#weapon.name.toUpperCase()}  ${this.#weapon.damage} DMG${armor}`);
    this.#statusLabel.setText(`SMARTS ${this.#smarts}\nFLOOR ${this.#floor}/10  LEFT ${alive}`);
    this.#floorLabel.setText(
      `WASD MOVE  ${keyName(this.#binds.attack)}/RMB SWING  LEFT CLICK GUARD  ${keyName(this.#binds.interact)} OPEN  ${keyName(this.#binds.inventory)} BAG  ${keyName(this.#binds.pause)} MENU`,
    );
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------

  override update(time: number, delta: number): void {
    if (this.#dead) return;

    if (this.#overlay !== 'none') {
      this.#updateOverlay();
      return;
    }

    const left = this.#isDown('left') || this.#arrows.left.isDown;
    const right = this.#isDown('right') || this.#arrows.right.isDown;
    const up = this.#isDown('up') || this.#arrows.up.isDown;
    const down = this.#isDown('down') || this.#arrows.down.isDown;

    // Raw input axes drive facing, animation and dodging. Deriving them from the
    // normalised velocity made diagonal steps ambiguous and left attacks coming
    // out in the previous direction.
    const ix = (left ? -1 : 0) + (right ? 1 : 0);
    const iy = (up ? -1 : 0) + (down ? 1 : 0);
    const moving = ix !== 0 || iy !== 0;
    this.#updateFacing(ix, iy);

    if (this.#justPressed('pause')) {
      this.#openPause();
      return;
    }
    if (this.#justPressed('inventory')) {
      this.#openInventory();
      return;
    }

    this.#updateBlock(time);

    const body = this.#player.body as Phaser.Physics.Arcade.Body;
    this.#keepOutOfWalls(time, body);

    if (!this.#blocking && this.#justPressed('sprint') && time >= this.#sprintReadyAt && moving) {
      this.#sprintUntil = time + BALANCE.player.sprintDurationMs;
      this.#sprintReadyAt = time + BALANCE.player.sprintCooldownMs;
    }

    if (this.#justPressed('dodge') && time >= this.#dodgeReadyAt && !this.#blocking) {
      const facing = moving ? { x: ix, y: iy } : this.#facingVector();
      const length = Math.hypot(facing.x, facing.y) || 1;
      this.#dodgeUntil = time + BALANCE.player.dodgeDurationMs;
      this.#dodgeReadyAt = time + BALANCE.player.dodgeCooldownMs * this.#dodgeCooldownMult;
      this.#invulnUntil = Math.max(this.#invulnUntil, time + BALANCE.player.dodgeInvulnMs);
      body.setVelocity(
        (facing.x / length) * BALANCE.player.dodgeSpeed,
        (facing.y / length) * BALANCE.player.dodgeSpeed,
      );
      this.#spawnDust();
    }

    if (time < this.#dodgeUntil) {
      // Dodge velocity is already set; ignore steering until it ends.
    } else if (time < this.#knockbackUntil) {
      // Let the hit impulse play out before steering resumes.
    } else if (this.#blocking) {
      const speed = this.#moveSpeed * BALANCE.combat.blockMoveMultiplier;
      body.setVelocity(ix * speed, iy * speed);
    } else {
      const speed = this.#moveSpeed * (time < this.#sprintUntil ? BALANCE.player.sprintMultiplier : 1);
      body.setVelocity(ix * speed, iy * speed);
    }

    this.#animate(ix, iy);

    if (this.#justPressed('attack') && !this.#blocking) {
      this.#swing(time);
    }
    if (this.#justPressed('interact')) {
      this.#interact();
    }

    this.#updateEnemies(time);

    this.#player.setDepth(Math.round(this.#player.y));
    this.#playerShadow.setPosition(this.#player.x, this.#player.y + 5).setDepth(Math.round(this.#player.y) - 1);
    this.#player.setAlpha(time < this.#invulnUntil ? 0.6 : 1);
    this.#stairs.setDepth(this.#stairs.y);

    if (this.#ink < this.#inkMax) {
      this.#ink = Math.min(
        this.#inkMax,
        this.#ink + BALANCE.player.inkRegenPerSecond * (delta / 1000),
      );
    }

    if (this.time.now > this.#toastUntil && this.#toastLabel.text.length > 0) {
      this.#toastLabel.setText('');
    }

    this.#hudTimer += delta;
    if (this.#hudTimer > 160) {
      this.#hudTimer = 0;
      this.#refreshHud();
    }
  }

  // -------------------------------------------------------------------------
  // Input helpers
  // -------------------------------------------------------------------------

  #isDown(action: BindAction): boolean {
    const key = this.#bindKeys[action];
    return key ? key.isDown : false;
  }

  #justPressed(action: BindAction): boolean {
    const key = this.#bindKeys[action];
    return key ? Phaser.Input.Keyboard.JustDown(key) : false;
  }

  #navJust(direction: BagDirection): boolean {
    const key = this.#bindKeys[direction];
    const bindHit = key ? Phaser.Input.Keyboard.JustDown(key) : false;
    return bindHit || Phaser.Input.Keyboard.JustDown(this.#arrows[direction]);
  }

  #bagDirectionPressed(): BagDirection | null {
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      if (this.#navJust(direction)) return direction;
    }
    return null;
  }

  #digitPressed(): number | null {
    const keys = [this.#menu.one, this.#menu.two, this.#menu.three, this.#menu.four];
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (key && Phaser.Input.Keyboard.JustDown(key)) return index;
    }
    return null;
  }

  #updateFacing(ix: number, iy: number): void {
    if (ix === 0 && iy === 0) return;
    const length = Math.hypot(ix, iy);
    this.#facing = { x: ix / length, y: iy / length };
    if (ix !== 0) {
      this.#facingDir = 'side';
      this.#player.setFlipX(ix < 0);
    } else {
      this.#facingDir = iy < 0 ? 'up' : 'down';
    }
  }

  #facingVector(): { x: number; y: number } {
    return { ...this.#facing };
  }

  #animate(ix: number, iy: number): void {
    const moving = ix !== 0 || iy !== 0;
    if (!moving) {
      if (!this.#idleFrame) {
        this.#player.anims.stop();
        this.#player.setTexture(playerTextureKey(this.#classId, this.#facingDir, 0));
        this.#idleFrame = true;
      }
      return;
    }
    this.#idleFrame = false;
    const walk = playerAnimKey(this.#classId, this.#facingDir);
    if (this.#player.anims.currentAnim?.key !== walk) {
      this.#player.anims.play(walk, true);
    }
  }

  /**
   * Arcade separation can resolve a fast dodge or a knockback into the far side
   * of a wall run, or into a corner it cannot back out of. Rather than trust the
   * solver, keep the last clear body position and snap back the moment the body
   * is inside geometry, cancelling the impulse that put it there.
   */
  #keepOutOfWalls(time: number, body: Phaser.Physics.Arcade.Body): void {
    const box = { halfWidth: body.halfWidth, halfHeight: body.halfHeight };
    if (!overlapsWall(this.#plan, TILE, body.center.x, body.center.y, box)) {
      this.#safeX = this.#player.x;
      this.#safeY = this.#player.y;
      return;
    }
    const spot = nearestFreeSpot(this.#plan, TILE, body.center.x, body.center.y, box);
    const target = spot ?? { x: this.#safeX, y: this.#safeY };
    const offsetX = this.#player.x - body.center.x;
    const offsetY = this.#player.y - body.center.y;
    this.#player.setPosition(target.x + offsetX, target.y + offsetY);
    body.reset(this.#player.x, this.#player.y);
    body.setVelocity(0, 0);
    this.#safeX = this.#player.x;
    this.#safeY = this.#player.y;
    if (time < this.#dodgeUntil) this.#dodgeUntil = 0;
    if (time < this.#knockbackUntil) this.#knockbackUntil = 0;
  }

  #updateBlock(time: number): void {
    const key = this.#bindKeys.block;
    const wants = this.#pointerBlocking || (key ? key.isDown : false);
    if (wants && !this.#blocking) {
      this.#blocking = true;
      this.#blockStartedAt = time;
      this.#blockArc?.setVisible(true);
    } else if (!wants && this.#blocking) {
      this.#blocking = false;
      this.#blockArc?.setVisible(false);
    }
    if (this.#blocking) this.#drawBlockArc(time);
  }

  #drawBlockArc(time: number): void {
    const graphics = this.#blockArc;
    if (!graphics) return;
    const angle = Math.atan2(this.#facing.y, this.#facing.x);
    const inWindow = time - this.#blockStartedAt <= BALANCE.combat.parryWindowMs;
    graphics.clear();
    graphics.lineStyle(inWindow ? 2 : 1, inWindow ? 0xe7c65b : 0x4a76b8, inWindow ? 0.95 : 0.65);
    graphics.beginPath();
    graphics.arc(this.#player.x, this.#player.y - 2, 15, angle - 0.7, angle + 0.7);
    graphics.strokePath();
    if (inWindow) {
      graphics.lineStyle(1, 0xcfe3c0, 0.7);
      graphics.beginPath();
      graphics.arc(this.#player.x, this.#player.y - 2, 12, angle - 0.5, angle + 0.5);
      graphics.strokePath();
    }
  }

  // -------------------------------------------------------------------------
  // Player combat
  // -------------------------------------------------------------------------

  #swing(time: number): void {
    if (time < this.#nextSwingAt) return;
    const rate = Math.max(0.2, attackSpeedOf(this.#weapon, this.#effects));
    this.#nextSwingAt = time + 1000 / rate;

    const facing = this.#facingVector();
    const reach = Math.max(20, reachOf(this.#weapon, this.#effects));
    this.#drawSwing(facing, reach);

    for (const enemy of this.#enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.sprite.x - this.#player.x;
      const dy = enemy.sprite.y - this.#player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > reach + 10) continue;
      const dot = distance === 0 ? 1 : (dx * facing.x + dy * facing.y) / distance;
      if (dot < 0.2) continue;
      this.#damageEnemy(enemy, facing);
      if (this.#dead) return;
    }
  }

  #damageEnemy(enemy: EnemyActor, facing: { x: number; y: number }, multiplier = 1): void {
    const result = computeDamage({
      baseDamage: this.#weapon.damage * multiplier,
      effects: this.#effects,
      globalMult: 0,
      flatBonus: 0,
      targetArmor: enemy.armor,
      targetResist: 0,
      isRanged: false,
      targetStunned: enemy.stunnedUntil > this.time.now,
      targetAtFullHp: enemy.hp === enemy.maxHp,
      attackerHpPct: this.#hp / this.#maxHp,
      streak: 0,
      firstHitAfterWrong: false,
      critRoll: this.#combatRng.next(),
      critChance: this.#weapon.critChance,
      armorScale: BALANCE.combat.armorScale,
      minDamage: BALANCE.combat.minDamage,
    });

    enemy.hp -= result.amount;
    enemy.aggroed = true;
    this.#ink = Math.min(BALANCE.player.baseInk, this.#ink + BALANCE.player.inkOnHit);
    this.#showFloat(
      enemy.sprite.x,
      enemy.sprite.y - 12,
      `${result.amount}${result.crit ? '!' : ''}`,
      result.crit ? '#e7c65b' : '#eef3e6',
    );
    this.#applyHitStop(result.crit);
    this.#spawnDust(enemy.sprite.x, enemy.sprite.y, result.crit ? 8 : 4);
    enemy.sprite.setTintFill(result.crit ? 0xffffff : 0xffd0c0);
    this.time.delayedCall(70, () => {
      if (enemy.sprite.active) enemy.sprite.clearTint();
    });

    const push = knockbackVector(
      { x: this.#player.x, y: this.#player.y },
      { x: enemy.sprite.x + facing.x, y: enemy.sprite.y + facing.y },
      result.knockback,
    );
    enemy.sprite.setVelocity(push.x, push.y);
    enemy.windupUntil = 0;

    if (enemy.hp <= 0) {
      this.#killEnemy(enemy);
    } else {
      this.#drawEnemyBar(enemy);
    }
  }

  #drawSwing(facing: { x: number; y: number }, reach: number): void {
    const graphics = this.add.graphics().setDepth(this.#player.depth + 4);
    const angle = Math.atan2(facing.y, facing.x);
    graphics.lineStyle(2, 0xcfe3c0, 0.9);
    graphics.beginPath();
    graphics.arc(this.#player.x, this.#player.y - 2, reach, angle - 0.6, angle + 0.6);
    graphics.strokePath();
    graphics.lineStyle(1, 0xe7c65b, 0.5);
    graphics.beginPath();
    graphics.arc(this.#player.x, this.#player.y - 2, Math.max(6, reach - 6), angle - 0.5, angle + 0.5);
    graphics.strokePath();
    this.tweens.add({ targets: graphics, alpha: 0, duration: 150, onComplete: () => graphics.destroy() });
  }

  #applyHitStop(crit: boolean): void {
    const duration = crit ? BALANCE.combat.critHitStopMs : BALANCE.combat.hitStopMs;
    const strength = BALANCE.combat.critShake * (crit ? 0.02 : 0.012);
    this.cameras.main.shake(duration, strength);
  }

  #showFloat(x: number, y: number, text: string, color: string): void {
    const label = new PixelLabel(this, x, y, {
      text,
      color,
      width: 64,
      maxLines: 1,
      align: 'center',
    }).setDepth(960);
    this.tweens.add({
      targets: label.image,
      y: y - BALANCE.combat.damageNumberRise,
      alpha: 0,
      duration: 620,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  #hurtPlayer(amount: number, sourceX: number, sourceY: number, source?: EnemyActor): void {
    if (this.#dead) return;
    const now = this.time.now;
    if (now < this.#invulnUntil) return;

    let incoming = Math.max(1, Math.round(amount * damageTakenMultiplier(this.#effects, 'blunt')));
    const armorTotal = this.#armorValue + (this.#armor?.armorValue ?? 0);
    if (armorTotal > 0) {
      incoming = Math.max(1, incoming - Math.round(armorTotal * 0.35));
    }

    if (this.#blocking) {
      const outcome = resolveBlock(
        incoming,
        now - this.#blockStartedAt,
        BALANCE,
        this.#blockReductionBonus,
      );
      if (outcome.parried) {
        this.#invulnUntil = now + BALANCE.combat.parryInvulnMs;
        this.#showFloat(this.#player.x, this.#player.y - 18, 'PARRY!', '#e7c65b');
        this.#spawnSparks(this.#player.x + this.#facing.x * 12, this.#player.y + this.#facing.y * 12, 10);
        this.#cameras().flash(80, 231, 198, 91);
        if (source && source.alive) {
          source.stunnedUntil = now + BALANCE.combat.parryStunMs;
          source.windupUntil = 0;
          source.sprite.setVelocity(0, 0);
          this.#damageEnemy(source, this.#facing, BALANCE.combat.parryCounterMultiplier);
        }
        return;
      }
      incoming = outcome.damage;
      this.#showFloat(this.#player.x, this.#player.y - 18, 'BLOCKED', '#a9c4a0');
      this.#spawnDust(this.#player.x, this.#player.y, 4);
    }

    this.#hp -= incoming;
    this.#invulnUntil = now + BALANCE.player.hurtInvulnMs;
    this.#knockbackUntil = now + 160;
    this.#applyHitStop(false);
    this.#showFloat(this.#player.x, this.#player.y - 14, `${incoming}`, '#c8453f');
    this.#player.setTintFill(0xff5a4a);
    this.time.delayedCall(120, () => {
      if (this.#player.active) this.#player.clearTint();
    });

    const push = knockbackVector(
      { x: sourceX, y: sourceY },
      { x: this.#player.x, y: this.#player.y },
      150,
    );
    (this.#player.body as Phaser.Physics.Arcade.Body).setVelocity(push.x, push.y);

    this.#refreshHud();
    if (this.#hp <= 0) {
      this.#gameOver();
    }
  }

  /** Applies a heal, floats the amount gained and returns it (0 at full HP). */
  #healPlayer(amount: number): number {
    if (this.#dead || amount <= 0) return 0;
    const before = this.#hp;
    this.#hp = applyHeal(this.#hp, this.#maxHp, amount);
    const gained = Math.round(this.#hp - before);
    if (gained <= 0) return 0;
    this.#showFloat(this.#player.x, this.#player.y - 18, `+${gained}`, '#8fd694');
    this.#refreshHud();
    return gained;
  }

  /** Pays out once per room, and only for rooms that held an enemy. */
  #clearRoom(roomId: number): void {
    if (roomId < 0 || this.#clearedRooms.has(roomId)) return;
    if (!this.#enemies.some((enemy) => enemy.roomId === roomId)) return;
    if (this.#enemies.some((enemy) => enemy.alive && enemy.roomId === roomId)) return;
    this.#clearedRooms.add(roomId);
    const gained = this.#healPlayer(healForPercent(this.#maxHp, BALANCE.recovery.roomClearHealPercent));
    this.#showToast(gained > 0 ? `ROOM CLEAR. +${gained} HP.` : 'ROOM CLEAR.', 1500);
  }

  /** Upgrades an item and keeps the bag, weapon and armor references in sync. */
  #upgradeInPlace(target: ItemDef): ItemDef {
    const upgraded = upgradeItem(target);
    const at = this.#inventory.indexOf(target);
    if (at >= 0) this.#inventory[at] = upgraded;
    if (this.#weapon === target) this.#weapon = upgraded;
    if (this.#armor === target) this.#armor = upgraded;
    if (this.#lockerTarget === target) this.#lockerTarget = upgraded;
    this.#refreshHud();
    return upgraded;
  }

  /** Boss payout: stage-scaled gear, then the door to the locker room. */
  #dropBossLoot(roomId: number, x: number, y: number): void {
    const loot = rollBossLoot(this.#lootRng, this.#floor, BALANCE, ITEMS);
    for (const item of loot.items) this.#inventory.push(item);
    this.#spawnLockerRoom(roomId, x, y);
    this.#refreshHud();
    this.time.delayedCall(900, () => {
      if (this.#dead) return;
      this.#pendingLoot = { items: loot.items, smarts: loot.smarts, rarity: loot.rarity, furniture: 'locker' };
      this.#openLootPanel();
    });
  }

  #spawnLockerRoom(roomId: number, fallbackX: number, fallbackY: number): void {
    const room = this.#plan.rooms.find((candidate) => candidate.id === roomId);
    const doorX = room ? room.cx * TILE + TILE / 2 : fallbackX;
    const doorY = room ? room.cy * TILE + TILE / 2 : fallbackY;
    const sprite = this.add.image(doorX, doorY, chestTextureKey('locker', false)).setDepth(Math.round(doorY) + 1);
    const glow = this.add
      .image(doorX, doorY, 'glow')
      .setDepth(sprite.depth - 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.7)
      .setScale(2.2);
    this.tweens.add({ targets: glow, alpha: { from: 0.4, to: 0.95 }, duration: 900, yoyo: true, repeat: -1 });
    this.#lockerDoor = { sprite, glow };
    this.#lockerUsed = false;
  }

  #openLockerRoom(): void {
    if (this.#lockerUsed) {
      this.#showToast('THE LOCKER ROOM IS CLOSED. ONE VISIT PER BOSS.', 1800);
      return;
    }
    this.#lockerAttempts = Math.max(1, BALANCE.lockerRoom.questions);
    this.#lockerIndex = 0;
    this.#lockerTarget = null;
    this.#openOverlay('locker');
    this.#renderLockerRoom();
  }

  #renderLockerRoom(): void {
    this.#resetOverlayContent();
    this.#panel(24, 18, 432, 234);
    this.#text('LOCKER ROOM', 38, 26, '#e7c65b', { width: 240 });
    const left = `${this.#lockerAttempts} QUESTION${this.#lockerAttempts === 1 ? '' : 'S'} LEFT`;
    this.#text(left, VIEW_W - 38, 26, '#a9c4a0', { width: 170, align: 'right' });
    this.#text('PICK A PIECE OF GEAR. A RIGHT ANSWER UPGRADES IT A TIER.', 38, 40, '#cfe3c0', {
      width: 410,
    });

    const count = this.#inventory.length;
    this.#lockerIndex = Math.max(0, Math.min(this.#lockerIndex, count - 1));
    const start = Math.max(
      0,
      Math.min(this.#lockerIndex - Math.floor(INVENTORY_ROWS / 2), count - INVENTORY_ROWS),
    );
    for (let row = 0; row < INVENTORY_ROWS; row += 1) {
      const index = start + row;
      const item = this.#inventory[index];
      if (!item) break;
      const y = 58 + row * 15;
      const selected = index === this.#lockerIndex;
      if (selected) this.#rowHighlight(34, y - 3, 412, 14);
      this.#icon(item, 42, y + 3);
      this.#text(item.name.toUpperCase(), 54, y, selected ? '#e7c65b' : '#b9c0c4', { width: 250 });
      const right =
        item.kind === 'weapon' ? `T${item.tier}  ${item.damage} DMG` : `T${item.tier}  ARM ${item.armorValue ?? 0}`;
      this.#text(right, 300, y, '#8c949a', { width: 130, align: 'right' });
      this.#addHotspot(34, y - 3, 412, 14, () => {
        this.#lockerIndex = index;
        this.#renderLockerRoom();
      });
    }

    if (count === 0) {
      this.#text('NOTHING IN THE BAG TO UPGRADE.', VIEW_W / 2, 120, '#b9c0c4', { width: 360, align: 'center' });
    }
    this.#overlayGfx?.fillStyle(0x233040, 1).fillRect(150, 196, 180, 18);
    this.#text('ENTER  ANSWER THE QUESTION', VIEW_W / 2, 201, '#e7c65b', { width: 300, align: 'center' });
    this.#addHotspot(150, 196, 180, 18, () => this.#openLockerQuestion(this.#inventory[this.#lockerIndex] ?? null));
    this.#text(
      `${keyName(this.#binds.up)}/${keyName(this.#binds.down)} SELECT   ${keyName(this.#binds.pause)} LEAVE`,
      38,
      230,
      '#a9c4a0',
      { width: 400 },
    );
  }

  #openLockerQuestion(target: ItemDef | null): void {
    if (!target) return;
    this.#lockerTarget = target;
    const question = pickBonusQuestion(this.#questionRng, QUESTIONS, this.#themeSubject());
    this.#presented = presentQuestion(this.#questionRng, question);
    this.#overlay = 'locker-question';
    this.#resetOverlayContent();
    this.#panel(24, 20, 432, 230);
    this.#text(`LOCKER ROOM - ${target.name.toUpperCase()} ON THE BENCH`, VIEW_W / 2, 28, '#e7c65b', {
      width: 400,
      align: 'center',
    });
    this.#text(this.#presented.prompt, VIEW_W / 2, 46, '#eef3e6', {
      width: 384,
      maxLines: 3,
      align: 'center',
    });
    this.#presented.choices.forEach((choice, index) => {
      const y = 100 + index * 22;
      this.#text(`${index + 1}. ${choice}`, 48, y, '#cfe3c0', { width: 390 });
      this.#addHotspot(42, y - 4, 400, 19, () => this.#answerLockerQuestion(index));
    });
    this.#text(`${this.#lockerAttempts} LEFT. A WRONG ANSWER BURNS ONE.`, VIEW_W / 2, 212, '#a9c4a0', {
      width: 380,
      align: 'center',
    });
  }

  #answerLockerQuestion(index: number): void {
    const presented = this.#presented;
    if (!presented) return;
    const correct = index === presented.answerIndex;
    let upgradedName = '';
    let upgradedTier = 0;

    if (correct && this.#lockerTarget) {
      const upgraded = this.#upgradeInPlace(this.#lockerTarget);
      upgradedName = upgraded.name.toUpperCase();
      upgradedTier = upgraded.tier;
      this.#spawnSparks(this.#player.x, this.#player.y - 8, 12);
    }

    this.#lockerAttempts = Math.max(0, this.#lockerAttempts - 1);
    this.#overlay = 'locker-result';
    this.#resetOverlayContent();
    this.#panel(40, 40, 400, 190);
    this.#text(correct ? 'CORRECT - GEAR UPGRADED' : 'NOT QUITE - NO UPGRADE', VIEW_W / 2, 50, correct ? '#a9c4a0' : '#c8453f', {
      width: 360,
      align: 'center',
    });
    this.#text(
      correct && upgradedName
        ? `${upgradedName} IS NOW TIER ${upgradedTier}.`
        : `THE ANSWER WAS: ${presented.choices[presented.answerIndex] ?? ''}`,
      VIEW_W / 2,
      72,
      '#eef3e6',
      { width: 350, maxLines: 2, align: 'center' },
    );
    this.#text(presented.explanation, VIEW_W / 2, 116, '#b9c0c4', {
      width: 350,
      maxLines: 3,
      align: 'center',
    });
    this.#text(this.#lockerAttempts > 0 ? 'SPACE  NEXT ITEM' : 'SPACE  LEAVE', VIEW_W / 2, 196, '#8c949a', {
      width: 350,
      align: 'center',
    });
    this.#addHotspot(40, 40, 400, 190, () => this.#leaveLockerResult());
    this.#refreshHud();
  }

  #leaveLockerResult(): void {
    this.#presented = null;
    if (this.#lockerAttempts > 0) {
      this.#overlay = 'locker';
      this.#renderLockerRoom();
      return;
    }
    this.#finishLockerRoom();
  }

  #skipLockerQuestion(): void {
    this.#presented = null;
    this.#lockerAttempts = Math.max(0, this.#lockerAttempts - 1);
    if (this.#lockerAttempts > 0) {
      this.#overlay = 'locker';
      this.#renderLockerRoom();
      return;
    }
    this.#finishLockerRoom();
  }

  #finishLockerRoom(): void {
    this.#lockerUsed = true;
    this.#lockerTarget = null;
    if (this.#lockerDoor?.glow) {
      this.#lockerDoor.glow.destroy();
      this.#lockerDoor.glow = null;
    }
    this.#lockerDoor?.sprite.setTint(0x6f7a80);
    this.#closeOverlay();
    this.#showToast('THE LOCKER ROOM GOES DARK. THE STAIRS ARE WAITING.', 2200);
  }

  #cameras(): Phaser.Cameras.Scene2D.Camera {
    return this.cameras.main;
  }

  #gameOver(): void {
    this.#dead = true;
    this.#hp = 0;
    clearSlot(this.#slot);
    this.#blocking = false;
    this.#pointerBlocking = false;
    this.#blockArc?.setVisible(false);
    this.#refreshHud();
    this.physics.pause();
    this.#showToast('YOU FAILED. THE HALLWAY RESETS.', 2600);
    this.time.delayedCall(2400, () => this.scene.start('Title'));
  }

  #killEnemy(enemy: EnemyActor): void {
    enemy.alive = false;
    enemy.hp = 0;
    enemy.bar.destroy();
    enemy.shadow.destroy();
    const body = enemy.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    this.#smarts = Math.min(
      BALANCE.player.smartsCap,
      this.#smarts + this.#smartsGain(smartsDrop(enemy.def, this.#combatRng, BALANCE)),
    );
    this.#kills += 1;
    const recovery = BALANCE.recovery;
    if (killHealDue(this.#kills, recovery)) {
      this.#healPlayer(healForPercent(this.#maxHp, recovery.killHealPercent));
    }
    this.#clearRoom(enemy.roomId);
    this.#spawnDust(enemy.sprite.x, enemy.sprite.y, 10);
    const targetScale = enemy.sprite.scaleX * 1.15;
    this.tweens.add({
      targets: enemy.sprite,
      alpha: 0,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: deathFadeMs(enemy.def.role),
      onComplete: () => enemy.sprite.destroy(),
    });
    if (enemy.def.role === 'boss') {
      this.#showToast(`${enemy.def.name.toUpperCase()} FALLS. A LOCKER ROOM OPENS.`, 3200);
      this.#dropBossLoot(enemy.roomId, enemy.sprite.x, enemy.sprite.y);
    } else if (enemy.def.role === 'elite') {
      this.#showToast(`${enemy.def.name.toUpperCase()} IS DOWN.`, 1800);
    }
    this.#refreshHud();
  }

  // -------------------------------------------------------------------------
  // Enemy loop
  // -------------------------------------------------------------------------

  #playerRoomId(): number | null {
    const room = roomAt(
      this.#plan,
      Math.floor(this.#player.x / TILE),
      Math.floor(this.#player.y / TILE),
    );
    return room ? room.id : null;
  }

  #updateEnemies(time: number): void {
    const playerX = this.#player.x;
    const playerY = this.#player.y;
    const playerRoomId = this.#playerRoomId();

    for (const enemy of this.#enemies) {
      if (!enemy.alive) continue;
      const sprite = enemy.sprite;
      const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, playerX, playerY);

      // Room-scoped aggro: enemies sleep until the player is in their room.
      if (!enemy.aggroed && shouldAggroInRoom(playerRoomId, enemy.roomId, distance, BALANCE.combat.enemyAlertRadius)) {
        enemy.aggroed = true;
        this.#showFloat(sprite.x, sprite.y - 20, '!', '#e7c65b');
      }
      if (enemy.aggroed && shouldDisengageRoom(playerRoomId, enemy.roomId)) {
        enemy.aggroed = false;
        enemy.windupUntil = 0;
      }

      if (enemy.stunnedUntil > time) {
        sprite.setVelocity(0, 0);
        if (sprite.active) {
          const blink = Math.floor(time / 80) % 2 === 0;
          if (blink) sprite.setTint(0xe7c65b);
          else sprite.clearTint();
        }
        this.#syncEnemy(enemy);
        continue;
      }

      if (enemy.windupUntil > 0) {
        sprite.setVelocity(0, 0);
        if (sprite.active) {
          const blink = Math.floor(time / 70) % 2 === 0;
          if (blink) sprite.setTint(enemy.elite ? 0xffe08a : 0xff8a5a);
          else sprite.clearTint();
        }
        if (time >= enemy.windupUntil) {
          enemy.windupUntil = 0;
          if (sprite.active) sprite.clearTint();
          this.#enemyStrike(enemy, time);
        }
        this.#syncEnemy(enemy);
        continue;
      }

      if (enemy.aggroed) {
        if (time >= enemy.nextAttackAt && distance <= enemy.def.attackRange) {
          enemy.windupUntil = time + windupMs(enemy.def);
          sprite.setVelocity(0, 0);
          continue;
        }
        if (distance > preferredRange(enemy.def)) {
          const velocity = aimVector({ x: sprite.x, y: sprite.y }, { x: playerX, y: playerY }, enemy.speed);
          sprite.setVelocity(velocity.x, velocity.y);
          if (isRangedEnemy(enemy.def) && distance <= enemy.def.attackRange) {
            sprite.setVelocity(0, 0);
          }
        } else {
          sprite.setVelocity(0, 0);
        }
      } else {
        const homeDistance = Phaser.Math.Distance.Between(sprite.x, sprite.y, enemy.homeX, enemy.homeY);
        if (homeDistance > 8) {
          const velocity = aimVector(
            { x: sprite.x, y: sprite.y },
            { x: enemy.homeX, y: enemy.homeY },
            enemy.speed * 0.35,
          );
          sprite.setVelocity(velocity.x, velocity.y);
        } else {
          sprite.setVelocity(0, 0);
        }
      }

      this.#syncEnemy(enemy);
    }
  }

  #syncEnemy(enemy: EnemyActor): void {
    const sprite = enemy.sprite;
    sprite.setDepth(Math.round(sprite.y));
    enemy.shadow.setPosition(sprite.x, sprite.y + 6).setDepth(Math.round(sprite.y) - 1);
    this.#drawEnemyBar(enemy);
  }

  #enemyStrike(enemy: EnemyActor, time: number): void {
    enemy.nextAttackAt = time + enemy.def.attackCooldownMs;
    const sprite = enemy.sprite;
    const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, this.#player.x, this.#player.y);

    if (isRangedEnemy(enemy.def)) {
      const shot = this.#projectiles.create(sprite.x, sprite.y, 'projectile') as Phaser.Physics.Arcade.Image;
      shot.setDepth(sprite.depth + 1);
      const speed = enemy.def.projectileSpeed ?? 120;
      const velocity = aimVector(
        { x: sprite.x, y: sprite.y },
        { x: this.#player.x, y: this.#player.y },
        speed,
      );
      shot.setData('damage', enemy.damage);
      shot.setVelocity(velocity.x, velocity.y);
      const cleanup = this.time.delayedCall(2600, () => {
        if (shot.active) shot.destroy();
      });
      shot.once(Phaser.GameObjects.Events.DESTROY, () => cleanup.remove(false));
      return;
    }

    if (distance <= enemy.def.attackRange + 6) {
      this.#hurtPlayer(enemy.damage, sprite.x, sprite.y, enemy);
    }
  }

  #projectileHit(shot: Phaser.GameObjects.GameObject): void {
    const image = shot as Phaser.Physics.Arcade.Image;
    if (!image.active) return;
    const damage = Number(image.getData('damage') ?? 1);
    const { x, y } = image;
    if (this.#blocking) {
      this.#hurtPlayer(damage, x, y);
      if (image.active) image.destroy();
      return;
    }
    image.destroy();
    this.#hurtPlayer(damage, x, y);
  }

  #drawEnemyBar(enemy: EnemyActor): void {
    const bar = enemy.bar;
    bar.clear();
    if (!enemy.alive) return;
    const boss = enemy.def.role === 'boss';
    const showAlways = boss || enemy.elite || enemy.aggroed;
    if (!showAlways && enemy.hp >= enemy.maxHp) return;

    const width = boss ? 34 : 16;
    const x = enemy.sprite.x - width / 2;
    const y = enemy.sprite.y - (boss ? 22 : 13);
    const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    bar.fillStyle(0x11181f, 0.9).fillRect(x - 1, y - 1, width + 2, 4);
    bar.fillStyle(0x8f2b30, 1).fillRect(x, y, width, 2);
    bar.fillStyle(boss || enemy.elite ? 0xe7c65b : 0xc8453f, 1).fillRect(x, y, Math.round(width * ratio), 2);
  }

  // -------------------------------------------------------------------------
  // Interaction and the loot flow
  // -------------------------------------------------------------------------

  #interact(): void {
    const playerX = this.#player.x;
    const playerY = this.#player.y;

    let nearest: PickupActor | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const pickup of this.#pickups) {
      if (pickup.opened) continue;
      const distance = Math.hypot(pickup.sprite.x - playerX, pickup.sprite.y - playerY);
      if (distance < 26 && distance < nearestDistance) {
        nearest = pickup;
        nearestDistance = distance;
      }
    }
    if (nearest) {
      this.#openPickup(nearest);
      return;
    }

    if (this.#lockerDoor && !this.#lockerUsed) {
      const door = this.#lockerDoor.sprite;
      if (Math.hypot(door.x - playerX, door.y - playerY) < 28) {
        this.#openLockerRoom();
        return;
      }
    }

    const gate = this.#gates.find(
      (candidate) =>
        !candidate.opened &&
        Math.abs(candidate.image.x - playerX) < 22 &&
        Math.abs(candidate.image.y - playerY) < 22,
    );
    if (gate) {
      this.#showToast('LOCKED - THE QUIZ SIGIL IS DARK. FIND ANOTHER WAY.', 2400);
      return;
    }

    if (Math.abs(this.#stairs.x - playerX) < 20 && Math.abs(this.#stairs.y - playerY) < 20) {
      const bossAlive = this.#enemies.some((enemy) => enemy.alive && enemy.def.role === 'boss');
      if (bossAlive) {
        this.#showToast('THE WAY DOWN IS SEALED UNTIL THE ROOM IS QUIET.', 2400);
        return;
      }
      this.#descend();
      return;
    }

    this.#showToast('NOTHING WITHIN REACH. DESKS AND LOCKERS GLOW.', 1600);
  }

  #openPickup(pickup: PickupActor): void {
    pickup.opened = true;
    pickup.sprite.setTexture(chestTextureKey(pickup.furniture, true));
    if (pickup.glow) {
      pickup.glow.destroy();
      pickup.glow = null;
    }
    this.#spawnSparks(pickup.sprite.x, pickup.sprite.y - 2, 8);

    const luck = this.#difficulty?.lootLuck ?? 0;
    const loot = rollChestLoot(this.#lootRng, pickup.chest, this.#floor, BALANCE, ITEMS, luck);
    this.#smarts = Math.min(BALANCE.player.smartsCap, this.#smarts + this.#smartsGain(loot.smarts));
    for (const item of loot.items) this.#inventory.push(item);
    this.#pendingLoot = { ...loot, furniture: pickup.furniture };
    this.#refreshHud();
    this.#openLootPanel();
  }

  #openLootPanel(): void {
    const pending = this.#pendingLoot;
    if (!pending) return;
    this.#openOverlay('loot');
    this.#panel(52, 38, 376, 194);
    const heading = pending.furniture === 'locker' ? 'THE LOCKER CLICKS OPEN' : 'THE DESK DRAWER OPENS';
    this.#text(heading, VIEW_W / 2, 48, '#e7c65b', { width: 350, align: 'center' });
    const smarts = pending.smarts > 0 ? `  +${pending.smarts} SMARTS` : '';
    this.#text(`${pending.rarity.toUpperCase()} FIND${smarts}`, VIEW_W / 2, 64, '#cfe3c0', {
      width: 350,
      align: 'center',
    });

    if (pending.items.length === 0) {
      this.#text('EMPTY. SOMEBODY GOT HERE FIRST.', VIEW_W / 2, 104, '#b9c0c4', { width: 330, align: 'center' });
    }
    pending.items.forEach((item, index) => {
      const y = 86 + index * 30;
      this.#icon(item, 74, y + 4);
      this.#text(item.name.toUpperCase(), 90, y, '#eef3e6', { width: 240 });
      const stats =
        item.kind === 'weapon'
          ? `TIER ${item.tier}   ${item.damage} DMG   ${item.speed} SPD`
          : `TIER ${item.tier}   ARMOR ${item.armorValue ?? 0}`;
      this.#text(stats, 90, y + 11, '#a9c4a0', { width: 240 });
    });

    this.#text('SPACE  BONUS QUESTION TO UPGRADE ONE', VIEW_W / 2, 186, '#e7c65b', { width: 360, align: 'center' });
    this.#text(`${keyName(this.#binds.pause)}  TAKE IT AND GO`, VIEW_W / 2, 200, '#a9c4a0', {
      width: 360,
      align: 'center',
    });
    this.#addHotspot(60, 44, 360, 190, () => this.#openLootQuestion());
  }

  #openLootQuestion(): void {
    const pending = this.#pendingLoot;
    if (!pending || pending.items.length === 0) {
      this.#closeOverlay();
      return;
    }
    const question = pickBonusQuestion(this.#questionRng, QUESTIONS, this.#themeSubject());
    this.#presented = presentQuestion(this.#questionRng, question);
    this.#overlay = 'loot-question';
    this.#resetOverlayContent();
    this.#panel(24, 20, 432, 230);
    this.#text('BONUS QUESTION - ANSWER TO UPGRADE ONE ITEM', VIEW_W / 2, 28, '#e7c65b', {
      width: 400,
      align: 'center',
    });
    this.#text(this.#presented.prompt, VIEW_W / 2, 46, '#eef3e6', {
      width: 384,
      maxLines: 3,
      align: 'center',
    });
    this.#presented.choices.forEach((choice, index) => {
      const y = 100 + index * 22;
      this.#text(`${index + 1}. ${choice}`, 48, y, '#cfe3c0', { width: 390 });
      this.#addHotspot(42, y - 4, 400, 19, () => this.#answerLootQuestion(index));
    });
    this.#text('PRESS 1-4 OR CLICK AN ANSWER', VIEW_W / 2, 212, '#a9c4a0', {
      width: 380,
      align: 'center',
    });
  }

  #answerLootQuestion(index: number): void {
    const presented = this.#presented;
    if (!presented) return;
    const correct = index === presented.answerIndex;
    const pending = this.#pendingLoot;
    let upgradedName = '';
    let upgradedTier = 0;

    if (correct && pending) {
      const target = upgradeTarget(pending.items);
      if (target) {
        const upgraded = this.#upgradeInPlace(target);
        pending.items = pending.items.map((item) => (item === target ? upgraded : item));
        upgradedName = upgraded.name.toUpperCase();
        upgradedTier = upgraded.tier;
        this.#spawnSparks(this.#player.x, this.#player.y - 8, 12);
      }
    }

    this.#overlay = 'loot-result';
    this.#resetOverlayContent();
    this.#panel(40, 40, 400, 190);
    this.#text(correct ? 'CORRECT - ITEM UPGRADED' : 'NOT QUITE - NO UPGRADE', VIEW_W / 2, 50, correct ? '#a9c4a0' : '#c8453f', {
      width: 360,
      align: 'center',
    });
    this.#text(
      correct && upgradedName
        ? `${upgradedName} IS NOW TIER ${upgradedTier}.`
        : `THE ANSWER WAS: ${presented.choices[presented.answerIndex] ?? ''}`,
      VIEW_W / 2,
      72,
      '#eef3e6',
      { width: 350, maxLines: 2, align: 'center' },
    );
    this.#text(presented.explanation, VIEW_W / 2, 116, '#b9c0c4', {
      width: 350,
      maxLines: 3,
      align: 'center',
    });
    this.#text('SPACE  CLOSE', VIEW_W / 2, 196, '#8c949a', { width: 350, align: 'center' });
    this.#addHotspot(40, 40, 400, 190, () => this.#closeOverlay());
    this.#refreshHud();
  }

  #themeSubject(): Subject | undefined {
    const entries = Object.entries(this.#plan.theme.subjects).map(([value, weight]) => ({
      value: value as Subject,
      weight: Number(weight),
    }));
    if (entries.length === 0) return undefined;
    return weightedPick(this.#questionRng, entries);
  }

  #applyLoadout(): void {
    const classDef = CLASS_BY_ID.get(this.#classId) ?? CLASSES[0];
    if (!classDef) throw new Error('Content is missing playable classes');
    const difficulty = DIFFICULTY_BY_ID.get(this.#difficultyId) ?? DIFFICULTIES[0];
    if (!difficulty) throw new Error('Content is missing difficulty levels');
    this.#difficulty = difficulty;
    this.#blockReductionBonus = classDef.blockReductionBonus;
    this.#dodgeCooldownMult = classDef.dodgeCooldownMultiplier;
    this.#smartsMultiplier = difficulty.smartsMultiplier;
    if (this.#restoredInventory && this.#restoredInventory.length > 0) {
      this.#inventory = [...this.#restoredInventory];
      const carried = this.#restoredWeapon;
      this.#weapon =
        (carried && this.#inventory.includes(carried) ? carried : null) ??
        this.#inventory.find((item) => item.kind === 'weapon') ??
        starterWeapon(classDef.id);
      this.#armor =
        this.#restoredArmor && this.#inventory.includes(this.#restoredArmor) ? this.#restoredArmor : null;
    } else {
      this.#weapon = starterWeapon(classDef.id);
      this.#inventory = [this.#weapon];
      this.#armor = null;
    }
    this.#recomputeStats();
    this.#ink = this.#inkMax;
  }

  #recomputeStats(): void {
    const classDef = CLASS_BY_ID.get(this.#classId) ?? CLASSES[0];
    if (!classDef) return;
    const nodeEffects: PerkEffects[] = [];
    let bonusHp = 0;
    let bonusArmor = 0;
    let bonusSpeed = 0;
    let bonusInk = 0;
    for (const id of this.#unlocked) {
      const skill = SKILL_BY_ID.get(id);
      if (!skill) continue;
      if (skill.effects) nodeEffects.push(skill.effects);
      bonusHp += skill.maxHp ?? 0;
      bonusArmor += skill.armor ?? 0;
      bonusSpeed += skill.moveSpeed ?? 0;
      bonusInk += skill.ink ?? 0;
    }
    this.#effects = aggregateEffectList([
      {
        damageMult: classDef.damageMultiplier - 1,
        critChanceBonus: classDef.critChanceBonus,
        reachBonus: classDef.reachBonus,
        armorBonus: classDef.armorBonus,
      },
      ...nodeEffects,
    ]);
    this.#maxHp = Math.max(1, Math.round(BALANCE.player.baseHp * classDef.hpMultiplier) + bonusHp);
    this.#armorValue = classDef.armorBonus + bonusArmor;
    this.#moveSpeed = BALANCE.player.moveSpeed * classDef.moveSpeedMultiplier + bonusSpeed;
    this.#inkMax = BALANCE.player.baseInk + classDef.inkBonus + bonusInk;
    this.#hp = this.#hp > 0 ? Math.min(this.#hp, this.#maxHp) : this.#maxHp;
    this.#ink = Math.min(this.#ink, this.#inkMax);
  }

  #difficultyModifiers(): EnemyDifficultyModifiers {
    const difficulty = this.#difficulty;
    if (!difficulty) return {};
    return {
      hpMultiplier: difficulty.enemyHpMultiplier,
      damageMultiplier: difficulty.enemyDamageMultiplier,
      speedMultiplier: difficulty.enemySpeedMultiplier,
    };
  }

  #smartsGain(amount: number): number {
    return Math.max(0, Math.round(amount * this.#smartsMultiplier));
  }

  #persist(): void {
    if (this.#dead) return;
    writeSlot(
      makeSave({
        slot: this.#slot,
        seed: this.#seed,
        floor: this.#floor,
        classId: this.#classId,
        difficultyId: this.#difficultyId,
        smarts: this.#smarts,
        unlocked: this.#unlocked,
        hp: Math.max(0, Math.round(this.#hp)),
        maxHp: this.#maxHp,
        updatedAt: Date.now(),
      }),
    );
  }

  #skillPool(): SkillDef[] {
    return SKILLS.filter((skill) => skill.classId === this.#classId);
  }

  #skillUnlocked(id: string): boolean {
    return this.#unlocked.includes(id);
  }

  #skillAvailable(skill: SkillDef): boolean {
    if (this.#skillUnlocked(skill.id)) return false;
    return skill.requires === null || this.#skillUnlocked(skill.requires);
  }

  #openSkills(): void {
    this.#openOverlay('skills');
    this.#skillIndex = 0;
    this.#renderSkills();
  }

  #renderSkills(): void {
    this.#resetOverlayContent();
    this.#panel(24, 16, 432, 238);
    const classDef = CLASS_BY_ID.get(this.#classId);
    this.#text(`${(classDef?.name ?? 'STUDENT').toUpperCase()} - SKILL TREE`, 38, 24, '#e7c65b', {
      width: 300,
    });
    this.#text(`${this.#smarts} SMARTS`, VIEW_W - 38, 24, '#a9c4a0', { width: 120, align: 'right' });

    const nodes = this.#skillPool();
    const selected = nodes[this.#skillIndex];
    nodes.forEach((skill, index) => {
      const y = 46 + index * 22;
      const owned = this.#skillUnlocked(skill.id);
      const available = this.#skillAvailable(skill);
      const affordable = this.#smarts >= skill.cost;
      const active = index === this.#skillIndex;
      if (active) this.#rowHighlight(32, y - 3, 416, 20);
      const mark = owned ? '[X]' : available ? (affordable ? '[ ]' : '[/]') : '[-]';
      const color = owned ? '#a9c4a0' : available ? (affordable ? '#eef3e6' : '#8c949a') : '#5f686f';
      this.#text(`${mark} T${skill.tier}  ${skill.name.toUpperCase()}`, 38, y, active ? '#e7c65b' : color, {
        width: 300,
      });
      this.#text(owned ? 'LEARNED' : `${skill.cost} SMARTS`, 330, y, owned ? '#6fae5f' : color, {
        width: 110,
        align: 'right',
      });
      this.#addHotspot(32, y - 3, 416, 20, () => {
        this.#skillIndex = index;
        this.#renderSkills();
      });
    });

    if (selected) {
      this.#text(selected.description, 38, 182, '#b9c0c4', { width: 400, maxLines: 2 });
      const locked = !this.#skillAvailable(selected) && !this.#skillUnlocked(selected.id);
      const note = this.#skillUnlocked(selected.id)
        ? 'ALREADY ON YOUR RECORD.'
        : locked
          ? 'REQUIRES AN EARLIER NODE.'
          : this.#smarts < selected.cost
            ? `NEED ${selected.cost - this.#smarts} MORE SMARTS.`
            : 'ENTER TO LEARN.';
      this.#text(note, 38, 206, locked ? '#c8453f' : '#e7c65b', { width: 400 });
    }
    this.#text('W/S SELECT   ENTER LEARN   K CLOSE', 38, 226, '#a9c4a0', { width: 400 });
  }

  #buySkill(): void {
    const skill = this.#skillPool()[this.#skillIndex];
    if (!skill) return;
    if (!this.#skillAvailable(skill) || this.#smarts < skill.cost) return;
    this.#smarts -= skill.cost;
    this.#unlocked.push(skill.id);
    this.#recomputeStats();
    this.#hp = Math.min(this.#maxHp, this.#hp + (skill.maxHp ?? 0));
    this.#spawnSparks(this.#player.x, this.#player.y - 10, 10);
    this.#persist();
    this.#refreshHud();
    this.#renderSkills();
  }

  #descend(): void {
    const nextFloor = this.#floor + 1;
    if (nextFloor > BALANCE.floorScaling.floors) {
      this.#showToast('THE HALLWAY ENDS. FOR NOW.', 2200);
      this.time.delayedCall(1400, () => this.scene.start('Title'));
      return;
    }
    this.#persist();
    this.scene.restart({
      seed: this.#seed,
      floor: nextFloor,
      classId: this.#classId,
      difficultyId: this.#difficultyId,
      slot: this.#slot,
      smarts: this.#smarts,
      unlocked: this.#unlocked,
      hp: this.#hp,
      inventory: this.#inventory,
      weapon: this.#weapon,
      armor: this.#armor,
    });
  }

  // -------------------------------------------------------------------------
  // Overlays: pause, inventory, loot
  // -------------------------------------------------------------------------

  #openOverlay(kind: OverlayKind): void {
    this.#clearOverlayVisuals();
    this.#overlay = kind;
    this.physics.pause();
    this.#pointerBlocking = false;
    this.#blocking = false;
    this.#blockArc?.setVisible(false);
    this.#blockArc?.clear();
    this.#overlayGfx = this.add.graphics().setScrollFactor(0).setDepth(2000);
  }

  #resetOverlayContent(): void {
    for (const label of this.#overlayLabels) label.destroy();
    this.#overlayLabels = [];
    for (const image of this.#overlayImages) image.destroy();
    this.#overlayImages = [];
    this.#hotspots = [];
    this.#overlayGfx?.clear();
  }

  #clearOverlayVisuals(): void {
    this.#resetOverlayContent();
    this.#overlayGfx?.destroy();
    this.#overlayGfx = undefined;
  }

  #closeOverlay(): void {
    this.#clearOverlayVisuals();
    this.#overlay = 'none';
    this.#pendingLoot = null;
    this.#presented = null;
    if (!this.#dead) this.physics.resume();
    this.#refreshHud();
  }

  #panel(x: number, y: number, w: number, h: number): void {
    const graphics = this.#overlayGfx;
    if (!graphics) return;
    graphics.fillStyle(0x0b0f12, 0.74).fillRect(0, 0, VIEW_W, VIEW_H);
    // Classroom chalkboard in a wooden frame, with the chalk tray underneath.
    graphics.fillStyle(0x654630, 1).fillRect(x - 4, y - 4, w + 8, h + 8);
    graphics.fillStyle(0xa87c50, 1).fillRect(x - 4, y - 4, w + 8, 2);
    graphics.fillStyle(0x417a45, 1).fillRect(x, y, w, h);
    graphics.fillStyle(0xcfe3c0, 0.16).fillRect(x + 2, y + 2, w - 4, 1);
    // Erased smudges, deliberately not aligned with anything else on the board.
    graphics.fillStyle(0xcfe3c0, 0.05).fillRect(x + 12, y + h - 40, w - 60, 7);
    graphics.fillStyle(0xcfe3c0, 0.04).fillRect(x + 40, y + 22, w - 120, 4);
    graphics.fillStyle(0x8a6242, 1).fillRect(x, y + h + 2, w, 4);
    graphics.fillStyle(0xeef3e6, 0.9).fillRect(x + 12, y + h + 3, 18, 2);
  }

  /** Selected row on a chalkboard: a chalk wash plus a yellow chalk tick. */
  #rowHighlight(x: number, y: number, w: number, h: number): void {
    const graphics = this.#overlayGfx;
    if (!graphics) return;
    graphics.fillStyle(0xcfe3c0, 0.12).fillRect(x, y, w, h);
    graphics.fillStyle(0xe7c65b, 1).fillRect(x, y, 2, h);
  }

  #text(
    text: string,
    x: number,
    y: number,
    color = '#eef3e6',
    options: { width?: number; maxLines?: number; align?: 'left' | 'center' | 'right'; scale?: number } = {},
  ): PixelLabel {
    const label = new PixelLabel(this, x, y, {
      text,
      color,
      width: options.width ?? 300,
      maxLines: options.maxLines ?? 1,
      align: options.align ?? 'left',
      scale: options.scale ?? 1,
    });
    label.setScrollFactor(0).setDepth(2001);
    this.#overlayLabels.push(label);
    return label;
  }

  #icon(item: ItemDef, x: number, y: number): void {
    const key = ensureItemIcon(this, item.spriteKey, item.tier);
    const image = this.add.image(x, y, key).setScrollFactor(0).setDepth(2001);
    this.#overlayImages.push(image);
  }

  #addHotspot(x: number, y: number, w: number, h: number, run: () => void): void {
    this.#hotspots.push({ x, y, w, h, run });
  }

  #handleOverlayClick(x: number, y: number): void {
    for (const spot of this.#hotspots) {
      if (x >= spot.x && x <= spot.x + spot.w && y >= spot.y && y <= spot.y + spot.h) {
        spot.run();
        return;
      }
    }
  }

  #openPause(): void {
    this.#openOverlay('paused');
    this.#panel(70, 38, 340, 194);
    this.#text('PAUSED', VIEW_W / 2, 50, '#e7c65b', { width: 320, align: 'center', scale: 2 });
    const rows: { text: string; run: () => void }[] = [
      { text: `${keyName(this.#binds.pause)}   RESUME`, run: () => this.#closeOverlay() },
      { text: `${keyName(this.#binds.inventory)}   SCHOOL BAG`, run: () => this.#openInventory() },
      { text: 'K   SKILL TREE', run: () => this.#openSkills() },
      { text: 'C   CONTROLS & KEYBINDS', run: () => this.#openSettings() },
    ];
    rows.forEach((row, index) => {
      const y = 86 + index * 15;
      this.#text(row.text, 96, y, index === 0 ? '#cfe3c0' : '#b9c0c4', { width: 280 });
      this.#addHotspot(84, y - 4, 300, 15, row.run);
    });
    this.#text('LEFT CLICK GUARD, RIGHT CLICK SWING.\nLOCKERS GLOW WHEN THEY HOLD SOMETHING.', 96, 150, '#a9c4a0', {
      width: 290,
      maxLines: 2,
    });
    this.#text(
      `FLOOR ${this.#floor}   HP ${Math.max(0, Math.round(this.#hp))}   SMARTS ${this.#smarts}`,
      96,
      182,
      '#e7c65b',
      { width: 290 },
    );
  }

  #openInventory(): void {
    this.#openOverlay('inventory');
    this.#renderInventory();
  }

  /**
   * The bag: a chalk drawing of a backpack, a page of pocket slots, and the
   * selected item on a sheet of ruled paper. Everything is still driven by the
   * keyboard, so the click hotspots are a convenience rather than a requirement.
   */
  #renderInventory(): void {
    this.#resetOverlayContent();
    this.#panel(16, 10, 448, 250);
    const count = this.#inventory.length;
    this.#invIndex = Math.max(0, Math.min(this.#invIndex, Math.max(0, count - 1)));
    const page = bagPageOf(this.#invIndex);
    const pages = bagPageCount(count);

    this.#text('SCHOOL BAG', 30, 16, '#e7c65b', { width: 220 });
    this.#text(`${count} ITEM${count === 1 ? '' : 'S'}   PAGE ${page + 1}/${pages}`, 450, 16, '#cfe3c0', {
      width: 220,
      align: 'right',
    });

    this.#drawBackpack(30, 46);
    this.#drawBagTabs(pages, page);
    this.#drawBagGrid(page * BAG_SLOTS);
    this.#drawBagCard(count === 0 ? null : this.#inventory[this.#invIndex] ?? null);

    this.#text('ENTER  EQUIP IT', 30, 184, '#cfe3c0', { width: 240 });
    this.#text(
      `${keyName(this.#binds.up)}/${keyName(this.#binds.down)}/${keyName(this.#binds.left)}/${keyName(this.#binds.right)} SELECT   ${keyName(this.#binds.pause)} CLOSE`,
      30,
      200,
      '#a9c4a0',
      { width: 430 },
    );
  }

  #drawBackpack(x: number, y: number): void {
    const graphics = this.#overlayGfx;
    if (!graphics) return;
    graphics.fillStyle(0x11181f, 0.45).fillRect(x + 6, y + 96, 72, 6);
    // Straps first, so the body covers their lower halves.
    graphics.fillStyle(0x654630, 1).fillRect(x + 14, y, 8, 22);
    graphics.fillStyle(0x654630, 1).fillRect(x + 62, y, 8, 22);
    graphics.fillStyle(0x8a6242, 1).fillRect(x + 8, y + 14, 68, 88);
    graphics.fillStyle(0x654630, 1).fillRect(x + 8, y + 14, 68, 24);
    graphics.fillStyle(0xd9cfb4, 1).fillRect(x + 8, y + 38, 68, 1);
    // Buckle.
    graphics.fillStyle(0xe7c65b, 1).fillRect(x + 38, y + 20, 8, 8);
    graphics.fillStyle(0x11181f, 1).fillRect(x + 40, y + 22, 4, 4);
    // Zip, front pocket and school crest.
    graphics.fillStyle(0xd9cfb4, 1).fillRect(x + 10, y + 46, 64, 1);
    graphics.fillStyle(0x654630, 1).fillRect(x + 18, y + 52, 48, 34);
    graphics.fillStyle(0x8a6242, 1).fillRect(x + 18, y + 52, 48, 2);
    graphics.fillStyle(0x4a76b8, 1).fillRect(x + 24, y + 60, 10, 10);
    graphics.fillStyle(0xe7c65b, 1).fillRect(x + 27, y + 63, 4, 4);
    // Side pockets.
    graphics.fillStyle(0x654630, 1).fillRect(x + 4, y + 56, 5, 22);
    graphics.fillStyle(0x654630, 1).fillRect(x + 75, y + 56, 5, 22);
    graphics.fillStyle(0xd9cfb4, 0.8);
    for (let dot = 0; dot < 8; dot += 1) graphics.fillRect(x + 12 + dot * 8, y + 96, 3, 1);
    this.#text('YOUR BAG', x + 42, y + 106, '#a9c4a0', { width: 84, align: 'center' });
  }

  #drawBagTabs(pages: number, page: number): void {
    const graphics = this.#overlayGfx;
    if (!graphics) return;
    for (let index = 0; index < pages; index += 1) {
      const x = 126 + index * 20;
      const active = index === page;
      graphics.fillStyle(active ? 0xe7c65b : 0x5f686f, 1).fillRect(x, 46, 16, 7);
      graphics.fillStyle(0x11181f, 1).fillRect(x, 46, 16, 1);
      this.#addHotspot(x, 44, 16, 10, () => {
        this.#invIndex = Math.min(Math.max(0, this.#inventory.length - 1), index * BAG_SLOTS);
        this.#renderInventory();
      });
    }
  }

  #drawBagGrid(pageStart: number): void {
    const graphics = this.#overlayGfx;
    if (!graphics) return;
    for (let slot = 0; slot < BAG_SLOTS; slot += 1) {
      const index = pageStart + slot;
      const item = this.#inventory[index];
      const rect = bagSlotRect(slot, 126, 58, 34, 6);
      const selected = index === this.#invIndex && Boolean(item);
      const top = rect.y - (selected ? 2 : 0);
      graphics.fillStyle(0x11181f, 0.55).fillRect(rect.x + 2, top + 3, rect.w, rect.h);
      graphics.fillStyle(0xf3ecd8, 1).fillRect(rect.x, top, rect.w, rect.h);
      graphics.fillStyle(0xd9cfb4, 1).fillRect(rect.x, top + rect.h - 2, rect.w, 2);
      graphics.lineStyle(selected ? 2 : 1, selected ? 0xe7c65b : 0x1a2430, 1);
      graphics.strokeRect(rect.x + 0.5, top + 0.5, rect.w - 1, rect.h - 1);
      if (item) {
        this.#icon(item, rect.x + rect.w / 2, top + rect.h / 2 - 2);
        if (item === this.#weapon || item === this.#armor) {
          graphics.fillStyle(0x6fae5f, 1).fillRect(rect.x + rect.w - 8, top + 3, 5, 5);
        }
        this.#addHotspot(rect.x, top, rect.w, rect.h, () => {
          this.#invIndex = index;
          this.#renderInventory();
        });
      } else {
        graphics.fillStyle(0x8c949a, 0.45);
        graphics.fillRect(rect.x + 13, top + 16, 8, 1);
        graphics.fillRect(rect.x + 16, top + 13, 1, 8);
      }
    }
  }

  #drawBagCard(item: ItemDef | null): void {
    const graphics = this.#overlayGfx;
    if (!graphics) return;
    const x = 252;
    const y = 58;
    const w = 196;
    const h = 118;
    graphics.fillStyle(0x11181f, 0.5).fillRect(x + 2, y + 3, w, h);
    graphics.fillStyle(0xf3ecd8, 1).fillRect(x, y, w, h);
    // Ruled exercise-book paper with a red margin.
    for (let line = y + 15; line < y + h - 6; line += 11) {
      graphics.fillStyle(0xd9cfb4, 1).fillRect(x + 14, line, w - 22, 1);
    }
    graphics.fillStyle(0xc8453f, 1).fillRect(x + 12, y, 1, h);

    if (!item) {
      this.#text('NOTHING SELECTED', x + 22, y + 20, '#5f686f', { width: w - 34 });
      this.#text('DESKS AND LOCKERS FILL THIS BAG AS YOU CLEAR FLOORS.', x + 22, y + 38, '#5f686f', {
        width: w - 34,
        maxLines: 3,
      });
      return;
    }

    this.#text(item.name.toUpperCase(), x + 20, y + 8, '#1a2430', { width: w - 34, maxLines: 2 });
    const worn = item === this.#weapon ? 'WIELDING' : item === this.#armor ? 'WEARING' : '';
    if (worn) {
      graphics.fillStyle(0xe7c65b, 1).fillRect(x + w - 64, y + 5, 58, 11);
      this.#text(worn, x + w - 35, y + 7, '#1a2430', { width: 54, align: 'center' });
    }
    const kind = item.kind === 'weapon' ? 'SUPPLY' : 'UNIFORM';
    this.#text(`${kind}   TIER ${item.tier}`, x + 20, y + 34, '#417a45', { width: w - 34 });
    const stats =
      item.kind === 'weapon'
        ? `${item.damage} DAMAGE   ${item.speed.toFixed(1)} SPEED`
        : `ARMOR ${item.armorValue ?? 0}   WEIGHT ${item.weight}`;
    this.#text(stats, x + 20, y + 46, '#233040', { width: w - 34 });
    this.#text(item.specialText, x + 20, y + 64, '#2f4055', { width: w - 34, maxLines: 4 });
  }

  #equipSelected(): void {
    const item = this.#inventory[this.#invIndex];
    if (!item) return;
    if (item.kind === 'weapon') this.#weapon = item;
    else this.#armor = item;
    this.#refreshHud();
    this.#renderInventory();
  }

  #openSettings(): void {
    this.#clearOverlayVisuals();
    this.#overlay = 'none';
    this.scene.launch('Settings', { from: 'Run' });
    this.scene.pause();
    this.events.once(Phaser.Scenes.Events.RESUME, () => {
      this.#applyBinds();
      if (!this.#dead) this.#openPause();
    });
  }

  #updateOverlay(): void {
    const confirm =
      Phaser.Input.Keyboard.JustDown(this.#menu.confirm) ||
      Phaser.Input.Keyboard.JustDown(this.#menu.space);
    const cancel = this.#justPressed('pause');

    switch (this.#overlay) {
      case 'paused': {
        if (cancel) {
          this.#closeOverlay();
          return;
        }
        if (this.#justPressed('inventory')) {
          this.#openInventory();
          return;
        }
        if (Phaser.Input.Keyboard.JustDown(this.#menu.c)) {
          this.#openSettings();
        }
        break;
      }
      case 'inventory': {
        const count = this.#inventory.length;
        if (count === 0) {
          if (cancel) this.#closeOverlay();
          return;
        }
        const direction = this.#bagDirectionPressed();
        if (direction) {
          this.#invIndex = moveBagSelection(this.#invIndex, direction, count);
          this.#renderInventory();
          return;
        }
        if (confirm) {
          this.#equipSelected();
          return;
        }
        if (cancel || this.#justPressed('inventory')) this.#closeOverlay();
        break;
      }
      case 'loot': {
        if (cancel) {
          this.#closeOverlay();
          return;
        }
        if (confirm) this.#openLootQuestion();
        break;
      }
      case 'loot-question': {
        if (cancel) {
          this.#closeOverlay();
          return;
        }
        const digit = this.#digitPressed();
        if (digit !== null) this.#answerLootQuestion(digit);
        break;
      }
      case 'loot-result': {
        if (confirm || cancel) this.#closeOverlay();
        break;
      }
      case 'locker': {
        const count = this.#inventory.length;
        if (count === 0) {
          if (cancel) this.#closeOverlay();
          return;
        }
        let moved = false;
        if (this.#navJust('up')) {
          this.#lockerIndex = (this.#lockerIndex + count - 1) % count;
          moved = true;
        }
        if (this.#navJust('down')) {
          this.#lockerIndex = (this.#lockerIndex + 1) % count;
          moved = true;
        }
        if (moved) {
          this.#renderLockerRoom();
          return;
        }
        if (confirm) {
          this.#openLockerQuestion(this.#inventory[this.#lockerIndex] ?? null);
          return;
        }
        if (cancel || this.#justPressed('inventory')) this.#finishLockerRoom();
        break;
      }
      case 'locker-question': {
        if (cancel) {
          this.#skipLockerQuestion();
          return;
        }
        const digit = this.#digitPressed();
        if (digit !== null) this.#answerLockerQuestion(digit);
        break;
      }
      case 'locker-result': {
        if (confirm || cancel) this.#leaveLockerResult();
        break;
      }
      case 'skills': {
        const nodes = this.#skillPool();
        if (nodes.length === 0) {
          if (cancel) this.#closeOverlay();
          return;
        }
        let moved = false;
        if (this.#navJust('up')) {
          this.#skillIndex = (this.#skillIndex + nodes.length - 1) % nodes.length;
          moved = true;
        }
        if (this.#navJust('down')) {
          this.#skillIndex = (this.#skillIndex + 1) % nodes.length;
          moved = true;
        }
        if (moved) {
          this.#renderSkills();
          return;
        }
        if (confirm) {
          this.#buySkill();
          return;
        }
        if (cancel || Phaser.Input.Keyboard.JustDown(this.#menu.k)) this.#closeOverlay();
        break;
      }
      default:
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  #spawnDust(x = this.#player.x, y = this.#player.y + 4, quantity = 5): void {
    const emitter = this.add.particles(x, y, 'dust', {
      speed: { min: 10, max: 40 },
      lifespan: 260,
      quantity,
      scale: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.NORMAL,
    });
    emitter.setDepth(5);
    this.time.delayedCall(280, () => emitter.destroy());
  }

  #spawnSparks(x: number, y: number, quantity = 6): void {
    const emitter = this.add.particles(x, y, 'spark', {
      speed: { min: 30, max: 90 },
      lifespan: 420,
      quantity,
      scale: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
    });
    emitter.setDepth(940);
    this.time.delayedCall(460, () => emitter.destroy());
  }
}
