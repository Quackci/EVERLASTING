import { describe, expect, it } from 'vitest';
import {
  BAG_SLOTS,
  bagPageCount,
  bagPageOf,
  bagSlotRect,
  moveBagSelection,
} from '../src/game/ui/bag';

describe('bag grid', () => {
  it('lays slots out three across before starting a new row', () => {
    const first = bagSlotRect(0, 100, 50, 34, 6);
    const second = bagSlotRect(1, 100, 50, 34, 6);
    const fourth = bagSlotRect(3, 100, 50, 34, 6);
    expect(first).toEqual({ x: 100, y: 50, w: 34, h: 34 });
    expect(second.x).toBe(140);
    expect(second.y).toBe(50);
    expect(fourth.x).toBe(100);
    expect(fourth.y).toBe(90);
  });

  it('never reports less than one page', () => {
    expect(bagPageCount(0)).toBe(1);
    expect(bagPageCount(1)).toBe(1);
    expect(bagPageCount(BAG_SLOTS)).toBe(1);
    expect(bagPageCount(BAG_SLOTS + 1)).toBe(2);
    expect(bagPageCount(BAG_SLOTS * 2)).toBe(2);
  });

  it('maps an index to its page', () => {
    expect(bagPageOf(0)).toBe(0);
    expect(bagPageOf(BAG_SLOTS - 1)).toBe(0);
    expect(bagPageOf(BAG_SLOTS)).toBe(1);
  });
});

describe('bag selection', () => {
  it('moves by one slot horizontally and one row vertically', () => {
    expect(moveBagSelection(0, 'right', 9)).toBe(1);
    expect(moveBagSelection(1, 'left', 9)).toBe(0);
    expect(moveBagSelection(0, 'down', 9)).toBe(3);
    expect(moveBagSelection(4, 'up', 9)).toBe(1);
  });

  it('stays put at the top row and at the last item', () => {
    expect(moveBagSelection(1, 'up', 9)).toBe(1);
    expect(moveBagSelection(8, 'right', 9)).toBe(8);
    expect(moveBagSelection(0, 'left', 9)).toBe(0);
  });

  it('stops vertically when the target row is beyond the last item', () => {
    // Seven items: the last row holds only index 6, so index 4 cannot step down,
    // while index 6 can still step up into the full middle row.
    expect(moveBagSelection(4, 'down', 7)).toBe(4);
    expect(moveBagSelection(6, 'up', 7)).toBe(3);
  });

  it('flows onto the next page horizontally', () => {
    expect(moveBagSelection(8, 'right', 12)).toBe(9);
    expect(moveBagSelection(9, 'left', 12)).toBe(8);
    expect(moveBagSelection(7, 'right', 12)).toBe(8);
  });

  it('clamps out-of-range indices and handles an empty bag', () => {
    // 99 clamps to the last item (index 3), which then steps up to index 0.
    expect(moveBagSelection(99, 'up', 4)).toBe(0);
    // -3 clamps to index 0, which then steps down a row to index 3.
    expect(moveBagSelection(-3, 'down', 4)).toBe(3);
    expect(moveBagSelection(0, 'right', 0)).toBe(0);
  });
});
