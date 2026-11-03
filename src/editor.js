// The corner editor: loads a photo, lets the user drag corners, and renders the scan.

import { defaultQuad, outputSize, rotateQuad } from './geometry.js';
import { enhance, warp } from './pixels.js';

const WORKING_SIDE = 3000; // Keeps memory use safe on a phone.
const OUTPUT_SIDE = 2000;
const JPEG_QUALITY = 0.85;
const GRAB_RADIUS = 44; // CSS pixels.
const STAGE_HEIGHT_SHARE = 0.6; // Share of the screen height used by the photo.

async function loadPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, WORKING_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function rotated(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.height;
  canvas.height = source.width;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

const toJpeg = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not create the JPEG'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

export function createEditor(stage) {
  const ctx = stage.getContext('2d');
  let photo = null;
  let quad = null;
  let scale = 1; // Stage pixels per photo pixel.
  let dragging = -1;

  const accent = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

  function draw() {
    const dpr = devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(photo, 0, 0, photo.width * scale, photo.height * scale);
    const color = accent();

    ctx.beginPath();
    quad.forEach(({ x, y }, i) => {
      if (i === 0) ctx.moveTo(x * scale, y * scale);
      else ctx.lineTo(x * scale, y * scale);
    });
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();

    for (const { x, y } of quad) {
      ctx.beginPath();
      ctx.arc(x * scale, y * scale, 11, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function layout() {
    const available = stage.parentElement.clientWidth;
    const maxHeight = innerHeight * STAGE_HEIGHT_SHARE;
    scale = Math.min(available / photo.width, maxHeight / photo.height);
    const dpr = devicePixelRatio || 1;
    const width = photo.width * scale;
    const height = photo.height * scale;
    stage.width = Math.round(width * dpr);
    stage.height = Math.round(height * dpr);
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    draw();
  }

  const pointerAt = (event) => {
    const box = stage.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  stage.addEventListener('pointerdown', (event) => {
    if (!photo) return;
    const at = pointerAt(event);
    let nearest = -1;
    let best = GRAB_RADIUS;
    quad.forEach(({ x, y }, i) => {
      const d = Math.hypot(x * scale - at.x, y * scale - at.y);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    dragging = nearest;
    if (dragging >= 0) stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener('pointermove', (event) => {
    if (dragging < 0) return;
    const at = pointerAt(event);
    quad[dragging] = {
      x: Math.min(photo.width, Math.max(0, at.x / scale)),
      y: Math.min(photo.height, Math.max(0, at.y / scale)),
    };
    draw();
  });

  const stopDragging = () => {
    dragging = -1;
  };
  stage.addEventListener('pointerup', stopDragging);
  stage.addEventListener('pointercancel', stopDragging);

  return {
    async open(file) {
      photo = await loadPhoto(file);
      quad = defaultQuad(photo.width, photo.height);
    },

    /** Call once the editor is on screen, because sizing needs the real layout. */
    show: layout,

    rotate() {
      quad = rotateQuad(quad, photo.height);
      photo = rotated(photo);
      layout();
    },

    /** Returns the finished scan as a JPEG Blob. */
    async render({ enhanced }) {
      const { width, height } = outputSize(quad, OUTPUT_SIDE);
      const source = photo.getContext('2d').getImageData(0, 0, photo.width, photo.height);
      let result = warp(source, quad, width, height);
      if (enhanced) result = enhance(result);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas
        .getContext('2d')
        .putImageData(new ImageData(result.data, width, height), 0, 0);
      return toJpeg(canvas);
    },

    close() {
      photo = null;
      quad = null;
    },
  };
}
