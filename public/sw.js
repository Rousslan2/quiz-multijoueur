/* ZapPlay — cache léger pour mode PWA hors ligne (shell uniquement)
 * Les pages HTML passent en *réseau d'abord* pour éviter d'afficher une
 * ancienne version en navigation classique (où le cache SW persiste).
 * La navigation privée recharge souvent sans ce cache, d'où l'écart.
 */
const CACHE = 'zapplay-shell-v2';
const PRECACHE = ['/theme.css', '/shared.js', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isHtmlDocumentRequest(req) {
  return req.mode === 'navigate' || req.destination === 'document';
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;

  if (isHtmlDocumentRequest(req)) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(cached => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && req.destination === 'document') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
