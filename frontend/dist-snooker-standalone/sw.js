const CACHE_VERSION = 'v2';
const STATIC_CACHE = `sl18-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `sl18-runtime-${CACHE_VERSION}`;
const PRECACHE_URLS = ['/', '/index.html', '/favicon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
  try { self.skipWaiting(); } catch {}
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k.endsWith(CACHE_VERSION) ? null : caches.delete(k))));
      try { await self.clients.claim(); } catch {}
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api')) return;

    const accept = request.headers.get('accept') || '';
    const isNav = request.mode === 'navigate' || accept.includes('text/html');
    const isAsset =
      url.pathname.startsWith('/assets/') ||
      /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot)$/.test(url.pathname);

    if (isNav) {
      event.respondWith(
        (async () => {
          try {
            const res = await fetch(request);
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          } catch {
            const cached = await caches.match(request);
            if (cached) return cached;
            const index = await caches.match('/index.html');
            if (index) return index;
            throw new Error('offline');
          }
        })()
      );
      return;
    }

    if (isAsset) {
      event.respondWith(
        (async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const res = await fetch(request);
          const ct = (res && res.headers && res.headers.get('content-type')) || '';
          if (res && res.ok && !ct.includes('text/html')) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })()
      );
      return;
    }

    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const fetchPromise = (async () => {
          try {
            const res = await fetch(request);
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          } catch {
            return null;
          }
        })();
        const net = await fetchPromise;
        return net || cached || fetch(request);
      })()
    );
  } catch {}
});
