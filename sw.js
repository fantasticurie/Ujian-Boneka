const CACHE_NAME = 'tasya-planner-2026-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

const IDB_NAME = 'TasyaPlannerNotifDB';
const IDB_STORE = 'reminders';

// 1. Install & Cache Core Files
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// 2. Activate & Clean Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Network-First Fetch Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// 4. IndexedDB Helper di dalam Service Worker
function openSwDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// 5. Pengecekan Pengingat H-3, H-1, dan Hari-H di Background
async function checkAndTriggerBackgroundReminders() {
  try {
    const db = await openSwDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);

    const reminders = await new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    const now = new Date();
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const rem of reminders) {
      if (!rem.date) continue;
      const parts = rem.date.split('-').map(Number);
      const targetZero = new Date(parts[0], parts[1] - 1, parts[2]);
      const diffDays = Math.round((targetZero - todayZero) / (1000 * 60 * 60 * 24));
      const mode = rem.remindMode || 'all';
      if (!rem.notifiedFlags) rem.notifiedFlags = {};

      let shouldUpdate = false;

      // H-3
      if (diffDays === 3 && mode === 'all' && !rem.notifiedFlags.h3) {
        await self.registration.showNotification('⏳ Pengingat H-3 | Tasya Planner', {
          body: `${rem.title} jatuh tempo 3 hari lagi (${rem.date} ${rem.time || ''})`,
          icon: './icon-192.png',
          badge: './icon-192.png',
          vibrate: [200, 100, 200],
          tag: `${rem.id}_h3`,
          requireInteraction: true
        });
        rem.notifiedFlags.h3 = true;
        shouldUpdate = true;
      }

      // H-1
      if (diffDays === 1 && (mode === 'all' || mode === 'h1') && !rem.notifiedFlags.h1) {
        await self.registration.showNotification('⚠️ Pengingat H-1 (Besok) | Tasya Planner', {
          body: `Besok batas akhir: ${rem.title} (${rem.date} ${rem.time || ''})`,
          icon: './icon-192.png',
          badge: './icon-192.png',
          vibrate: [300, 100, 300],
          tag: `${rem.id}_h1`,
          requireInteraction: true
        });
        rem.notifiedFlags.h1 = true;
        shouldUpdate = true;
      }

      // Hari-H
      if (diffDays === 0 && !rem.notifiedFlags.h0) {
        await self.registration.showNotification('🚨 HARI INI DEADLINE! | Tasya Planner', {
          body: `Jangan lupa hari ini: ${rem.title} pukul ${rem.time || '23:59'}`,
          icon: './icon-192.png',
          badge: './icon-192.png',
          vibrate: [400, 150, 400],
          tag: `${rem.id}_h0`,
          requireInteraction: true
        });
        rem.notifiedFlags.h0 = true;
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        const writeTx = db.transaction(IDB_STORE, 'readwrite');
        writeTx.objectStore(IDB_STORE).put(rem);
      }
    }
  } catch (err) {
    console.error('SW Reminder Check Error:', err);
  }
}

// 6. Terima Pesan Sinkronisasi dari index.html & Jadwalkan OS Trigger jika didukung
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_REMINDERS') {
    event.waitUntil(checkAndTriggerBackgroundReminders());
  }
});

// 7. Periodic Background Sync (Berjalan di latar belakang walau tab ditutup)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'tasya-deadline-check') {
    event.waitUntil(checkAndTriggerBackgroundReminders());
  }
});

// 8. Push Event (Jika menggunakan server push / Firebase Cloud Messaging)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🔔 Pengingat Tasya Planner';
  const options = {
    body: data.body || 'Ada jadwal atau deadline yang mendekat!',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 9. Klik pada Notifikasi Membuka Aplikasi
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
