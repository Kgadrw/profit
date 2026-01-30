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
  // Render immediately - don't mark body as loaded yet (let SplashScreen handle it)
  // Use requestAnimationFrame to ensure smooth render
  requestAnimationFrame(() => {
    createRoot(document.getElementById("root")!).render(<App />);
  });
});
