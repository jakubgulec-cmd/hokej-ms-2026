// Service Worker pro PWA — minimální offline cache pro shell
const CACHE_NAME = 'hokej-tipovacka-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Supabase API a webové requests: always network (no cache)
  if (request.url.includes('supabase.co') || request.method !== 'GET') {
    return;
  }

  // Statika: network first, fallback na cache
  event.respondWith(
    fetch(request)
      .then(response => {
        // Pokud OK, kopii ulož do cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
