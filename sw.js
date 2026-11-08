/* Streak Buddy service worker: shows push notifications (hourly reminders) and focuses the app when tapped. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: e.data ? e.data.text() : '' }; }
  const n = Object.assign({}, d.notification || {}, d.data || {}, d.title ? { title: d.title, body: d.body } : {});
  e.waitUntil(self.registration.showNotification(n.title || 'Streak Buddy', {
    body: n.body || 'Something is waiting for you!',
    icon: 'icon-192.png', badge: 'icon-192.png',
    tag: n.tag || 'sb-hourly', renotify: true,
    data: { url: n.url || './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
