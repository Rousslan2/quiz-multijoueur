/* ZapPlay — shell PWA (CSS/JS) sans mettre en cache les pages HTML :
 * le cache HTTP + d’anciennes réponses dans le SW faisaient voir une vieille
 * accueil aux profils normaux, pas en navigation privée.
 */
const CACHE = 'zapplay-shell-v3';
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

  // Pages HTML : toujours le réseau, jamais de mise en cache SW (évite version figée).
  if (isHtmlDocumentRequest(req)) {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/index.html')
      )
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
