const CACHE="alqahwa-v8-2-0";
const CORE=[
  "./","./index.html","./platform.css?v=8.2.0","./platform.js?v=8.2.0",
  "./domino.html","./domino.css?v=8.2.0","./domino-app.js?v=8.2.0",
  "./chess.html","./chess.css?v=8.2.0","./chess-app.js?v=8.2.0",
  "./xo.html","./xo.css?v=8.2.0","./xo-app.js?v=8.2.0",
  "./2048.html","./game-2048.css?v=8.2.0","./game-2048.js?v=8.2.0",
  "./sudoku.html","./sudoku.css?v=8.2.0","./sudoku.js?v=8.2.0",
  "./arcade-game.css?v=8.2.0","./social.css?v=8.2.0","./social.js?v=8.2.0","./room-helper.js?v=8.2.0",
  "./firebase-config.js?v=8.2.0","./turn-config.js?v=8.2.0","./manifest.webmanifest?v=8.2.0",
  "./logo-coffee.png","./icons/icon-192.png","./icons/icon-512.png",
  "./assets/domino-place-real.wav?v=8.2.0","./assets/domino-double-real.wav?v=8.2.0","./assets/domino-draw-real.wav?v=8.2.0","./assets/domino-win.wav?v=8.2.0",
  "./assets/chess-move.wav?v=8.2.0","./assets/chess-capture.wav?v=8.2.0","./assets/chess-castle.wav?v=8.2.0","./assets/chess-check.wav?v=8.2.0",
  "./assets/xo-x.wav?v=8.2.0","./assets/xo-o.wav?v=8.2.0","./assets/xo-win.wav?v=8.2.0","./assets/xo-draw.wav?v=8.2.0",
  "./assets/2048-move.wav?v=8.2.0","./assets/2048-merge.wav?v=8.2.0","./assets/2048-win.wav?v=8.2.0","./assets/2048-gameover.wav?v=8.2.0",
  "./assets/sudoku-tap.wav?v=8.2.0","./assets/sudoku-correct.wav?v=8.2.0","./assets/sudoku-error.wav?v=8.2.0","./assets/sudoku-hint.wav?v=8.2.0","./assets/sudoku-complete.wav?v=8.2.0"
];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==self.location.origin)return;e.respondWith(fetch(r).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});return res}).catch(()=>caches.match(r).then(hit=>hit||(r.mode==="navigate"?caches.match("./index.html"):Promise.reject()))))});
