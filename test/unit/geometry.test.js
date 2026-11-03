import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultQuad,
  homography,
  outputSize,
  project,
  rotateQuad,
} from '../../src/geometry.js';

const close = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} is not close to ${expected}`);

test('homography maps every source corner to its destination corner', () => {
  const from = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 0, y: 200 }];
  const to = [{ x: 12, y: 5 }, { x: 90, y: 20 }, { x: 110, y: 180 }, { x: 3, y: 210 }];
  const h = homography(from, to);
  from.forEach((p, i) => {
    const q = project(h, p);
    close(q.x, to[i].x);
    close(q.y, to[i].y);
  });
});

test('homography of a rectangle to itself is the identity', () => {
  const r = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const q = project(homography(r, r), { x: 3, y: 7 });
  close(q.x, 3);
  close(q.y, 7);
});

test('homography rejects a collapsed quad', () => {
  const from = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const line = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
  assert.throws(() => homography(from, line), /degenerate/i);
});

test('outputSize uses the longer opposite edges', () => {
  const quad = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 280, y: 800 }, { x: 20, y: 800 }];
  assert.deepEqual(outputSize(quad, 2000), { width: 300, height: 800 });
});

test('outputSize scales down so the longest side meets the limit, keeping the ratio', () => {
  const quad = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 4000 }, { x: 0, y: 4000 }];
  assert.deepEqual(outputSize(quad, 2000), { width: 500, height: 2000 });
});

test('outputSize never returns a zero dimension', () => {
  const quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 9000 }, { x: 0, y: 9000 }];
  assert.equal(outputSize(quad, 2000).width, 1);
});

test('defaultQuad insets 5% from each edge, clockwise from top left', () => {
  assert.deepEqual(defaultQuad(100, 200), [
    { x: 5, y: 10 }, { x: 95, y: 10 }, { x: 95, y: 190 }, { x: 5, y: 190 },
  ]);
});

test('rotateQuad turns corners 90 degrees clockwise and keeps top-left first', () => {
  const quad = [{ x: 10, y: 20 }, { x: 90, y: 20 }, { x: 90, y: 180 }, { x: 10, y: 180 }];
  // Source is 100 wide and 200 tall, so the rotated image is 200 wide and 100 tall.
  assert.deepEqual(rotateQuad(quad, 200), [
    { x: 20, y: 10 }, { x: 180, y: 10 }, { x: 180, y: 90 }, { x: 20, y: 90 },
  ]);
});
