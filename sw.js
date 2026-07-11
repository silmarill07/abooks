const CACHE_NAME = 'abooks-cache-v5';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'abook_logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(e => {
        console.error('[Service Worker] Pre-cache failed:', e);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Intercept GET requests only
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip blob URLs, WebSocket, Dev tools hmr URLs, and db_audio links
  if (
    url.protocol.startsWith('chrome-extension') || 
    url.protocol === 'blob:' || 
    url.pathname.includes('ws') ||
    url.pathname.includes('vite') ||
    url.pathname.includes('hmr') ||
    // Пропускаем аудиофайлы, так как SW не поддерживает Range-запросы для них
    // и они не входят в список кэшируемых ресурсов
    url.pathname.match(/\.(mp3|m4a|wav|ogg|aac|mp4)$/i)
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache first, then fetch from network to refresh the cache in parallel (Stale-While-Revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Fail silently when offline during background update checks
          });
        return cachedResponse;
      }

      // If not in cache, fetch from network and caching it
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Cache CSS, JS, Fonts and Images dynamically
          const isCacheable = networkResponse.type === 'basic' || 
                              url.pathname.match(/\.(js|css|woff2|png|jpg|jpeg|svg|webp)$/) ||
                              url.hostname.includes('unsplash.com') || 
                              url.hostname.includes('googleapis.com') || 
                              url.hostname.includes('gstatic.com');

          if (isCacheable) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return networkResponse;
        })
        .catch((err) => {
          // Fallback to index.html for navigation requests when offline
          if (event.request.mode === 'navigate') {
            return caches.match('./') || caches.match('index.html');
          }
          throw err;
        });
    })
  );
});
