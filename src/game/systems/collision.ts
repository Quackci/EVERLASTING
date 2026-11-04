/**
 * Wall safety for the player body.
 *
 * Arcade Physics separates a dynamic body from a static wall, but a fast dodge
 * (250 px/s) or a knockback can be resolved into the far side of a wall run, and
 * two walls meeting at a corner can leave the body wedged with no valid
 * separation direction. The scene keeps the last clear position and snaps back
 * to it when this module reports the body inside geometry.
 */
import { TILE_FLOOR, tileAt, type FloorPlan } from '../world/dungeon';

export interface BodyBox {
  /** Half the body's collision width, in pixels. */
  halfWidth: number;
  /** Half the body's collision height, in pixels. */
  halfHeight: number;
}

/**
 * Pixels trimmed off each edge of the body before sampling. A body resting
 * flush against a wall shares a tile edge with it; without the inset that touch
 * would count as an overlap and the guard would fight normal wall sliding.
 */
const EDGE_INSET = 0.5;

/** True when the body rectangle centred on (centerX, centerY) overlaps a tile that is not floor. */
export function overlapsWall(
  plan: FloorPlan,
  tileSize: number,
  centerX: number,
  centerY: number,
  box: BodyBox,
): boolean {
  const left = centerX - box.halfWidth + EDGE_INSET;
  const right = centerX + box.halfWidth - EDGE_INSET;
  const top = centerY - box.halfHeight + EDGE_INSET;
  const bottom = centerY + box.halfHeight - EDGE_INSET;
  const minX = Math.floor(left / tileSize);
  const maxX = Math.floor(right / tileSize);
  const minY = Math.floor(top / tileSize);
  const maxY = Math.floor(bottom / tileSize);
  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      if (tileAt(plan, tx, ty) !== TILE_FLOOR) return true;
    }
  }
  return false;
}

export interface FreeSpot {
  x: number;
  y: number;
}

/**
 * Nearest tile centre where the body fits, searched in rings outwards so a body
 * that ends up inside geometry is returned to the closest floor rather than a
 * far-away tile. Returns null when nothing within `maxRadius` tiles fits.
 */
export function nearestFreeSpot(
  plan: FloorPlan,
  tileSize: number,
  centerX: number,
  centerY: number,
  box: BodyBox,
  maxRadius = 4,
): FreeSpot | null {
  const startX = Math.floor(centerX / tileSize);
  const startY = Math.floor(centerY / tileSize);
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    let best: FreeSpot | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        // Only the ring itself, so nearer tiles always win.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = (startX + dx) * tileSize + tileSize / 2;
        const y = (startY + dy) * tileSize + tileSize / 2;
        if (overlapsWall(plan, tileSize, x, y, box)) continue;
        const distance = Math.hypot(x - centerX, y - centerY);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }
    }
    if (best) return best;
  }
  return null;
}
