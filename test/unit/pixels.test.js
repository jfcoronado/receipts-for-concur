import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enhance, warp } from '../../src/pixels.js';

/** Builds an RGBA buffer from a function of x and y returning a grey level. */
const image = (width, height, grey) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const g = grey(x, y);
      data[i] = data[i + 1] = data[i + 2] = g;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
};

const greyAt = (img, x, y) => img.data[(y * img.width + x) * 4];

test('warp with the full image as the quad reproduces the image', () => {
  const src = image(20, 20, (x) => (x < 10 ? 0 : 200));
  const quad = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
  const out = warp(src, quad, 20, 20);
  assert.equal(out.width, 20);
  assert.equal(out.height, 20);
  assert.equal(greyAt(out, 2, 10), 0);
  assert.equal(greyAt(out, 17, 10), 200);
});

test('warp crops to the quad', () => {
  // A white square on black: cropping exactly to the square must give all white.
  const src = image(40, 40, (x, y) => (x >= 10 && x < 30 && y >= 10 && y < 30 ? 255 : 0));
  const quad = [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }, { x: 10, y: 30 }];
  const out = warp(src, quad, 10, 10);
  assert.equal(greyAt(out, 5, 5), 255);
  assert.equal(greyAt(out, 1, 1), 255);
});

test('warp straightens a skewed quad', () => {
  // Left half dark and right half light, split on the vertical x = 20.
  const src = image(40, 40, (x) => (x < 20 ? 10 : 240));
  const quad = [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 35, y: 40 }, { x: 5, y: 40 }];
  const out = warp(src, quad, 20, 20);
  for (const y of [2, 10, 17]) {
    assert.ok(greyAt(out, 3, y) < 50, `left side at row ${y} should be dark`);
    assert.ok(greyAt(out, 16, y) > 200, `right side at row ${y} should be light`);
  }
});

test('warp output is fully opaque', () => {
  const src = image(10, 10, () => 100);
  const quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const out = warp(src, quad, 5, 5);
  assert.ok(out.data.every((v, i) => i % 4 !== 3 || v === 255));
});

test('enhance stretches a faded receipt to near black and near white', () => {
  // Faded thermal print: grey text (110) on grey paper (170).
  const src = image(100, 100, (x) => (x < 20 ? 110 : 170));
  const out = enhance(src);
  assert.ok(greyAt(out, 5, 50) < 40, `text was ${greyAt(out, 5, 50)}`);
  assert.ok(greyAt(out, 60, 50) > 215, `paper was ${greyAt(out, 60, 50)}`);
});

test('enhance outputs greyscale and does not change the input', () => {
  const src = image(10, 10, () => 100);
  src.data[0] = 250; // Add a colour cast to one pixel.
  const before = Uint8ClampedArray.from(src.data);
  const out = enhance(src);
  assert.deepEqual(src.data, before);
  assert.equal(out.data[0], out.data[1]);
  assert.equal(out.data[1], out.data[2]);
});

test('enhance leaves a blank image unchanged instead of dividing by zero', () => {
  const out = enhance(image(10, 10, () => 128));
  assert.equal(greyAt(out, 5, 5), 128);
});
