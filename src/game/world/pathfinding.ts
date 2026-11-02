/** Deterministic grid A* used by enemies and the dungeon connectivity checks. */

export interface Point {
  x: number;
  y: number;
}

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
}

class MinHeap {
  #items: Node[] = [];

  get size(): number {
    return this.#items.length;
  }

  push(node: Node): void {
    const items = this.#items;
    items.push(node);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      const parentNode = items[parent];
      const node = items[index];
      if (!parentNode || !node || parentNode.f <= node.f) break;
      items[parent] = node;
      items[index] = parentNode;
      index = parent;
    }
  }

  pop(): Node | undefined {
    const items = this.#items;
    const top = items[0];
    const last = items.pop();
    if (!top || !last || items.length === 0) return top;
    items[0] = last;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      const smallestNode = items[smallest];
      const leftNode = items[left];
      const rightNode = items[right];
      if (leftNode && smallestNode && leftNode.f < smallestNode.f) smallest = left;
      const candidate = items[smallest];
      if (rightNode && candidate && rightNode.f < candidate.f) smallest = right;
      if (smallest === index) break;
      const a = items[index];
      const b = items[smallest];
      if (!a || !b) break;
      items[index] = b;
      items[smallest] = a;
      index = smallest;
    }
    return top;
  }
}

const NEIGHBOURS: readonly Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function findPath(
  width: number,
  height: number,
  isWalkable: (x: number, y: number) => boolean,
  start: Point,
  goal: Point,
  maxNodes = 4000,
): Point[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const key = (x: number, y: number): number => y * width + x;
  const open = new MinHeap();
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  const heuristic = (x: number, y: number): number => Math.abs(x - goal.x) + Math.abs(y - goal.y);

  open.push({ x: start.x, y: start.y, g: 0, f: heuristic(start.x, start.y) });
  gScore.set(key(start.x, start.y), 0);
  let visited = 0;

  while (open.size > 0 && visited < maxNodes) {
    const current = open.pop();
    if (!current) break;
    const currentKey = key(current.x, current.y);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    visited += 1;

    if (current.x === goal.x && current.y === goal.y) {
      const path: Point[] = [];
      let nodeKey = currentKey;
      for (;;) {
        const x = nodeKey % width;
        const y = (nodeKey - x) / width;
        path.push({ x, y });
        const previous = cameFrom.get(nodeKey);
        if (previous === undefined) break;
        nodeKey = previous;
      }
      path.reverse();
      return path;
    }

    for (const step of NEIGHBOURS) {
      const nx = current.x + step.x;
      const ny = current.y + step.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!isWalkable(nx, ny)) continue;
      const neighbourKey = key(nx, ny);
      if (closed.has(neighbourKey)) continue;
      const tentative = current.g + 1;
      const known = gScore.get(neighbourKey);
      if (known !== undefined && tentative >= known) continue;
      gScore.set(neighbourKey, tentative);
      cameFrom.set(neighbourKey, currentKey);
      open.push({ x: nx, y: ny, g: tentative, f: tentative + heuristic(nx, ny) });
    }
  }

  return null;
}

/** Flood fill from a point; used by tests and by map reveal. */
export function reachableCells(
  width: number,
  height: number,
  isWalkable: (x: number, y: number) => boolean,
  start: Point,
): Set<number> {
  const seen = new Set<number>();
  const queue: Point[] = [start];
  while (queue.length > 0) {
    const point = queue.pop();
    if (!point) break;
    const k = point.y * width + point.x;
    if (seen.has(k)) continue;
    seen.add(k);
    for (const step of NEIGHBOURS) {
      const nx = point.x + step.x;
      const ny = point.y + step.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!isWalkable(nx, ny)) continue;
      if (!seen.has(ny * width + nx)) queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}
