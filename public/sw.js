/* global Response, URL, caches, fetch, self */

// Bump CACHE_VERSION on each deploy to invalidate stale caches
const CACHE_VERSION = "6";
const CACHE_NAME = `cloudless-v${CACHE_VERSION}`;
const STATIC_CACHE = `cloudless-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `cloudless-dynamic-v${CACHE_VERSION}`;

const STATIC_ASSETS = ["/", "/offline.html", "/manifest.webmanifest"];

// Max entries in the dynamic cache to prevent unbounded growth
const DYNAMIC_CACHE_MAX = 50;

const STATIC_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".css",
  ".js",
];

// Install event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Offline fallback
        return cache.add("/offline.html");
      });
    }),
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Delete stale caches from previous versions
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== STATIC_CACHE &&
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== CACHE_NAME
            ) {
              return caches.delete(cacheName);
            }
          }),
        );
      }),
      // Enable Navigation Preload for faster page loads on mobile
      self.registration.navigationPreload?.enable(),
    ]),
  );
  self.clients.claim();
});

// Message handler — supports SKIP_WAITING for a controlled update flow
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Helper: clone and cache a response safely, then trim the dynamic cache
function cacheResponse(cacheName, request, response) {
  try {
    const cloned = response.clone();
    caches.open(cacheName).then((cache) => {
      cache.put(request, cloned).then(() => {
        if (cacheName === DYNAMIC_CACHE) trimDynamicCache();
      });
    });
  } catch {
    // Response body already consumed — skip caching
  }
}

// Evict the oldest entries when DYNAMIC_CACHE exceeds the size limit
function trimDynamicCache() {
  caches.open(DYNAMIC_CACHE).then((cache) => {
    cache.keys().then((keys) => {
      const excess = keys.length - DYNAMIC_CACHE_MAX;
      if (excess > 0) {
        Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
      }
    });
  });
}

function handleApiRequest(request) {
  return fetch(request).catch(() => {
    return new Response("API unavailable offline", { status: 503 });
  });
}

function handleNavigationRequest(event) {
  // Use the preloaded response if available (faster on mobile)
  return Promise.resolve(event.preloadResponse)
    .then((preloadResponse) => {
      if (preloadResponse) {
        if (preloadResponse.ok) {
          cacheResponse(DYNAMIC_CACHE, event.request, preloadResponse);
        }
        return preloadResponse;
      }
      // Fall back to normal fetch
      return fetch(event.request).then((response) => {
        if (response.ok) {
          cacheResponse(DYNAMIC_CACHE, event.request, response);
        }
        return response;
      });
    })
    .catch(() => {
      return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return caches
            .match("/offline.html")
            .then((offline) => offline || new Response("Offline", { status: 503 }));
        });
    });
}

// Stale-while-revalidate: serve from cache immediately, update in background
function handleStaticAssetRequest(request) {
  return caches.open(STATIC_CACHE).then((cache) => {
    return cache.match(request).then((cached) => {
      // Always kick off a background revalidation
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => new Response("Offline", { status: 503 }));
      // Return cached immediately; fall back to network if not cached yet
      return cached || networkFetch;
    });
  });
}

function handleDefaultRequest(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        cacheResponse(DYNAMIC_CACHE, request, response);
      }
      return response;
    })
    .catch(() => {
      return caches.match(request).then((cached) => {
        return cached || new Response("Offline", { status: 503 });
      });
    });
}

function ensureResponse(result, fallbackBody = "Offline") {
  if (result instanceof Response) return result;
  return new Response(fallbackBody, { status: 503 });
}

// Fetch event
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith("http")) return;

  // Network-only for API routes
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      handleApiRequest(request)
        .then((response) => ensureResponse(response, "API unavailable offline"))
        .catch(() => new Response("API unavailable offline", { status: 503 })),
    );
    return;
  }

  // Network-first for navigation (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      handleNavigationRequest(event)
        .then((response) => ensureResponse(response))
        .catch(() => new Response("Offline", { status: 503 })),
    );
    return;
  }

  // Stale-while-revalidate for static assets
  const isStaticAsset = STATIC_EXTENSIONS.some((ext) =>
    url.pathname.endsWith(ext),
  );

  if (isStaticAsset) {
    event.respondWith(
      handleStaticAssetRequest(request)
        .then((response) => ensureResponse(response))
        .catch(() => new Response("Offline", { status: 503 })),
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    handleDefaultRequest(request)
      .then((response) => ensureResponse(response))
      .catch(() => new Response("Offline", { status: 503 })),
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  let data = { title: "Cloudless", body: "New notification", url: undefined };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // Malformed push payload — use defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [100, 50, 100],
      data: data.url ? { url: data.url } : undefined,
    }),
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
