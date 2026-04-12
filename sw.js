// FitSutra Service Worker — Auto-updating version
// Strategy:
//   - index.html : network-first (always try fresh, fall back to cache offline)
//   - static assets (icons, manifest) : stale-while-revalidate
//   - Firebase/Google APIs : bypass cache entirely
// Result: users always get the latest app on next load, no manual cache clear.

const CACHE = 'fitsutra-v4-auto';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192-1.png',
  '/icon-512-1.png',
  '/icon-96-1.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon-16.png',
  '/favicon-32.png',
];

// ── INSTALL: precache static assets, take over immediately ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: delete all old caches, claim all open tabs ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: smart strategy per request type ──
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. Bypass cache for Firebase / Google APIs / Gemini / analytics
  if (url.hostname.includes('firebase')    ||
      url.hostname.includes('googleapis')  ||
      url.hostname.includes('firestore')   ||
      url.hostname.includes('gstatic')     ||
      url.hostname.includes('google.com')  ||
      url.hostname.includes('anthropic')   ||
      url.hostname.includes('generativelanguage')) {
    return; // let the browser handle it normally
  }

  // 2. Network-first for HTML (index.html and navigation requests)
  //    This is the critical fix: always try to fetch fresh HTML so app updates are picked up.
  const isHTML = req.mode === 'navigate' ||
                 req.destination === 'document' ||
                 url.pathname === '/' ||
                 url.pathname.endsWith('.html');

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => {
          // Update cache with fresh copy for offline fallback
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // 3. Stale-while-revalidate for everything else (static assets)
  //    Serve cache instantly for speed, fetch fresh in background for next time.
  e.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// ── MESSAGE: let the page ask us to activate immediately ──
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── PUSH NOTIFICATIONS (unchanged from your previous SW) ──
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
