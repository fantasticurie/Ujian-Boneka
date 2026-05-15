const CACHE_NAME = 'tasya-planner-v1';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    // Karena kita pakai CDN eksternal (Tailwind, FontAwesome, Google Fonts), 
    // kita fokus menyimpan file lokal utama agar bisa load offline.
];

// Install Service Worker & Simpan Cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Membuka cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch Data (Logika: Ambil dari Cache dulu, kalau gak ada baru internet)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cache jika ada
                if (response) {
                    return response;
                }
                // Jika tidak ada di cache, ambil dari internet
                return fetch(event.request);
            })
    );
});

// Update Service Worker (Hapus Cache Lama)
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
