import { describe, expect, it } from 'vitest';
import { nearestFreeSpot, overlapsWall } from '../src/game/systems/collision';
import { ROOMS } from '../src/game/content';
import { TILE_FLOOR, TILE_WALL, buildFloor, tileAt, type FloorPlan } from '../src/game/world/dungeon';

const TILE = 16;
const BOX = { halfWidth: 5, halfHeight: 4 };

/** A tiny hand-built plan: '#' is wall, '.' is floor. */
function grid(rows: string[]): FloorPlan {
  const width = rows[0]?.length ?? 0;
  const tiles = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) {
      tiles[y * width + x] = row[x] === '.' ? TILE_FLOOR : TILE_WALL;
    }
  });
  return { width, height: rows.length, tiles } as unknown as FloorPlan;
}

describe('overlapsWall', () => {
  it('is clear when the body sits inside floor', () => {
    const plan = grid(['...', '...', '...']);
    expect(overlapsWall(plan, TILE, 24, 24, BOX)).toBe(false);
  });

  it('catches a body centred inside a wall tile', () => {
    const plan = grid(['.#.', '.#.', '.#.']);
    expect(overlapsWall(plan, TILE, 24, 24, BOX)).toBe(true);
  });

  it('treats a body flush against a wall edge as clear', () => {
    // Right edge of tile 1 is x = 32; a body ending exactly there must not
    // register as overlapping tile 2, or wall sliding would fight the guard.
    const plan = grid(['..#', '..#', '..#']);
    expect(overlapsWall(plan, TILE, 32 - BOX.halfWidth, 24, BOX)).toBe(false);
    expect(overlapsWall(plan, TILE, 33 - BOX.halfWidth, 24, BOX)).toBe(true);
  });

  it('treats the outside of the map as solid', () => {
    const plan = grid(['...', '...', '...']);
    expect(overlapsWall(plan, TILE, -1, 24, BOX)).toBe(true);
    expect(overlapsWall(plan, TILE, 24, 200, BOX)).toBe(true);
  });

  it('detects a body straddling the corner of a wall', () => {
    const plan = grid(['..##', '..##', '....', '....']);
    // Body centred on the corner between two walls and two floors.
    expect(overlapsWall(plan, TILE, 32, 32, BOX)).toBe(true);
    expect(overlapsWall(plan, TILE, 32, 44, BOX)).toBe(false);
  });
});

describe('nearestFreeSpot', () => {
  it('pushes a body out of a wall onto the closest floor tile', () => {
    const plan = grid(['...', '.#.', '...']);
    const spot = nearestFreeSpot(plan, TILE, 24, 24, BOX);
    expect(spot).not.toBeNull();
    if (!spot) return;
    expect(overlapsWall(plan, TILE, spot.x, spot.y, BOX)).toBe(false);
    expect(Math.hypot(spot.x - 24, spot.y - 24)).toBeLessThanOrEqual(TILE * 1.5);
  });

  it('returns the same tile when the body is already clear', () => {
    const plan = grid(['...', '...', '...']);
    expect(nearestFreeSpot(plan, TILE, 24, 24, BOX)).toEqual({ x: 24, y: 24 });
  });

  it('gives up when every tile in range is solid', () => {
    const plan = grid(['###', '###', '###']);
    expect(nearestFreeSpot(plan, TILE, 24, 24, BOX, 1)).toBeNull();
  });

  it('rescues a body from a real generated floor', () => {
    const plan = buildFloor(4242, 3, ROOMS);
    let wall: { x: number; y: number } | null = null;
    for (let y = 1; y < plan.height - 1 && !wall; y += 1) {
      for (let x = 1; x < plan.width - 1 && !wall; x += 1) {
        if (tileAt(plan, x, y) === TILE_WALL && tileAt(plan, x + 1, y) === TILE_FLOOR) {
          wall = { x, y };
        }
      }
    }
    expect(wall).not.toBeNull();
    if (!wall) return;
    const centerX = wall.x * TILE + TILE / 2;
    const centerY = wall.y * TILE + TILE / 2;
    expect(overlapsWall(plan, TILE, centerX, centerY, BOX)).toBe(true);
    const spot = nearestFreeSpot(plan, TILE, centerX, centerY, BOX);
    expect(spot).not.toBeNull();
    if (!spot) return;
    expect(overlapsWall(plan, TILE, spot.x, spot.y, BOX)).toBe(false);
    expect(tileAt(plan, Math.floor(spot.x / TILE), Math.floor(spot.y / TILE))).toBe(TILE_FLOOR);
  });

  it('keeps the player spawn clear on generated floors', () => {
    const plan = buildFloor(7, 1, ROOMS);
    const spawnX = plan.spawn.x * TILE + TILE / 2;
    const spawnY = plan.spawn.y * TILE + TILE / 2;
    expect(overlapsWall(plan, TILE, spawnX, spawnY, BOX)).toBe(false);
  });
});
