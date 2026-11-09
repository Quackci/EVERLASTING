/**
 * All art is generated in code from the locked 32-colour palette: tiles,
 * characters, enemies, props, containers and light. Nothing is downloaded,
 * stretched or borrowed.
 *
 * The scene composes these textures with ambient occlusion strips, soft
 * shadows and a vignette so the flat tiles read as a lit 3/4 view instead of a
 * plain grid.
 */
import Phaser from 'phaser';
import { CLASSES, ENEMIES, ITEMS, THEMES } from '../content';
import {
  BASE_PLAYER_MAPS,
  FACING_DIRS,
  FRAMES_PER_DIRECTION,
  classLook,
  playerAnimKey,
  playerTextureKey,
  type ClassLook,
  type FacingDir,
} from './classSprites';
import { PALETTE, type PaletteName } from './palette';

const TILE = 16;
const playerCounters = new Map<string, number>();

export function paletteHex(name: string): string {
  return (PALETTE as Record<string, string>)[name] ?? PALETTE.red;
}

/** Palette colour with alpha, used only for light and shadow gradients. */
function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, width, height);
  draw(ctx);
  texture.refresh();
}

function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ---------------------------------------------------------------------------
// Player: 16x16 student with outline, shading and a three-frame walk cycle.
// ---------------------------------------------------------------------------

function drawPlayerFrame(
  ctx: CanvasRenderingContext2D,
  dir: FacingDir,
  frame: number,
  look: ClassLook,
): void {
  const rows = BASE_PLAYER_MAPS[dir];
  // One step each way, so the idle frame is the only symmetrical pose.
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const bob = frame === 1 ? -1 : 0;
  const decor = new Map<string, string>();
  for (const entry of look.decor[dir] ?? []) decor.set(`${entry.x},${entry.y}`, entry.ch);

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y] ?? '';
    for (let x = 0; x < row.length; x += 1) {
      // Class details are painted over the shared skeleton after the base pixel.
      const ch = decor.get(`${x},${y}`) ?? row[x] ?? '.';
      if (ch === '.' || ch === ' ') continue;
      const name = look.colors[ch];
      if (!name) continue;
      // Legs scissor and arms counter-swing, so a walk reads as a stride rather
      // than the whole sprite sliding sideways. Head and torso bob on the step.
      let dx = 0;
      if (y >= 14) {
        dx = dir === 'side' ? step : x < 8 ? step : -step;
      } else if (y >= 10 && y <= 12 && (x <= 3 || x >= 12)) {
        dx = x <= 3 ? -step : step;
      }
      const dy = y < 10 ? bob : 0;
      pixel(ctx, x + dx, y + dy, PALETTE[name]);
    }
  }
}

// ---------------------------------------------------------------------------
// Enemies: distinct silhouettes per archetype, outlined and shaded per enemy.
// ---------------------------------------------------------------------------

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  archetype: string,
  base: string,
  shade: string,
  light: string,
  accent: string,
): void {
  const outline = PALETTE.ink900;
  const eye = PALETTE.bone;
  const pupil = PALETTE.ink900;

  const outlinedBox = (x: number, y: number, w: number, h: number, color: string): void => {
    box(ctx, x - 1, y - 1, w + 2, h + 2, outline);
    box(ctx, x, y, w, h, color);
  };

  switch (archetype) {
    case 'golem': {
      // Stacked, slightly misaligned homework pages with a chalk scrawl on top.
      outlinedBox(2, 3, 12, 5, base);
      box(ctx, 3, 3, 10, 1, light);
      box(ctx, 3, 6, 10, 1, shade);
      box(ctx, 4, 5, 2, 1, PALETTE.paper);
      box(ctx, 8, 4, 3, 1, PALETTE.paperShade);
      outlinedBox(2, 9, 12, 5, shade);
      box(ctx, 3, 9, 10, 1, base);
      box(ctx, 5, 10, 2, 2, eye);
      box(ctx, 5, 10, 1, 1, pupil);
      box(ctx, 9, 10, 2, 2, eye);
      box(ctx, 9, 10, 1, 1, pupil);
      box(ctx, 1, 10, 2, 3, base);
      box(ctx, 13, 10, 2, 3, base);
      box(ctx, 3, 14, 3, 1, outline);
      box(ctx, 10, 14, 3, 1, outline);
      box(ctx, 7, 12, 2, 1, accent);
      break;
    }
    case 'humanoid': {
      // A student-shaped enemy: cap brim, dead eyes, badge and swinging arms.
      outlinedBox(5, 1, 6, 5, base);
      box(ctx, 5, 1, 6, 1, light);
      box(ctx, 6, 3, 1, 2, eye);
      box(ctx, 9, 3, 1, 2, eye);
      box(ctx, 6, 4, 1, 1, pupil);
      box(ctx, 9, 4, 1, 1, pupil);
      box(ctx, 4, 5, 8, 1, shade);
      outlinedBox(4, 7, 8, 5, shade);
      box(ctx, 5, 7, 6, 1, base);
      box(ctx, 7, 8, 2, 1, light);
      box(ctx, 5, 9, 1, 3, accent);
      box(ctx, 10, 9, 1, 3, accent);
      box(ctx, 3, 8, 1, 3, base);
      box(ctx, 12, 8, 1, 3, base);
      box(ctx, 5, 12, 2, 2, outline);
      box(ctx, 9, 12, 2, 2, outline);
      box(ctx, 5, 14, 2, 1, base);
      box(ctx, 9, 14, 2, 1, base);
      break;
    }
    case 'machine': {
      // A vending machine that has decided it is a person: glass, buttons, slot.
      outlinedBox(2, 1, 12, 12, base);
      box(ctx, 3, 1, 10, 1, light);
      box(ctx, 3, 3, 10, 5, PALETTE.ink900);
      box(ctx, 4, 4, 8, 3, PALETTE.blueDark);
      box(ctx, 5, 5, 2, 1, accent);
      box(ctx, 7, 5, 4, 1, PALETTE.teal);
      box(ctx, 5, 6, 5, 1, PALETTE.steel);
      box(ctx, 11, 4, 1, 1, eye);
      box(ctx, 4, 9, 2, 2, accent);
      box(ctx, 7, 9, 2, 2, PALETTE.grey300);
      box(ctx, 10, 9, 2, 2, PALETTE.red);
      box(ctx, 7, 11, 2, 1, PALETTE.yellow);
      box(ctx, 3, 12, 10, 1, shade);
      box(ctx, 2, 13, 3, 1, outline);
      box(ctx, 11, 13, 3, 1, outline);
      break;
    }
    case 'blob': {
      // Glossy, wet and slightly lumpy, with drips that outlive the shadow.
      outlinedBox(2, 7, 12, 7, base);
      outlinedBox(4, 4, 8, 4, base);
      box(ctx, 3, 7, 10, 1, light);
      box(ctx, 5, 5, 3, 1, light);
      box(ctx, 5, 5, 2, 1, PALETTE.bone);
      box(ctx, 2, 12, 12, 2, shade);
      box(ctx, 4, 9, 2, 2, eye);
      box(ctx, 4, 9, 1, 1, pupil);
      box(ctx, 9, 9, 2, 2, eye);
      box(ctx, 9, 9, 1, 1, pupil);
      box(ctx, 2, 13, 2, 2, base);
      box(ctx, 12, 13, 2, 1, base);
      box(ctx, 7, 13, 2, 2, accent);
      break;
    }
    case 'ghost': {
      // A sheet with a torn hem, rim light down one side and hollow eyes.
      box(ctx, 4, 1, 8, 2, outline);
      box(ctx, 3, 3, 10, 9, base);
      box(ctx, 2, 4, 1, 7, outline);
      box(ctx, 13, 4, 1, 7, outline);
      box(ctx, 3, 11, 2, 2, base);
      box(ctx, 6, 11, 2, 3, base);
      box(ctx, 9, 11, 2, 2, base);
      box(ctx, 12, 11, 1, 2, base);
      box(ctx, 4, 3, 1, 8, light);
      box(ctx, 5, 9, 6, 1, shade);
      box(ctx, 6, 4, 2, 3, outline);
      box(ctx, 9, 4, 2, 3, outline);
      box(ctx, 7, 4, 1, 1, eye);
      box(ctx, 10, 4, 1, 1, eye);
      box(ctx, 7, 8, 2, 1, accent);
      break;
    }
    case 'beast': {
      // Low hound silhouette: heavy shoulders, snout, claws and a low tail.
      outlinedBox(1, 6, 11, 5, base);
      box(ctx, 2, 6, 9, 1, light);
      box(ctx, 2, 10, 9, 1, shade);
      outlinedBox(10, 3, 5, 5, base);
      box(ctx, 11, 3, 3, 1, light);
      box(ctx, 13, 5, 1, 1, eye);
      box(ctx, 13, 5, 1, 1, pupil);
      box(ctx, 15, 6, 1, 1, outline);
      box(ctx, 12, 2, 1, 1, accent);
      box(ctx, 2, 11, 2, 4, shade);
      box(ctx, 5, 11, 2, 4, shade);
      box(ctx, 8, 11, 2, 4, shade);
      box(ctx, 2, 14, 2, 1, outline);
      box(ctx, 5, 14, 2, 1, outline);
      box(ctx, 8, 14, 2, 1, outline);
      box(ctx, 1, 5, 3, 1, base);
      box(ctx, 9, 7, 2, 1, accent);
      break;
    }
    case 'paper':
    default: {
      const fold = (points: readonly (readonly [number, number])[], color: string): void => {
        const [first, ...rest] = points;
        if (!first) return;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(first[0], first[1]);
        for (const [x, y] of rest) ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();
      };
      fold([[2, 1], [15, 5], [9, 15], [1, 10]], outline);
      fold([[3, 3], [14, 6], [8, 14], [2, 9]], base);
      fold([[3, 3], [14, 6], [8, 8]], light);
      fold([[2, 9], [8, 14], [8, 8]], shade);
      box(ctx, 8, 8, 1, 6, outline);
      box(ctx, 5, 6, 4, 1, accent);
      box(ctx, 9, 10, 1, 1, eye);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Item icons: 12x12 silhouette per sprite key, tinted by tier.
// ---------------------------------------------------------------------------

export function tierColor(tier: number): PaletteName {
  const colors: PaletteName[] = ['grey100', 'chalk', 'blue', 'purple', 'yellow'];
  return colors[Math.max(0, Math.min(4, tier - 1))] ?? 'bone';
}

function drawItem(ctx: CanvasRenderingContext2D, spriteKey: string, tint: string): void {
  const dark = PALETTE.ink900;
  const light = PALETTE.bone;
  switch (spriteKey) {
    case 'pencil':
      box(ctx, 2, 9, 2, 2, light);
      box(ctx, 4, 7, 2, 2, tint);
      box(ctx, 6, 5, 2, 2, tint);
      box(ctx, 8, 3, 2, 2, tint);
      box(ctx, 10, 2, 1, 1, dark);
      break;
    case 'pen':
      box(ctx, 3, 8, 2, 3, tint);
      box(ctx, 5, 6, 2, 2, tint);
      box(ctx, 7, 4, 2, 2, tint);
      box(ctx, 9, 2, 1, 2, dark);
      break;
    case 'blade':
      box(ctx, 2, 9, 3, 3, dark);
      box(ctx, 4, 7, 2, 3, tint);
      box(ctx, 6, 5, 2, 3, tint);
      box(ctx, 8, 3, 2, 3, tint);
      box(ctx, 10, 2, 1, 2, light);
      break;
    case 'gun':
      box(ctx, 2, 4, 8, 4, tint);
      box(ctx, 3, 8, 3, 3, dark);
      box(ctx, 9, 5, 2, 2, light);
      break;
    case 'stick':
      box(ctx, 2, 9, 8, 2, tint);
      box(ctx, 3, 8, 7, 1, light);
      break;
    case 'box':
      box(ctx, 2, 3, 8, 7, tint);
      box(ctx, 2, 3, 8, 1, light);
      box(ctx, 5, 6, 2, 1, dark);
      break;
    case 'bottle':
      box(ctx, 4, 1, 3, 2, dark);
      box(ctx, 3, 3, 5, 8, tint);
      box(ctx, 4, 5, 3, 4, light);
      break;
    case 'book':
      box(ctx, 2, 3, 8, 8, tint);
      box(ctx, 3, 4, 6, 6, light);
      box(ctx, 5, 4, 1, 6, dark);
      break;
    case 'board':
      box(ctx, 2, 2, 8, 8, tint);
      box(ctx, 3, 3, 6, 5, PALETTE.bone);
      box(ctx, 4, 7, 4, 1, PALETTE.grey500);
      break;
    case 'clip':
      box(ctx, 4, 2, 1, 8, tint);
      box(ctx, 7, 3, 1, 7, tint);
      box(ctx, 4, 2, 4, 1, tint);
      box(ctx, 4, 9, 4, 1, tint);
      break;
    case 'ring':
      ctx.strokeStyle = tint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(6, 6, 4, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'ball':
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(6, 6, 4, 0, Math.PI * 2);
      ctx.fill();
      box(ctx, 5, 3, 2, 1, light);
      break;
    case 'tray':
      box(ctx, 2, 5, 8, 4, tint);
      box(ctx, 1, 4, 10, 1, light);
      box(ctx, 3, 9, 6, 1, dark);
      break;
    case 'paper':
      box(ctx, 3, 2, 6, 8, light);
      box(ctx, 4, 4, 4, 1, PALETTE.grey500);
      box(ctx, 4, 6, 4, 1, PALETTE.grey500);
      break;
    case 'ticket':
      box(ctx, 2, 4, 8, 4, tint);
      box(ctx, 4, 5, 1, 2, dark);
      box(ctx, 7, 5, 1, 2, dark);
      break;
    default:
      box(ctx, 3, 3, 6, 6, tint);
      break;
  }
}

// ---------------------------------------------------------------------------
// Tiles: grouted floor with wear, panelled walls with a top face and baseboard.
// ---------------------------------------------------------------------------

function themeColor(themeId: string, field: 'floorColor' | 'wallColor' | 'accentColor'): string {
  const theme = THEMES.find((candidate) => candidate.id === themeId);
  return paletteHex(theme?.[field] ?? 'grey700');
}

type FloorPattern = 'tile' | 'plank' | 'checker' | 'carpet' | 'concrete' | 'lab';

/** Floors follow the room: the gym is boards, the cafeteria is checker, and so on. */
function floorPattern(themeId: string): FloorPattern {
  switch (themeId) {
    case 'library':
    case 'gym':
      return 'plank';
    case 'cafeteria':
      return 'checker';
    case 'records_office':
    case 'principals_office':
      return 'carpet';
    case 'boiler_room':
      return 'concrete';
    case 'science_lab':
      return 'lab';
    default:
      return 'tile';
  }
}

function drawFloorTile(
  ctx: CanvasRenderingContext2D,
  base: string,
  accent: string,
  variant: number,
  pattern: FloorPattern,
): void {
  box(ctx, 0, 0, TILE, TILE, base);

  switch (pattern) {
    case 'plank':
      // Boards run across the room, staggered so the seams never line up.
      for (let row = 0; row < 4; row += 1) {
        const y = row * 4;
        box(ctx, 0, y, TILE, 1, rgba(PALETTE.ink900, 0.5));
        box(ctx, 0, y + 1, TILE, 1, rgba(PALETTE.bone, 0.07));
        box(ctx, (row * 7 + variant * 3) % TILE, y + 1, 1, 3, rgba(PALETTE.ink900, 0.45));
      }
      break;
    case 'checker':
      box(ctx, 0, 0, 8, 8, rgba(PALETTE.ink900, 0.16));
      box(ctx, 8, 8, 8, 8, rgba(PALETTE.ink900, 0.16));
      box(ctx, 0, 0, 8, 8, rgba(PALETTE.bone, 0.05));
      box(ctx, 8, 8, 8, 8, rgba(PALETTE.bone, 0.05));
      box(ctx, 0, 0, TILE, 1, rgba(PALETTE.ink900, 0.3));
      box(ctx, 0, 0, 1, TILE, rgba(PALETTE.ink900, 0.3));
      break;
    case 'carpet':
      for (let dot = 0; dot < 22; dot += 1) {
        box(ctx, (dot * 7 + variant * 5) % TILE, (dot * 11 + variant * 3) % TILE, 1, 1, rgba(PALETTE.bone, 0.06));
      }
      box(ctx, 0, 0, TILE, 1, rgba(PALETTE.ink900, 0.22));
      break;
    case 'concrete':
      box(ctx, 2, 3, 5, 1, rgba(PALETTE.ink900, 0.2));
      box(ctx, 9, 11, 4, 1, rgba(PALETTE.ink900, 0.18));
      box(ctx, 12, 5, 2, 2, rgba(PALETTE.ink900, 0.14));
      box(ctx, 0, 0, TILE, 1, rgba(PALETTE.ink900, 0.35));
      break;
    case 'lab':
      box(ctx, 0, 0, TILE, 1, PALETTE.ink800);
      box(ctx, 0, 0, 1, TILE, PALETTE.ink800);
      box(ctx, 1, 1, 6, 1, rgba(PALETTE.bone, 0.09));
      box(ctx, 1, 1, 1, 6, rgba(PALETTE.bone, 0.06));
      box(ctx, 9, 9, 5, 1, rgba(PALETTE.ink900, 0.18));
      break;
    case 'tile':
    default:
      // Two-by-two grout grid: reads as tile, not as a flat colour block.
      box(ctx, 0, 0, TILE, 1, PALETTE.ink800);
      box(ctx, 0, 0, 1, TILE, PALETTE.ink800);
      box(ctx, 0, 8, TILE, 1, PALETTE.ink700);
      box(ctx, 8, 0, 1, TILE, PALETTE.ink700);
      box(ctx, 1, 1, 7, 1, rgba(PALETTE.bone, 0.08));
      box(ctx, 1, 1, 1, 7, rgba(PALETTE.bone, 0.05));
      break;
  }

  // Wear is what sells a floor as used: every variant gets its own mess.
  if (variant === 1) {
    // Hairline crack with a scuffed corner.
    box(ctx, 11, 3, 1, 4, rgba(PALETTE.ink900, 0.45));
    box(ctx, 12, 7, 2, 1, rgba(PALETTE.ink900, 0.4));
    box(ctx, 4, 12, 1, 1, accent);
    box(ctx, 5, 13, 1, 1, PALETTE.grey500);
  } else if (variant === 2) {
    // A scrap of paper somebody never picked up.
    box(ctx, 10, 10, 4, 3, PALETTE.paperShade);
    box(ctx, 10, 10, 4, 1, PALETTE.paper);
    box(ctx, 11, 11, 2, 1, PALETTE.grey300);
  } else if (variant === 3) {
    // Worn patch and a chalk speck.
    box(ctx, 2, 9, 4, 3, rgba(PALETTE.ink900, 0.18));
    box(ctx, 3, 12, 1, 1, PALETTE.paperShade);
    box(ctx, 12, 3, 1, 1, PALETTE.paperShade);
  }
}

function drawWallFace(
  ctx: CanvasRenderingContext2D,
  base: string,
  floor: string,
  accent: string,
  variant: number,
): void {
  box(ctx, 0, 0, TILE, TILE, PALETTE.ink900);
  // Top face: the wall is 3/4, so the upper band is lit differently.
  box(ctx, 0, 0, TILE, 3, rgba(PALETTE.ink900, 0.55));
  box(ctx, 0, 0, TILE, 1, rgba(PALETTE.bone, 0.12));
  // Front face with a wainscot band along the bottom.
  box(ctx, 0, 3, TILE, 10, base);
  box(ctx, 0, 3, TILE, 1, rgba(PALETTE.bone, 0.16));
  box(ctx, 0, 8, TILE, 5, rgba(PALETTE.ink900, 0.22));
  box(ctx, 0, 8, TILE, 1, rgba(PALETTE.bone, 0.1));
  box(ctx, 7, 3, 1, 10, rgba(PALETTE.ink900, 0.3));
  // Baseboard and its shadow.
  box(ctx, 0, 13, TILE, 3, floor);
  box(ctx, 0, 13, TILE, 1, PALETTE.ink900);
  box(ctx, 0, 15, TILE, 1, rgba(PALETTE.ink900, 0.6));

  // One detail per variant, so long walls do not repeat perfectly.
  if (variant === 0) {
    // Pinned notice with a line of writing.
    box(ctx, 4, 4, 8, 6, PALETTE.paperShade);
    box(ctx, 4, 4, 8, 1, PALETTE.paper);
    box(ctx, 5, 6, 6, 1, PALETTE.grey500);
    box(ctx, 5, 8, 4, 1, PALETTE.grey500);
    box(ctx, 7, 4, 2, 1, accent);
  } else if (variant === 1) {
    // Vent grille.
    box(ctx, 3, 4, 6, 4, rgba(PALETTE.ink900, 0.5));
    for (let slat = 0; slat < 3; slat += 1) box(ctx, 4, 5 + slat, 4, 1, PALETTE.grey500);
  } else if (variant === 2) {
    // Conduit running up the wall.
    box(ctx, 12, 2, 2, 11, PALETTE.steel);
    box(ctx, 12, 2, 1, 11, PALETTE.grey100);
    box(ctx, 11, 6, 4, 1, PALETTE.ink800);
  } else {
    // Scuffs and a knocked corner.
    box(ctx, 3, 6, 1, 2, rgba(PALETTE.ink900, 0.3));
    box(ctx, 11, 11, 2, 1, rgba(PALETTE.ink900, 0.26));
    box(ctx, 12, 4, 1, 1, rgba(PALETTE.ink900, 0.35));
  }
}

function drawWallTop(ctx: CanvasRenderingContext2D): void {
  box(ctx, 0, 0, TILE, TILE, PALETTE.ink900);
  // The ceiling above the play plane: beams and dust, no baseboard.
  box(ctx, 0, 0, TILE, 2, PALETTE.ink800);
  box(ctx, 0, 7, TILE, 1, rgba(PALETTE.grey700, 0.6));
  box(ctx, 0, 13, TILE, 1, rgba(PALETTE.grey700, 0.45));
  for (let x = 2; x < TILE; x += 5) box(ctx, x, 2, 1, 5, rgba(PALETTE.grey700, 0.35));
  box(ctx, 4, 10, 1, 1, rgba(PALETTE.bone, 0.12));
  box(ctx, 11, 4, 1, 1, rgba(PALETTE.bone, 0.1));
}

function drawGate(ctx: CanvasRenderingContext2D, open: boolean): void {
  box(ctx, 0, 0, TILE, TILE, PALETTE.ink900);
  if (open) {
    // Leaves swung aside, with a lit threshold between them.
    box(ctx, 2, 1, 2, 14, PALETTE.steel);
    box(ctx, 12, 1, 2, 14, PALETTE.steel);
    box(ctx, 2, 1, 2, 1, PALETTE.grey100);
    box(ctx, 12, 1, 2, 1, PALETTE.grey100);
    box(ctx, 4, 4, 8, 8, PALETTE.ink800);
    box(ctx, 5, 5, 6, 6, PALETTE.chalkLight);
    box(ctx, 6, 6, 4, 4, PALETTE.bone);
    box(ctx, 4, 1, 8, 2, PALETTE.grey700);
    box(ctx, 4, 13, 8, 2, PALETTE.grey700);
    return;
  }
  // Two steel leaves in a heavy frame.
  box(ctx, 1, 0, 14, 16, PALETTE.grey700);
  box(ctx, 2, 1, 5, 14, PALETTE.steel);
  box(ctx, 9, 1, 5, 14, PALETTE.steel);
  box(ctx, 2, 1, 5, 1, PALETTE.grey100);
  box(ctx, 9, 1, 5, 1, PALETTE.grey100);
  box(ctx, 7, 1, 1, 14, PALETTE.ink900);
  for (let rivet = 0; rivet < 4; rivet += 1) {
    box(ctx, 3, 3 + rivet * 3, 1, 1, PALETTE.ink700);
    box(ctx, 12, 3 + rivet * 3, 1, 1, PALETTE.ink700);
  }
  // Hazard stripe across the base.
  for (let stripe = 2; stripe < 14; stripe += 4) box(ctx, stripe, 12, 2, 2, PALETTE.yellow);
  // The quiz sigil: a lit chalk ring with a rune inside, so a locked door reads
  // as locked before the player walks into it.
  box(ctx, 4, 4, 8, 6, rgba(PALETTE.ink900, 0.6));
  ctx.strokeStyle = PALETTE.chalkLight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(8, 7, 4, 0, Math.PI * 2);
  ctx.stroke();
  box(ctx, 7, 4, 2, 1, PALETTE.yellow);
  box(ctx, 8, 5, 1, 3, PALETTE.chalkLight);
  box(ctx, 6, 8, 4, 1, PALETTE.chalkLight);
  // Handle.
  box(ctx, 10, 6, 2, 3, PALETTE.ink900);
  box(ctx, 10, 6, 1, 1, PALETTE.yellow);
}

function drawStairs(ctx: CanvasRenderingContext2D): void {
  box(ctx, 0, 0, TILE, TILE, PALETTE.ink900);
  box(ctx, 1, 1, 14, 14, PALETTE.grey700);
  box(ctx, 1, 1, 14, 1, PALETTE.grey500);
  // Steps get darker as they descend, lit from the bottom of the well.
  for (let i = 0; i < 4; i += 1) {
    box(ctx, 2, 3 + i * 3, 12 - i, 2, PALETTE.ink800);
    box(ctx, 2, 3 + i * 3, 12 - i, 1, PALETTE.slate);
  }
  box(ctx, 4, 12, 8, 2, PALETTE.yellow);
  box(ctx, 5, 12, 6, 1, PALETTE.chalkLight);
  // Handrails.
  box(ctx, 2, 2, 1, 12, PALETTE.steel);
  box(ctx, 13, 2, 1, 12, PALETTE.steel);
}

// ---------------------------------------------------------------------------
// Props: a real silhouette per object instead of one generic block.
// ---------------------------------------------------------------------------

const PROP_COLORS: Record<string, PaletteName> = {
  desk: 'wood',
  table: 'wood',
  counter: 'steel',
  bench: 'wood',
  chair: 'cork',
  locker: 'steel',
  cabinet: 'cork',
  shelf: 'corkDark',
  crate: 'cork',
  plant: 'green',
  rug: 'redDark',
  board: 'greenDark',
  pipe: 'steel',
  bucket: 'slate',
  vending: 'redDark',
  machine: 'grey500',
  furnace: 'redDark',
  vault: 'steel',
  trophy: 'yellow',
  fountain: 'blue',
  lamp: 'yellow',
  mat: 'blue',
  rope: 'paper',
  sign: 'yellow',
  bottle: 'teal',
  tray: 'grey100',
  stage: 'corkDark',
  court: 'wood',
};

function drawProp(ctx: CanvasRenderingContext2D, prop: string): void {
  const color = PALETTE[PROP_COLORS[prop] ?? 'cork'];
  const dark = PALETTE.ink900;
  switch (prop) {
    case 'desk':
      // Desktop with a lip, a book and two legs.
      box(ctx, 2, 4, 12, 1, dark);
      box(ctx, 2, 5, 12, 5, color);
      box(ctx, 2, 5, 12, 1, PALETTE.wood);
      box(ctx, 4, 7, 5, 2, PALETTE.paper);
      box(ctx, 5, 7, 1, 2, PALETTE.grey300);
      box(ctx, 3, 10, 2, 5, PALETTE.corkDark);
      box(ctx, 11, 10, 2, 5, PALETTE.corkDark);
      box(ctx, 2, 10, 12, 1, dark);
      break;
    case 'table':
      box(ctx, 1, 5, 14, 4, color);
      box(ctx, 1, 5, 14, 1, PALETTE.wood);
      box(ctx, 2, 9, 2, 6, PALETTE.corkDark);
      box(ctx, 12, 9, 2, 6, PALETTE.corkDark);
      box(ctx, 5, 7, 6, 1, rgba(PALETTE.ink900, 0.25));
      break;
    case 'counter':
      box(ctx, 1, 4, 14, 3, PALETTE.grey100);
      box(ctx, 1, 7, 14, 7, color);
      box(ctx, 1, 7, 14, 1, PALETTE.ink900);
      box(ctx, 3, 9, 4, 4, PALETTE.grey700);
      box(ctx, 9, 9, 4, 4, PALETTE.grey700);
      break;
    case 'bench':
      box(ctx, 1, 6, 14, 4, color);
      box(ctx, 1, 6, 14, 1, PALETTE.wood);
      box(ctx, 2, 10, 2, 4, PALETTE.corkDark);
      box(ctx, 12, 10, 2, 4, PALETTE.corkDark);
      break;
    case 'chair':
      box(ctx, 4, 3, 8, 3, color);
      box(ctx, 5, 6, 6, 4, PALETTE.corkDark);
      box(ctx, 4, 3, 8, 1, PALETTE.wood);
      box(ctx, 5, 10, 1, 4, dark);
      box(ctx, 10, 10, 1, 4, dark);
      break;
    case 'locker':
      box(ctx, 4, 1, 9, 14, dark);
      box(ctx, 5, 2, 7, 12, color);
      box(ctx, 5, 2, 7, 1, PALETTE.grey100);
      for (let i = 0; i < 3; i += 1) box(ctx, 6, 4 + i, 5, 1, PALETTE.ink700);
      box(ctx, 6, 9, 5, 3, PALETTE.ink800);
      box(ctx, 10, 10, 1, 1, PALETTE.yellow);
      box(ctx, 5, 13, 7, 1, PALETTE.ink800);
      break;
    case 'shelf':
      box(ctx, 2, 1, 12, 14, dark);
      box(ctx, 3, 2, 10, 12, color);
      for (let row = 0; row < 3; row += 1) {
        box(ctx, 3, 6 + row * 4, 10, 1, PALETTE.ink900);
        box(ctx, 4 + row, 3 + row * 4, 2, 3, PALETTE.red);
        box(ctx, 7 + row, 3 + row * 4, 2, 3, PALETTE.blue);
        box(ctx, 10, 3 + row * 4, 2, 3, PALETTE.teal);
      }
      break;
    case 'plant':
      box(ctx, 6, 10, 5, 4, PALETTE.cork);
      box(ctx, 6, 10, 5, 1, PALETTE.corkDark);
      box(ctx, 5, 4, 7, 6, color);
      box(ctx, 7, 2, 3, 3, PALETTE.green);
      box(ctx, 4, 6, 2, 3, PALETTE.greenDark);
      box(ctx, 11, 5, 2, 3, PALETTE.greenDark);
      break;
    case 'rug':
      box(ctx, 1, 4, 14, 8, color);
      box(ctx, 1, 4, 14, 1, PALETTE.red);
      box(ctx, 1, 11, 14, 1, PALETTE.red);
      box(ctx, 3, 6, 10, 1, PALETTE.yellow);
      box(ctx, 3, 9, 10, 1, PALETTE.yellow);
      break;
    case 'mat':
      box(ctx, 2, 5, 12, 6, color);
      box(ctx, 2, 5, 12, 1, PALETTE.blueDark);
      box(ctx, 6, 7, 4, 2, PALETTE.chalkLight);
      break;
    case 'board':
      box(ctx, 1, 2, 14, 10, PALETTE.corkDark);
      box(ctx, 2, 3, 12, 8, color);
      box(ctx, 4, 5, 5, 1, PALETTE.chalkLight);
      box(ctx, 4, 7, 8, 1, PALETTE.chalk);
      box(ctx, 9, 9, 3, 1, PALETTE.chalk);
      box(ctx, 2, 12, 12, 1, PALETTE.grey700);
      break;
    case 'pipe':
      box(ctx, 5, 0, 5, 16, PALETTE.ink900);
      box(ctx, 6, 0, 3, 16, color);
      box(ctx, 6, 0, 1, 16, PALETTE.grey100);
      box(ctx, 4, 3, 8, 2, PALETTE.ink800);
      box(ctx, 4, 11, 8, 2, PALETTE.ink800);
      break;
    case 'bucket':
      box(ctx, 4, 5, 8, 9, color);
      box(ctx, 4, 5, 8, 1, PALETTE.grey300);
      box(ctx, 5, 3, 6, 2, PALETTE.grey700);
      box(ctx, 5, 8, 6, 1, PALETTE.teal);
      break;
    case 'vending':
      box(ctx, 2, 1, 12, 14, PALETTE.ink900);
      box(ctx, 3, 2, 10, 10, color);
      box(ctx, 4, 3, 8, 6, PALETTE.ink800);
      box(ctx, 5, 4, 2, 2, PALETTE.yellow);
      box(ctx, 8, 4, 2, 2, PALETTE.orange);
      box(ctx, 5, 7, 5, 2, PALETTE.chalkLight);
      box(ctx, 3, 12, 10, 2, PALETTE.grey700);
      break;
    case 'furnace':
      box(ctx, 2, 2, 12, 13, PALETTE.ink900);
      box(ctx, 3, 3, 10, 11, color);
      box(ctx, 5, 6, 6, 5, PALETTE.ink800);
      box(ctx, 6, 7, 4, 3, PALETTE.orange);
      box(ctx, 7, 8, 2, 2, PALETTE.yellow);
      box(ctx, 4, 3, 8, 1, PALETTE.grey700);
      break;
    case 'cabinet':
      box(ctx, 3, 1, 10, 14, PALETTE.ink900);
      box(ctx, 4, 2, 8, 12, color);
      box(ctx, 8, 2, 1, 12, PALETTE.ink900);
      box(ctx, 6, 5, 1, 2, PALETTE.yellow);
      box(ctx, 10, 5, 1, 2, PALETTE.yellow);
      box(ctx, 4, 2, 8, 1, PALETTE.cork);
      break;
    case 'crate':
      box(ctx, 3, 4, 10, 10, PALETTE.ink900);
      box(ctx, 4, 5, 8, 8, color);
      box(ctx, 4, 5, 8, 1, PALETTE.corkDark);
      box(ctx, 4, 8, 8, 1, PALETTE.corkDark);
      box(ctx, 7, 5, 1, 8, PALETTE.corkDark);
      break;
    case 'lamp':
      box(ctx, 6, 2, 4, 3, color);
      box(ctx, 7, 5, 2, 7, PALETTE.grey700);
      box(ctx, 4, 12, 8, 2, PALETTE.ink900);
      break;
    case 'trophy':
      box(ctx, 6, 2, 4, 4, color);
      box(ctx, 5, 1, 6, 1, PALETTE.orange);
      box(ctx, 7, 6, 2, 3, PALETTE.grey300);
      box(ctx, 5, 9, 6, 2, PALETTE.ink900);
      break;
    case 'fountain':
      box(ctx, 3, 6, 10, 7, PALETTE.grey500);
      box(ctx, 4, 7, 8, 4, PALETTE.blue);
      box(ctx, 5, 8, 6, 1, PALETTE.chalkLight);
      box(ctx, 3, 5, 10, 1, PALETTE.grey100);
      break;
    case 'court':
      box(ctx, 0, 0, 16, 16, color);
      box(ctx, 0, 0, 16, 1, PALETTE.wood);
      box(ctx, 7, 0, 2, 16, rgba(PALETTE.ink900, 0.18));
      box(ctx, 0, 7, 16, 2, rgba(PALETTE.ink900, 0.18));
      break;
    case 'stage':
      box(ctx, 0, 3, 16, 10, color);
      box(ctx, 0, 3, 16, 1, PALETTE.cork);
      box(ctx, 0, 12, 16, 1, PALETTE.ink900);
      for (let x = 2; x < 16; x += 4) box(ctx, x, 4, 1, 8, rgba(PALETTE.ink900, 0.15));
      break;
    case 'sign':
      box(ctx, 2, 3, 12, 8, PALETTE.ink900);
      box(ctx, 3, 4, 10, 6, color);
      box(ctx, 4, 6, 8, 1, PALETTE.ink900);
      box(ctx, 7, 11, 2, 3, PALETTE.grey700);
      break;
    case 'tray':
      box(ctx, 2, 6, 12, 5, PALETTE.grey100);
      box(ctx, 1, 5, 14, 1, PALETTE.bone);
      box(ctx, 2, 11, 12, 1, PALETTE.grey700);
      box(ctx, 5, 7, 6, 1, PALETTE.grey300);
      break;
    case 'bottle':
      box(ctx, 6, 2, 4, 2, PALETTE.ink900);
      box(ctx, 5, 4, 6, 9, color);
      box(ctx, 6, 6, 4, 4, PALETTE.chalkLight);
      break;
    case 'rope':
      box(ctx, 7, 0, 2, 14, PALETTE.paperShade);
      for (let y = 1; y < 14; y += 3) box(ctx, 6, y, 4, 1, PALETTE.paperShade);
      break;
    case 'vent':
    case 'machine':
    case 'vault':
    case 'gym':
    default:
      box(ctx, 1, 4, 14, 9, PALETTE.ink900);
      box(ctx, 2, 5, 12, 7, color);
      box(ctx, 2, 5, 12, 1, PALETTE.grey100);
      for (let i = 0; i < 3; i += 1) box(ctx, 4, 7 + i * 2, 8, 1, rgba(PALETTE.ink900, 0.35));
      box(ctx, 3, 12, 2, 2, PALETTE.ink900);
      box(ctx, 11, 12, 2, 2, PALETTE.ink900);
      break;
  }
}

// ---------------------------------------------------------------------------
// Containers: the desks and glowing lockers the player opens with E.
// ---------------------------------------------------------------------------

export function chestTextureKey(furniture: 'desk' | 'locker', open: boolean): string {
  return `chest-${furniture}${open ? '-open' : ''}`;
}

function drawDeskChest(ctx: CanvasRenderingContext2D, open: boolean): void {
  const dark = PALETTE.ink900;
  // A school desk seen from above: pale top, wooden lip, metal legs.
  box(ctx, 1, 4, 14, 9, dark);
  box(ctx, 2, 5, 12, 7, PALETTE.wood);
  box(ctx, 2, 5, 12, 1, PALETTE.cork);
  box(ctx, 3, 12, 2, 3, PALETTE.slate);
  box(ctx, 11, 12, 2, 3, PALETTE.slate);
  if (open) {
    // Drawer pulled out with a pale envelope inside.
    box(ctx, 3, 7, 10, 5, PALETTE.corkDark);
    box(ctx, 4, 8, 8, 3, PALETTE.paper);
    box(ctx, 5, 9, 3, 1, PALETTE.grey300);
    box(ctx, 9, 9, 2, 1, PALETTE.grey300);
    box(ctx, 3, 7, 10, 1, PALETTE.cork);
  } else {
    // Closed drawer with a handle and a name tag.
    box(ctx, 4, 7, 8, 4, PALETTE.corkDark);
    box(ctx, 6, 8, 4, 1, PALETTE.yellow);
    box(ctx, 7, 9, 2, 1, PALETTE.paperShade);
  }
}

function drawLockerChest(ctx: CanvasRenderingContext2D, open: boolean): void {
  const dark = PALETTE.ink900;
  box(ctx, 3, 0, 10, 16, dark);
  if (open) {
    // Door swung aside, dark interior, something glinting inside.
    box(ctx, 4, 1, 8, 14, PALETTE.ink800);
    box(ctx, 4, 1, 8, 1, PALETTE.ink700);
    box(ctx, 12, 0, 3, 16, PALETTE.steel);
    box(ctx, 12, 1, 1, 14, PALETTE.grey100);
    box(ctx, 6, 6, 3, 3, PALETTE.yellow);
    box(ctx, 7, 7, 1, 1, PALETTE.bone);
    box(ctx, 4, 14, 8, 1, PALETTE.ink700);
  } else {
    box(ctx, 4, 1, 8, 14, PALETTE.steel);
    box(ctx, 4, 1, 8, 1, PALETTE.grey100);
    for (let i = 0; i < 3; i += 1) box(ctx, 5, 3 + i, 4, 1, PALETTE.ink700);
    box(ctx, 5, 7, 6, 4, PALETTE.ink800);
    box(ctx, 9, 8, 1, 2, PALETTE.yellow);
    // Glowing seam: the "something is in here" tell.
    box(ctx, 10, 2, 1, 12, PALETTE.yellow);
    box(ctx, 4, 13, 8, 1, PALETTE.ink700);
  }
}

// ---------------------------------------------------------------------------
// Light, shadow and atmosphere.
// ---------------------------------------------------------------------------

function drawGlow(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, rgba(PALETTE.yellow, 0.55));
  gradient.addColorStop(0.45, rgba(PALETTE.orange, 0.22));
  gradient.addColorStop(1, rgba(PALETTE.ink900, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
}

function drawShadow(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createRadialGradient(8, 3, 1, 8, 3, 7);
  gradient.addColorStop(0, rgba(PALETTE.ink900, 0.5));
  gradient.addColorStop(1, rgba(PALETTE.ink900, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 6);
}

function drawAoTop(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, 6);
  gradient.addColorStop(0, rgba(PALETTE.ink900, 0.55));
  gradient.addColorStop(1, rgba(PALETTE.ink900, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 6);
}

function drawAoLeft(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 6, 0);
  gradient.addColorStop(0, rgba(PALETTE.ink900, 0.45));
  gradient.addColorStop(1, rgba(PALETTE.ink900, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 6, 16);
}

function drawAoRight(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(10, 0, 16, 0);
  gradient.addColorStop(0, rgba(PALETTE.ink900, 0));
  gradient.addColorStop(1, rgba(PALETTE.ink900, 0.4));
  ctx.fillStyle = gradient;
  ctx.fillRect(10, 0, 6, 16);
}

function drawAoBottom(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 10, 0, 16);
  gradient.addColorStop(0, rgba(PALETTE.ink900, 0));
  gradient.addColorStop(1, rgba(PALETTE.ink900, 0.4));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 10, 16, 6);
}

function drawLightPool(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, rgba(PALETTE.yellow, 0.3));
  gradient.addColorStop(0.5, rgba(PALETTE.orange, 0.12));
  gradient.addColorStop(1, rgba(PALETTE.ink900, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
}

function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.28,
    width / 2,
    height / 2,
    height * 0.82,
  );
  gradient.addColorStop(0, rgba(PALETTE.ink900, 0));
  gradient.addColorStop(0.7, rgba(PALETTE.ink900, 0.22));
  gradient.addColorStop(1, rgba(PALETTE.ink900, 0.62));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// ---------------------------------------------------------------------------
// Public generation entry points.
// ---------------------------------------------------------------------------

export function generateArt(scene: Phaser.Scene, viewWidth = 480, viewHeight = 270): void {
  for (const theme of THEMES) {
    const floor = themeColor(theme.id, 'floorColor');
    const accent = themeColor(theme.id, 'accentColor');
    const wall = themeColor(theme.id, 'wallColor');
    const pattern = floorPattern(theme.id);
    for (let variant = 0; variant < 4; variant += 1) {
      makeCanvasTexture(scene, `tile-${theme.id}-floor-${variant}`, TILE, TILE, (ctx) =>
        drawFloorTile(ctx, floor, accent, variant, pattern),
      );
      makeCanvasTexture(scene, `tile-${theme.id}-wall-face-${variant}`, TILE, TILE, (ctx) =>
        drawWallFace(ctx, wall, floor, accent, variant),
      );
    }
    makeCanvasTexture(scene, `tile-${theme.id}-wall-top`, TILE, TILE, drawWallTop);
  }

  makeCanvasTexture(scene, 'gate', TILE, TILE, (ctx) => drawGate(ctx, false));
  makeCanvasTexture(scene, 'gate-open', TILE, TILE, (ctx) => drawGate(ctx, true));
  makeCanvasTexture(scene, 'stairs', TILE, TILE, drawStairs);
  makeCanvasTexture(scene, 'dust', 3, 3, (ctx) => box(ctx, 0, 0, 3, 3, PALETTE.paperShade));
  makeCanvasTexture(scene, 'mote', 2, 2, (ctx) => box(ctx, 0, 0, 2, 2, PALETTE.chalkLight));
  makeCanvasTexture(scene, 'spark', 4, 4, (ctx) => {
    box(ctx, 0, 1, 4, 2, PALETTE.yellow);
    box(ctx, 1, 0, 2, 4, PALETTE.yellow);
    box(ctx, 1, 1, 2, 2, PALETTE.bone);
  });
  makeCanvasTexture(scene, 'projectile', 6, 6, (ctx) => {
    box(ctx, 0, 0, 6, 6, PALETTE.ink900);
    box(ctx, 1, 1, 4, 4, PALETTE.yellow);
    box(ctx, 2, 2, 2, 2, PALETTE.bone);
  });
  makeCanvasTexture(scene, 'glow', 32, 32, drawGlow);
  makeCanvasTexture(scene, 'shadow', 16, 6, drawShadow);
  makeCanvasTexture(scene, 'ao-top', 16, 6, drawAoTop);
  makeCanvasTexture(scene, 'ao-left', 6, 16, drawAoLeft);
  makeCanvasTexture(scene, 'ao-right', 6, 16, drawAoRight);
  makeCanvasTexture(scene, 'ao-bottom', 16, 6, drawAoBottom);
  makeCanvasTexture(scene, 'lightpool', 64, 64, drawLightPool);
  makeCanvasTexture(scene, 'vignette', viewWidth, viewHeight, (ctx) => drawVignette(ctx, viewWidth, viewHeight));

  for (const furniture of ['desk', 'locker'] as const) {
    makeCanvasTexture(scene, chestTextureKey(furniture, false), TILE, TILE, (ctx) =>
      furniture === 'desk' ? drawDeskChest(ctx, false) : drawLockerChest(ctx, false),
    );
    makeCanvasTexture(scene, chestTextureKey(furniture, true), TILE, TILE, (ctx) =>
      furniture === 'desk' ? drawDeskChest(ctx, true) : drawLockerChest(ctx, true),
    );
  }

  for (const cls of CLASSES) {
    const look = classLook(cls.id);
    for (const direction of FACING_DIRS) {
      for (let frame = 0; frame < FRAMES_PER_DIRECTION; frame += 1) {
        makeCanvasTexture(scene, playerTextureKey(cls.id, direction, frame), 16, 16, (ctx) =>
          drawPlayerFrame(ctx, direction, frame, look),
        );
      }
      const key = playerAnimKey(cls.id, direction);
      if (scene.anims.exists(key)) scene.anims.remove(key);
      scene.anims.create({
        key,
        frames: Array.from({ length: FRAMES_PER_DIRECTION }, (_unused, frame) => ({
          key: playerTextureKey(cls.id, direction, frame),
        })),
        frameRate: look.walkFrameRate,
        repeat: -1,
      });
    }
  }

  for (const enemy of ENEMIES) {
    const key = `enemy-${enemy.archetype}-${enemy.palette}`;
    const base = paletteHex(enemy.palette);
    const shadeHex = Phaser.Display.Color.ValueToColor(base).darken(28).color;
    const lightHex = Phaser.Display.Color.ValueToColor(base).lighten(16).color;
    makeCanvasTexture(scene, key, 16, 16, (ctx) =>
      drawEnemy(
        ctx,
        enemy.archetype,
        base,
        `#${shadeHex.toString(16).padStart(6, '0')}`,
        `#${lightHex.toString(16).padStart(6, '0')}`,
        PALETTE.red,
      ),
    );
  }

  for (let style = 0; style < 3; style += 1) {
    makeCanvasTexture(scene, `loot-bag-${style}`, 40, 44, (ctx) => drawLootBag(ctx, style));
  }

  for (const item of ITEMS) ensureItemIcon(scene, item.spriteKey, item.tier);

  const props = new Set<string>([
    'desk',
    'chair',
    'locker',
    'table',
    'shelf',
    'crate',
    'plant',
    'rug',
    'pipe',
    'board',
    'bench',
    'counter',
    'cabinet',
    'vending',
    'furnace',
    'lamp',
    'sign',
    'tray',
    'bottle',
    'bucket',
    'fountain',
    'trophy',
    'court',
    'stage',
    'mat',
    'rope',
    'vent',
    'machine',
    'vault',
  ]);
  for (const prop of props) {
    makeCanvasTexture(scene, `prop-${prop}`, TILE, TILE, (ctx) => drawProp(ctx, prop));
  }
  playerCounters.clear();
}

export function ensureItemIcon(scene: Phaser.Scene, spriteKey: string, tier: number): string {
  const key = `item-${spriteKey}-${tier}`;
  makeCanvasTexture(scene, key, 12, 12, (ctx) => drawItem(ctx, spriteKey, paletteHex(tierColor(tier))));
  return key;
}

export function ensurePropTexture(scene: Phaser.Scene, prop: string): string {
  const key = `prop-${prop}`;
  makeCanvasTexture(scene, key, TILE, TILE, (ctx) => drawProp(ctx, prop));
  return key;
}

export function enemyTextureKey(archetype: string, palette: string): string {
  return `enemy-${archetype}-${palette}`;
}

// ---------------------------------------------------------------------------
// Reward backpacks: three large, distinct silhouettes for the loot screen.
// ---------------------------------------------------------------------------

function drawLootBag(ctx: CanvasRenderingContext2D, style: number): void {
  const outline = PALETTE.ink900;
  const leather = style === 2 ? PALETTE.ink700 : PALETTE.cork;
  const dark = style === 2 ? PALETTE.ink900 : PALETTE.corkDark;
  const light = style === 1 ? PALETTE.paperShade : PALETTE.wood;
  const metal = PALETTE.yellow;
  const strap = PALETTE.grey900;

  const shell = (x: number, y: number, w: number, h: number, fill: string): void => {
    box(ctx, x - 1, y - 1, w + 2, h + 2, outline);
    box(ctx, x, y, w, h, fill);
  };

  if (style === 0) {
    // Rucksack: tall body, top flap and two buckled shoulder straps.
    shell(6, 8, 28, 30, leather);
    box(ctx, 8, 9, 24, 2, light);
    shell(5, 10, 30, 8, dark);
    box(ctx, 6, 10, 28, 2, light);
    box(ctx, 13, 12, 14, 2, strap);
    box(ctx, 17, 12, 6, 4, metal);
    box(ctx, 19, 13, 2, 2, dark);
    shell(2, 20, 5, 12, dark);
    shell(33, 20, 5, 12, dark);
    box(ctx, 8, 22, 24, 1, dark);
    box(ctx, 19, 24, 2, 8, strap);
    box(ctx, 18, 32, 4, 2, metal);
    box(ctx, 9, 20, 2, 6, light);
    return;
  }

  if (style === 1) {
    // Satchel: wide flap, centre buckle and a long diagonal shoulder strap.
    shell(7, 14, 26, 24, leather);
    box(ctx, 9, 15, 22, 2, light);
    shell(6, 12, 28, 9, dark);
    box(ctx, 7, 12, 26, 2, light);
    box(ctx, 15, 14, 10, 5, metal);
    box(ctx, 17, 15, 6, 3, dark);
    for (let i = 0; i < 15; i += 1) box(ctx, 8 + i, 31 - i, 3, 2, strap);
    box(ctx, 9, 36, 22, 1, light);
    box(ctx, 28, 16, 4, 2, metal);
    return;
  }

  // Duffel: a long cylinder with end panels, a zip and two handles.
  shell(4, 16, 32, 20, leather);
  box(ctx, 5, 17, 30, 2, light);
  box(ctx, 6, 34, 28, 1, dark);
  shell(10, 12, 20, 6, dark);
  box(ctx, 12, 14, 16, 1, metal);
  box(ctx, 18, 13, 4, 2, outline);
  box(ctx, 12, 8, 3, 5, strap);
  box(ctx, 25, 8, 3, 5, strap);
  box(ctx, 12, 8, 16, 2, strap);
  box(ctx, 4, 20, 3, 12, dark);
  box(ctx, 33, 20, 3, 12, dark);
  box(ctx, 7, 24, 2, 6, light);
}
