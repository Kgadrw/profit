import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/serviceWorker";
import { initDB } from "./lib/indexedDB";
import { logger } from "./lib/logger";

// Disable all console methods in production for privacy and security
if (import.meta.env.PROD) {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.trace = () => {};
  console.table = () => {};
  console.group = () => {};
  console.groupEnd = () => {};
  console.groupCollapsed = () => {};
  console.time = () => {};
  console.timeEnd = () => {};
  console.count = () => {};
  console.clear = () => {};
}

// Initialize IndexedDB and register service worker
// Don't block rendering - initialize in parallel
Promise.all([
  initDB().catch((error) => {
    logger.error("Failed to initialize IndexedDB:", error);
  }),
  registerServiceWorker().catch((error) => {
    logger.error("Failed to register service worker:", error);
  }),
]).then(() => {
  // Render immediately - don't block on cache clearing
  // Use requestAnimationFrame to ensure smooth render
  requestAnimationFrame(() => {
    createRoot(document.getElementById("root")!).render(<App />);
  });
  
  // ✅ Clear stale caches in background (non-blocking)
  // This prevents showing old/deleted products and wrong stock numbers
  // Do this AFTER rendering so app opens immediately
  import('./lib/cacheManager').then(({ clearAllCachesAndData }) => {
    clearAllCachesAndData().catch((error) => {
      console.error('[App] Error clearing caches:', error);
      // Don't block - continue anyway
    });
  }).catch((error) => {
    console.error('[App] Error importing cacheManager:', error);
    // Don't block - continue anyway
  });
});
