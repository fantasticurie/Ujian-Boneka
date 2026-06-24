const CACHE_NAME = 'planner-cache-v3'; // Versi dinaikkan agar cache lama terganti otomatis

// Daftar link eksternal utama yang WAJIB didownload saat pertama kali buka
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&family=Poppins:wght@400;500;600;700&display=swap',
  // TAMBAHAN: Cache library Firebase agar tidak error saat offline
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/8.10.1/firebase-app.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/8.10.1/firebase-auth.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/8.10.1/firebase-firestore.min.js'
];

// Install & Paksa Aktifkan SW Baru
self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Catch error jika ada link CDN yang gagal diambil, tapi tetap jalankan SW
      return Promise.allSettled(urlsToCache.map(url => cache.add(url)));
    })
  );
});

// Bersihkan Cache Versi Lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept Request (Ambil dari Cache dulu, kalau kosong baru ke Internet)
self.addEventListener('fetch', event => {
  // Abaikan sinkronisasi Firebase API saat offline agar tidak memblokir aplikasi
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  // Hindari caching ekstensi Chrome (jika diuji di PC)
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. Jika file ada di cache, langsung pakai (Ini yang bikin bisa Offline)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Jika tidak ada di cache, ambil dari internet
      return fetch(event.request).then(networkResponse => {
        // Simpan ke cache agar kunjungan berikutnya bisa offline
        // (Pastikan hanya method GET yang disimpan)
        if (event.request.method === 'GET' && networkResponse.type !== 'error') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        console.log('Mode Offline: Gagal memuat', event.request.url);
      });
    })
  );
});
