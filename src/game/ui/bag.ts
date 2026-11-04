/**
 * Layout and selection maths for the school bag screen. Kept free of Phaser so
 * the grid, paging and wrapping rules can be unit tested.
 */

export const BAG_COLUMNS = 3;
export const BAG_ROWS = 3;
export const BAG_SLOTS = BAG_COLUMNS * BAG_ROWS;

export type BagDirection = 'left' | 'right' | 'up' | 'down';

export interface BagSlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectangle of one slot on the current page, in screen pixels. */
export function bagSlotRect(
  slot: number,
  originX: number,
  originY: number,
  size: number,
  gap: number,
): BagSlotRect {
  const column = slot % BAG_COLUMNS;
  const row = Math.floor(slot / BAG_COLUMNS);
  return {
    x: originX + column * (size + gap),
    y: originY + row * (size + gap),
    w: size,
    h: size,
  };
}

/** A bag always shows at least one page, even when it is empty. */
export function bagPageCount(itemCount: number): number {
  return Math.max(1, Math.ceil(Math.max(0, itemCount) / BAG_SLOTS));
}

export function bagPageOf(index: number): number {
  return Math.max(0, Math.floor(Math.max(0, index) / BAG_SLOTS));
}

/**
 * Moves the selection one step. Vertical moves stay on the current page and
 * stop at the first row and at the last item; horizontal moves flow through the
 * bag in reading order, so holding right walks onto the next page and left walks
 * back. That keeps the whole bag reachable with the four movement keys.
 */
export function moveBagSelection(index: number, direction: BagDirection, itemCount: number): number {
  if (itemCount <= 0) return 0;
  const current = Math.min(Math.max(0, index), itemCount - 1);
  const page = bagPageOf(current);
  const cell = current - page * BAG_SLOTS;
  const row = Math.floor(cell / BAG_COLUMNS);
  const column = cell % BAG_COLUMNS;

  if (direction === 'up' || direction === 'down') {
    const nextRow = row + (direction === 'down' ? 1 : -1);
    if (nextRow < 0 || nextRow >= BAG_ROWS) return current;
    const next = page * BAG_SLOTS + nextRow * BAG_COLUMNS + column;
    return next < itemCount ? next : current;
  }

  const next = current + (direction === 'right' ? 1 : -1);
  if (next >= 0 && next < itemCount) return next;
  return current;
}
