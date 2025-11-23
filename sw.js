// Nombre del caché (cámbialo SIEMPRE si actualizas los archivos principales)
// ★★★ CAMBIO: v10 para corregir la regresión de búsqueda y diseño ★★★
const CACHE_NAME = 'ctrl-paq-cache-v10';

const urlsToCache = [
  '/',
  '/index.html',
  '/main.html',
  '/styles.css',
  '/app.js',
  '/sql-lite.js',
  '/zxing.min.js',
  '/icon-192.svg',
  '/icon-512.svg',
  '/manifest.webmanifest',
  '/jspdf.umd.js',
  '/jspdf.plugin.autotable.js',
];

const externalUrls = [];

self.addEventListener('install', event => {
  console.log('[SW] Instalando v10...');
  self.skipWaiting(); // Forzar activación
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache.concat(externalUrls)))
      .catch(err => console.error('[SW] Error precache:', err))
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activado v10. Limpiando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('ctrl-paq-cache-') && cacheName !== CACHE_NAME;
        }).map(cacheName => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(cache => {
    return cache.match(request).then(cachedResponse => {
      const networkFetch = fetch(request).then(response => {
        if (response && response.status === 200 && request.method === 'GET') {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(err => {
        console.error('[SW] Fallo red:', err);
        throw err; 
      });
      return cachedResponse || networkFetch;
    });
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Usar StaleWhileRevalidate para todo lo local
  event.respondWith(staleWhileRevalidate(event.request));
});


