const CACHE = 'harmonia-v4';

const APP_SHELL = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Harmonia', {
      body: data.body ?? '',
      icon: '/icon-192.png',
    })
  );
});

// caches.match() resolves to undefined on a miss (it doesn't reject). Passing undefined to
// event.respondWith() throws "Failed to convert value to 'Response'" and kills the whole fetch —
// so every fallback chain below must bottom out in a real Response, never a bare cache lookup.
const OFFLINE_RESPONSE = () => new Response('', { status: 503, statusText: 'Offline' });

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for API calls so data is always fresh
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(cached => cached || OFFLINE_RESPONSE())
      )
    );
    return;
  }

  // Network-first for index.html so app shell updates are never stale
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then(cached => cached || OFFLINE_RESPONSE())
        )
    );
    return;
  }

  // Cache-first for static assets (JS/CSS have content-hashed filenames)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() =>
        caches.match('/index.html').then(cached => cached || OFFLINE_RESPONSE())
      );
    })
  );
});
