// Hook to manage API data (replaces useLocalStorage for backend integration)
import { useState, useEffect, useCallback, useRef } from "react";
import { productApi, saleApi, clientApi, scheduleApi } from "@/lib/api";
import { SyncManager } from "@/lib/syncManager";
import { initDB, getAllItems, addItem, updateItem, deleteItem, getItem, clearStore } from "@/lib/indexedDB";
import { generateUniqueId } from "@/lib/idGenerator";
import { apiCache } from "@/lib/apiCache";
import { logger } from "@/lib/logger";

interface UseApiOptions<T> {
  endpoint: 'products' | 'sales' | 'clients' | 'schedules';
  defaultValue: T[];
  onError?: (error: Error) => void;
}

export function useApi<T extends { _id?: string; id?: number }>({
  endpoint,
  defaultValue,
  onError,
}: UseApiOptions<T>) {
  const [items, setItems] = useState<T[]>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasErrorShownRef = useRef(false);
  const isLoadingDataRef = useRef(false);
  const syncManager = SyncManager.getInstance();

  // Map MongoDB _id to id for compatibility
  const mapItem = useCallback((item: any): T => {
    if (item._id && !item.id) {
      return { ...item, id: item._id };
    }
    return item;
  }, []);

  // Load data from IndexedDB first, then try to sync with API
  const loadData = useCallback(async () => {
    // Prevent multiple simultaneous requests
    if (isLoadingDataRef.current) {
      return;
    }

    // Validate userId exists before making API calls (data isolation)
    const userId = localStorage.getItem("profit-pilot-user-id");
    if (!userId) {
      setIsLoading(false);
      setError(new Error('User not authenticated. Please login.'));
      setItems(defaultValue);
      return;
    }

    isLoadingDataRef.current = true;
    setIsLoading(true);
    setError(null);
    hasErrorShownRef.current = false;
    
    // Minimum loading time to prevent flickering (500ms for better UX)
    const startTime = Date.now();
    const minLoadingTime = 500;
    
    try {
      // Initialize IndexedDB
      await initDB();
      
      const storeName = endpoint;
      const isSalesEndpoint = endpoint === 'sales';
      
      // Check if stored userId matches current userId - clear IndexedDB if different
      const storedUserId = localStorage.getItem("profit-pilot-stored-user-id");
      if (storedUserId && storedUserId !== userId) {
        // User changed - clear all IndexedDB stores to prevent data leakage
        try {
          await clearStore(storeName);
          // Clear cache as well
          const cacheKey = `/${endpoint}`;
          apiCache.delete(cacheKey);
        } catch (clearError) {
          // Log but don't fail - continue with API fetch
          console.warn("Error clearing IndexedDB on user change:", clearError);
        }
      }
      // Store current userId for future checks
      localStorage.setItem("profit-pilot-stored-user-id", userId);
      
      // ✅ For products, ALWAYS fetch from API first to ensure fresh data
      // Skip IndexedDB and cache on initial load to prevent stale data
      const shouldSkipCache = endpoint === 'products';
      
      // For sales, ALWAYS fetch from API first - skip IndexedDB and cache
      // For other endpoints, use offline-first approach
      if (!isSalesEndpoint && !shouldSkipCache) {
        // Load from IndexedDB first (offline-first) for non-sales, non-products endpoints
        // Filter by userId if products have userId field (for data isolation)
        const localItems = await getAllItems<T>(storeName);
        
        // Filter items by userId if they have a userId field
        const filteredItems = localItems.filter((item: any) => {
          // If item has userId field, only include if it matches current userId
          if (item.userId !== undefined) {
            return item.userId === userId;
          }
          // If no userId field, include it (backward compatibility)
          // But prefer to fetch from API to ensure data isolation
          return false; // Don't use items without userId for security
        });
        
        if (filteredItems.length > 0) {
          const mappedItems = filteredItems.map(mapItem);
          setItems(mappedItems);
          setIsLoading(false);
        }
      
        // Check cache first to reduce API requests (for non-sales, non-products)
      const cacheKey = `/${endpoint}`;
      const cached = apiCache.get(cacheKey);
      
      // If we have valid cached data and no local changes, use cache
      const lastSyncTime = localStorage.getItem("profit-pilot-last-sync");
      const hasLocalChanges = localStorage.getItem(`profit-pilot-${endpoint}-changed`) === "true";
      
      if (cached && !hasLocalChanges && lastSyncTime) {
        const cacheAge = Date.now() - parseInt(lastSyncTime);
        // If cache is fresh (less than 2 minutes old), use it
        if (cacheAge < 2 * 60 * 1000) {
          const cachedItems = cached.data;
          const mappedItems = Array.isArray(cachedItems) ? cachedItems.map(mapItem) : [];
          setItems(mappedItems.length > 0 ? mappedItems : defaultValue);
          setIsLoading(false);
          isLoadingDataRef.current = false;
          return;
        }
        }
      } else {
        // For sales, check cache first to reduce API calls and avoid rate limiting
        const cacheKey = `/${endpoint}`;
        const cached = apiCache.get(cacheKey);
        const lastSyncTime = localStorage.getItem("profit-pilot-last-sync");
        const hasLocalChanges = localStorage.getItem(`profit-pilot-${endpoint}-changed`) === "true";
        
        // Use cache if it's fresh (less than 30 seconds old) and no local changes
        if (cached && !hasLocalChanges && lastSyncTime) {
          const cacheAge = Date.now() - parseInt(lastSyncTime);
          if (cacheAge < 30 * 1000) { // 30 seconds cache for sales
            const cachedItems = cached.data;
            const mappedItems = Array.isArray(cachedItems) ? cachedItems.map(mapItem) : [];
            if (mappedItems.length > 0) {
              // Sort by timestamp (newest first)
              mappedItems.sort((a, b) => {
                const aTime = (a as any).timestamp || (a as any).date;
                const bTime = (b as any).timestamp || (b as any).date;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
              });
              setItems(mappedItems);
              setIsLoading(false);
              isLoadingDataRef.current = false;
              
              // Still fetch in background to update cache, but don't block UI
              saleApi.getAll().then((response) => {
                if (response?.data) {
                  const freshItems = response.data.map(mapItem);
                  apiCache.set(cacheKey, response.data);
                  localStorage.setItem("profit-pilot-last-sync", String(Date.now()));
                  
                  // Update UI if data changed
                  freshItems.sort((a, b) => {
                    const aTime = (a as any).timestamp || (a as any).date;
                    const bTime = (b as any).timestamp || (b as any).date;
                    return new Date(bTime).getTime() - new Date(aTime).getTime();
                  });
                  setItems(freshItems);
                }
              }).catch(() => {
                // Silently fail background refresh
              });
              return;
            }
          }
        }
        // logger.log(`[useApi] Sales: Always fetching fresh data from API (skipping cache and IndexedDB)...`);
      }

      try {
        let response;
        if (endpoint === 'products') {
          response = await productApi.getAll();
        } else if (endpoint === 'sales') {
          // logger.log(`[useApi] ===== ALWAYS FETCHING SALES FROM API =====`);
          // logger.log(`[useApi] Sales: Fetching ALL sales directly from server (no cache, no IndexedDB first)...`);
          response = await saleApi.getAll();
          // logger.log(`[useApi] ✓ Sales API response received:`, {
          //   count: Array.isArray(response?.data) ? response.data.length : 0,
          //   hasData: !!response?.data,
          // });
        } else if (endpoint === 'clients') {
          response = await clientApi.getAll();
        } else if (endpoint === 'schedules') {
          response = await scheduleApi.getAll();
        } else {
          throw new Error(`Unknown endpoint: ${endpoint}`);
        }
        
        // Verify userId hasn't changed during the request (prevent data leakage)
        const currentUserId = localStorage.getItem("profit-pilot-user-id");
        if (currentUserId !== userId) {
          // User changed during request, clear data for security
          setItems(defaultValue);
          setIsLoading(false);
          return;
        }

        if (response.data) {
          const mappedItems = response.data.map(mapItem);
          
          // logger.log(`[useApi] Processing ${endpoint} data from server:`, {
          //   count: Array.isArray(response.data) ? response.data.length : 0,
          //   isArray: Array.isArray(response.data),
          //   mappedCount: mappedItems.length,
          // });
          
          // For sales, REPLACE all IndexedDB data with fresh server data
          if (isSalesEndpoint) {
            // logger.log(`[useApi] Sales: Replacing all IndexedDB data with fresh server data...`);
            
            // Clear all existing sales from IndexedDB first
            try {
              await clearStore(storeName);
              // logger.log(`[useApi] Sales: Cleared all existing IndexedDB data`);
            } catch (clearError) {
              // logger.error(`[useApi] Error clearing IndexedDB for sales:`, clearError);
              // If clear fails, try to delete items individually
              const existingItems = await getAllItems<T>(storeName);
              for (const item of existingItems) {
                const itemId = (item as any)._id || (item as any).id;
                if (itemId) {
                  const numericId = typeof itemId === 'string' ? parseInt(itemId) : itemId;
                  if (!isNaN(numericId)) {
                    try {
                      await deleteItem(storeName, numericId);
                    } catch (deleteError) {
                      // Ignore individual delete errors
                      // logger.warn(`[useApi] Could not delete item ${numericId}:`, deleteError);
                    }
                  }
                }
              }
            }
            
            // Add all fresh server items (use updateItem which handles both add and update)
            for (const item of mappedItems) {
              try {
                // Use updateItem which will add if doesn't exist, or update if exists (avoids key conflicts)
                await updateItem(storeName, item);
              } catch (updateError: any) {
                // Log error but continue with other items
                // logger.warn(`[useApi] Error updating sales item in IndexedDB:`, updateError, item);
                // Continue with next item instead of failing completely
              }
            }
            
            // Sort by timestamp (newest first) for immediate display
            const sortedItems = [...mappedItems].sort((a, b) => {
              const aTime = (a as any).timestamp || (a as any).date;
              const bTime = (b as any).timestamp || (b as any).date;
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            });
            
            // Update UI immediately with fresh data
            setItems(sortedItems.length > 0 ? sortedItems : defaultValue);
            
            // Cache the response for future use
            const cacheKey = `/${endpoint}`;
            apiCache.set(cacheKey, response.data);
            // Clear the changed flag since we've synced
            localStorage.removeItem(`profit-pilot-${endpoint}-changed`);
            
            // logger.log(`[useApi] ✓ Sales table updated with ${sortedItems.length} fresh records from API`);
          } else {
            // For other endpoints, use merge approach
            const cacheKey = `/${endpoint}`;
            // Cache the response
            apiCache.set(cacheKey, response.data);
            // Clear the changed flag since we've synced
            localStorage.removeItem(`profit-pilot-${endpoint}-changed`);
            
            // ✅ For products, replace all IndexedDB data with fresh server data (no merge)
            // This ensures we don't show deleted products or stale data
            if (endpoint === 'products') {
              // Clear existing products first
              try {
                await clearStore(storeName);
                console.log(`[useApi] Cleared products store to ensure fresh data`);
              } catch (clearError) {
                console.warn(`[useApi] Error clearing products store:`, clearError);
              }
              
              // Add all fresh server items with userId
              const itemsWithUserId = mappedItems.map(item => ({
                ...item,
                userId: userId
              })) as T[];
              
              for (const item of itemsWithUserId) {
                try {
                  await addItem(storeName, item);
                } catch (addError) {
                  console.warn(`[useApi] Error adding product to IndexedDB:`, addError);
                }
              }
              
              // Use server data directly (fresh from backend)
              setItems(mappedItems.length > 0 ? mappedItems : defaultValue);
            } else {
              // For other endpoints, use merge approach
              // Update IndexedDB with server data (merge with local data, prevent duplicates)
              // Add userId to each item for data isolation
              const itemsWithUserId = mappedItems.map(item => ({
                ...item,
                userId: userId
              })) as T[];
              
              const existingItems = await getAllItems<T>(storeName);
              // Normalize server IDs to strings for consistent comparison
              const serverIds = new Set(itemsWithUserId.map(i => {
                const id = (i as any)._id || (i as any).id;
                return id ? String(id) : null;
              }).filter(id => id !== null));
              
              // Remove local items that don't exist on server or belong to different user (cleanup)
              for (const localItem of existingItems) {
                const localId = (localItem as any)._id || (localItem as any).id;
                const localUserId = (localItem as any).userId;
                
                // Remove items from different users
                if (localUserId && localUserId !== userId) {
                  try {
                    const itemId = (localItem as any).id;
                    if (itemId) {
                      const numericId = typeof itemId === 'string' ? parseInt(itemId) : itemId;
                      if (!isNaN(numericId)) {
                        await deleteItem(storeName, numericId);
                      }
                    }
                  } catch (deleteError) {
                    // Ignore delete errors
                  }
                  continue;
                }
                
                // Normalize local ID to string for comparison
                const normalizedLocalId = localId ? String(localId) : null;
                if (normalizedLocalId && !serverIds.has(normalizedLocalId)) {
                  // Check if this is a temporary ID (very large number from generateUniqueId)
                  // Temporary IDs are typically > 1e15, server IDs are strings or smaller numbers
                  const isTemporaryId = typeof localId === 'number' && localId > 1e15;
                  if (isTemporaryId) {
                    // This is likely a temporary ID, check if it matches any server item by content
                    // (For now, we'll keep it if it doesn't match - it might be a pending sync)
                    continue;
                  }
                  
                  // Item doesn't exist on server and is not a temporary ID - delete it (product was deleted)
                  try {
                    // Use the numeric id that IndexedDB uses (not _id)
                    const itemId = (localItem as any).id;
                    if (itemId && typeof itemId === 'number') {
                      await deleteItem(storeName, itemId);
                      console.log(`[useApi] Removed deleted item from IndexedDB: ${itemId} (server ID: ${localId})`);
                    } else if (itemId) {
                      // Try to convert to number if it's a string
                      const numericId = typeof itemId === 'string' ? parseInt(itemId) : itemId;
                      if (!isNaN(numericId) && isFinite(numericId)) {
                        await deleteItem(storeName, numericId);
                        console.log(`[useApi] Removed deleted item from IndexedDB: ${numericId} (server ID: ${localId})`);
                      }
                    }
                  } catch (deleteError) {
                    // Log but don't fail - continue with other items
                    console.warn(`[useApi] Error removing deleted item from IndexedDB:`, deleteError);
                  }
                }
              }
              
              // Now add/update all server items with userId for data isolation
              for (const item of mappedItems) {
                const itemId = (item as any)._id || (item as any).id;
                if (itemId) {
                  // Add userId to item for data isolation
                  const itemWithUserId = {
                    ...item,
                    userId: userId
                  } as T;
                  
                  // Check if item already exists
                  const existingItem = existingItems.find((i: any) => {
                    const existingId = (i as any)._id || (i as any).id;
                    return existingId === itemId;
                  });
                  
                  if (existingItem) {
                    await updateItem(storeName, itemWithUserId);
                  } else {
                    await addItem(storeName, itemWithUserId);
                  }
                }
              }
              
              // Reload from IndexedDB to get the merged result, filtered by userId
              const allItems = await getAllItems<T>(storeName);
              const finalItems = allItems.filter((item: any) => {
                // Only include items that belong to current user
                if (item.userId !== undefined) {
                  return item.userId === userId;
                }
                // If no userId, exclude for security (shouldn't happen after this update)
                return false;
              });
              const finalMappedItems = finalItems.map(mapItem);
              
              setItems(finalMappedItems.length > 0 ? finalMappedItems : defaultValue);
            }
          }
          
          // Update last sync timestamp in localStorage
          localStorage.setItem("profit-pilot-last-sync", String(Date.now()));
        }
      } catch (apiError: any) {
        // For sales, show error if API fails (don't use stale IndexedDB data)
        if (isSalesEndpoint) {
          // logger.error(`[useApi] ✗ Failed to fetch sales from API:`, apiError);
          // logger.error(`[useApi] Error details:`, {
          //   message: apiError?.message,
          //   status: apiError?.status,
          //   response: apiError?.response,
          //   name: apiError?.name,
          // });
          
          // Show empty state or error state, don't use stale data
          if (apiError?.response?.connectionError || apiError?.response?.silent) {
            // logger.log("Sales: Connection error - cannot fetch from API");
            // Load from IndexedDB as fallback only if API completely fails
            const localItems = await getAllItems<T>(storeName);
            if (localItems.length > 0) {
              const mappedItems = localItems.map(mapItem);
              // Sort by timestamp (newest first)
              mappedItems.sort((a, b) => {
                const aTime = (a as any).timestamp || (a as any).date;
                const bTime = (b as any).timestamp || (b as any).date;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
              });
              setItems(mappedItems);
            } else {
              setItems(defaultValue);
            }
          } else if (apiError?.status === 401) {
            // logger.error("Sales: Authentication error - user needs to login");
            setItems(defaultValue);
          } else {
            // Other errors - show empty state but log the error
            // logger.error("Sales: API error - showing empty state:", apiError);
            setItems(defaultValue);
          }
        } else {
          // For other endpoints, silently fail if offline - data is already loaded from IndexedDB
          if (apiError?.response?.silent || apiError?.response?.connectionError) {
            // Connection error - use local data, don't show error
            // logger.log("Offline mode: using local data");
          } else {
            // Other errors - still use local data but log
            // logger.log("API error, using local data:", apiError);
          }
        }
      }
      
      // Calculate remaining time to meet minimum loading duration
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minLoadingTime - elapsed);
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }

      setIsLoading(false);
      hasErrorShownRef.current = false; // Reset error flag on success
    } catch (err) {
      // Calculate remaining time to meet minimum loading duration
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minLoadingTime - elapsed);
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
      
      const error = err instanceof Error ? err : new Error('Failed to load data');
      setError(error);
      
      // Only call onError if it's not a silent connection error
      if (onError && !hasErrorShownRef.current && !(error as any).silent) {
        onError(error);
        hasErrorShownRef.current = true;
      }
      
      // Fallback to default value on error
      setItems(defaultValue);
      setIsLoading(false);
    } finally {
      isLoadingDataRef.current = false;
    }
  }, [endpoint, defaultValue, mapItem, onError, syncManager]);

  // Load data on mount and when force refresh is requested
  useEffect(() => {
    loadData();
    
    // Listen for force refresh events (when caches are cleared)
    const handleForceRefresh = () => {
      console.log(`[useApi] Force refresh requested for ${endpoint}`);
      loadData();
    };
    
    window.addEventListener('force-refresh-data', handleForceRefresh);
    
    return () => {
      window.removeEventListener('force-refresh-data', handleForceRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Monitor userId changes and clear data if it changes (data isolation)
  useEffect(() => {
    const checkUserId = () => {
      const currentUserId = localStorage.getItem("profit-pilot-user-id");
      if (!currentUserId && items.length > 0) {
        // User logged out, clear data
        setItems(defaultValue);
      }
    };

    // Check on mount
    checkUserId();

    // Listen for storage changes (userId changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "profit-pilot-user-id") {
        checkUserId();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Also check periodically (in case localStorage is changed directly)
    const interval = setInterval(checkUserId, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [items, defaultValue]);

  // Add item - save to IndexedDB first, then sync with backend
  const add = useCallback(async (item: T): Promise<void> => {
    // Validate userId exists (data isolation)
    const userId = localStorage.getItem("profit-pilot-user-id");
    if (!userId) {
      throw new Error('User not authenticated. Please login.');
    }
    
    // Always save to IndexedDB first, even if offline - this ensures data is never lost
    // We'll try to sync to server, and if it fails, the item will remain in IndexedDB for later sync
    
    try {
      await initDB();
      const storeName = endpoint;
      
      // For all endpoints (including sales), save to IndexedDB first for immediate UI update
      // Then sync to server - this ensures items appear even if API call fails
      const isSalesEndpoint = endpoint === 'sales';
      let localId: any = null;
      let itemWithId: any = null;
      
      // Generate local ID if not present
      itemWithId = { ...item };
      if (!itemWithId.id && !itemWithId._id) {
        (itemWithId as any).id = generateUniqueId();
      }
      
      // Add userId for data isolation
      (itemWithId as any).userId = userId;
      
      // Ensure timestamp is present for sales (preserve if exists, add if missing)
      if (endpoint === 'sales' && !itemWithId.timestamp) {
        (itemWithId as any).timestamp = new Date().toISOString();
      }
      
      localId = (itemWithId as any).id || (itemWithId as any)._id;
      
      // Save to IndexedDB first (for immediate UI update)
      await addItem(storeName, itemWithId);
      
      // Update UI immediately
      const newItem = mapItem(itemWithId);
      setItems((prev) => [...prev, newItem]);
      
      // ALWAYS try to send to backend when online - this is the primary path
      const itemData = { ...item };
      delete (itemData as any).id;
      delete (itemData as any)._id;
      
      // Ensure timestamp is present for sales (preserve if exists, add if missing)
      if (endpoint === 'sales' && !itemData.timestamp) {
        (itemData as any).timestamp = new Date().toISOString();
      }
      
      // logger.log(`[useApi] Sending ${endpoint} to backend (online: ${navigator.onLine}):`, itemData);
      
      try {
        let response;
        if (endpoint === 'products') {
          response = await productApi.create(itemData);
        } else if (endpoint === 'sales') {
          // logger.log(`[useApi] Creating sale via DIRECT API call:`, itemData);
          // logger.log(`[useApi] Online status: ${navigator.onLine}`);
          // logger.log(`[useApi] API Base URL: ${import.meta.env.VITE_API_URL || 'https://profit-backend-e4w1.onrender.com/api'}`);
          
          // Direct API call - no offline storage, no syncing
          response = await saleApi.create(itemData);
          
          // logger.log(`[useApi] ✓ Sale API response received:`, response);
          if (!response || (!response.data && !response)) {
            throw new Error('Invalid response from sales API. No data received.');
          }
        } else if (endpoint === 'clients') {
          response = await clientApi.create(itemData);
        } else if (endpoint === 'schedules') {
          response = await scheduleApi.create(itemData);
        } else {
          throw new Error(`Unknown endpoint: ${endpoint}`);
        }

        // logger.log(`[useApi] Backend response received for ${endpoint}:`, response);
        // logger.log(`[useApi] Response structure:`, {
        //   hasData: !!response?.data,
        //   hasResponse: !!response,
        //   responseKeys: response ? Object.keys(response) : [],
        // });
        
        // Handle response - backend may return data in response.data or directly
        const responseData = response?.data || response;
        // logger.log(`[useApi] Extracted response data for ${endpoint}:`, responseData);
        
        if (!responseData) {
          // logger.error(`[useApi] ✗ No data in response for ${endpoint}:`, response);
          throw new Error(`Invalid API response: No data received from server for ${endpoint}`);
        }
        
        // logger.log(`[useApi] Processing response data for ${endpoint}:`, responseData);
        const syncedItem = mapItem(responseData);
        
        // Ensure timestamp is preserved for sales (use server timestamp if available, otherwise use original)
        if (endpoint === 'sales') {
          if (!syncedItem.timestamp && (item as any).timestamp) {
            (syncedItem as any).timestamp = (item as any).timestamp;
          } else if (!syncedItem.timestamp) {
            (syncedItem as any).timestamp = new Date().toISOString();
          }
        }
        
        // logger.log(`[useApi] Mapped synced item for ${endpoint}:`, syncedItem);
        
        // CRITICAL: If we got here, the backend call succeeded!
        // logger.log(`[useApi] ✓ Successfully sent ${endpoint} to backend via DIRECT API call!`);
        
        // For all endpoints, find and remove the local item with the temporary ID
          const existingItems = await getAllItems<T>(storeName);
          const localItemToRemove = existingItems.find((i) => {
            const currentId = (i as any)._id || (i as any).id;
            return currentId === localId;
          });
          
          // Remove the local item if it exists
          if (localItemToRemove) {
            const numericId = typeof localId === 'string' ? parseInt(localId) : localId;
            if (!isNaN(numericId)) {
              await deleteItem(storeName, numericId);
            }
          }
          
          // Add userId for data isolation
          const syncedItemWithUserId = {
            ...syncedItem,
            userId: userId
          } as T;
          
          // Add the synced item with server ID
          await addItem(storeName, syncedItemWithUserId);
          
          // Invalidate cache for this endpoint since data changed
          apiCache.invalidateStore(endpoint);
          localStorage.setItem(`profit-pilot-${endpoint}-changed`, "true");
          
          // Update UI - replace local item with synced item and remove duplicates
          setItems((prev) => {
          if (isSalesEndpoint) {
            // For sales, replace local item with server item or add if not found, then deduplicate
            const itemExists = prev.some((i) => {
              const currentId = (i as any)._id || (i as any).id;
              return currentId === localId;
            });
            
            let updated: T[];
            if (itemExists) {
              // Replace existing item
              updated = prev.map((i) => {
                const currentId = (i as any)._id || (i as any).id;
                return currentId === localId ? syncedItem : i;
              });
            } else {
              // Add new item if it doesn't exist (ensures immediate update)
              updated = [...prev, syncedItem];
            }
            
            // Deduplicate sales by content
              const seen = new Map<string, T>();
              for (const item of updated) {
                const sale = item as any;
                const dateStr = typeof sale.date === 'string' 
                  ? sale.date.split('T')[0] 
                  : new Date(sale.date).toISOString().split('T')[0];
                const key = `${sale.product}_${dateStr}_${sale.quantity}_${sale.revenue}`;
                
                if (seen.has(key)) {
                  const existing = seen.get(key)!;
                  const existingId = (existing as any)._id || (existing as any).id;
                  const currentId = (sale as any)._id || (sale as any).id;
                  
                  // Prefer server ID over temporary ID
                  const existingIsServerId = typeof existingId === 'string' || (typeof existingId === 'number' && existingId < 1e15);
                  const currentIsServerId = typeof currentId === 'string' || (typeof currentId === 'number' && currentId < 1e15);
                  
                  if (currentIsServerId && !existingIsServerId) {
                    seen.set(key, item);
                  }
                } else {
                  seen.set(key, item);
                }
              }
              const deduplicated = Array.from(seen.values());
              
              // Sort by timestamp (newest first) to ensure new sales appear at top
              deduplicated.sort((a, b) => {
                const aTime = (a as any).timestamp || (a as any).date;
                const bTime = (b as any).timestamp || (b as any).date;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
              });
              
              return deduplicated;
          } else {
            // For other endpoints, replace local item or add if not found
            const itemExists = prev.some((i) => {
              const currentId = (i as any)._id || (i as any).id;
              return currentId === localId;
            });
            
            if (itemExists) {
              return prev.map((i) => {
                const currentId = (i as any)._id || (i as any).id;
                return currentId === localId ? syncedItem : i;
              });
            } else {
              return [...prev, syncedItem];
            }
          }
        });
      } catch (apiError: any) {
        // Check if it's actually a connection/network error (not a server validation error)
        const isNetworkError = !navigator.onLine || 
                               apiError?.message?.includes('Failed to fetch') ||
                               apiError?.message?.includes('NetworkError') ||
                               apiError?.message?.includes('Network request failed') ||
                               apiError?.message?.includes('Cannot record sales while offline') ||
                               (apiError?.response?.connectionError === true);
        
        // For sales, queue for sync if it's a network error (item is already saved to IndexedDB)
        if (isSalesEndpoint && isNetworkError) {
          // Queue for sync - the item is already saved locally
          await syncManager.queueAction({
            type: "create",
            store: storeName,
            data: itemWithId,
          });
          // Throw a silent error so the UI can show success message
          const silentError: any = new Error("Sale saved locally. Will sync when online.");
          silentError.response = { silent: true, connectionError: true };
          throw silentError;
        }
        
        // For products, don't queue for sync - just throw the error
        if (endpoint === 'products') {
          throw apiError;
        }
        
        // For other endpoints, queue for sync if it's a REAL network/connection error
        if (isNetworkError) {
          // logger.log(`[useApi] Network error detected for ${endpoint}, queueing for sync:`, apiError);
          await syncManager.queueAction({
            type: "create",
            store: storeName,
            data: itemWithId,
          });
          // Throw a silent error so the UI can show success message
          const silentError: any = new Error("Item saved locally. Will sync when online.");
          silentError.response = { silent: true, connectionError: true };
          throw silentError;
        } else {
          // Real API error (validation, server error, etc.) - show error but item is saved locally
          // logger.error(`[useApi] API error for ${endpoint} (not network):`, apiError);
          // Don't queue for sync - this is a real error that needs to be fixed
          // The item is already saved locally, so user can retry
          throw apiError;
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add item');
      // Check if it's a silent connection error
      if ((error as any).response?.silent || (error as any).response?.connectionError) {
        // Re-throw as-is for UI handling
        throw error;
      }
      setError(error);
      // Don't show errors for connection issues
      if (onError && !(error as any).silent) {
        onError(error);
      }
      throw error;
    }
  }, [endpoint, mapItem, onError, syncManager]);

  // Update item - save to IndexedDB first, then sync with backend
  const update = useCallback(async (item: T): Promise<void> => {
    // Validate userId exists (data isolation)
    const userId = localStorage.getItem("profit-pilot-user-id");
    if (!userId) {
      throw new Error('User not authenticated. Please login.');
    }
    
    try {
      await initDB();
      const storeName = endpoint;
      const itemId = (item as any)._id || (item as any).id;
      if (!itemId) {
        throw new Error('Item ID is required for update');
      }

      // Add userId for data isolation
      const itemWithUserId = {
        ...item,
        userId: userId
      } as T;

      // Save to IndexedDB first (offline-first)
      await updateItem(storeName, itemWithUserId);
      
      // Update UI immediately
      const updatedItem = mapItem(item);
      setItems((prev) =>
        prev.map((i) => {
          const currentId = (i as any)._id || (i as any).id;
          return currentId === itemId ? updatedItem : i;
        })
      );

      // Try to sync with backend (silently fail if offline)
      const itemData = { ...item };
      delete (itemData as any).id;
      delete (itemData as any)._id;
      
      try {
        let response;
        if (endpoint === 'products') {
          response = await productApi.update(itemId.toString(), itemData);
        } else if (endpoint === 'sales') {
          response = await saleApi.update(itemId.toString(), itemData);
        } else if (endpoint === 'clients') {
          response = await clientApi.update(itemId.toString(), itemData);
        } else if (endpoint === 'schedules') {
          response = await scheduleApi.update(itemId.toString(), itemData);
        } else {
          throw new Error(`Unknown endpoint: ${endpoint}`);
        }

        if (response.data) {
          const syncedItem = mapItem(response.data);
          // Add userId for data isolation
          const syncedItemWithUserId = {
            ...syncedItem,
            userId: userId
          } as T;
          // Update IndexedDB with server response
          await updateItem(storeName, syncedItemWithUserId);
          
          // Invalidate cache for this endpoint since data changed
          apiCache.invalidateStore(endpoint);
          localStorage.setItem(`profit-pilot-${endpoint}-changed`, "true");
          
          // Update UI with synced item
          setItems((prev) =>
            prev.map((i) => {
              const currentId = (i as any)._id || (i as any).id;
              return currentId === itemId ? syncedItem : i;
            })
          );
        }
      } catch (apiError: any) {
        // For sales and products, don't queue for sync - just throw the error
        if (endpoint === 'sales' || endpoint === 'products') {
          throw apiError;
        }
        
        // Check if it's actually a connection/network error (not a server validation error)
        const isNetworkError = !navigator.onLine || 
                               apiError?.message?.includes('Failed to fetch') ||
                               apiError?.message?.includes('NetworkError') ||
                               apiError?.message?.includes('Network request failed') ||
                               (apiError?.response?.connectionError === true);
        
        // Only queue for sync if it's a REAL network/connection error (for non-sales, non-products endpoints)
        if (isNetworkError) {
          // logger.log(`[useApi] Network error detected for ${endpoint} update, queueing for sync:`, apiError);
          await syncManager.queueAction({
            type: "update",
            store: storeName,
            data: item,
          });
          // Throw a silent error so the UI can show success message
          const silentError: any = new Error("Item updated locally. Will sync when online.");
          silentError.response = { silent: true, connectionError: true };
          throw silentError;
        } else {
          // Real API error (validation, server error, etc.) - show error but item is saved locally
          // logger.error(`[useApi] API error for ${endpoint} update (not network):`, apiError);
          // Don't queue for sync - this is a real error that needs to be fixed
          throw apiError;
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update item');
      setError(error);
      // Don't show errors for connection issues
      if (onError && !(error as any).silent) {
        onError(error);
      }
      throw error;
    }
  }, [endpoint, mapItem, onError, syncManager]);

  // Remove item - delete from IndexedDB first, then sync with backend
  const remove = useCallback(async (item: T): Promise<void> => {
    // Validate userId exists (data isolation)
    const userId = localStorage.getItem("profit-pilot-user-id");
    if (!userId) {
      throw new Error('User not authenticated. Please login.');
    }
    
    try {
      await initDB();
      const storeName = endpoint;
      const itemId = (item as any)._id || (item as any).id;
      if (!itemId) {
        throw new Error('Item ID is required for delete');
      }

      // Delete from IndexedDB first (offline-first)
      const numericId = typeof itemId === 'string' ? parseInt(itemId) : itemId;
      if (!isNaN(numericId)) {
        await deleteItem(storeName, numericId);
      }
      
      // Update UI immediately
      setItems((prev) =>
        prev.filter((i) => {
          const currentId = (i as any)._id || (i as any).id;
          return currentId !== itemId;
        })
      );

      // Invalidate cache for this endpoint since data changed
      apiCache.invalidateStore(endpoint);
      localStorage.setItem(`profit-pilot-${endpoint}-changed`, "true");

      // Try to sync with backend (silently fail if offline)
      try {
        if (endpoint === 'products') {
          await productApi.delete(itemId.toString());
        } else if (endpoint === 'sales') {
          await saleApi.delete(itemId.toString());
        } else if (endpoint === 'clients') {
          await clientApi.delete(itemId.toString());
        } else if (endpoint === 'schedules') {
          await scheduleApi.delete(itemId.toString());
        } else {
          throw new Error(`Unknown endpoint: ${endpoint}`);
        }
        
        // Dispatch event to notify other components/pages to refresh after successful deletion
        if (endpoint === 'products') {
          window.dispatchEvent(new CustomEvent('products-should-refresh'));
        } else if (endpoint === 'sales') {
          window.dispatchEvent(new CustomEvent('sales-should-refresh'));
        }
      } catch (apiError: any) {
        // For sales and products, don't queue for sync - just log the error
        if (endpoint === 'sales' || endpoint === 'products') {
          // logger.error(`[useApi] API error for ${endpoint} delete:`, apiError);
          // Still dispatch event even if API call failed (item is already removed from UI)
          if (endpoint === 'products') {
            window.dispatchEvent(new CustomEvent('products-should-refresh'));
          } else if (endpoint === 'sales') {
            window.dispatchEvent(new CustomEvent('sales-should-refresh'));
          }
          return;
        }
        
        // Check if it's actually a connection/network error
        const isNetworkError = !navigator.onLine || 
                               apiError?.message?.includes('Failed to fetch') ||
                               apiError?.message?.includes('NetworkError') ||
                               apiError?.message?.includes('Network request failed') ||
                               (apiError?.response?.connectionError === true);
        
        // Only queue for sync if it's a REAL network/connection error (for non-sales, non-products endpoints)
        if (isNetworkError) {
          // logger.log(`[useApi] Network error detected for ${endpoint} delete, queueing for sync:`, apiError);
          await syncManager.queueAction({
            type: "delete",
            store: storeName,
            data: item,
          });
        } else {
          // Real API error - log but don't queue (item is already deleted locally)
          // logger.error(`[useApi] API error for ${endpoint} delete (not network):`, apiError);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete item');
      setError(error);
      // Don't show errors for connection issues
      if (onError && !(error as any).silent) {
        onError(error);
      }
      throw error;
    }
  }, [endpoint, onError, syncManager]);

  // Bulk add (for sales) - require online connection, no offline support
  const bulkAdd = useCallback(async (itemsToAdd: T[]): Promise<void> => {
    if (endpoint !== 'sales') {
      throw new Error('Bulk add is only available for sales');
    }

    // Validate userId exists (data isolation)
    const userId = localStorage.getItem("profit-pilot-user-id");
    if (!userId) {
      throw new Error('User not authenticated. Please login.');
    }

    // For sales, require online connection - no offline support
    if (!navigator.onLine) {
      const error: any = new Error('Cannot record sales while offline. Please check your internet connection.');
      error.response = { connectionError: true };
      throw error;
    }

    try {
      await initDB();
      const storeName = endpoint;
      
      // Don't save to IndexedDB first - only save after successful server response
      const itemsData = itemsToAdd.map((item) => {
        const itemData = { ...item };
        delete (itemData as any).id;
        delete (itemData as any)._id;
        
        // Ensure timestamp is present for each sale (preserve if exists, add if missing)
        if (!itemData.timestamp) {
          (itemData as any).timestamp = new Date().toISOString();
        }
        
        return itemData;
      });
      
      try {
        // logger.log(`[useApi] Attempting to send bulk sales via DIRECT API call:`, itemsData);
        // logger.log(`[useApi] Online status: ${navigator.onLine}`);
        // logger.log(`[useApi] API Base URL: ${import.meta.env.VITE_API_URL || 'https://profit-backend-e4w1.onrender.com/api'}`);
        
        // Direct API call - no offline storage, no syncing
        const response = await saleApi.createBulk(itemsData);
        
        // logger.log(`[useApi] ✓ Bulk sales API response received:`, response);
        if (!response || (!response.data && !response)) {
          throw new Error('Invalid response from bulk sales API. No data received.');
        }

        // Handle both response.data and direct response
        if (!response || (!response.data && !response)) {
          // logger.error(`[useApi] ✗ Invalid bulk response for ${endpoint}:`, response);
          throw new Error(`Invalid API response: No data received from server for bulk ${endpoint}`);
        }
        
          const responseData = response.data || response;
          // logger.log(`[useApi] Processing bulk response data for ${endpoint}:`, responseData);
        
        if (!responseData || (Array.isArray(responseData) && responseData.length === 0)) {
          // logger.error(`[useApi] ✗ Empty bulk response data for ${endpoint}:`, responseData);
          throw new Error(`Invalid API response: Empty data received from server for bulk ${endpoint}`);
        }
        
        const syncedItems = (Array.isArray(responseData) ? responseData : [responseData]).map((responseItem, index) => {
          const mapped = mapItem(responseItem);
          
          // Ensure timestamp is preserved for sales (use server timestamp if available, otherwise use original)
          if (!mapped.timestamp && itemsToAdd[index] && (itemsToAdd[index] as any).timestamp) {
            (mapped as any).timestamp = (itemsToAdd[index] as any).timestamp;
          } else if (!mapped.timestamp) {
            (mapped as any).timestamp = new Date().toISOString();
          }
          
          return mapped;
        });
        // logger.log(`[useApi] ✓ Successfully processed ${syncedItems.length} bulk sales from DIRECT API call`);
        
        // Add all synced items with server IDs and userId for data isolation
        for (const syncedItem of syncedItems) {
          const syncedItemWithUserId = {
            ...syncedItem,
            userId: userId
          } as T;
          await addItem(storeName, syncedItemWithUserId);
          }
          
          // Invalidate cache for this endpoint since data changed
          apiCache.invalidateStore(endpoint);
          localStorage.setItem(`profit-pilot-${endpoint}-changed`, "true");
          
        // Update UI - add synced items and remove duplicates
          setItems((prev) => {
          const updated = [...prev, ...syncedItems];
            
            // Deduplicate sales by content to remove any remaining duplicates
            const seen = new Map<string, T>();
            for (const item of updated) {
              const sale = item as any;
              const dateStr = typeof sale.date === 'string' 
                ? sale.date.split('T')[0] 
                : new Date(sale.date).toISOString().split('T')[0];
              const key = `${sale.product}_${dateStr}_${sale.quantity}_${sale.revenue}`;
              
              if (seen.has(key)) {
                const existing = seen.get(key)!;
                const existingId = (existing as any)._id || (existing as any).id;
                const currentId = (sale as any)._id || (sale as any).id;
                
                // Prefer server ID over temporary ID
                const existingIsServerId = typeof existingId === 'string' || (typeof existingId === 'number' && existingId < 1e15);
                const currentIsServerId = typeof currentId === 'string' || (typeof currentId === 'number' && currentId < 1e15);
                
                if (currentIsServerId && !existingIsServerId) {
                  seen.set(key, item);
                }
              } else {
                seen.set(key, item);
              }
            }
            const deduplicated = Array.from(seen.values());
            
            // Sort by timestamp (newest first) to ensure new sales appear at top
            deduplicated.sort((a, b) => {
              const aTime = (a as any).timestamp || (a as any).date;
              const bTime = (b as any).timestamp || (b as any).date;
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            });
            
            return deduplicated;
          });
      } catch (apiError: any) {
        // For sales, don't queue for sync - just throw the error
          throw apiError;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to bulk add items');
      setError(error);
      if (onError && !(error as any).silent) {
        onError(error);
      }
      throw error;
    }
  }, [endpoint, mapItem, onError, syncManager]);

  // Set items (for compatibility)
  const setItemsDirect = useCallback((newItems: T[]) => {
    setItems(newItems);
  }, []);

  // Rate limiting for refresh calls
  const lastRefreshTimeRef = useRef<number>(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const REFRESH_COOLDOWN = 3000; // 3 seconds minimum between refreshes

  // Refresh function that resets error state with rate limiting
  const refresh = useCallback(() => {
    // Don't refresh if already loading
    if (isLoadingDataRef.current) {
      return;
    }
    
    hasErrorShownRef.current = false;
    
    // Clear any pending refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
    
    if (timeSinceLastRefresh < REFRESH_COOLDOWN) {
      // Schedule refresh after cooldown period
      const remainingTime = REFRESH_COOLDOWN - timeSinceLastRefresh;
      refreshTimeoutRef.current = setTimeout(() => {
        // Check again if still not loading before executing
        if (!isLoadingDataRef.current) {
          lastRefreshTimeRef.current = Date.now();
          loadData();
        }
      }, remainingTime);
    } else {
      // Refresh immediately (loadData already checks isLoadingDataRef)
      lastRefreshTimeRef.current = Date.now();
      loadData();
    }
  }, [loadData]);

  return {
    items,
    isLoading,
    error,
    add,
    update,
    remove,
    bulkAdd,
    setItems: setItemsDirect,
    refresh,
  };
}
