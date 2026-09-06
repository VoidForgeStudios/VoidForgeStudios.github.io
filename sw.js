const CACHE = "voidforge-shell-v4";
const SHELL = ["./", "./index.html", "./assets/launcher.css", "./assets/launcher.js", "./assets/voidforge-mark.svg", "./games.json", "./manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  // Only the explicit launcher shell is cached. Every game entry and asset is
  // therefore fetched normally, rather than treating Minecraft as a special case.
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
