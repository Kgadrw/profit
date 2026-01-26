// Background Sync utility for periodic notification checks
// Enables notifications to work even when the app is closed

export class BackgroundSyncManager {
  private static instance: BackgroundSyncManager;
  private syncRegistration: ServiceWorkerRegistration | null = null;
  private periodicSyncSupported = false;

  private constructor() {
    this.init();
  }

  public static getInstance(): BackgroundSyncManager {
    if (!BackgroundSyncManager.instance) {
      BackgroundSyncManager.instance = new BackgroundSyncManager();
    }
    return BackgroundSyncManager.instance;
  }

  private async init() {
    if ('serviceWorker' in navigator) {
      try {
        this.syncRegistration = await navigator.serviceWorker.ready;
        
        // Check for Periodic Background Sync support
        if ('periodicSync' in this.syncRegistration) {
          this.periodicSyncSupported = true;
          console.log('Periodic Background Sync is supported');
        } else {
          console.log('Periodic Background Sync not supported, using Background Sync API');
        }
      } catch (error) {
        console.error('Error initializing background sync:', error);
      }
    }
  }

  /**
   * Register periodic background sync for notifications
   */
  public async registerPeriodicSync(): Promise<boolean> {
    if (!this.syncRegistration) {
      await this.init();
    }

    if (!this.syncRegistration) {
      return false;
    }

    try {
      if (this.periodicSyncSupported && 'periodicSync' in this.syncRegistration) {
        // Register periodic sync (checks every hour)
        await (this.syncRegistration as any).periodicSync.register('notification-check', {
          minInterval: 60 * 60 * 1000, // 1 hour minimum
        });
        console.log('Periodic background sync registered');
        return true;
      } else {
        // Fallback: Use Background Sync API
        await this.registerBackgroundSync();
        return true;
      }
    } catch (error) {
      console.error('Error registering periodic sync:', error);
      // Fallback to background sync
      return await this.registerBackgroundSync();
    }
  }

  /**
   * Register background sync (fallback for browsers without periodic sync)
   */
  private async registerBackgroundSync(): Promise<boolean> {
    if (!this.syncRegistration) {
      return false;
    }

    try {
      if ('sync' in this.syncRegistration) {
        await (this.syncRegistration as any).sync.register('background-notification-check');
        console.log('Background sync registered');
        return true;
      }
    } catch (error) {
      console.error('Error registering background sync:', error);
    }

    return false;
  }

  /**
   * Send userId to service worker for background checks
   */
  public async sendUserIdToServiceWorker(userId: string | null): Promise<void> {
    if (!this.syncRegistration) {
      await this.init();
    }

    if (this.syncRegistration?.active) {
      this.syncRegistration.active.postMessage({
        type: 'SET_USER_ID',
        userId,
      });
    }
  }

  /**
   * Request immediate notification check from service worker
   */
  public async requestNotificationCheck(): Promise<void> {
    if (!this.syncRegistration) {
      await this.init();
    }

    if (this.syncRegistration?.active) {
      this.syncRegistration.active.postMessage({
        type: 'CHECK_NOTIFICATIONS',
      });
    }
  }

  /**
   * Unregister periodic sync
   */
  public async unregisterPeriodicSync(): Promise<void> {
    if (!this.syncRegistration) {
      return;
    }

    try {
      if (this.periodicSyncSupported && 'periodicSync' in this.syncRegistration) {
        await (this.syncRegistration as any).periodicSync.unregister('notification-check');
        console.log('Periodic background sync unregistered');
      }
    } catch (error) {
      console.error('Error unregistering periodic sync:', error);
    }
  }
}

export const backgroundSyncManager = BackgroundSyncManager.getInstance();
