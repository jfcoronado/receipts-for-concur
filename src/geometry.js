// Pure geometry for the corner editor. Quads run clockwise from the top left.

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Solves a square linear system by Gaussian elimination with partial pivoting. */
function solve(matrix, values) {
  const n = values.length;
  const rows = matrix.map((row, i) => [...row, values[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    }
    if (Math.abs(rows[pivot][col]) < 1e-9) throw new Error('Degenerate quad');
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    for (let r = col + 1; r < n; r++) {
      const factor = rows[r][col] / rows[col][col];
      for (let c = col; c <= n; c++) rows[r][c] -= factor * rows[col][c];
    }
  }
  const result = new Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let sum = rows[r][n];
    for (let c = r + 1; c < n; c++) sum -= rows[r][c] * result[c];
    result[r] = sum / rows[r][r];
  }
  return result;
}

/** Returns the 3x3 projective transform, as 9 numbers, that maps `from` onto `to`. */
export function homography(from, to) {
  const matrix = [];
  const values = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    matrix.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    values.push(v);
  }
  return [...solve(matrix, values), 1];
}

export function project(h, { x, y }) {
  const w = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
  };
}

/** Picks an output size from the quad's longer opposite edges, capped at maxSide. */
export function outputSize(quad, maxSide) {
  const [tl, tr, br, bl] = quad;
  const width = Math.max(distance(tl, tr), distance(bl, br));
  const height = Math.max(distance(tl, bl), distance(tr, br));
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function defaultQuad(width, height) {
  const dx = width * 0.05;
  const dy = height * 0.05;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

/** Rotates a quad 90 degrees clockwise. `height` is the image height before rotating. */
export function rotateQuad(quad, height) {
  const turned = quad.map(({ x, y }) => ({ x: height - y, y: x }));
  // The old bottom-left corner becomes the new top-left.
  return [turned[3], turned[0], turned[1], turned[2]];
}
