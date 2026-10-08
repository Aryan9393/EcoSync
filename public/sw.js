// Offline shell cache. API calls always go to the network.
const CACHE = 'ecosync-v1';
const SHELL = ['./', 'index.html', 'css/app.css', 'vendor/leaflet.css', 'js/app.js', 'js/api.js', 'js/mock.js', 'js/state.js', 'js/ui.js', 'js/icons.js', 'js/auth.js', 'js/pay.js', 'js/views.js', 'js/scan.js', 'js/maps.js', 'js/passport.js', 'js/bot.js', 'icons/logo.svg', 'manifest.webmanifest'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/download/')) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
