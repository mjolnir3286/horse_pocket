/*
 * Shed service worker. Generic Horse Pocket PWA pattern, reusable as-is by
 * another app (change the cache prefix and SHELL_ASSETS):
 *   - app shell precached; HTML network-first with cached fallback (offline)
 *   - hashed /assets/ files cache-first
 *   - /ocr/ (Tesseract worker, WASM core, English model) cache-first on first
 *     use, so label scanning works offline after one online scan
 * Bump the version suffixes when the cached files change shape.
 */
const PREFIX = 'shed';
const SHELL_CACHE = `${PREFIX}-shell-v5`;
const ASSET_CACHE = `${PREFIX}-assets-v1`;
const OCR_CACHE = `${PREFIX}-ocr-v1`;
const ASSET_MAX = 60;
const BASE = self.registration.scope;

const SHELL_ASSETS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.webmanifest`,
  `${BASE}favicon.svg`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, OCR_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith(`${PREFIX}-`) && !keep.has(k)).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

const sameOrigin = (url) => url.origin === self.location.origin && url.href.startsWith(BASE);
const isHtml = (req, url) => req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
const isAsset = (url) => url.pathname.includes('/assets/');
const isOcr = (url) => url.pathname.includes('/ocr/');

async function putCapped(cacheName, request, response, maxEntries) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  if (!maxEntries) return;
  const keys = await cache.keys();
  if (keys.length > maxEntries) await cache.delete(keys[0]);
}

async function cacheFirst(event, cacheName, maxEntries) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  const res = await fetch(event.request);
  if (res && res.ok) event.waitUntil(putCapped(cacheName, event.request, res.clone(), maxEntries));
  return res;
}

async function networkFirstHtml(event) {
  try {
    const res = await fetch(event.request);
    if (res && res.ok) {
      const copy = res.clone();
      event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.put(`${BASE}index.html`, copy)));
    }
    return res;
  } catch {
    return (await caches.match(`${BASE}index.html`)) || (await caches.match(BASE)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!sameOrigin(url)) return;
  if (isHtml(req, url)) {
    event.respondWith(networkFirstHtml(event));
  } else if (isOcr(url)) {
    event.respondWith(cacheFirst(event, OCR_CACHE, 0));
  } else if (isAsset(url)) {
    event.respondWith(cacheFirst(event, ASSET_CACHE, ASSET_MAX));
  } else {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
