// Service Worker for PWA and offline support

const CACHE_VERSION = Date.now().toString();
const CACHE_NAME = `trippo-${CACHE_VERSION}`;

// Install event - cache resources
self.addEventListener("install", (event) => {
  console.log("Service Worker installing with cache version:", CACHE_VERSION);
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up ALL old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating, clearing old caches...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log("Deleting old cache:", cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log("All old caches cleared");
      return self.clients.claim();
    })
  );
});

// Fetch event - Network First strategy (better for development)
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip caching for Vite dev server assets (they have hashes)
  const url = new URL(event.request.url);
  if (url.pathname.includes('/node_modules/') || 
      url.pathname.includes('/@vite/') ||
      url.pathname.includes('/src/') ||
      url.searchParams.has('t') ||
      url.searchParams.has('v')) {
    // For development assets with hashes, always fetch from network
    event.respondWith(fetch(event.request));
    return;
  }

  // Network First strategy - try network, fallback to cache if offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Network request succeeded, update cache and return response
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network request failed, try cache (for offline support)
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return a basic offline response if nothing in cache
          return new Response("Offline - No cached version available", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({
              "Content-Type": "text/plain",
            }),
          });
        });
      })
  );
});

// Message handler for sync requests
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === "SYNC_REQUEST") {
    // Trigger sync when online
    if (navigator.onLine) {
      event.waitUntil(syncData(event.data.payload));
    }
  }
});

// Sync data function (called when online)
async function syncData(payload) {
  try {
    // In a real app, this would sync with the server
    // For now, we'll just acknowledge the sync
    console.log("Syncing data:", payload);
    return Promise.resolve();
  } catch (error) {
    console.error("Sync error:", error);
    return Promise.reject(error);
  }
}
