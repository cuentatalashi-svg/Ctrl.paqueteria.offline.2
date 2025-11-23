// Nombre del caché (cámbialo SIEMPRE si actualizas los archivos principales)
// ★★★ CAMBIO: v9 para purgar cualquier error persistente ★★★
const CACHE_NAME = 'ctrl-paq-cache-v9';

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
  console.log('[SW] Instalando v9...');
  self.skipWaiting(); // Forzar activación inmediata
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache.concat(externalUrls)))
      .catch(err => console.error('[SW] Error precache:', err))
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activado v9. Limpiando viejos...');
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
        // Si falla red y no hay caché, error
        console.error('[SW] Fallo red:', err);
        throw err; 
      });
      return cachedResponse || networkFetch;
    });
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  // Estrategia especial para scripts críticos: Network First si es posible para asegurar versión nueva
  // Pero mantenemos StaleWhileRevalidate para velocidad offline.
  // Con v9 y el botón de reset, esto se arreglará.
  event.respondWith(staleWhileRevalidate(event.request));
});


