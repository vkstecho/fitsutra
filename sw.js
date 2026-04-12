const CACHE = 'fitsutra-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192-1.png',
  '/icon-512-1.png',
  '/icon-96-1.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first for API, cache first for assets
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // Don't cache Firebase/Supabase API calls
  if (e.request.url.includes('firebase') ||
      e.request.url.includes('googleapis') ||
      e.request.url.includes('firestore') ||
      e.request.url.includes('anthropic')) return;

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

// Push notifications
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'FitSutra 💪', {
      body:    data.body  || 'Time to log your activity!',
      icon:    '/icon-192-1.png',
      badge:   '/icon-96-1.png',
      tag:     'fitsutra',
      renotify: true,
      actions: [
        { action: 'open',   title: '📱 Open App' },
        { action: 'snooze', title: '⏰ Snooze 15m' },
      ],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
