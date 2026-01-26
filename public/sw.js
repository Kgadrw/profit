// Service Worker for PWA, offline support, and background notifications

const CACHE_VERSION = Date.now().toString();
const CACHE_NAME = `trippo-${CACHE_VERSION}`;
const API_BASE_URL = 'https://profit-backend-e4w1.onrender.com/api';
const NOTIFICATION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Install event - cache resources
self.addEventListener("install", (event) => {
  console.log("Service Worker installing with cache version:", CACHE_VERSION);
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up ALL old caches and start background sync
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
    }).then(() => {
      // Start background notification checking
      startBackgroundNotificationCheck();
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

// Message handler for sync requests and notification setup
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

  // Handle notification check requests from client
  if (event.data && event.data.type === "CHECK_NOTIFICATIONS") {
    event.waitUntil(checkForNotifications());
  }

  // Handle notification data from client
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    event.waitUntil(showNotification(event.data.notification));
  }

  // Store userId for background checks
  if (event.data && event.data.type === "SET_USER_ID") {
    // Store in a variable (in a real app, you might use IndexedDB in service worker)
    self.userId = event.data.userId;
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

// Background notification checking
let notificationCheckInterval = null;

function startBackgroundNotificationCheck() {
  // Clear any existing interval
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
  }

  // Check for notifications periodically
  notificationCheckInterval = setInterval(() => {
    checkForNotifications();
  }, NOTIFICATION_CHECK_INTERVAL);

  // Also check immediately
  checkForNotifications();
}

async function checkForNotifications() {
  try {
    // Get userId from stored variable (set by client)
    const userId = self.userId;
    if (!userId) {
      return; // No user logged in
    }

    // Check notification permission
    const permission = await self.registration.permission;
    if (permission !== 'granted') {
      return; // Notifications not allowed
    }

    // Check for new data and send notifications
    await checkAndNotify(userId);
  } catch (error) {
    console.error("Error checking for notifications:", error);
  }
}

async function checkAndNotify(userId) {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add userId to headers if needed by backend
    // Note: Backend should use userId from auth token, but we include it for clarity
    
    // Check for low stock products
    try {
      const productsResponse = await fetch(`${API_BASE_URL}/products`, {
        method: 'GET',
        headers,
      });

      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        if (productsData.data && Array.isArray(productsData.data)) {
          for (const product of productsData.data) {
            const minStock = product.minStock || 5;
            const threshold = Math.ceil(minStock * 1.2);
            
            if (product.stock <= threshold && product.stock > 0) {
              await showNotification({
                title: 'Low Stock Alert',
                body: `${product.name} is running low (${product.stock} left, minimum: ${minStock})`,
                icon: '/logo.png',
                tag: `low-stock-${product.name}`,
                data: {
                  route: 'products',
                  type: 'low_stock',
                },
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking products:", error);
    }
  } catch (error) {
    console.error("Error in checkAndNotify:", error);
  }
}

async function showNotification(options) {
  try {
    await self.registration.showNotification(options.title, {
      body: options.body,
      icon: options.icon || '/logo.png',
      badge: '/logo.png',
      tag: options.tag,
      data: options.data || {},
      requireInteraction: options.requireInteraction || false,
    });
  } catch (error) {
    console.error("Error showing notification:", error);
  }
}

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data;
  if (data && data.route) {
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(data.route) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(`/${data.route}`);
        }
      })
    );
  }
});

// Background Sync API support
self.addEventListener("sync", (event) => {
  if (event.tag === "background-notification-check") {
    event.waitUntil(checkForNotifications());
  }
});

// Periodic Background Sync API support (if available)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicSync', (event) => {
    if (event.tag === 'notification-check') {
      event.waitUntil(checkForNotifications());
    }
  });
}
