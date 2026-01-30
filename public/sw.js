// Service Worker for PWA, offline support, and background notifications

const CACHE_VERSION = "v1"; // Change this only when you deploy a new version
const CACHE_NAME = `trippo-${CACHE_VERSION}`;
const API_BASE_URL = 'https://profit-backend-e4w1.onrender.com/api';
const NOTIFICATION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Install event - cache resources
self.addEventListener("install", (event) => {
  console.log("Service Worker installing with cache version:", CACHE_VERSION);
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up only app's old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating, clearing old caches...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        // Only delete caches that belong to this app (trippo- prefix) but not current version
        cacheNames
          .filter((name) => name.startsWith("trippo-") && name !== CACHE_NAME)
          .map((cacheName) => {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log("App caches cleared");
      return self.clients.claim();
    })
  );
});

// Fetch event - NEVER cache API calls, only cache static assets
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // ✅ 1) NEVER cache backend API calls - always fetch fresh
  // Don't override headers - let the request pass through as-is
  if (url.origin === "https://profit-backend-e4w1.onrender.com" || url.pathname.startsWith("/api")) {
    // Create a new request with no-store cache, preserving original headers
    const req = new Request(event.request, { cache: "no-store" });
    event.respondWith(fetch(req));
    return;
  }

  // Skip caching for Vite dev server assets (they have hashes)
  if (
    url.pathname.includes("/node_modules/") ||
    url.pathname.includes("/@vite/") ||
    url.pathname.includes("/src/") ||
    url.searchParams.has("t") ||
    url.searchParams.has("v")
  ) {
    // For development assets with hashes, always fetch from network
    event.respondWith(fetch(event.request));
    return;
  }

  // ✅ 2) For non-API static assets: Network-first + cache fallback
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
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  
  if (event.data.type === "SYNC_REQUEST") {
    // Trigger sync when online
    if (navigator.onLine) {
      event.waitUntil(syncData(event.data.payload));
    }
    return;
  }

  // Handle notification check requests from client
  if (event.data.type === "CHECK_NOTIFICATIONS") {
    event.waitUntil(checkForNotifications());
    return;
  }

  // Handle notification data from client
  if (event.data.type === "SHOW_NOTIFICATION") {
    event.waitUntil(showNotification(event.data.notification));
    return;
  }

  // Store userId for background checks
  if (event.data.type === "SET_USER_ID") {
    // Store in a variable (in a real app, you might use IndexedDB in service worker)
    self.userId = event.data.userId;
    return;
  }

  // Respond to keep-alive messages
  if (event.data.type === "KEEP_ALIVE") {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ alive: true });
    }
    return;
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
let lastNotificationCheck = 0;
const NOTIFICATION_DEBOUNCE = 5 * 60 * 1000; // 5 minutes between same notifications

function startBackgroundNotificationCheck() {
  // Clear any existing interval
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
  }

  // Check for notifications periodically (works even when app is closed)
  // This interval keeps the service worker active
  notificationCheckInterval = setInterval(() => {
    const now = Date.now();
    // Only check if enough time has passed
    if (now - lastNotificationCheck >= NOTIFICATION_CHECK_INTERVAL) {
      lastNotificationCheck = now;
      checkForNotifications();
    }
  }, NOTIFICATION_CHECK_INTERVAL);

  // Also check immediately
  checkForNotifications();
}

async function checkForNotifications() {
  try {
    // Get userId from stored variable (set by client)
    const userId = self.userId;
    if (!userId) {
      console.log("No userId set, skipping notification check");
      return; // No user logged in
    }

    // Check notification permission
    // Note: self.registration.permission is not a standard API
    // We'll check by trying to show a notification (will fail if not granted)
    try {
      // Check if we can show notifications by checking registration
      const registration = self.registration;
      if (!registration) {
        return;
      }

      // Check for new data and send notifications
      await checkAndNotify(userId);
    } catch (permError) {
      console.log("Notification permission not granted or error:", permError);
      return; // Notifications not allowed
    }
  } catch (error) {
    console.error("Error checking for notifications:", error);
  }
}

// Store last notification times to prevent duplicates
const lastNotificationTimes = new Map();
// Store last known product IDs to track when products are removed
let lastKnownProductIds = new Set();
// Store last known stock state per product (for state-based notifications)
const lastKnownStock = new Map(); // productId -> stock number

// Helper to close notifications by tag
async function closeNotificationByTag(tag) {
  try {
    const registration = self.registration;
    if (!registration || !('getNotifications' in registration)) {
      return;
    }
    const notifs = await registration.getNotifications({ tag });
    notifs.forEach(n => n.close());
    if (notifs.length > 0) {
      console.log(`Closed ${notifs.length} notification(s) with tag: ${tag}`);
    }
  } catch (e) {
    console.error("Failed to close notifications:", e);
  }
}

async function checkAndNotify(userId) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    };

    // Check for low stock and out of stock products
    try {
      // ✅ Force fresh data - never use cache for API calls
      const productsResponse = await fetch(`${API_BASE_URL}/products`, {
        method: 'GET',
        headers: headers,
        cache: 'no-store', // Explicitly disable caching
      });

      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        if (productsData.data && Array.isArray(productsData.data)) {
          // Check if there are any products - skip notification check if no products exist
          if (productsData.data.length === 0) {
            console.log("No products found, skipping notification check");
            // Clear all product-related notifications when no products exist
            lastNotificationTimes.clear();
            lastKnownProductIds.clear();
            return;
          }
          
          // Track current product IDs to detect removals
          const currentProductIds = new Set();
          
          for (const product of productsData.data) {
            const minStock = Number(product.minStock ?? 5);
            // Safely get productId - ensure it's a string
            const productId = String(product._id ?? product.id ?? '');
            if (!productId || productId === 'undefined') {
              console.warn('Skipping product with invalid ID:', product);
              continue;
            }
            // Safely get currentStock - null/undefined becomes 0
            const currentStock = Number(product.stock ?? 0);
            const lowTag = `low-stock-${productId}`;
            const outTag = `out-of-stock-${productId}`;
            
            // Track this product ID
            currentProductIds.add(productId?.toString());
            
            // Check if we should notify (out of stock or low stock)
            const isOutOfStock = currentStock === 0;
            const isLowStock = currentStock > 0 && currentStock <= minStock;
            
            // Get previous stock state
            const prevStock = lastKnownStock.get(productId);
            const stockChanged = prevStock === undefined ? true : prevStock !== currentStock;
            
            // Update last known stock
            lastKnownStock.set(productId, currentStock);
            
            // ✅ Close resolved notifications (stock is no longer low/out)
            if (!isLowStock) {
              await closeNotificationByTag(lowTag);
            }
            if (!isOutOfStock) {
              await closeNotificationByTag(outTag);
            }
            
            // ✅ State-based notification (only notify when stock actually changes)
            // This replaces time-based debounce with state-based logic
            if ((isOutOfStock || isLowStock) && stockChanged) {
              // Use same tag to replace existing notification if it exists
              if (isOutOfStock) {
                await showNotification({
                  title: 'Out of Stock Alert',
                  body: `${product.name} is out of stock!`,
                  icon: '/logo.png',
                  badge: '/logo.png',
                  tag: outTag, // Same tag replaces previous notification
                  requireInteraction: false, // Don't stick forever - auto-close after a few seconds
                  data: {
                    route: '/products',
                    type: 'low_stock',
                    productName: product.name,
                    currentStock: 0,
                    minStock: minStock,
                    productId: productId,
                    action: 'update_stock',
                  },
                });
              } else if (isLowStock) {
                await showNotification({
                  title: 'Low Stock Alert',
                  body: `${product.name} is running low (${currentStock} left, minimum: ${minStock})`,
                  icon: '/logo.png',
                  badge: '/logo.png',
                  tag: lowTag, // Same tag replaces previous notification
                  requireInteraction: false, // Don't stick forever - auto-close after a few seconds
                  data: {
                    route: '/products',
                    type: 'low_stock',
                    productName: product.name,
                    currentStock: currentStock,
                    minStock: minStock,
                    productId: productId,
                    action: 'update_stock',
                  },
                });
              }
            }
          }
          
          // Clean up notifications for products that no longer exist
          for (const oldProductId of lastKnownProductIds) {
            if (!currentProductIds.has(oldProductId)) {
              // Product was removed, clear its notification tracking and close notifications
              const oldNotificationKey = `product-${oldProductId}`;
              lastNotificationTimes.delete(oldNotificationKey);
              lastKnownStock.delete(oldProductId);
              
              // Close any existing notifications for this product
              await closeNotificationByTag(`low-stock-${oldProductId}`);
              await closeNotificationByTag(`out-of-stock-${oldProductId}`);
              
              console.log(`Cleared notification tracking for removed product: ${oldProductId}`);
            }
          }
          
          // Update last known product IDs
          lastKnownProductIds = currentProductIds;
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
    // Check if we have permission to show notifications
    const registration = self.registration;
    if (!registration) {
      console.log("No service worker registration available");
      return;
    }

    // Show notification (will work even when app is closed)
    await registration.showNotification(options.title, {
      body: options.body,
      icon: options.icon || '/logo.png',
      badge: options.badge || '/logo.png',
      tag: options.tag,
      data: options.data || {},
      requireInteraction: options.requireInteraction !== undefined ? options.requireInteraction : false,
      silent: false,
      vibrate: [200, 100, 200], // Vibration pattern for mobile devices
      timestamp: Date.now(),
    });
    
    console.log("Notification shown:", options.title);
  } catch (error) {
    console.error("Error showing notification:", error);
    // If permission is denied, we can't show notifications
    // This is expected behavior
  }
}

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data;
  
  // Handle low stock notification with quick update action
  if (data && data.type === 'low_stock' && data.action === 'update_stock' && data.productId) {
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        // Send message to all clients to show stock update dialog
        for (const client of clientList) {
          client.postMessage({
            type: 'SHOW_STOCK_UPDATE',
            productId: data.productId,
            productName: data.productName,
            currentStock: data.currentStock,
            minStock: data.minStock,
          });
        }
        
        // Focus or open a window
        if (clientList.length > 0) {
          return clientList[0].focus();
        } else if (clients.openWindow) {
          return clients.openWindow('/products');
        }
      })
    );
    return;
  }
  
  // Default behavior: navigate to route
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
        // ✅ Fix: route already includes leading slash, don't add another
        if (clients.openWindow) {
          const route = data.route.startsWith('/') ? data.route : `/${data.route}`;
          return clients.openWindow(route);
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
// This allows notifications to work even when the app is completely closed
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicSync', (event) => {
    if (event.tag === 'notification-check') {
      console.log("Periodic sync triggered for notifications");
      event.waitUntil(checkForNotifications());
    }
  });
}

// ✅ Push notification support for real-time notifications when app is closed
// This is the proper way to get real-time notifications - server sends push events
// When backend implements push notifications, it should:
// 1. Send push when stock becomes low/out-of-stock (immediate)
// 2. Send push when stock is replenished (to clear stale alerts)
// 3. Use same tags as polling notifications for consistency
self.addEventListener("push", (event) => {
  console.log("Push event received:", event);
  
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error("Error parsing push data:", e);
    data = {
      title: "Trippo",
      body: event.data ? event.data.text() : "You have a new update",
    };
  }

  // If push indicates stock is resolved, close the notification
  if (data.resolved === true && data.tag) {
    event.waitUntil(closeNotificationByTag(data.tag));
    return;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Trippo", {
      body: data.body || "You have a new update",
      icon: data.icon || "/logo.png",
      badge: data.badge || "/logo.png",
      data: data.data || {},
      tag: data.tag || "trippo-push",
      requireInteraction: false, // Don't stick forever - auto-close
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
    })
  );
});
