// Progress portal service worker: shows the latest update when a push arrives.
const SCOPE = '/progress/';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let title = 'MyChamaa', body = 'There is a new update on the build.';
    try {
      const r = await fetch(SCOPE + 'progress.json', { cache: 'no-store' });
      const p = await r.json();
      const latest = (p.news || [])[0];
      if (latest) { title = (latest.by || 'The team') + ' just made an update'; body = latest.title + (latest.body ? ': ' + latest.body : ''); }
    } catch (_) { /* offline: use the default text */ }
    await self.registration.showNotification(title, { body, icon: SCOPE + 'icon-192.png', badge: SCOPE + 'icon-192.png', tag: 'mc-progress', data: { url: SCOPE } });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => c.url.includes(SCOPE));
    if (open) return open.focus();
    return self.clients.openWindow(SCOPE);
  })());
});
