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
  const legShift = frame === 1 ? -1 : frame === 2 ? 1 : 0;
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
      const offsetX = y >= 14 ? legShift : 0;
      const offsetY = y < 14 ? bob : 0;
      pixel(ctx, x + offsetX, y + offsetY, PALETTE[name]);
    }
  }
}

// ---------------------------------------------------------------------------
// Enemies: distinct silhouettes per archetype, outlined and shaded per enemy.
// ---------------------------------------------------------------------------

function drawEnemy(ctx: CanvasRenderingContext2D, archetype: string, base: string, shade: string, accent: string): void {
  const outline = PALETTE.ink900;
  const eye = PALETTE.bone;

  const outlinedBox = (x: number, y: number, w: number, h: number, color: string): void => {
    box(ctx, x - 1, y - 1, w + 2, h + 2, outline);
    box(ctx, x, y, w, h, color);
  };

  switch (archetype) {
    case 'golem':
      outlinedBox(2, 4, 12, 4, base);
      outlinedBox(2, 9, 12, 4, shade);
      box(ctx, 2, 4, 12, 1, base);
      box(ctx, 5, 5, 2, 2, eye);
      box(ctx, 10, 5, 2, 2, eye);
      box(ctx, 3, 14, 3, 1, outline);
      box(ctx, 10, 14, 3, 1, outline);
      box(ctx, 7, 11, 2, 1, accent);
      break;
    case 'humanoid':
      outlinedBox(5, 2, 6, 5, base);
      box(ctx, 6, 4, 1, 1, eye);
      box(ctx, 9, 4, 1, 1, eye);
      outlinedBox(4, 8, 8, 5, shade);
      box(ctx, 4, 9, 1, 3, accent);
      box(ctx, 11, 9, 1, 3, accent);
      box(ctx, 5, 13, 2, 2, outline);
      box(ctx, 9, 13, 2, 2, outline);
      box(ctx, 5, 3, 6, 1, shade);
      break;
    case 'machine':
      outlinedBox(2, 2, 12, 12, base);
      box(ctx, 4, 4, 8, 4, PALETTE.ink900);
      box(ctx, 5, 5, 2, 2, accent);
      box(ctx, 9, 5, 2, 2, eye);
      box(ctx, 3, 11, 10, 2, shade);
      box(ctx, 2, 2, 12, 1, PALETTE.grey100);
      break;
    case 'blob':
      outlinedBox(2, 6, 12, 8, base);
      outlinedBox(4, 4, 8, 4, base);
      box(ctx, 2, 12, 12, 2, shade);
      box(ctx, 5, 8, 2, 2, eye);
      box(ctx, 9, 8, 2, 2, eye);
      box(ctx, 3, 13, 2, 1, accent);
      box(ctx, 11, 13, 2, 1, accent);
      break;
    case 'ghost':
      box(ctx, 4, 2, 8, 3, outline);
      box(ctx, 5, 3, 6, 9, base);
      box(ctx, 4, 4, 1, 8, base);
      box(ctx, 11, 4, 1, 8, base);
      box(ctx, 5, 12, 2, 2, base);
      box(ctx, 9, 12, 2, 2, base);
      box(ctx, 6, 10, 4, 1, shade);
      box(ctx, 7, 10, 2, 2, accent);
      box(ctx, 6, 5, 1, 2, eye);
      box(ctx, 9, 5, 1, 2, eye);
      break;
    case 'beast':
      outlinedBox(1, 6, 12, 5, base);
      outlinedBox(10, 3, 4, 5, base);
      box(ctx, 13, 5, 1, 1, eye);
      box(ctx, 2, 11, 2, 4, shade);
      box(ctx, 6, 11, 2, 4, shade);
      box(ctx, 9, 11, 2, 4, shade);
      box(ctx, 1, 7, 3, 1, accent);
      box(ctx, 15, 6, 1, 1, outline);
      break;
    case 'paper':
    default: {
      ctx.fillStyle = outline;
      ctx.beginPath();
      ctx.moveTo(2, 2);
      ctx.lineTo(14, 5);
      ctx.lineTo(11, 15);
      ctx.lineTo(1, 11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.moveTo(3, 4);
      ctx.lineTo(13, 7);
      ctx.lineTo(10, 14);
      ctx.lineTo(2, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(3, 10);
      ctx.lineTo(10, 14);
      ctx.lineTo(2, 10);
      ctx.closePath();
      ctx.fill();
      box(ctx, 5, 7, 4, 1, accent);
      box(ctx, 7, 9, 2, 1, accent);
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

function drawFloorTile(ctx: CanvasRenderingContext2D, base: string, accent: string, variant: number): void {
  box(ctx, 0, 0, TILE, TILE, base);

  // Two-by-two grout grid: reads as tile, not as a flat colour block.
  box(ctx, 0, 0, TILE, 1, PALETTE.ink800);
  box(ctx, 0, 0, 1, TILE, PALETTE.ink800);
  box(ctx, 0, 8, TILE, 1, PALETTE.ink700);
  box(ctx, 8, 0, 1, TILE, PALETTE.ink700);
  box(ctx, 1, 1, 7, 1, rgba(PALETTE.bone, 0.08));
  box(ctx, 1, 1, 1, 7, rgba(PALETTE.bone, 0.05));

  if (variant === 1) {
    // Hairline crack with a scuffed corner.
    box(ctx, 11, 3, 1, 4, PALETTE.ink700);
    box(ctx, 12, 7, 2, 1, PALETTE.ink700);
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

function drawWallTile(ctx: CanvasRenderingContext2D, base: string, floor: string): void {
  box(ctx, 0, 0, TILE, TILE, PALETTE.ink900);
  // Top face: the wall is 3/4, so the upper band is lit differently.
  box(ctx, 0, 0, TILE, 3, rgba(PALETTE.ink900, 0.55));
  box(ctx, 0, 0, TILE, 1, rgba(PALETTE.bone, 0.12));
  // Front face.
  box(ctx, 0, 3, TILE, 10, base);
  box(ctx, 0, 4, TILE, 1, rgba(PALETTE.bone, 0.14));
  // Panel seams.
  box(ctx, 7, 3, 1, 10, rgba(PALETTE.ink900, 0.35));
  box(ctx, 0, 9, TILE, 1, rgba(PALETTE.ink900, 0.18));
  // Baseboard.
  box(ctx, 0, 13, TILE, 3, floor);
  box(ctx, 0, 13, TILE, 1, PALETTE.ink900);
  box(ctx, 0, 15, TILE, 1, rgba(PALETTE.ink900, 0.6));
  // A couple of knocks so long walls do not repeat perfectly.
  box(ctx, 3, 6, 1, 2, rgba(PALETTE.ink900, 0.25));
  box(ctx, 11, 11, 2, 1, rgba(PALETTE.ink900, 0.22));
}

function drawGate(ctx: CanvasRenderingContext2D): void {
  box(ctx, 0, 0, TILE, TILE, PALETTE.ink900);
  box(ctx, 1, 1, TILE - 2, TILE - 2, PALETTE.grey700);
  box(ctx, 1, 1, TILE - 2, 1, PALETTE.grey500);
  for (let x = 3; x < TILE - 1; x += 4) box(ctx, x, 1, 2, TILE - 2, PALETTE.steel);
  // The quiz sigil: dark, with a faint ring, so "locked" is legible.
  box(ctx, 4, 5, 8, 6, PALETTE.ink900);
  box(ctx, 4, 5, 8, 1, PALETTE.redDark);
  box(ctx, 6, 7, 4, 2, PALETTE.red);
  box(ctx, 7, 8, 2, 1, PALETTE.yellow);
  box(ctx, 2, 2, 1, 1, PALETTE.grey100);
}

function drawStairs(ctx: CanvasRenderingContext2D): void {
  box(ctx, 0, 0, TILE, TILE, PALETTE.ink900);
  box(ctx, 1, 1, 14, 14, PALETTE.grey700);
  box(ctx, 1, 1, 14, 1, PALETTE.grey500);
  for (let i = 0; i < 4; i += 1) {
    box(ctx, 3, 3 + i * 3, 10 - i * 2, 2, PALETTE.ink800);
    box(ctx, 3, 3 + i * 3, 10 - i * 2, 1, PALETTE.slate);
  }
  box(ctx, 7, 12, 2, 2, PALETTE.chalkLight);
  box(ctx, 2, 2, 1, 1, PALETTE.bone);
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
    for (let variant = 0; variant < 4; variant += 1) {
      makeCanvasTexture(scene, `tile-${theme.id}-floor-${variant}`, TILE, TILE, (ctx) =>
        drawFloorTile(ctx, floor, accent, variant),
      );
    }
    makeCanvasTexture(scene, `tile-${theme.id}-wall`, TILE, TILE, (ctx) => drawWallTile(ctx, wall, floor));
  }

  makeCanvasTexture(scene, 'gate', TILE, TILE, drawGate);
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
    const shadeHex = Phaser.Display.Color.ValueToColor(base).darken(25).color;
    makeCanvasTexture(scene, key, 16, 16, (ctx) =>
      drawEnemy(ctx, enemy.archetype, base, `#${shadeHex.toString(16).padStart(6, '0')}`, PALETTE.red),
    );
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
