// Sync Manager for handling offline changes and auto-sync

import { addItem, updateItem, deleteItem, getAllItems, clearStore } from "./indexedDB";
import { productApi, saleApi, clientApi, scheduleApi } from "./api";

export interface SyncAction {
  id?: number;
  type: "create" | "update" | "delete";
  store: string;
  data: any;
  timestamp: number;
  synced: boolean;
}

export class SyncManager {
  private static instance: SyncManager;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;

  private constructor() {
    this.setupOnlineOfflineListeners();
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private setupOnlineOfflineListeners() {
    const handleOnline = () => {
      this.isOnline = true;
      // Small delay to ensure network is fully restored
      setTimeout(() => {
        this.syncAll().catch((error) => {
          console.log("Auto-sync on network restore failed:", error);
        });
      }, 1000);
    };

    const handleOffline = () => {
      this.isOnline = false;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Also check periodically if we're online (in case event listeners don't fire)
    setInterval(() => {
      const currentlyOnline = navigator.onLine;
      if (currentlyOnline && !this.isOnline) {
        // Network was restored but event didn't fire
        handleOnline();
      } else if (!currentlyOnline && this.isOnline) {
        // Network was lost but event didn't fire
        handleOffline();
      }
    }, 5000); // Check every 5 seconds
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  // Add action to sync queue
  public async queueAction(action: Omit<SyncAction, "id" | "timestamp" | "synced">): Promise<void> {
    const syncAction: SyncAction = {
      ...action,
      timestamp: Date.now(),
      synced: false,
    };

    // Always queue first to get an ID (for syncQueue, ID is auto-generated)
    const queuedAction = await addItem<SyncAction>("syncQueue", syncAction);
    
    // If online, try to sync immediately
    if (this.isOnline && queuedAction.id) {
      try {
        await this.syncAction(queuedAction);
        // Mark as synced after successful sync
        await this.markAsSynced(queuedAction.id);
        return;
      } catch (error) {
        console.log("Failed to sync immediately, will retry later:", error);
      }
    }
  }

  // Sync a single action
  private async syncAction(action: SyncAction): Promise<void> {
    // Sync with backend API
    try {
      const itemData = { ...action.data };
      const localId = (itemData as any)._id || (itemData as any).id;
      // Remove id if it exists (backend will generate _id)
      delete (itemData as any).id;
      delete (itemData as any)._id;

      console.log(`[SyncManager] Syncing ${action.type} action for ${action.store}:`, itemData);

      let response: any = null;

      switch (action.type) {
        case "create":
          if (action.store === "products") {
            // Products should not be synced - they require online connection
            throw new Error("Products cannot be synced offline. Please create products when online.");
          } else if (action.store === "sales") {
            // Sales should not be synced - they require online connection
            throw new Error("Sales cannot be synced offline. Please record sales when online.");
          } else if (action.store === "clients") {
            response = await clientApi.create(itemData);
          } else if (action.store === "schedules") {
            response = await scheduleApi.create(itemData);
          }
          if (!response) {
            throw new Error(`No response from ${action.store} create API`);
          }
          console.log(`[SyncManager] Create response for ${action.store}:`, response);
          break;
        case "update":
          const itemId = action.data._id || action.data.id;
          if (!itemId) {
            throw new Error("Item ID is required for update");
          }
          if (action.store === "products") {
            // Products should not be synced - they require online connection
            throw new Error("Products cannot be synced offline. Please update products when online.");
          } else if (action.store === "sales") {
            // Sales should not be synced - they require online connection
            throw new Error("Sales cannot be synced offline. Please update sales when online.");
          } else if (action.store === "clients") {
            response = await clientApi.update(itemId.toString(), itemData);
          } else if (action.store === "schedules") {
            response = await scheduleApi.update(itemId.toString(), itemData);
          }
          if (!response) {
            throw new Error(`No response from ${action.store} update API`);
          }
          console.log(`[SyncManager] Update response for ${action.store}:`, response);
          break;
        case "delete":
          const deleteId = action.data._id || action.data.id;
          if (!deleteId) {
            throw new Error("Item ID is required for delete");
          }
          if (action.store === "products") {
            // Products should not be synced - they require online connection
            throw new Error("Products cannot be synced offline. Please delete products when online.");
          } else if (action.store === "sales") {
            // Sales should not be synced - they require online connection
            throw new Error("Sales cannot be synced offline. Please delete sales when online.");
          } else if (action.store === "clients") {
            response = await clientApi.delete(deleteId.toString());
          } else if (action.store === "schedules") {
            response = await scheduleApi.delete(deleteId.toString());
          }
          console.log(`[SyncManager] Delete response for ${action.store}:`, response);
          break;
      }

      // Update IndexedDB with server response for create/update operations
      if (response && (action.type === "create" || action.type === "update")) {
        // Handle both response.data and direct response
        const syncedItem = response.data || response;
        if (!syncedItem) {
          console.warn(`[SyncManager] No data in response for ${action.store} ${action.type}`);
          throw new Error(`No data returned from ${action.store} ${action.type} API`);
        }
        
        // Map _id to id for compatibility
        if (syncedItem._id && !syncedItem.id) {
          syncedItem.id = syncedItem._id;
        }
        
        console.log(`[SyncManager] Updating IndexedDB with synced item for ${action.store}:`, syncedItem);
        
          // For create operations, find and remove the local item with temporary ID
          if (action.type === "create") {
            const existingItems = await getAllItems(action.store);
            // Try to find the local item by matching the original local ID stored in action.data
            const originalLocalId = (action.data as any)._id || (action.data as any).id;
            const matchingLocalItem = existingItems.find((localItem: any) => {
              const currentId = (localItem as any)._id || (localItem as any).id;
              return currentId === originalLocalId;
            });
            
            if (matchingLocalItem) {
              // Remove the local item with temporary ID
              const localId = (matchingLocalItem as any)._id || (matchingLocalItem as any).id;
              const numericId = typeof localId === 'string' ? parseInt(localId) : localId;
              if (!isNaN(numericId)) {
                await deleteItem(action.store, numericId);
              }
            }
          }
        
        // Add/update the synced item with server ID
        await updateItem(action.store, syncedItem);
      }

      // Mark as synced if it has an id (was queued)
      if (action.id !== undefined) {
        await this.markAsSynced(action.id);
      }
    } catch (error: any) {
      // If sync fails, it's okay - data is already saved locally in IndexedDB
      // Log detailed error for debugging
      console.error(`[SyncManager] Sync action failed for ${action.type} ${action.store}:`, {
        error,
        errorMessage: error?.message,
        errorResponse: error?.response,
        actionData: action.data,
        isConnectionError: error?.response?.connectionError || error?.response?.silent,
      });
      
      // Only throw if it's not a connection error (connection errors will be retried)
      if (!error?.response?.connectionError && !error?.response?.silent) {
        throw error; // Re-throw so it can be retried later
      }
      // For connection errors, don't throw - they'll be retried when online
      throw error; // Still throw to mark as failed for retry
    }
  }

  // Mark action as synced
  private async markAsSynced(actionId: number): Promise<void> {
    try {
      const action = await getAllItems<SyncAction>("syncQueue");
      const toUpdate = action.find((a) => a.id === actionId);
      if (toUpdate) {
        toUpdate.synced = true;
        await updateItem("syncQueue", toUpdate);
      }
    } catch (error) {
      console.error("Error marking as synced:", error);
    }
  }

  // Sync all pending actions
  public async syncAll(): Promise<void> {
    // Double-check online status
    if (!navigator.onLine) {
      this.isOnline = false;
      return;
    }

    if (this.syncInProgress) {
      return;
    }

    this.isOnline = true;
    this.syncInProgress = true;

    try {
      const queue = await getAllItems<SyncAction>("syncQueue");
      // Filter out products and sales from sync queue - they require online connection
      const pendingActions = queue.filter((action) => 
        !action.synced && 
        action.store !== "products" && 
        action.store !== "sales"
      );

      // Remove products and sales from sync queue (mark as synced to skip them)
      const productsAndSalesActions = queue.filter((action) => 
        !action.synced && 
        (action.store === "products" || action.store === "sales")
      );
      
      if (productsAndSalesActions.length > 0) {
        console.log(`[SyncManager] Removing ${productsAndSalesActions.length} product/sales actions from sync queue (not supported)`);
        for (const action of productsAndSalesActions) {
          if (action.id !== undefined) {
            await this.markAsSynced(action.id);
          }
        }
      }

      if (pendingActions.length === 0) {
        return; // Nothing to sync
      }

      console.log(`[SyncManager] Syncing ${pendingActions.length} pending action(s)...`);

      let successCount = 0;
      let failCount = 0;

      for (const action of pendingActions) {
        try {
          // Check online status before each sync
          if (!navigator.onLine) {
            this.isOnline = false;
            console.warn(`[SyncManager] Network lost, stopping sync. ${successCount} succeeded, ${failCount} failed.`);
            break; // Stop syncing if network is lost
          }
          await this.syncAction(action);
          // Mark as synced after successful sync
          if (action.id !== undefined) {
            await this.markAsSynced(action.id);
          }
          successCount++;
          console.log(`[SyncManager] ✓ Successfully synced ${action.type} action for ${action.store} (ID: ${action.id})`);
        } catch (error: any) {
          failCount++;
          // Only log if it's not a connection error (connection errors are expected when offline)
          if (!error?.response?.connectionError && !error?.response?.silent) {
            console.error(`[SyncManager] ✗ Failed to sync action ${action.id} (${action.type} ${action.store}), will retry later:`, error);
          } else {
            console.log(`[SyncManager] Connection error for action ${action.id}, will retry when online`);
          }
          // Continue with next action instead of stopping
        }
      }

      console.log(`[SyncManager] Sync complete: ${successCount} succeeded, ${failCount} failed out of ${pendingActions.length} total`);
      
      // Dispatch event to notify UI to refresh
      if (successCount > 0) {
        window.dispatchEvent(new CustomEvent('sync-complete', { 
          detail: { successCount, failCount, total: pendingActions.length } 
        }));
      }

      // Clean up synced actions (keep last 100 for debugging)
      const allActions = await getAllItems<SyncAction>("syncQueue");
      const syncedActions = allActions.filter((a) => a.synced);
      if (syncedActions.length > 100) {
        const toKeep = syncedActions.slice(-100);
        await clearStore("syncQueue");
        for (const action of toKeep) {
          await addItem("syncQueue", action);
        }
      }
    } catch (error) {
      console.error("Error during sync:", error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Get sync status
  public async getSyncStatus(): Promise<{ pending: number; lastSync: number | null }> {
    try {
      const queue = await getAllItems<SyncAction>("syncQueue");
      const pending = queue.filter((a) => !a.synced).length;
      const synced = queue.filter((a) => a.synced);
      const lastSync = synced.length > 0 
        ? Math.max(...synced.map((a) => a.timestamp)) 
        : null;

      return { pending, lastSync };
    } catch (error) {
      console.error("Error getting sync status:", error);
      return { pending: 0, lastSync: null };
    }
  }
}

// Export getSyncStatus function for use in hooks
export async function getSyncStatus(): Promise<{ pending: number; lastSync: number | null }> {
  const syncManager = SyncManager.getInstance();
  return syncManager.getSyncStatus();
}
