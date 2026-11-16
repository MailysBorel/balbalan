// Réseau d'abord, cache en secours (l'app s'ouvre même hors ligne avec les derniers scores vus).
const C = 'balbalan-v2';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png']))); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/push')) return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request)));
});

// Notifications : but, carton rouge, début / fin de match, set… (envoyées par /api/cron)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'Balbalan', body: e.data?.text() || '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Balbalan', {
    body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag, data: { url: d.url || '/' },
  }));
});
// Toucher la notif ouvre le match (dans l'app déjà ouverte si possible)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => x.url.startsWith(location.origin));
    return w ? w.focus().then(x => x.navigate(url)) : self.clients.openWindow(url);
  }));
});
