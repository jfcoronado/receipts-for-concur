// Stores the app's own files so it opens offline. Receipts live in IndexedDB, not here.
// Change VERSION on every release, or installed phones keep the old files.

const VERSION = 'v4';
const CACHE = `receipts-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'src/app.js',
  'src/editor.js',
  'src/geometry.js',
  'src/pixels.js',
  'src/queue.js',
  'src/share.js',
  'src/store.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
});
