const CACHE_NAME = 'tasya-planner-v1';

// File utama yang wajib disimpan
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Service Worker & Cache file statis
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercept request & gunakan Cache kalau offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Kalau ada di cache, langsung pakai (Offline Mode)
        if (response) {
          return response;
        }
        
        // Kalau belum ada, ambil dari internet lalu simpan ke cache
        return fetch(event.request).then(
          function(networkResponse) {
            // Pastikan response valid
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Simpan CDN/Resource baru ke dalam cache
            var responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                // Hindari caching request Firebase API/Analytics biar gak error
                if(!event.request.url.includes('firestore') && !event.request.url.includes('google')) {
                    cache.put(event.request, responseToCache);
                }
              });

            return networkResponse;
          }
        ).catch(function() {
            // Fallback kalau offline dan file belum ada di cache
            console.log('You are offline and resource is not cached.');
        });
      })
  );
});

// Update Cache kalau ada versi baru
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
