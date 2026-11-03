// Draws the app icons as PNG files, using only Node's standard library.
// Run with: node tools/make-icons.js
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const OUT = resolve(import.meta.dirname, '..', 'icons');
const TEAL = [15, 118, 110];
const PAPER = [255, 255, 255];
const INK = [15, 118, 110];
const INK_LIGHT = [153, 204, 199];

/** Picks the colour at a point, where u and v both run from 0 to 1 across the icon. */
function colourAt(u, v) {
  const left = 0.26;
  const right = 0.74;
  const top = 0.14;
  const bottom = 0.86;
  if (u < left || u > right || v < top || v > bottom) return TEAL;

  // Zigzag torn edge along the bottom of the paper.
  const teeth = 6;
  const tooth = (right - left) / teeth;
  const phase = ((u - left) % tooth) / tooth;
  const depth = Math.abs(phase - 0.5) * 2 * 0.045;
  if (v > bottom - depth) return TEAL;

  const inBar = (y, height, x0, x1) => v >= y && v < y + height && u >= x0 && u <= x1;
  if (inBar(0.24, 0.05, 0.33, 0.67)) return INK;
  for (const y of [0.36, 0.44, 0.52]) {
    if (inBar(y, 0.03, 0.33, 0.67)) return INK_LIGHT;
  }
  if (inBar(0.63, 0.06, 0.48, 0.67)) return INK;
  return PAPER;
}

function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, check]);
}

function png(size) {
  const row = 1 + size * 3;
  const raw = Buffer.alloc(row * size);
  const samples = 4; // Supersampling per axis, so edges stay smooth.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const colour = colourAt(
            (x + (sx + 0.5) / samples) / size,
            (y + (sy + 0.5) / samples) / size,
          );
          colour.forEach((value, c) => (sum[c] += value));
        }
      }
      const at = y * row + 1 + x * 3;
      sum.forEach((value, c) => (raw[at + c] = Math.round(value / samples ** 2)));
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // Bit depth.
  header[9] = 2; // RGB, with no alpha, as iOS prefers for home screen icons.
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), png(size));
}
