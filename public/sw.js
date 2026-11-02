// Service worker : l'appli s'ouvre même sans réseau.
// Pages : réseau d'abord (le verrou par code reste vérifié en ligne), copie locale hors ligne.
// Fichiers (JS, CSS, icônes) : copie locale tout de suite, mise à jour en arrière-plan.
const CACHE = 'ecureuil-v2';
const SHELL = [
  '/', '/styles.css', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png',
  '/js/app.js', '/js/calc.js', '/js/store.js', '/js/views.js', '/js/forms.js', '/js/ui.js',
  '/js/charts.js', '/js/format.js', '/js/backup.js', '/js/recurrence.js', '/js/repeat-editor.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const cacheable = (res) => res && res.ok && !res.redirected && res.type === 'basic';

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // Safari refuse une réponse redirigée servie par un service worker : on renvoie la redirection.
          if (res.redirected) return Response.redirect(res.url, 302);
          if (cacheable(res) && url.pathname === '/') caches.open(CACHE).then((c) => c.put('/', res.clone()));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const update = fetch(req).then((res) => {
        if (cacheable(res)) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      });
      if (hit) {
        e.waitUntil(update.catch(() => {}));
        return hit;
      }
      return update;
    }),
  );
});
