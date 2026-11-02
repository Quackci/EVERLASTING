#!/usr/bin/env node
/**
 * Generates build/icon.png (512x512) from a 32x32 pixel-art drawing, upscaled
 * with nearest-neighbour sampling. No image libraries: a small PNG encoder is
 * enough for a flat-colour icon, and it keeps the build dependency-free.
 *
 * Colours are named after src/game/art/palette.ts entries so the icon stays in
 * the same locked 32-colour family as the rest of the game.
 */
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const PALETTE = {
  void: '#0b0f12',
  ink900: '#11181f',
  ink800: '#1a2430',
  ink700: '#233040',
  ink600: '#2f4055',
  slate: '#3c5169',
  bone: '#eef3e6',
  corkDark: '#654630',
  orange: '#d9853f',
  yellow: '#e7c65b',
};

const SIZE = 32;
const SCALE = 16;
const pixels = new Array(SIZE * SIZE).fill(null);

function rect(x, y, w, h, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) continue;
      pixels[py * SIZE + px] = color ? PALETTE[color] ?? null : null;
    }
  }
}

// The room: ink border, tiled back wall, floorboards.
rect(0, 0, SIZE, SIZE, 'void');
rect(0, 0, SIZE, 1, 'ink800');
rect(0, SIZE - 1, SIZE, 1, 'ink800');
rect(0, 0, 1, SIZE, 'ink800');
rect(SIZE - 1, 0, 1, SIZE, 'ink800');

rect(1, 1, 30, 20, 'ink700');
for (let y = 4; y <= 20; y += 4) rect(1, y, 30, 1, 'ink800');
for (let x = 9; x < 31; x += 9) rect(x, 1, 1, 20, 'ink600');

rect(1, 21, 30, 10, 'slate');
for (let y = 23; y < 31; y += 3) rect(1, y, 30, 1, 'ink600');

// Doorway: pale frame, warm light inside, light spilling onto the floor.
rect(11, 6, 9, 1, 'bone');
rect(11, 7, 1, 14, 'bone');
rect(19, 7, 1, 14, 'bone');
rect(12, 7, 7, 14, 'ink900');
rect(13, 8, 5, 13, 'corkDark');
rect(13, 10, 5, 8, 'orange');
rect(13, 15, 5, 6, 'yellow');
rect(12, 21, 8, 1, 'yellow');
rect(11, 22, 10, 1, 'orange');
rect(10, 23, 12, 1, 'corkDark');

// A student walking into the light, seen from behind.
rect(5, 20, 3, 3, 'ink900');
rect(4, 23, 5, 4, 'ink900');
rect(5, 27, 1, 3, 'ink900');
rect(7, 27, 1, 3, 'ink900');

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Nearest-neighbour render of the 32x32 drawing at any square size. */
function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(SIZE - 1, Math.floor((x * SIZE) / size));
      const sy = Math.min(SIZE - 1, Math.floor((y * SIZE) / size));
      const hex = pixels[sy * SIZE + sx];
      const offset = (y * size + x) * 4;
      if (!hex) {
        rgba[offset + 3] = 0;
        continue;
      }
      rgba[offset] = Number.parseInt(hex.slice(1, 3), 16);
      rgba[offset + 1] = Number.parseInt(hex.slice(3, 5), 16);
      rgba[offset + 2] = Number.parseInt(hex.slice(5, 7), 16);
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

/**
 * ICO container holding PNG-compressed frames (Vista and later). Windows picks
 * the closest size for the taskbar, Start menu, Alt-Tab and the file icon.
 */
function encodeIco(sizes) {
  const frames = sizes.map((size) => ({ size, png: encodePng(size, size, render(size)) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);

  const entries = Buffer.alloc(16 * frames.length);
  let offset = header.length + entries.length;
  frames.forEach((frame, index) => {
    const base = index * 16;
    entries[base] = frame.size >= 256 ? 0 : frame.size;
    entries[base + 1] = frame.size >= 256 ? 0 : frame.size;
    entries[base + 2] = 0;
    entries[base + 3] = 0;
    entries.writeUInt16LE(1, base + 4);
    entries.writeUInt16LE(32, base + 6);
    entries.writeUInt32LE(frame.png.length, base + 8);
    entries.writeUInt32LE(offset, base + 12);
    offset += frame.png.length;
  });

  return Buffer.concat([header, entries, ...frames.map((frame) => frame.png)]);
}

const buildDir = path.resolve('build');
fs.mkdirSync(buildDir, { recursive: true });

const outSize = SIZE * SCALE;
const pngPath = path.join(buildDir, 'icon.png');
fs.writeFileSync(pngPath, encodePng(outSize, outSize, render(outSize)));
console.log(`Wrote ${path.relative(process.cwd(), pngPath)} (${outSize}x${outSize})`);

const icoSizes = [16, 32, 48, 64, 128, 256];
const icoPath = path.join(buildDir, 'icon.ico');
fs.writeFileSync(icoPath, encodeIco(icoSizes));
console.log(`Wrote ${path.relative(process.cwd(), icoPath)} (${icoSizes.join(', ')})`);
