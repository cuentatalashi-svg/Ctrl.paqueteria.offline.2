// Nombre del caché (cámbialo SIEMPRE si actualizas los archivos principales)
// ★★★ CAMBIO: Incremento la versión a v7 para purgar cualquier error previo ★★★
const CACHE_NAME = 'ctrl-paq-cache-v7';

// "App Shell" - Archivos necesarios para que la app funcione offline
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
  console.log('[SW] Instalando v7...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Abriendo caché v7 y guardando todo');
        return cache.addAll(urlsToCache.concat(externalUrls));
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Fallo crítico al precachear:', err))
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activado v7.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('ctrl-paq-cache-') && cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log(`[SW] Borrando caché antiguo: ${cacheName}`);
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
        console.error('[SW] Fallo red:', error, request.url);
        throw error; 
      });
      return cachedResponse || networkFetch;
    });
  });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isLocalFile = url.origin === location.origin && urlsToCache.some(u => url.pathname.endsWith(u.replace('/', '')));
  const isExternalLibrary = externalUrls.includes(event.request.url);

  if (event.request.method !== 'GET') return;
  
  if (isLocalFile || isExternalLibrary) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});


