/* global Response, URL, caches, fetch, self */

// Bump CACHE_VERSION on each deploy to invalidate stale caches
const CACHE_VERSION = "4";
const CACHE_NAME = `cloudless-v${CACHE_VERSION}`;
const STATIC_CACHE = `cloudless-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `cloudless-dynamic-v${CACHE_VERSION}`;

const STATIC_ASSETS = ["/", "/offline.html"];

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
  );
  self.clients.claim();
});

// Helper: clone and cache a response safely
function cacheResponse(cacheName, request, response) {
  try {
    const cloned = response.clone();
    caches.open(cacheName).then((cache) => {
      cache.put(request, cloned);
    });
  } catch {
    // Response body already consumed — skip caching
  }
}

function handleApiRequest(request) {
  return fetch(request).catch(() => {
    return new Response("API unavailable offline", { status: 503 });
  });
}

function handleNavigationRequest(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        cacheResponse(DYNAMIC_CACHE, request, response);
      }
      return response;
    })
    .catch(() => {
      return caches.match(request).then((cached) => {
        return cached || caches.match("/offline.html");
      });
    });
}

function handleStaticAssetRequest(request) {
  const isJsAsset = request.url.endsWith(".js");
  const isCssAsset = request.url.endsWith(".css");

  // Use network-first for JS/CSS chunks to avoid stale script/style cache issues.
  if (isJsAsset || isCssAsset) {
    return fetch(request)
      .then((response) => {
        if (response.ok) {
          cacheResponse(STATIC_CACHE, request, response);
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response("Offline", { status: 503 });
        });
      });
  }

  return caches.open(STATIC_CACHE).then((cache) => {
    return cache.match(request).then((cached) => {
      if (cached) {
        // Stale-while-revalidate: return cached immediately, refresh in background
        fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
          })
          .catch(() => {});
        return cached;
      }

      // Cache miss: fetch from network and cache the response
      return fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      });
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

// Fetch event
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith("http")) return;

  // Skip cross-origin requests (e.g. Typekit, analytics, CDNs)
  // The SW should only manage same-origin assets
  if (url.origin !== self.location.origin) return;

  // Network-only for API routes
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Network-first for navigation (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Cache-first for static assets
  const isStaticAsset = STATIC_EXTENSIONS.some((ext) =>
    url.pathname.endsWith(ext),
  );

  if (isStaticAsset) {
    event.respondWith(handleStaticAssetRequest(request));
    return;
  }

  // Default: network-first
  event.respondWith(handleDefaultRequest(request));
});

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data
    ? event.data.json()
    : { title: "Cloudless", body: "New notification" };

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
