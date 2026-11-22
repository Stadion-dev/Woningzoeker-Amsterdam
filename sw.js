const scope = self.registration.scope;
const prefix = `woningzoeker:${scope}:`;
const cacheName = `${prefix}v1`;
const shell = [
  './', './style.css', './app.js', './manifest.webmanifest', './assets/icon.svg',
  './assets/icon-192.png', './assets/icon-512.png', './assets/west.webp',
  './assets/zuid.webp', './assets/rivierenbuurt.webp', './data/aanbod.json'
].map(path => new URL(path, scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(scope)) return;
  const navigation = event.request.mode === 'navigate';
  const url = navigation ? scope : event.request.url;
  if (!shell.includes(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(event.request, { cache: 'no-cache' });
      if (response.ok) {
        await cache.put(url, response.clone());
        return response;
      }
      return await cache.match(url) || response;
    } catch {
      return await cache.match(url) || Response.error();
    }
  })());
});
