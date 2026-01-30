// Service Worker Registration

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // In development, don't register service worker or unregister existing ones
  if (isDevelopment) {
    console.log("Development mode: Unregistering service worker for live updates");
    return navigator.serviceWorker.getRegistrations().then((registrations) => {
      return Promise.all(
        registrations.map((registration) => {
          console.log("Unregistering service worker:", registration.scope);
          return registration.unregister();
        })
      );
    }).then(() => {
      // Clear all caches in development
      return caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log("Deleting cache:", cacheName);
            return caches.delete(cacheName);
          })
        );
      });
    }).then(() => {
      console.log("All service workers and caches cleared for development");
      return null;
    }).catch((error) => {
      console.error("Error clearing service workers:", error);
      return null;
    });
  }

  // In production, register service worker normally
  if ("serviceWorker" in navigator) {
    // Register service worker (don't unregister first - let browser handle updates)
    return navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered successfully:", registration.scope);

        // Check for updates periodically (but don't force reload loop)
        // Only check for updates, don't auto-reload
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New service worker is available - notify user but don't auto-reload
                console.log("New service worker available. Reload page to update.");
                // Optionally show a toast/notification to user to reload
              } else if (newWorker.state === "installed") {
                console.log("Service Worker installed for the first time");
              }
            });
          }
        });

        // Only reload once when controller changes (not on every change)
        let hasReloaded = false;
        const handleControllerChange = () => {
          if (!hasReloaded && navigator.serviceWorker.controller) {
            hasReloaded = true;
            console.log("Service Worker controller changed, reloading to use new version");
            // Remove listener to prevent multiple reloads
            navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
            window.location.reload();
          }
        };

        // Only listen for controller change if there's already a controller
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange, { once: true });
        }

        // Check for updates on page load (but not continuously)
        registration.update();

        return registration;
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
        return null;
      });
  }
  return Promise.resolve(null);
}

export function unregisterServiceWorker(): Promise<boolean> {
  if ("serviceWorker" in navigator) {
    return navigator.serviceWorker.getRegistrations().then((registrations) => {
      return Promise.all(
        registrations.map((registration) => registration.unregister())
      ).then((results) => {
        const success = results.some((result) => result === true);
        if (success) {
          console.log("All Service Workers unregistered");
        }
        return success;
      });
    });
  }
  return Promise.resolve(false);
}

// Clear all caches and service workers (useful for development)
export async function clearAllCaches(): Promise<void> {
  console.log("Clearing all caches and service workers...");
  
  // Unregister all service workers
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
    console.log(`Unregistered ${registrations.length} service worker(s)`);
  }
  
  // Clear all caches
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((cacheName) => {
    console.log("Deleting cache:", cacheName);
    return caches.delete(cacheName);
  }));
  console.log(`Cleared ${cacheNames.length} cache(s)`);
  
  console.log("All caches and service workers cleared!");
}

// Make it available globally for easy access
if (typeof window !== "undefined") {
  (window as any).clearAllCaches = clearAllCaches;
}
