const CACHE = "voidforge-shell-v3";
const SHELL = ["./", "./index.html", "./assets/launcher.css", "./assets/launcher.js", "./assets/voidforge-mark.svg", "./games.json", "./manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  const url = new URL(event.request.url);
  // Game files are intentionally network-first: large game resources are not blindly cached by the launcher.
  if (url.pathname.includes("/minecraft/")) return;
  // Only the explicit shell list is cached; other requests keep their normal network behavior.
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
