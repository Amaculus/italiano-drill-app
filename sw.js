// Service worker: caches the app shell so the drill opens instantly (and
// offline, from the last sync), and turns Web Push messages from the desktop
// into native notifications. Chrome on Android handles push and the
// notification click through the same two handlers below.
'use strict';
const CACHE = 'italiano-v1';
const SHELL = ['./', './index.html', './srs.js', './config.json',
               './manifest.webmanifest', './icon-180.png', './icon-192.png',
               './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))
              .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // Drop caches from earlier versions, then take over the open pages.
  e.waitUntil(caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network-first for the shell so updates land, cache as fallback for offline.
// Only complete, successful responses are stored: a 404 for a missing audio
// clip, or a partial (206) media response, must not be cached.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;      // GitHub API goes straight out
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && r.status !== 206) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data.json(); } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title || 'Italiano', {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return clients.openWindow(url);
    }));
});
