// Cache Manager - Clear all caches and stale data
import { clearAllStores } from './indexedDB';
import { apiCache } from './apiCache';
import { notificationStore } from './notificationStore';

/**
 * Clear all caches, IndexedDB, and stale data
 * Use this to ensure fresh data from backend
 */
export async function clearAllCachesAndData(): Promise<void> {
  try {
    console.log('[CacheManager] Clearing all caches and data...');
    
    // 1. Clear IndexedDB stores (only products store to avoid blocking)
    try {
      // Only clear products store to ensure fresh product data
      // Don't clear all stores as it might block app startup
      const { clearStore } = await import('./indexedDB');
      await clearStore('products');
      console.log('[CacheManager] ✓ Cleared products store');
    } catch (error) {
      console.error('[CacheManager] Error clearing IndexedDB:', error);
      // Don't throw - continue with other cache clearing
    }
    
    // 2. Clear API cache
    try {
      apiCache.clear();
      console.log('[CacheManager] ✓ Cleared API cache');
    } catch (error) {
      console.error('[CacheManager] Error clearing API cache:', error);
    }
    
    // 3. Clear notification store
    try {
      notificationStore.clearAll();
      console.log('[CacheManager] ✓ Cleared notification store');
    } catch (error) {
      console.error('[CacheManager] Error clearing notification store:', error);
    }
    
    // 4. Clear localStorage cache flags
    try {
      localStorage.removeItem('profit-pilot-last-sync');
      localStorage.removeItem('profit-pilot-products-changed');
      localStorage.removeItem('profit-pilot-sales-changed');
      localStorage.removeItem('profit-pilot-clients-changed');
      localStorage.removeItem('profit-pilot-schedules-changed');
      console.log('[CacheManager] ✓ Cleared localStorage cache flags');
    } catch (error) {
      console.error('[CacheManager] Error clearing localStorage:', error);
    }
    
    // 5. Clear service worker caches
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter(name => name.startsWith('trippo-'))
            .map(name => caches.delete(name))
        );
        console.log('[CacheManager] ✓ Cleared service worker caches');
      }
    } catch (error) {
      console.error('[CacheManager] Error clearing service worker caches:', error);
    }
    
    // 6. Clear service worker notification tracking (non-blocking)
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // Don't wait for ready - just send message if controller exists
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_NOTIFICATION_TRACKING' });
        console.log('[CacheManager] ✓ Cleared service worker notification tracking');
      } else {
        // If no controller yet, try to get ready (but don't block)
        navigator.serviceWorker.ready.then((reg) => {
          reg.active?.postMessage({ type: 'CLEAR_NOTIFICATION_TRACKING' });
        }).catch(() => {
          // Ignore errors - service worker might not be ready yet
        });
      }
    } catch (error) {
      console.error('[CacheManager] Error clearing service worker tracking:', error);
    }
    
    console.log('[CacheManager] ✓ All caches and data cleared successfully');
  } catch (error) {
    console.error('[CacheManager] Error during cache clear:', error);
    throw error;
  }
}

/**
 * Force refresh all data from backend (clears cache and triggers refresh)
 */
export async function forceRefreshFromBackend(): Promise<void> {
  await clearAllCachesAndData();
  
  // Dispatch event to trigger refresh in all components
  window.dispatchEvent(new CustomEvent('force-refresh-data'));
}
