/**
 * Seeded, deterministic floor generation: BSP rooms joined by one-tile corridors,
 * then room roles, quiz gates on the critical path, chests, props and enemy spawns.
 * Pure module (no Phaser) so floors can be generated and verified headlessly.
 */
import { BOSS_BY_FLOOR, BALANCE, ENEMY_BY_ID, THEMES, THEME_BY_ID } from '../content';
import type { EnemyDef, RoomTemplateDef, ThemeDef } from '../content/types';
import { createRng, type Rng } from '../core/rng';
import { findPath, reachableCells, type Point } from './pathfinding';

export const TILE_WALL = 0;
export const TILE_FLOOR = 1;
export const TILE_GATE = 2;

export type RoomKind = 'entrance' | 'normal' | 'stairs' | 'shop' | 'nook' | 'boss';

export interface DungeonRoom {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  kind: RoomKind;
  templateId: string;
  theme: string;
}

export interface PropSpot extends Point {
  prop: string;
  roomId: number;
}

export interface ChestSpot extends Point {
  rarity: 'common' | 'rare' | 'locked';
  roomId: number;
  lockSubject: string | null;
  /** What the container physically is: a school desk or a hallway locker. */
  furniture: 'desk' | 'locker';
}

export interface GateSpot extends Point {
  index: number;
  opened: boolean;
}

export interface EnemySpawn extends Point {
  enemyId: string;
  roomId: number;
  elite: boolean;
}

export interface FloorPlan {
  seed: number;
  floor: number;
  act: number;
  themeId: string;
  theme: ThemeDef;
  width: number;
  height: number;
  tiles: Uint8Array;
  rooms: DungeonRoom[];
  spawn: Point;
  stairs: Point;
  gates: GateSpot[];
  chests: ChestSpot[];
  workshop: Point;
  nook: Point | null;
  props: PropSpot[];
  enemySpawns: EnemySpawn[];
  bossSpawn: Point | null;
  bossId: string | null;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_LEAF = 9;

export function themeForFloor(floor: number): ThemeDef {
  const pools: Record<number, string[]> = {
    1: ['classroom', 'hallway'],
    2: ['hallway', 'cafeteria'],
    3: ['classroom', 'cafeteria', 'hallway'],
    4: ['classroom'],
    5: ['science_lab', 'library', 'gym'],
    6: ['library', 'gym', 'science_lab'],
    7: ['gym'],
    8: ['records_office', 'boiler_room'],
    9: ['boiler_room', 'records_office', 'science_lab'],
    10: ['principals_office'],
  };
  const pool = pools[floor] ?? ['classroom'];
  const themeId = pool[(floor * 7) % pool.length] ?? 'classroom';
  return THEME_BY_ID.get(themeId) ?? THEMES[0]!;
}

export function actForFloor(floor: number): number {
  if (floor <= 4) return 1;
  if (floor <= 7) return 2;
  return 3;
}

export function createFloorPlan(seed: number, floor: number): FloorPlan {
  const rng = createRng(seed >>> 0).fork(`floor-${floor}`);
  const width = BALANCE.world.floorWidthTiles;
  const height = BALANCE.world.floorHeightTiles;
  const tiles = new Uint8Array(width * height);
  const theme = themeForFloor(floor);
  const targetRooms = rng.range(BALANCE.floorScaling.roomsMin, BALANCE.floorScaling.roomsMax);

  const leaves: Rect[] = [];
  const root: Rect = { x: 2, y: 2, w: width - 4, h: height - 4 };
  split(root, rng, 0, leaves, targetRooms);

  const candidates: DungeonRoom[] = [];
  for (const [index, leaf] of leaves.entries()) {
    const maxW = Math.min(BALANCE.world.roomMaxSize, leaf.w - 2);
    const maxH = Math.min(BALANCE.world.roomMaxSize, leaf.h - 2);
    if (maxW < BALANCE.world.roomMinSize || maxH < BALANCE.world.roomMinSize) continue;
    const w = rng.range(BALANCE.world.roomMinSize, maxW);
    const h = rng.range(BALANCE.world.roomMinSize, maxH);
    const x = leaf.x + rng.range(1, Math.max(1, leaf.w - w - 1));
    const y = leaf.y + rng.range(1, Math.max(1, leaf.h - h - 1));
    const template = pickTemplate(rng, theme.id);
    candidates.push({
      id: index,
      x,
      y,
      w,
      h,
      cx: Math.floor(x + w / 2),
      cy: Math.floor(y + h / 2),
      kind: 'normal',
      templateId: template.id,
      theme: theme.id,
    });
  }

  // The BSP split can overshoot by one leaf per split; cap to the design range.
  const rooms = rng.shuffle(candidates).slice(0, targetRooms);
  rooms.forEach((room, index) => {
    room.id = index;
    carveRect(tiles, width, room.x, room.y, room.w, room.h);
  });

  if (rooms.length === 0) {
    throw new Error('Dungeon generation produced no rooms');
  }

  connectRooms(tiles, width, rooms, rng);

  const entrance = rooms[0]!;
  const stairs = farthestRoom(rooms, entrance);
  entrance.kind = 'entrance';
  stairs.kind = 'stairs';

  const others = rooms.filter((room) => room !== entrance && room !== stairs);
  const shopRoom = others.length > 0 ? rng.pick(others) : stairs;
  shopRoom.kind = 'shop';
  let nookRoom: DungeonRoom | null = null;
  const nookCandidates = others.filter((room) => room !== shopRoom);
  if (nookCandidates.length > 0 && rng.chance(0.65)) {
    nookRoom = rng.pick(nookCandidates);
    nookRoom.kind = 'nook';
  }

  const spawn: Point = { x: entrance.cx, y: entrance.cy };
  const stairsPoint: Point = { x: stairs.cx, y: stairs.cy };

  const bossId = BOSS_BY_FLOOR.get(floor) ?? null;
  if (bossId) stairs.kind = 'boss';

  // Quiz gates sit on the critical path, so they always gate progress.
  const gates: GateSpot[] = [];
  const path = findPath(width, height, (x, y) => tiles[y * width + x] === TILE_FLOOR, spawn, stairsPoint);
  const gateCount = rng.range(BALANCE.floorScaling.locksMin, BALANCE.floorScaling.locksMax);
  if (path && path.length > 12) {
    const roomTiles = new Set<number>();
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (let x = room.x; x < room.x + room.w; x += 1) roomTiles.add(y * width + x);
      }
    }
    const candidates = path.filter((point, index) => {
      if (index === 0 || index === path.length - 1) return false;
      if (roomTiles.has(point.y * width + point.x)) return false;
      return isCorridor(tiles, width, point.x, point.y);
    });
    const step = Math.max(1, Math.floor(candidates.length / (gateCount + 1)));
    for (let i = 0; i < gateCount && i < candidates.length; i += 1) {
      const point = candidates[Math.min(candidates.length - 1, step * (i + 1))];
      if (!point) continue;
      if (tiles[point.y * width + point.x] !== TILE_FLOOR) continue;
      tiles[point.y * width + point.x] = TILE_GATE;
      gates.push({ x: point.x, y: point.y, index: gates.length, opened: false });
    }
  }

  const chests: ChestSpot[] = [];
  const chestCount = rng.range(BALANCE.floorScaling.chestsMin, BALANCE.floorScaling.chestsMax);
  const chestRooms = rng.shuffle(others.filter((room) => room !== shopRoom));
  for (let i = 0; i < chestCount; i += 1) {
    const room = chestRooms[i % Math.max(1, chestRooms.length)];
    if (!room) break;
    const spot = freeTileInRoom(tiles, width, room, rng, [spawn, stairsPoint]);
    if (!spot) continue;
    const rarity = i === chestCount - 1 && chestCount > 1 ? 'rare' : rng.chance(0.25) ? 'locked' : 'common';
    chests.push({
      x: spot.x,
      y: spot.y,
      rarity,
      roomId: room.id,
      lockSubject: rarity === 'locked' ? rng.pick(['math', 'science', 'history', 'geography', 'language', 'school_life']) : null,
      furniture: rng.chance(0.45) ? 'locker' : 'desk',
    });
  }

  const props: PropSpot[] = [];
  for (const room of rooms) {
    const template = ROOM_TEMPLATES.get(room.templateId);
    if (!template) continue;
    for (const prop of template.props) {
      const spot = freeTileInRoom(tiles, width, room, rng, [spawn, stairsPoint], 1);
      if (spot) props.push({ x: spot.x, y: spot.y, prop, roomId: room.id });
    }
  }

  const enemySpawns: EnemySpawn[] = [];
  for (const room of rooms) {
    if (room.kind === 'entrance') continue;
    const packSize = rng.range(BALANCE.floorScaling.enemyPackMin, Math.min(BALANCE.floorScaling.enemyPackMax, 2 + room.w));
    for (let i = 0; i < packSize; i += 1) {
      const spot = freeTileInRoom(tiles, width, room, rng, [spawn, stairsPoint], 2);
      if (!spot) continue;
      const scaling = BALANCE.enemyScaling;
      const eliteChance = Math.min(
        scaling.eliteChanceMax,
        scaling.eliteChanceBase + floor * scaling.eliteChancePerFloor,
      );
      const elite = room.kind !== 'boss' && rng.chance(eliteChance);
      const pool = elite ? ELITES.filter((enemy) => enemy.act <= actForFloor(floor) + 1) : normalPool(theme);
      const enemy = rng.pick(pool.length > 0 ? pool : normalPool(theme));
      enemySpawns.push({ x: spot.x, y: spot.y, enemyId: enemy.id, roomId: room.id, elite });
    }
  }

  let bossSpawn: Point | null = null;
  if (bossId) {
    const bossRoom = stairs;
    bossSpawn = { x: bossRoom.cx, y: bossRoom.cy - 2 >= bossRoom.y ? bossRoom.cy - 2 : bossRoom.cy };
  }

  return {
    seed: seed >>> 0,
    floor,
    act: actForFloor(floor),
    themeId: theme.id,
    theme,
    width,
    height,
    tiles,
    rooms,
    spawn,
    stairs: stairsPoint,
    gates,
    chests,
    workshop: { x: shopRoom.cx, y: shopRoom.cy },
    nook: nookRoom ? { x: nookRoom.cx, y: nookRoom.cy } : null,
    props,
    enemySpawns,
    bossSpawn,
    bossId,
  };
}

const ROOM_TEMPLATES = new Map<string, RoomTemplateDef>();

export function registerRoomTemplates(templates: readonly RoomTemplateDef[]): void {
  ROOM_TEMPLATES.clear();
  for (const template of templates) ROOM_TEMPLATES.set(template.id, template);
}

function pickTemplate(rng: Rng, themeId: string): RoomTemplateDef {
  if (ROOM_TEMPLATES.size === 0) {
    // The runtime registers templates from content before generating a floor.
    throw new Error('Room templates must be registered before generating a floor');
  }
  const pool = [...ROOM_TEMPLATES.values()].filter((template) => template.theme === themeId);
  return rng.pick(pool.length > 0 ? pool : [...ROOM_TEMPLATES.values()]);
}

function split(rect: Rect, rng: Rng, depth: number, out: Rect[], target: number): void {
  const canSplitHorizontally = rect.w >= MIN_LEAF * 2;
  const canSplitVertically = rect.h >= MIN_LEAF * 2;
  if (depth >= 5 || out.length >= target || (!canSplitHorizontally && !canSplitVertically)) {
    out.push(rect);
    return;
  }
  const horizontal =
    canSplitHorizontally && canSplitVertically ? rng.chance(rect.w >= rect.h ? 0.65 : 0.35) : canSplitHorizontally;
  if (horizontal) {
    const cut = rng.range(MIN_LEAF, rect.w - MIN_LEAF);
    split({ x: rect.x, y: rect.y, w: cut, h: rect.h }, rng, depth + 1, out, target);
    split({ x: rect.x + cut, y: rect.y, w: rect.w - cut, h: rect.h }, rng, depth + 1, out, target);
  } else {
    const cut = rng.range(MIN_LEAF, rect.h - MIN_LEAF);
    split({ x: rect.x, y: rect.y, w: rect.w, h: cut }, rng, depth + 1, out, target);
    split({ x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut }, rng, depth + 1, out, target);
  }
}

function carveRect(tiles: Uint8Array, width: number, x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      tiles[yy * width + xx] = TILE_FLOOR;
    }
  }
}

function carveCorridor(tiles: Uint8Array, width: number, from: Point, to: Point, horizontalFirst: boolean): void {
  const hLine = (y: number, x0: number, x1: number): void => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
      tiles[y * width + x] = TILE_FLOOR;
    }
  };
  const vLine = (x: number, y0: number, y1: number): void => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
      tiles[y * width + x] = TILE_FLOOR;
    }
  };
  if (horizontalFirst) {
    hLine(from.y, from.x, to.x);
    vLine(to.x, from.y, to.y);
  } else {
    vLine(from.x, from.y, to.y);
    hLine(to.y, from.x, to.x);
  }
}

function connectRooms(tiles: Uint8Array, width: number, rooms: DungeonRoom[], rng: Rng): void {
  const ordered = [...rooms].sort((a, b) => (a.cx === b.cx ? a.cy - b.cy : a.cx - b.cx));
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (!previous || !current) continue;
    carveCorridor(
      tiles,
      width,
      { x: previous.cx, y: previous.cy },
      { x: current.cx, y: current.cy },
      rng.chance(0.5),
    );
  }
  // A couple of extra links keep the floor from feeling like a single snake.
  const loops = Math.max(1, Math.floor(rooms.length / 5));
  for (let i = 0; i < loops; i += 1) {
    const a = rng.pick(rooms);
    const b = rng.pick(rooms);
    if (a.id === b.id) continue;
    carveCorridor(tiles, width, { x: a.cx, y: a.cy }, { x: b.cx, y: b.cy }, rng.chance(0.5));
  }
}

function isCorridor(tiles: Uint8Array, width: number, x: number, y: number): boolean {
  let walkable = 0;
  if (tiles[y * width + x - 1] === TILE_FLOOR) walkable += 1;
  if (tiles[y * width + x + 1] === TILE_FLOOR) walkable += 1;
  if (tiles[(y - 1) * width + x] === TILE_FLOOR) walkable += 1;
  if (tiles[(y + 1) * width + x] === TILE_FLOOR) walkable += 1;
  const horizontal = tiles[y * width + x - 1] !== TILE_WALL && tiles[y * width + x + 1] !== TILE_WALL;
  const vertical = tiles[(y - 1) * width + x] !== TILE_WALL && tiles[(y + 1) * width + x] !== TILE_WALL;
  return walkable === 2 && (horizontal !== vertical);
}

function farthestRoom(rooms: DungeonRoom[], from: DungeonRoom): DungeonRoom {
  let best = rooms[0] ?? from;
  let bestDistance = -1;
  for (const room of rooms) {
    const distance = Math.abs(room.cx - from.cx) + Math.abs(room.cy - from.cy);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = room;
    }
  }
  return best;
}

function freeTileInRoom(
  tiles: Uint8Array,
  width: number,
  room: DungeonRoom,
  rng: Rng,
  avoid: Point[],
  margin = 1,
): Point | null {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = rng.range(room.x + margin, room.x + room.w - 1 - margin);
    const y = rng.range(room.y + margin, room.y + room.h - 1 - margin);
    if (tiles[y * width + x] !== TILE_FLOOR) continue;
    if (avoid.some((point) => Math.abs(point.x - x) <= 1 && Math.abs(point.y - y) <= 1)) continue;
    return { x, y };
  }
  return null;
}

export function isSolid(plan: FloorPlan, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= plan.width || y >= plan.height) return true;
  return plan.tiles[y * plan.width + x] !== TILE_FLOOR;
}

export function tileAt(plan: FloorPlan, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= plan.width || y >= plan.height) return TILE_WALL;
  return plan.tiles[y * plan.width + x] ?? TILE_WALL;
}

export function roomAt(plan: FloorPlan, x: number, y: number): DungeonRoom | null {
  return plan.rooms.find((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) ?? null;
}

export function openGate(plan: FloorPlan, index: number): boolean {
  const gate = plan.gates.find((candidate) => candidate.index === index);
  if (!gate || gate.opened) return false;
  gate.opened = true;
  plan.tiles[gate.y * plan.width + gate.x] = TILE_FLOOR;
  return true;
}

export function allFloorsReachable(plan: FloorPlan): boolean {
  const start = plan.spawn;
  const reachable = reachableCells(plan.width, plan.height, (x, y) => tileAt(plan, x, y) !== TILE_WALL, start);
  // Gates are passable for the reachability check: they open, they do not wall off content.
  for (const room of plan.rooms) {
    if (!reachable.has(room.cy * plan.width + room.cx)) return false;
  }
  return reachable.has(plan.stairs.y * plan.width + plan.stairs.x);
}

export function normalPool(theme: ThemeDef): EnemyDef[] {
  const pool = theme.enemies.map((id) => ENEMY_BY_ID.get(id)).filter((enemy): enemy is EnemyDef => Boolean(enemy));
  return pool.length > 0 ? pool : [...ENEMY_BY_ID.values()].filter((enemy) => enemy.role === 'normal');
}

const ELITES: EnemyDef[] = [...ENEMY_BY_ID.values()].filter((enemy) => enemy.role === 'elite');

/** Ensures a floor plan is walkable end-to-end; retries with a derived seed if not. */
export function buildFloor(seed: number, floor: number, templates: readonly RoomTemplateDef[]): FloorPlan {
  registerRoomTemplates(templates);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const plan = createFloorPlan((seed + attempt * 7919) >>> 0, floor);
    if (allFloorsReachable(plan)) return plan;
  }
  throw new Error(`Could not generate a connected floor for seed ${seed} floor ${floor}`);
}

export function serializeFloor(plan: FloorPlan): string {
  return JSON.stringify({
    seed: plan.seed,
    floor: plan.floor,
    themeId: plan.themeId,
    rooms: plan.rooms.map((room) => [room.x, room.y, room.w, room.h, room.kind]),
    gates: plan.gates.map((gate) => [gate.x, gate.y]),
    chests: plan.chests.map((chest) => [chest.x, chest.y, chest.rarity, chest.furniture]),
    spawn: [plan.spawn.x, plan.spawn.y],
    stairs: [plan.stairs.x, plan.stairs.y],
    enemies: plan.enemySpawns.map((spawn) => [spawn.x, spawn.y, spawn.enemyId]),
    props: plan.props.map((prop) => [prop.x, prop.y, prop.prop]),
    tiles: Array.from(plan.tiles).join(''),
  });
}
