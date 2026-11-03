// Pure pixel operations on { data: RGBA Uint8ClampedArray, width, height }.

import { homography } from './geometry.js';

/** Cuts the quad out of `src` and straightens it into a width x height rectangle. */
export function warp(src, quad, width, height) {
  const target = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const h = homography(target, quad);
  const data = new Uint8ClampedArray(width * height * 4);
  const maxX = src.width - 1;
  const maxY = src.height - 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Sample at pixel centres, using bilinear filtering so text stays smooth.
      const px = x + 0.5;
      const py = y + 0.5;
      const w = h[6] * px + h[7] * py + h[8];
      const sx = Math.min(maxX, Math.max(0, (h[0] * px + h[1] * py + h[2]) / w - 0.5));
      const sy = Math.min(maxY, Math.max(0, (h[3] * px + h[4] * py + h[5]) / w - 0.5));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(maxX, x0 + 1);
      const y1 = Math.min(maxY, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const out = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top =
          src.data[(y0 * src.width + x0) * 4 + c] * (1 - fx) +
          src.data[(y0 * src.width + x1) * 4 + c] * fx;
        const bottom =
          src.data[(y1 * src.width + x0) * 4 + c] * (1 - fx) +
          src.data[(y1 * src.width + x1) * 4 + c] * fx;
        data[out + c] = top * (1 - fy) + bottom * fy;
      }
      data[out + 3] = 255;
    }
  }
  return { data, width, height };
}

// Share of pixels ignored at each end, so specks and glare don't set the range.
const CLIP = 0.02;
// Below this spread the image is effectively blank, and stretching would add noise.
const MIN_RANGE = 8;

/** Converts to greyscale and stretches contrast. Returns a new image. */
export function enhance(src) {
  const { width, height } = src;
  const count = width * height;
  const grey = new Uint8ClampedArray(count);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const g = Math.round(
      0.299 * src.data[p] + 0.587 * src.data[p + 1] + 0.114 * src.data[p + 2],
    );
    grey[i] = g;
    histogram[g]++;
  }

  const clip = count * CLIP;
  let low = 0;
  for (let seen = histogram[0]; seen <= clip && low < 255; seen += histogram[++low]);
  let high = 255;
  for (let seen = histogram[255]; seen <= clip && high > 0; seen += histogram[--high]);

  const range = high - low;
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    const value = range < MIN_RANGE ? grey[i] : ((grey[i] - low) * 255) / range;
    const p = i * 4;
    data[p] = data[p + 1] = data[p + 2] = value;
    data[p + 3] = 255;
  }
  return { data, width, height };
}
