// Hook to manage API data (replaces useLocalStorage for backend integration)
import { useState, useEffect, useCallback, useRef } from "react";
import { productApi, saleApi, clientApi, scheduleApi } from "@/lib/api";
import { SyncManager } from "@/lib/syncManager";
import { initDB, getAllItems, addItem, updateItem, deleteItem, getItem } from "@/lib/indexedDB";
import { generateUniqueId } from "@/lib/idGenerator";
import { apiCache } from "@/lib/apiCache";

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
      
      // Load from IndexedDB first (offline-first)
      const storeName = endpoint;
      const localItems = await getAllItems<T>(storeName);
      
      if (localItems.length > 0) {
        const mappedItems = localItems.map(mapItem);
        setItems(mappedItems);
        setIsLoading(false);
      }
      
      // Try to sync with backend (silently fail if offline)
      // Check cache first to reduce API requests
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

      try {
        let response;
        if (endpoint === 'products') {
          response = await productApi.getAll();
        } else if (endpoint === 'sales') {
          response = await saleApi.getAll();
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
          // Cache the response
          apiCache.set(cacheKey, response.data);
          // Clear the changed flag since we've synced
          localStorage.removeItem(`profit-pilot-${endpoint}-changed`);
          const mappedItems = response.data.map(mapItem);
          // Update IndexedDB with server data (merge with local data, prevent duplicates)
          const existingItems = await getAllItems<T>(storeName);
          const serverIds = new Set(mappedItems.map(i => (i as any)._id || (i as any).id));
          
          // For sales, match by content to find local items with temporary IDs
          if (storeName === 'sales') {
            // Find local items that match server items by content
            for (const localItem of existingItems) {
              const localSale = localItem as any;
              const localId = localSale._id || localSale.id;
              
              // Skip if this local item already has a server ID
              if (serverIds.has(localId)) {
                continue;
              }
              
              // Check if this local item matches any server item by content
              const matchingServerItem = mappedItems.find((serverItem: any) => {
                const serverSale = serverItem as any;
                return localSale.product === serverSale.product &&
                       localSale.date === serverSale.date &&
                       localSale.quantity === serverSale.quantity &&
                       Math.abs((localSale.revenue || 0) - (serverSale.revenue || 0)) < 0.01;
              });
              
              // If we found a match, remove the local item (server version will be added)
              if (matchingServerItem) {
                const numericId = typeof localId === 'string' ? parseInt(localId) : localId;
                if (!isNaN(numericId)) {
                  await deleteItem(storeName, numericId);
                }
              }
            }
          } else {
            // For other stores, use ID-based matching
            const existingIds = new Set(existingItems.map(i => (i as any).id || (i as any)._id));
            
            // Remove local items that don't exist on server (cleanup)
            for (const localItem of existingItems) {
              const localId = (localItem as any)._id || (localItem as any).id;
              if (localId && !serverIds.has(localId)) {
                // Check if this is a temporary ID (very large number from generateUniqueId)
                // Temporary IDs are typically > 1e15, server IDs are strings or smaller numbers
                const isTemporaryId = typeof localId === 'number' && localId > 1e15;
                if (isTemporaryId) {
                  // This is likely a temporary ID, check if it matches any server item by content
                  // (For now, we'll keep it if it doesn't match - it might be a pending sync)
                  continue;
                }
              }
            }
          }
          
          // Now add/update all server items
          for (const item of mappedItems) {
            const itemId = (item as any)._id || (item as any).id;
            if (itemId) {
              // Check if item already exists
              const existingItem = existingItems.find((i: any) => {
                const existingId = (i as any)._id || (i as any).id;
                return existingId === itemId;
              });
              
              if (existingItem) {
                await updateItem(storeName, item);
              } else {
                await addItem(storeName, item);
              }
            }
          }
          
          // Reload from IndexedDB to get the merged result
          const finalItems = await getAllItems<T>(storeName);
          const finalMappedItems = finalItems.map(mapItem);
          
          // Deduplicate sales by matching content (product, date, quantity, revenue)
          let deduplicatedItems = finalMappedItems;
          if (storeName === 'sales') {
            const seen = new Map<string, T>();
            for (const item of finalMappedItems) {
              const sale = item as any;
              // Create a unique key based on content
              const dateStr = typeof sale.date === 'string' 
                ? sale.date.split('T')[0] 
                : new Date(sale.date).toISOString().split('T')[0];
              const key = `${sale.product}_${dateStr}_${sale.quantity}_${sale.revenue}`;
              
              // If we've seen this key before, prefer the one with a server ID (_id)
              if (seen.has(key)) {
                const existing = seen.get(key)!;
                const existingId = (existing as any)._id || (existing as any).id;
                const currentId = (sale as any)._id || (sale as any).id;
                
                // Prefer server ID over temporary ID
                const existingIsServerId = typeof existingId === 'string' || (typeof existingId === 'number' && existingId < 1e15);
                const currentIsServerId = typeof currentId === 'string' || (typeof currentId === 'number' && currentId < 1e15);
                
                if (currentIsServerId && !existingIsServerId) {
                  // Current has server ID, existing doesn't - replace
                  seen.set(key, item);
                }
                // Otherwise keep existing
              } else {
                seen.set(key, item);
              }
            }
            deduplicatedItems = Array.from(seen.values());
          }
          
          setItems(deduplicatedItems.length > 0 ? deduplicatedItems : defaultValue);
          
          // Update last sync timestamp in localStorage
          localStorage.setItem("profit-pilot-last-sync", String(Date.now()));
        }
      } catch (apiError: any) {
        // Silently fail if offline - data is already loaded from IndexedDB
        if (apiError?.response?.silent || apiError?.response?.connectionError) {
          // Connection error - use local data, don't show error
          console.log("Offline mode: using local data");
        } else {
          // Other errors - still use local data but log
          console.log("API error, using local data:", apiError);
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

  // Load data on mount only
  useEffect(() => {
    loadData();
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
    
    // For sales, require online connection - no offline support
    if (endpoint === 'sales' && !navigator.onLine) {
      const error: any = new Error('Cannot record sales while offline. Please check your internet connection.');
      error.response = { connectionError: true };
      throw error;
    }
    
    try {
      await initDB();
      const storeName = endpoint;
      
      // For sales, don't save to IndexedDB first - only save after successful server response
      // For other endpoints, use offline-first approach
      const isSalesEndpoint = endpoint === 'sales';
      let localId: any = null;
      let itemWithId: any = null;
      
      if (!isSalesEndpoint) {
        // Generate local ID if not present
        itemWithId = { ...item };
        if (!itemWithId.id && !itemWithId._id) {
          (itemWithId as any).id = generateUniqueId();
        }
        localId = (itemWithId as any).id || (itemWithId as any)._id;
        
        // Save to IndexedDB first (offline-first)
        await addItem(storeName, itemWithId);
        
        // Update UI immediately
        const newItem = mapItem(itemWithId);
        setItems((prev) => [...prev, newItem]);
      }
      
      // ALWAYS try to send to backend when online - this is the primary path
      const itemData = { ...item };
      delete (itemData as any).id;
      delete (itemData as any)._id;
      
      console.log(`[useApi] Sending ${endpoint} to backend (online: ${navigator.onLine}):`, itemData);
      
      try {
        let response;
        if (endpoint === 'products') {
          response = await productApi.create(itemData);
        } else if (endpoint === 'sales') {
          console.log(`[useApi] Creating sale via API:`, itemData);
          response = await saleApi.create(itemData);
          console.log(`[useApi] Sale API response:`, response);
        } else if (endpoint === 'clients') {
          response = await clientApi.create(itemData);
        } else if (endpoint === 'schedules') {
          response = await scheduleApi.create(itemData);
        } else {
          throw new Error(`Unknown endpoint: ${endpoint}`);
        }

        console.log(`[useApi] Backend response received for ${endpoint}:`, response);
        console.log(`[useApi] Response structure:`, {
          hasData: !!response?.data,
          hasResponse: !!response,
          responseKeys: response ? Object.keys(response) : [],
        });
        
        // Handle response - backend may return data in response.data or directly
        const responseData = response?.data || response;
        console.log(`[useApi] Extracted response data for ${endpoint}:`, responseData);
        
        if (responseData) {
          console.log(`[useApi] Processing response data for ${endpoint}:`, responseData);
          const syncedItem = mapItem(responseData);
          console.log(`[useApi] Mapped synced item for ${endpoint}:`, syncedItem);
          
          // CRITICAL: If we got here, the backend call succeeded!
          console.log(`[useApi] ✓ Successfully sent ${endpoint} to backend!`);
          
          if (!isSalesEndpoint) {
            // For non-sales endpoints, find and remove the local item with the temporary ID
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
          }
          
          // Add the synced item with server ID
          await addItem(storeName, syncedItem);
          
          // Invalidate cache for this endpoint since data changed
          apiCache.invalidateStore(endpoint);
          localStorage.setItem(`profit-pilot-${endpoint}-changed`, "true");
          
          // Update UI - replace local item with synced item and remove duplicates
          setItems((prev) => {
            if (isSalesEndpoint) {
              // For sales, just add the new item
              const updated = [...prev, syncedItem];
              
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
              return Array.from(seen.values());
            } else {
              // For other endpoints, replace local item
              const updated = prev.map((i) => {
                const currentId = (i as any)._id || (i as any).id;
                return currentId === localId ? syncedItem : i;
              });
              return updated;
            }
          });
        }
      } catch (apiError: any) {
        // For sales, don't queue for sync - just throw the error
        if (isSalesEndpoint) {
          // Remove any local item that might have been added (shouldn't happen, but safety check)
          throw apiError;
        }
        
        // Check if it's actually a connection/network error (not a server validation error)
        const isNetworkError = !navigator.onLine || 
                               apiError?.message?.includes('Failed to fetch') ||
                               apiError?.message?.includes('NetworkError') ||
                               apiError?.message?.includes('Network request failed') ||
                               (apiError?.response?.connectionError === true);
        
        // Only queue for sync if it's a REAL network/connection error (for non-sales endpoints)
        if (isNetworkError) {
          console.log(`[useApi] Network error detected for ${endpoint}, queueing for sync:`, apiError);
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
          console.error(`[useApi] API error for ${endpoint} (not network):`, apiError);
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

      // Save to IndexedDB first (offline-first)
      await updateItem(storeName, item);
      
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
          // Update IndexedDB with server response
          await updateItem(storeName, syncedItem);
          
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
        // Check if it's actually a connection/network error (not a server validation error)
        const isNetworkError = !navigator.onLine || 
                               apiError?.message?.includes('Failed to fetch') ||
                               apiError?.message?.includes('NetworkError') ||
                               apiError?.message?.includes('Network request failed') ||
                               (apiError?.response?.connectionError === true);
        
        // Only queue for sync if it's a REAL network/connection error
        if (isNetworkError) {
          console.log(`[useApi] Network error detected for ${endpoint} update, queueing for sync:`, apiError);
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
          console.error(`[useApi] API error for ${endpoint} update (not network):`, apiError);
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
      } catch (apiError: any) {
        // Check if it's actually a connection/network error
        const isNetworkError = !navigator.onLine || 
                               apiError?.message?.includes('Failed to fetch') ||
                               apiError?.message?.includes('NetworkError') ||
                               apiError?.message?.includes('Network request failed') ||
                               (apiError?.response?.connectionError === true);
        
        // Only queue for sync if it's a REAL network/connection error
        if (isNetworkError) {
          console.log(`[useApi] Network error detected for ${endpoint} delete, queueing for sync:`, apiError);
          await syncManager.queueAction({
            type: "delete",
            store: storeName,
            data: item,
          });
        } else {
          // Real API error - log but don't queue (item is already deleted locally)
          console.error(`[useApi] API error for ${endpoint} delete (not network):`, apiError);
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
        return itemData;
      });
      
      try {
        console.log(`[useApi] Attempting to send bulk ${endpoint} to backend:`, itemsData);
        console.log(`[useApi] Online status:`, navigator.onLine);
        const response = await saleApi.createBulk(itemsData);
        console.log(`[useApi] Backend response for bulk ${endpoint}:`, response);

        // Handle both response.data and direct response
        if (response?.data || response) {
          const responseData = response.data || response;
          console.log(`[useApi] Processing bulk response data for ${endpoint}:`, responseData);
          const syncedItems = (Array.isArray(responseData) ? responseData : [responseData]).map(mapItem);
          
          // Add all synced items with server IDs
          for (const syncedItem of syncedItems) {
            await addItem(storeName, syncedItem);
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
            return Array.from(seen.values());
          });
        }
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

  // Refresh function that resets error state
  // Use a debounce to prevent multiple rapid refreshes
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refresh = useCallback(() => {
    hasErrorShownRef.current = false;
    
    // Clear any pending refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    
    // Debounce refresh by 500ms to prevent rapid successive calls
    refreshTimeoutRef.current = setTimeout(() => {
      loadData();
      refreshTimeoutRef.current = null;
    }, 500);
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
