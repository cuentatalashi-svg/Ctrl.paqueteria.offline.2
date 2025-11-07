// Nombre del caché (cámbialo si actualizas los archivos)
const CACHE_NAME = 'ctrl-paq-cache-v1';

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
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

// Evento "install": se dispara cuando el SW se instala
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Abriendo caché y guardando app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Forzar al SW a activarse
  );
});

// Evento "activate": se dispara cuando el SW se activa (limpia cachés viejos)
self.addEventListener('activate', event => {
  console.log('[SW] Activado.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          // Borrar todos los cachés que no sean el actual
          return cacheName.startsWith('ctrl-paq-cache-') && cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log(`[SW] Borrando caché antiguo: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim()) // Tomar control inmediato de las páginas
  );
});

// Evento "fetch": se dispara cada vez que la app pide un recurso (CSS, JS, img, etc.)
self.addEventListener('fetch', event => {
  // Solo respondemos a peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Estrategia: Cache First (Primero caché, luego red)
  // Ideal para el "app shell" que no cambia a menudo.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 1. Si está en caché, lo devolvemos desde el caché
        if (cachedResponse) {
          // console.log('[SW] Recurso encontrado en caché:', event.request.url);
          return cachedResponse;
        }

        // 2. Si no está en caché, vamos a la red
        // console.log('[SW] Recurso NO encontrado en caché, buscando en red:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // (Opcional) Podríamos guardar en caché la respuesta aquí si quisiéramos
            // pero para el app shell, con el 'install' es suficiente.
            return networkResponse;
          }
        ).catch(error => {
          console.error('[SW] Error al buscar en red:', error);
          // (Opcional) Podríamos devolver una página de "error offline" genérica aquí
        });
      })
  );
});

