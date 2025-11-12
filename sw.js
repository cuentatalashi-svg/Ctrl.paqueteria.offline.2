// Nombre del caché (cámbialo SIEMPRE si actualizas los archivos principales)
// ★★★ CAMBIO: Incremento la versión del caché a v2 ★★★
const CACHE_NAME = 'ctrl-paq-cache-v2';

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
];

// URLs que siempre deben cargarse desde la red (Librerías externas)
const externalUrls = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

// Evento "install": se dispara cuando el SW se instala
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  // GUARANTEE: Se espera a que TODOS los archivos esenciales se guarden en caché.
  // Esto es la base para el funcionamiento offline inicial.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Abriendo caché y guardando app shell');
        // Cachear solo los archivos locales
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Forzar al SW a activarse
  );
});

// Evento "activate": se dispara cuando el SW se activa (limpia cachés viejos)
self.addEventListener('activate', event => {
  console.log('[SW] Activado.');
  // GUARANTEE: Se borran cachés antiguos para ahorrar espacio.
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

// Estrategia: Stale While Revalidate para archivos locales
// Sirve el caché inmediatamente y actualiza el caché en segundo plano.
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(cache => {
    return cache.match(request).then(cachedResponse => {
      // 1. Siempre devuelve la versión en caché inmediatamente si existe.
      // ESTO ES LO QUE GARANTIZA EL OFFLINE.
      const networkFetch = fetch(request).then(response => {
        // Almacena la nueva versión en caché para la próxima vez
        if (response && response.status === 200 && request.method === 'GET') {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(error => {
        console.error('[SW] Fallo al revalidar desde la red:', error, request.url);
        // Si la red falla y hay una copia antigua, se usa esa, si no, se propaga el error.
        throw error; 
      });

      // 2. Si hay una respuesta en caché, la devuelve de inmediato.
      // Si no hay caché, espera la respuesta de red (o falla si está offline).
      return cachedResponse || networkFetch;
    });
  });
}

// Evento "fetch": se dispara cada vez que la app pide un recurso
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isLocalFile = url.origin === location.origin && urlsToCache.some(u => url.pathname.endsWith(u.replace('/', '')));
  const isExternalLibrary = externalUrls.includes(event.request.url);

  if (event.request.method !== 'GET') {
    return;
  }
  
  // 1. Archivos locales (App Shell) - Usar Stale While Revalidate
  if (isLocalFile) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  
  // 2. Librerías externas - Usar Cache First (o la estrategia original)
  if (isExternalLibrary) {
     event.respondWith(
        caches.match(event.request).then(cachedResponse => {
           // Si está en caché, devuelve el caché (offline garantizado para libs)
           return cachedResponse || fetch(event.request).then(networkResponse => {
               return caches.open(CACHE_NAME).then(cache => {
                   // Cachar las librerías externas para reuso
                   cache.put(event.request, networkResponse.clone());
                   return networkResponse;
               });
           }).catch(error => {
               // Si no está en caché y la red falla, se devuelve un error de red.
               console.error('[SW] Fallo al cargar librería externa:', error, event.request.url);
           });
        })
     );
     return;
  }

  // 3. Otros (Imágenes dinámicas, etc.) - Red First o solo red
  event.respondWith(fetch(event.request).catch(error => {
      console.error('[SW] Fallo de red:', error, event.request.url);
      // Fallback al caché si la red falla (para cualquier otra imagen que haya cacheado)
      return caches.match(event.request); 
  }));
});


