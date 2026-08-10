const CACHE_NAME = 'tasya-planner-offline-v1';

// Daftar file dan link internet yang WAJIB disimpan untuk offline
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    
    // CDN Tailwind (Design)
    'https://cdn.tailwindcss.com',
    
    // CDN FontAwesome (Icons)
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    
    // CDN Google Fonts (Font tulisan)
    'https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&family=Poppins:wght@400;500;600;700&display=swap',
    
    // Gambar Placeholder default
    'https://placehold.co/300x300/ffeaa7/fd79a8?text=Keluarga',
    'https://placehold.co/300x300/ffd1dc/e84393?text=Teman',
    'https://placehold.co/300x300/f4aeb8/ffffff?text=Pacar',
    'https://placehold.co/300x200/e0f7fa/00acc1?text=Inspirasi'
];

// Saat diinstall, download semua aset di atas
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Menyimpan aset ke cache offline...');
                return cache.addAll(urlsToCache);
            })
    );
});

// Hapus cache lama jika ada update
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
});

// Strategi: Cek Cache dulu (Offline First), kalau tidak ada baru cari di internet
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Jika ketemu di cache lokal, langsung gunakan (Offline berhasil)
                if (response) {
                    return response;
                }
                
                // Jika tidak ada di cache, coba ambil dari internet (Network)
                return fetch(event.request).then(networkResponse => {
                    // Jika sukses ambil dari internet, simpan juga ke cache
                    if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        let responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Jika offline dan data tidak ada di cache, abaikan saja agar tidak crash
                    console.log('Mode Offline: Data tidak ditemukan di memori.');
                });
            })
    );
});
