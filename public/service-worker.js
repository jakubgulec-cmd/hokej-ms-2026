// Service Worker pro PWA — minimální cache + samočinný reload klientů na novou verzi
const CACHE_NAME = 'hokej-tipovacka-v8';
// index.html ZÁMĚRNĚ není v cache — vždy ze sítě, aby se nový build projevil hned
const APP_SHELL = [
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Smaž všechny staré cache
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));

    // Převezmi kontrolu nad otevřenými stránkami
    await self.clients.claim();

    // Vynuť reload všech otevřených oken → okamžitě načtou nový build
    // (řeší "zaseknutý" starý bundle bez nutnosti ručního dvojího reloadu)
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      if ('navigate' in client) {
        try { await client.navigate(client.url); } catch (e) { /* ignore */ }
      }
    }
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Supabase API a non-GET: vždy síť, bez cache
  if (request.url.includes('supabase.co') || request.method !== 'GET') {
    return;
  }

  // Navigace (HTML): vždy ze sítě, aby se změny projevily okamžitě
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Statika (JS/CSS/obrázky): network-first, fallback na cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
