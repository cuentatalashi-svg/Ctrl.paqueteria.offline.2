// Nombre del caché (cámbialo SIEMPRE si actualizas los archivos principales)
// ★★★ CAMBIO: Incremento a v8 para forzar la actualización del arreglo de PDF ★★★
const CACHE_NAME = 'ctrl-paq-cache-v8';

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
  console.log('[SW] Instalando v8...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos v8');
        return cache.addAll(urlsToCache.concat(externalUrls));
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Error precache:', err))
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activado v8.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('ctrl-paq-cache-') && cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log(`[SW] Borrando caché viejo: ${cacheName}`);
          return caches.delete(cacheName);
        })
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
      }).catch(error => {
        console.error('[SW] Fallo red:', error);
        throw error; 
      });
      return cachedResponse || networkFetch;
    });
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isLocal = url.origin === location.origin && urlsToCache.some(u => url.pathname.endsWith(u.replace('/', '')));
  
  if (isLocal || externalUrls.includes(event.request.url)) {
    event.respondWith(staleWhileRevalidate(event.request));
  } else {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  }
});


