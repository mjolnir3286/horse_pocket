/* Horse Pocket Service Worker (PWA Shell + Episode Alert Notifications) */
const CACHE_NAME = 'horse-pocket-v3';
const BASE = self.registration.scope; // the app's scope URL, including any subpath

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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match(BASE)))
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Horse Pocket — New Episode',
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
      tag: payload.tag || 'horse-pocket-episode',
      data: { url: payload.url || BASE },
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_EPISODE_NOTIFICATION') {
    const { title, body, tag } = event.data.payload || {};
    event.waitUntil(
      self.registration.showNotification(title || 'Horse Pocket — New Episode', {
        body: body || 'New episode available to stream.',
        icon: `${BASE}icons/icon-192.png`,
        badge: `${BASE}icons/icon-192.png`,
        tag: tag || 'horse-pocket-sim',
        data: { url: `${BASE}?tab=watchlist` },
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || BASE;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
