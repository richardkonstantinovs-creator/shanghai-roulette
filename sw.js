/* sw.js — the offline install.
 *
 * The app is served from a domain exactly once. This copies every byte of it
 * onto the device, and from then on the app is answered from that copy and
 * never asks the network for anything again. That is what keeps the promise
 * in CLAUDE.md: no network calls at runtime, on a street in Shanghai, on
 * Chinese mobile data, with the host possibly unreachable.
 *
 * Bump CACHE when the data is rebuilt, or devices will keep serving the old
 * map from their own copy.
 */
const CACHE = "shanghai-roulette-d609606e20";

const ASSETS = [
  "./",
  "./index.html",
  "./data/shanghai.js",
  /* Always here even when it is empty. The list is fixed at install and a
     file that only started existing later would never be fetched — the app
     would ask the network for it on a street in Shanghai and get nothing. */
  "./data/overlay.js",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      // Cache first, always. A hit is answered without touching the network
      // even when the network is available — the copy on the device is the
      // source of truth until the cache name changes.
      if (hit) return hit;

      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // Offline and not cached. Any navigation still opens the app.
          if (req.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 504, statusText: "offline" });
        });
    })
  );
});
