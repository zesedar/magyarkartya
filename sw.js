const CACHE_NAME = "magyar-passziansz-v4-mobile-card-images-20260521";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=mobile1",
  "./app.js?v=mobile1",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/cards-large/acorn-ace.png",
  "./assets/cards-large/acorn-eight.png",
  "./assets/cards-large/acorn-king.png",
  "./assets/cards-large/acorn-nine.png",
  "./assets/cards-large/acorn-ober.png",
  "./assets/cards-large/acorn-seven.png",
  "./assets/cards-large/acorn-ten.png",
  "./assets/cards-large/acorn-unter.png",
  "./assets/cards-large/back.png",
  "./assets/cards-large/bell-ace.png",
  "./assets/cards-large/bell-eight.png",
  "./assets/cards-large/bell-king.png",
  "./assets/cards-large/bell-nine.png",
  "./assets/cards-large/bell-ober.png",
  "./assets/cards-large/bell-seven.png",
  "./assets/cards-large/bell-ten.png",
  "./assets/cards-large/bell-unter.png",
  "./assets/cards-large/heart-ace.png",
  "./assets/cards-large/heart-eight.png",
  "./assets/cards-large/heart-king.png",
  "./assets/cards-large/heart-nine.png",
  "./assets/cards-large/heart-ober.png",
  "./assets/cards-large/heart-seven.png",
  "./assets/cards-large/heart-ten.png",
  "./assets/cards-large/heart-unter.png",
  "./assets/cards-large/leaf-ace.png",
  "./assets/cards-large/leaf-eight.png",
  "./assets/cards-large/leaf-king.png",
  "./assets/cards-large/leaf-nine.png",
  "./assets/cards-large/leaf-ober.png",
  "./assets/cards-large/leaf-seven.png",
  "./assets/cards-large/leaf-ten.png",
  "./assets/cards-large/leaf-unter.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const isAppShell = requestUrl.pathname.endsWith("/app.js") || requestUrl.pathname.endsWith("/styles.css") || requestUrl.pathname.endsWith("/index.html");

  if (isNavigation || isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
