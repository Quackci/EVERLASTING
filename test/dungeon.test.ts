import { describe, expect, it } from 'vitest';
import { ROOMS } from '../src/game/content';
import {
  allFloorsReachable,
  buildFloor,
  openGate,
  serializeFloor,
  TILE_FLOOR,
  TILE_GATE,
  tileAt,
} from '../src/game/world/dungeon';
import { findPath } from '../src/game/world/pathfinding';

describe('floor generation', () => {
  it('is deterministic for the same seed and floor', () => {
    const first = buildFloor(4242, 3, ROOMS);
    const second = buildFloor(4242, 3, ROOMS);
    expect(serializeFloor(first)).toBe(serializeFloor(second));
  });

  it('changes when the seed changes', () => {
    const first = buildFloor(1, 2, ROOMS);
    const second = buildFloor(2, 2, ROOMS);
    expect(serializeFloor(first)).not.toBe(serializeFloor(second));
  });

  it('generates 8-14 rooms on every floor', () => {
    for (let floor = 1; floor <= 10; floor += 1) {
      const plan = buildFloor(900 + floor, floor, ROOMS);
      expect(plan.rooms.length, `floor ${floor}`).toBeGreaterThanOrEqual(8);
      expect(plan.rooms.length, `floor ${floor}`).toBeLessThanOrEqual(14);
    }
  });

  it('keeps every room reachable from the spawn', () => {
    for (let floor = 1; floor <= 10; floor += 1) {
      for (const seed of [11, 222, 3333]) {
        const plan = buildFloor(seed, floor, ROOMS);
        expect(allFloorsReachable(plan), `seed ${seed} floor ${floor}`).toBe(true);
      }
    }
  });

  it('places the player and stairs on walkable tiles', () => {
    const plan = buildFloor(777, 1, ROOMS);
    expect(tileAt(plan, plan.spawn.x, plan.spawn.y)).toBe(TILE_FLOOR);
    expect(tileAt(plan, plan.stairs.x, plan.stairs.y)).toBe(TILE_FLOOR);
  });

  it('puts quiz gates on corridor tiles and opens them', () => {
    let gatesSeen = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const plan = buildFloor(seed, 2, ROOMS);
      expect(plan.gates.length).toBeLessThanOrEqual(2);
      for (const gate of plan.gates) {
        expect(tileAt(plan, gate.x, gate.y)).toBe(TILE_GATE);
        gatesSeen += 1;
      }
      if (plan.gates.length > 0) {
        const gate = plan.gates[0]!;
        expect(openGate(plan, gate.index)).toBe(true);
        expect(tileAt(plan, gate.x, gate.y)).toBe(TILE_FLOOR);
        expect(openGate(plan, gate.index)).toBe(false);
      }
    }
    expect(gatesSeen).toBeGreaterThan(0);
  });

  it('spawns enemies only on walkable floor tiles inside rooms', () => {
    const plan = buildFloor(31337, 5, ROOMS);
    expect(plan.enemySpawns.length).toBeGreaterThan(4);
    for (const spawn of plan.enemySpawns) {
      expect(tileAt(plan, spawn.x, spawn.y)).toBe(TILE_FLOOR);
      expect(plan.rooms.some((room) => room.id === spawn.roomId)).toBe(true);
    }
  });

  it('places a boss on floors 4, 7 and 10 only', () => {
    for (let floor = 1; floor <= 10; floor += 1) {
      const plan = buildFloor(55, floor, ROOMS);
      if (floor === 4 || floor === 7 || floor === 10) {
        expect(plan.bossId, `floor ${floor}`).not.toBeNull();
        expect(plan.bossSpawn).not.toBeNull();
      } else {
        expect(plan.bossId, `floor ${floor}`).toBeNull();
      }
    }
  });

  it('has a path from spawn to stairs once gates are open', () => {
    const plan = buildFloor(2468, 6, ROOMS);
    for (const gate of plan.gates) openGate(plan, gate.index);
    const path = findPath(plan.width, plan.height, (x, y) => tileAt(plan, x, y) === TILE_FLOOR, plan.spawn, plan.stairs);
    expect(path).not.toBeNull();
    expect((path ?? []).length).toBeGreaterThan(5);
  });
});
