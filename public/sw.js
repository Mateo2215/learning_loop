/**
 * Learning Loop service worker.
 *
 * Lightweight (no Workbox) so we own the dependency surface. Three strategies:
 *   - /api/*        → NetworkFirst (fresh data, fallback to cache when offline)
 *   - /_next/static, /icons, /manifest, /favicon, /icon* → CacheFirst (immutable)
 *   - Navigation HTML → NetworkFirst (offline falls back to cached shell)
 *
 * On activate, all caches whose key doesn't match the current `CACHE_VERSION`
 * are cleared, so bumping the version forces clients to refresh.
 */

const CACHE_VERSION = "v2";
const STATIC_CACHE = `ll-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ll-runtime-${CACHE_VERSION}`;
const API_CACHE = `ll-api-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE, API_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Manifest must stay fresh because Android uses it to build/update WebAPK metadata.
  if (url.pathname === "/manifest.json") {
    event.respondWith(networkOnly(req));
    return;
  }

  // API: NetworkFirst with 5s timeout, fallback to last-known cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req, API_CACHE, 5000));
    return;
  }

  // Static immutable assets: CacheFirst.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg" ||
    url.pathname.startsWith("/icon-") ||
    url.pathname.startsWith("/favicon-") ||
    url.pathname === "/apple-touch-icon.png"
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Navigation HTML: NetworkFirst (so users see fresh pages when online),
  // fallback to runtime cache, then to root '/' as last resort.
  if (req.mode === "navigate") {
    event.respondWith(navigationStrategy(req));
    return;
  }

  // Everything else (fonts, images): runtime cache, network-first.
  event.respondWith(networkFirst(req, RUNTIME_CACHE, 8000));
});

async function networkOnly(request) {
  try {
    return await fetch(request, { cache: "no-store" });
  } catch (err) {
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      statusText: "offline",
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response("offline", { status: 503, statusText: "offline" });
  }
}

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      statusText: "offline",
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function navigationStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const root = await caches.match("/");
    if (root) return root;
    return new Response("offline", { status: 503, statusText: "offline" });
  }
}

// Allow client to ping for skipWaiting (used after a deploy banner click).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
