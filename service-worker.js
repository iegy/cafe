const CACHE="alqahwa-v7-3-0";
const CORE=[
  "./","./index.html","./platform.css?v=7.3.0","./platform.js?v=7.3.0",
  "./domino.html","./domino.css?v=7.3.0","./domino-app.js?v=7.3.0",
  "./chess.html","./chess.css?v=7.3.0","./chess-app.js?v=7.3.0",
  "./firebase-config.js?v=7.3.0","./turn-config.js?v=7.3.0","./manifest.webmanifest?v=7.3.0",
  "./logo-coffee.png","./icons/icon-192.png","./icons/icon-512.png",
  "./assets/domino-place-real.wav?v=7.3.0","./assets/domino-double-real.wav?v=7.3.0",
  "./assets/domino-draw-real.wav?v=7.3.0","./assets/domino-win.wav?v=7.3.0"
];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==self.location.origin)return;e.respondWith(fetch(r).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});return res}).catch(()=>caches.match(r).then(hit=>hit||(r.mode==="navigate"?caches.match("./index.html"):Promise.reject()))))});
