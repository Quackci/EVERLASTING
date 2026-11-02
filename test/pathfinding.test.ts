import { describe, expect, it } from 'vitest';
import { findPath, reachableCells } from '../src/game/world/pathfinding';

function gridFrom(rows: string[]): { width: number; height: number; walkable: (x: number, y: number) => boolean } {
  const width = rows[0]?.length ?? 0;
  const height = rows.length;
  return {
    width,
    height,
    walkable: (x, y) => rows[y]?.[x] === '.',
  };
}

describe('A* pathfinding', () => {
  it('walks a straight open corridor', () => {
    const grid = gridFrom(['.....', '.....', '.....']);
    const path = findPath(grid.width, grid.height, grid.walkable, { x: 0, y: 0 }, { x: 4, y: 2 });
    expect(path).not.toBeNull();
    expect(path?.at(0)).toEqual({ x: 0, y: 0 });
    expect(path?.at(-1)).toEqual({ x: 4, y: 2 });
  });

  it('routes around a wall instead of through it', () => {
    const grid = gridFrom(['..#..', '..#..', '..#..', '.....']);
    const path = findPath(grid.width, grid.height, grid.walkable, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).not.toBeNull();
    for (const point of path ?? []) {
      expect(grid.walkable(point.x, point.y), `${point.x},${point.y}`).toBe(true);
    }
    expect((path ?? []).length).toBeGreaterThan(6);
  });

  it('returns null when the goal is sealed off', () => {
    const grid = gridFrom(['...#...', '...#...', '...#...']);
    const path = findPath(grid.width, grid.height, grid.walkable, { x: 0, y: 0 }, { x: 6, y: 0 });
    expect(path).toBeNull();
  });

  it('returns an empty path when already at the goal', () => {
    const grid = gridFrom(['...']);
    expect(findPath(grid.width, grid.height, grid.walkable, { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });

  it('flood fill counts only reachable cells', () => {
    const grid = gridFrom(['.....', '..#..', '..#..', '.....']);
    const reachable = reachableCells(grid.width, grid.height, grid.walkable, { x: 0, y: 0 });
    // 20 cells, 2 of them walls: the floor wraps around the obstacles.
    expect(reachable.size).toBe(18);
    expect(reachable.has(2 * grid.width + 2)).toBe(false);
  });
});
