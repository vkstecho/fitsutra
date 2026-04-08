const CACHE = 'fitsutara-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-96.png',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache first, fallback to network
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Push notifications (water reminder)
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'FitSutra', body: '💧 Time to drink water!' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'FitSutra', {
      body: data.body || '💧 Stay hydrated!',
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: 'fitsutara-reminder',
      renotify: true,
      actions: [
        { action: 'log', title: '✅ Log Water' },
        { action: 'snooze', title: '⏰ Snooze 15m' },
      ],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
