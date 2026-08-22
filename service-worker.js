const CACHE = "domino-alsohba-v6-4-0";
const CORE = [
  "./", "./index.html", "./styles.css?v=6.4.0", "./app.js?v=6.4.0", "./firebase-config.js?v=6.4.0",
  "./logo.svg", "./manifest.webmanifest", "./turn-config.js?v=6.4.0",
  "./assets/domino-place-real.wav?v=6.4.0", "./assets/domino-double-real.wav?v=6.4.0",
  "./assets/domino-draw-real.wav?v=6.4.0", "./assets/domino-win.wav?v=6.4.0", "./icons/icon-192.png", "./icons/icon-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === "navigate" ? caches.match("./index.html") : Promise.reject())))
  );
});
