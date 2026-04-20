/* ZapPlay — shell PWA : HTML toujours réseau ; JS/CSS réseau d’abord
 * (évite shared.js / zp-shell.js figés → barre compte obsolète sans Shift+F5).
 */
const CACHE = 'zapplay-shell-v19';
const PRECACHE = ['/theme.css', '/zp-shell.css', '/zp-loader.css', '/zp-page-loader.js', '/skyline.css', '/imposteur-page.css', '/manifest.webmanifest'];

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

  // Pages HTML : toujours le réseau, jamais de mise en cache SW (évite version figée).
  if (isHtmlDocumentRequest(req)) {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/index.html')
      )
    );
    return;
  }

  // Scripts & styles : toujours réseau en priorité (sinon cache SW = vieille logique compte / UI)
  if (/\.(js|css)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        })
        .catch(function () {
          return caches.match(req);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).catch(() => caches.match('/index.html'));
    })
  );
});
