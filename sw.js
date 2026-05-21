const CACHE_NAME = "magyar-passziansz-v7-ranglista-webp-20260521";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=ranglista",
  "./app.js?v=ranglista",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/cards-webp/back.webp"
];

const CARD_ASSETS = [
  "./assets/cards-webp/acorn-ace.webp",
  "./assets/cards-webp/acorn-eight.webp",
  "./assets/cards-webp/acorn-king.webp",
  "./assets/cards-webp/acorn-nine.webp",
  "./assets/cards-webp/acorn-ober.webp",
  "./assets/cards-webp/acorn-seven.webp",
  "./assets/cards-webp/acorn-ten.webp",
  "./assets/cards-webp/acorn-unter.webp",
  "./assets/cards-webp/bell-ace.webp",
  "./assets/cards-webp/bell-eight.webp",
  "./assets/cards-webp/bell-king.webp",
  "./assets/cards-webp/bell-nine.webp",
  "./assets/cards-webp/bell-ober.webp",
  "./assets/cards-webp/bell-seven.webp",
  "./assets/cards-webp/bell-ten.webp",
  "./assets/cards-webp/bell-unter.webp",
  "./assets/cards-webp/heart-ace.webp",
  "./assets/cards-webp/heart-eight.webp",
  "./assets/cards-webp/heart-king.webp",
  "./assets/cards-webp/heart-nine.webp",
  "./assets/cards-webp/heart-ober.webp",
  "./assets/cards-webp/heart-seven.webp",
  "./assets/cards-webp/heart-ten.webp",
  "./assets/cards-webp/heart-unter.webp",
  "./assets/cards-webp/leaf-ace.webp",
  "./assets/cards-webp/leaf-eight.webp",
  "./assets/cards-webp/leaf-king.webp",
  "./assets/cards-webp/leaf-nine.webp",
  "./assets/cards-webp/leaf-ober.webp",
  "./assets/cards-webp/leaf-seven.webp",
  "./assets/cards-webp/leaf-ten.webp",
  "./assets/cards-webp/leaf-unter.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(SHELL_ASSETS);
      await Promise.allSettled(CARD_ASSETS.map((asset) => cache.add(asset)));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

function isAppShellRequest(requestUrl) {
  return requestUrl.pathname.endsWith("/app.js")
    || requestUrl.pathname.endsWith("/styles.css")
    || requestUrl.pathname.endsWith("/index.html")
    || requestUrl.pathname.endsWith("/sw.js");
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    });
  });
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")));
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  if (!isSameOrigin) return;

  const isNavigation = event.request.mode === "navigate";
  if (isNavigation || isAppShellRequest(requestUrl)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    cacheFirst(event.request).catch(async () => {
      if (event.request.destination === "image") {
        return caches.match("./assets/cards-webp/back.webp") || Response.error();
      }
      return new Response("Offline", { status: 503, statusText: "Offline" });
    })
  );
});
