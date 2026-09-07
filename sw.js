const CACHE = "voidforge-shell";

const SHELL = [
  "./",
  "./index.html",
  "./assets/voidforge-mark.svg",
  "./games.json",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== location.origin
  ) {
    return;
  }

  const url = new URL(event.request.url);

  // Always get the latest CSS and JavaScript from the server.
  if (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js")
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else can use the cached shell.
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});
