const CACHE_NAME = "ludus-scaccorum-static-f1c98749b3ee";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=f1c98749b3ee",
  "./app.js?v=f1c98749b3ee",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/landing/maestro.webp",
  "./assets/pieces/cburnett/bB.svg",
  "./assets/pieces/cburnett/bK.svg",
  "./assets/pieces/cburnett/bN.svg",
  "./assets/pieces/cburnett/bP.svg",
  "./assets/pieces/cburnett/bQ.svg",
  "./assets/pieces/cburnett/bR.svg",
  "./assets/pieces/cburnett/wB.svg",
  "./assets/pieces/cburnett/wK.svg",
  "./assets/pieces/cburnett/wN.svg",
  "./assets/pieces/cburnett/wP.svg",
  "./assets/pieces/cburnett/wQ.svg",
  "./assets/pieces/cburnett/wR.svg",
];

// The engine is deliberately absent from the list above: it is 7.3 MB and is
// only needed once somebody actually plays. The fetch handler below stores it
// the first time it is requested, so it is there offline from then on.

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function sameOriginGet(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

function navigationFallback(request) {
  return fetch(request).catch(() => caches.match("./index.html"));
}

function cacheFirst(request) {
  return caches.match(request)
    .then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
    .catch(() => caches.match(request, { ignoreSearch: true }));
}

self.addEventListener("fetch", (event) => {
  if (!sameOriginGet(event.request)) return;
  if (event.request.mode === "navigate") {
    event.respondWith(navigationFallback(event.request));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});
