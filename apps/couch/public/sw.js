/* Couch Service Worker: static assets, upcoming JSON, and relay/TVmaze/image caching. */
const SHELL_CACHE = 'couch-shell-v15';
const RELAY_CACHE = 'couch-relay-v1';
// TVmaze responses only; the Upcoming file has its own cache so it is never evicted by TVmaze calls.
const DATA_CACHE = 'couch-data-v2';
const UPCOMING_CACHE = 'couch-upcoming-v1';
const IMAGE_CACHE = 'couch-images-v1';
const RELAY_MAX = 80;
const DATA_MAX = 60;
const UPCOMING_MAX = 2;
const IMAGE_MAX = 60;
const BASE = self.registration.scope;
const RELAY_HOST = 'couch-relay.mjolnir3286.workers.dev';
const TVMAZE_HOST = 'api.tvmaze.com';
const TMDB_IMAGE_HOST = 'image.tmdb.org';

const SHELL_ASSETS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.webmanifest`,
  `${BASE}favicon.svg`,
  `${BASE}couch-icon.png`,
  `${BASE}tmdb-logo.svg`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/icon-192-maskable.png`,
  `${BASE}icons/icon-512-maskable.png`,
  `${BASE}icons/apple-touch-icon.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, RELAY_CACHE, DATA_CACHE, UPCOMING_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    // All Horse Pocket apps share this origin's Cache Storage: only remove old Couch caches.
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('couch-') && !keep.has(k)).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

function isAsset(url) {
  return url.origin === self.location.origin && url.pathname.includes('/assets/');
}

function isUpcoming(url) {
  return url.origin === self.location.origin && url.pathname.endsWith('upcoming-releases.json');
}

async function putCapped(cacheName, request, response, maxEntries) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
  }
}

function isFresh(response, fallbackSeconds) {
  const ctrl = response.headers.get('Cache-Control') || '';
  const maxAge = /max-age=(\d+)/i.exec(ctrl);
  const ageHdr = response.headers.get('Date');
  const seconds = maxAge ? Number(maxAge[1]) : fallbackSeconds;
  if (!ageHdr || !Number.isFinite(seconds)) return false;
  const born = new Date(ageHdr).getTime();
  return Number.isFinite(born) && Date.now() - born < seconds * 1000;
}

async function staleWhileRevalidate(event, cacheName, maxEntries, freshSeconds) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  const fetchAndStore = fetch(event.request)
    .then((res) => {
      if (res && res.ok) {
        event.waitUntil(putCapped(cacheName, event.request, res.clone(), maxEntries));
      }
      return res;
    })
    .catch(() => cached);
  if (cached && isFresh(cached, freshSeconds)) return cached;
  if (cached) {
    event.waitUntil(fetchAndStore);
    return cached;
  }
  return fetchAndStore;
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

  if (url.hostname === RELAY_HOST) {
    event.respondWith(staleWhileRevalidate(event, RELAY_CACHE, RELAY_MAX, 1800));
    return;
  }
  if (url.hostname === TVMAZE_HOST) {
    event.respondWith(staleWhileRevalidate(event, DATA_CACHE, DATA_MAX, 6 * 60 * 60));
    return;
  }
  if (url.hostname === TMDB_IMAGE_HOST) {
    event.respondWith(cacheFirst(event, IMAGE_CACHE, IMAGE_MAX));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (isUpcoming(url)) {
    event.respondWith(staleWhileRevalidate(event, UPCOMING_CACHE, UPCOMING_MAX, 6 * 60 * 60));
    return;
  }
  if (url.pathname.endsWith('/sw.js')) return; // the browser handles worker updates itself
  if (isAsset(url) || url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png')) {
    event.respondWith(cacheFirst(event, SHELL_CACHE, 40));
    return;
  }
  event.respondWith(networkFirst(event, SHELL_CACHE));
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Couch — New Episode',
    body: 'A new episode from your watchlist is streaming now.',
    url: `${BASE}?tab=watchlist`,
  };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: `${BASE}icons/icon-192.png`,
      badge: `${BASE}icons/icon-192.png`,
      tag: payload.tag || 'couch-episode',
      data: { url: payload.url || BASE },
    })
  );
});

/** Only open pages inside Couch; anything else falls back to Couch's start page. */
function sameScopeUrl(raw) {
  try {
    const u = new URL(raw || BASE, BASE);
    if (u.origin === self.location.origin && u.href.startsWith(BASE)) return u.href;
  } catch {
    // fall through
  }
  return BASE;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = sameScopeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
