import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/game/content';
import { PALETTE } from '../src/game/art/palette';
import {
  BASE_PLAYER_MAPS,
  FACING_DIRS,
  FALLBACK_CLASS_ID,
  classLook,
  classLookIds,
  hasOwnLook,
  playerAnimKey,
  playerTextureKey,
} from '../src/game/art/classSprites';

const CLASS_IDS = CLASSES.map((cls) => cls.id);

describe('class sprite looks', () => {
  it('gives every class its own look', () => {
    expect(classLookIds().sort()).toEqual([...CLASS_IDS].sort());
    for (const id of CLASS_IDS) {
      expect(classLook(id).id).toBe(id);
      expect(hasOwnLook(id)).toBe(true);
    }
  });

  it('falls back to the Field Tripper for an unknown class', () => {
    expect(classLook('not_a_class').id).toBe(FALLBACK_CLASS_ID);
    expect(playerTextureKey('not_a_class', 'down', 0)).toBe(`player-${FALLBACK_CLASS_ID}-down-0`);
    expect(hasOwnLook('not_a_class')).toBe(false);
  });

  it('keeps the skeletons 16x16 in every direction', () => {
    for (const dir of FACING_DIRS) {
      const rows = BASE_PLAYER_MAPS[dir];
      expect(rows).toHaveLength(16);
      for (const row of rows) expect(row).toHaveLength(16);
    }
  });

  it('resolves every skeleton and decor character through the class palette', () => {
    for (const id of CLASS_IDS) {
      const look = classLook(id);
      for (const dir of FACING_DIRS) {
        for (const row of BASE_PLAYER_MAPS[dir]) {
          for (const ch of row) {
            if (ch === '.') continue;
            expect(look.colors[ch], `${id} ${dir} is missing a colour for "${ch}"`).toBeDefined();
          }
        }
        for (const pixel of look.decor[dir] ?? []) {
          expect(
            look.colors[pixel.ch],
            `${id} ${dir} decor at ${pixel.x},${pixel.y} is missing a colour for "${pixel.ch}"`,
          ).toBeDefined();
          expect(pixel.x).toBeGreaterThanOrEqual(0);
          expect(pixel.x).toBeLessThan(16);
          expect(pixel.y).toBeGreaterThanOrEqual(0);
          expect(pixel.y).toBeLessThan(16);
        }
      }
    }
  });

  it('only paints with colours from the locked palette', () => {
    for (const id of CLASS_IDS) {
      const look = classLook(id);
      for (const name of Object.values(look.colors)) {
        expect(PALETTE[name], `${id} uses unknown palette colour "${name}"`).toBeDefined();
      }
      expect(PALETTE[look.accent], `${id} has an unknown accent`).toBeDefined();
    }
  });

  it('keeps the four silhouettes visually distinct', () => {
    const torsos = CLASS_IDS.map((id) => classLook(id).colors.u);
    const heads = CLASS_IDS.map((id) => classLook(id).colors.j);
    const accents = CLASS_IDS.map((id) => classLook(id).accent);
    expect(new Set(torsos).size).toBe(CLASS_IDS.length);
    expect(new Set(heads).size).toBe(CLASS_IDS.length);
    expect(new Set(accents).size).toBe(CLASS_IDS.length);
  });

  it('keys textures and animations per class and direction', () => {
    expect(playerTextureKey('class_cutter', 'side', 2)).toBe('player-class_cutter-side-2');
    expect(playerAnimKey('class_cutter', 'side')).toBe('walk-class_cutter-side');
    for (const id of CLASS_IDS) {
      const keys = FACING_DIRS.flatMap((dir) =>
        [0, 1, 2].map((frame) => playerTextureKey(id, dir, frame)),
      );
      expect(new Set(keys).size).toBe(9);
      expect(new Set(FACING_DIRS.map((dir) => playerAnimKey(id, dir))).size).toBe(3);
    }
  });
});
