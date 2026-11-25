/* Wad Service Worker: static app shell caching and clean version updates. */
const SHELL_CACHE = 'wad-shell-v3';
const BASE = self.registration.scope;

const SHELL_ASSETS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.webmanifest`,
  `${BASE}wad-icon.png`,
  `${BASE}budget.png`,
  `${BASE}income.png`,
  `${BASE}tax.png`,
  `${BASE}expenses.png`,
  `${BASE}plan.png`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/apple-touch-icon.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE]);
  event.waitUntil(
    // All Horse Pocket apps share this origin's Cache Storage: only remove old wad caches.
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wad-') && !keep.has(k)).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

function isAsset(url) {
  return url.origin === self.location.origin && url.pathname.includes('/assets/');
}

async function putCapped(cacheName, request, response, maxEntries) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
  }
}

async function cacheFirst(event, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const res = await fetch(event.request);
  if (res && res.ok) {
    event.waitUntil(putCapped(cacheName, event.request, res.clone(), maxEntries));
  }
  return res;
}

async function networkFirst(event, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(event.request);
    if (res && res.ok) event.waitUntil(cache.put(event.request, res.clone()));
    return res;
  } catch (err) {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (
    isAsset(url) ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png')
  ) {
    event.respondWith(cacheFirst(event, SHELL_CACHE, 50));
    return;
  }
  if (url.pathname.endsWith('/sw.js')) return; // the browser handles worker updates itself
  event.respondWith(networkFirst(event, SHELL_CACHE));
});
