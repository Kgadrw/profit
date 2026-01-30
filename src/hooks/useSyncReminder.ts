// Hook to remind users to sync when back online after offline operations

import { useEffect, useRef } from 'react';
import { notificationService } from '@/lib/notifications';
import { SyncManager, getSyncStatus } from '@/lib/syncManager';

export function useSyncReminder() {
  const hasNotifiedRef = useRef(false);
  const isSyncingRef = useRef(false);
  const syncManagerRef = useRef(SyncManager.getInstance());

  useEffect(() => {
    const handleOnline = async () => {
      // Wait a bit for network to stabilize
      setTimeout(async () => {
        try {
          const status = await getSyncStatus();
          
          // If there are pending syncs
          if (status.pending > 0 && !isSyncingRef.current) {
            isSyncingRef.current = true;
            
            // Try to sync automatically
            try {
              await syncManagerRef.current.syncAll();
              
              // Check status again after sync attempt
              const newStatus = await getSyncStatus();
              
              // If sync failed (still have pending items)
              if (newStatus.pending > 0 && !hasNotifiedRef.current) {
                // Check if notification permission is granted
                if (notificationService.isAllowed()) {
                  await notificationService.showNotification('general', {
                    title: 'Sync Failed',
                    body: `Failed to sync ${newStatus.pending} pending change${newStatus.pending !== 1 ? 's' : ''}. Please sync manually.`,
                    icon: '/logo.png',
                    tag: 'sync-failed-reminder',
                    requireInteraction: true,
                    data: {
                      route: '/settings',
                      type: 'sync_reminder',
                      pendingCount: newStatus.pending,
                    },
                  });
                  
                  hasNotifiedRef.current = true;
                  
                  // Reset after 5 minutes to allow another reminder if needed
                  setTimeout(() => {
                    hasNotifiedRef.current = false;
                  }, 5 * 60 * 1000);
                }
              } else if (newStatus.pending === 0) {
                // Sync succeeded
                if (notificationService.isAllowed()) {
                  await notificationService.showNotification('general', {
                    title: 'Sync Complete',
                    body: 'All pending changes have been synced successfully.',
                    icon: '/logo.png',
                    tag: 'sync-success',
                    requireInteraction: false,
                    data: {
                      route: '/settings',
                      type: 'sync_success',
                    },
                  });
                }
              }
            } catch (syncError) {
              // Sync failed, notify user
              console.error('Auto-sync failed:', syncError);
              
              if (notificationService.isAllowed() && !hasNotifiedRef.current) {
                await notificationService.showNotification('general', {
                  title: 'Sync Failed',
                  body: `Failed to sync ${status.pending} pending change${status.pending !== 1 ? 's' : ''}. Please sync manually.`,
                  icon: '/logo.png',
                  tag: 'sync-failed-reminder',
                  requireInteraction: true,
                  data: {
                    route: '/settings',
                    type: 'sync_reminder',
                    pendingCount: status.pending,
                  },
                });
                
                hasNotifiedRef.current = true;
                
                setTimeout(() => {
                  hasNotifiedRef.current = false;
                }, 5 * 60 * 1000);
              }
            } finally {
              isSyncingRef.current = false;
            }
          }
        } catch (error) {
          console.error('Error checking sync status for reminder:', error);
          isSyncingRef.current = false;
        }
      }, 2000); // Wait 2 seconds after coming online
    };

    // Only set up listener if we're currently online (to catch when we come back online)
    if (navigator.onLine) {
      // Check immediately if we're already online
      handleOnline();
    }

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Also check periodically for pending syncs when online
  useEffect(() => {
    // Always set up the effect, but only run logic if online
    if (!navigator.onLine) {
      // Return empty cleanup if offline
      return () => {};
    }

    const checkPendingSyncs = async () => {
      try {
        const status = await getSyncStatus();
        if (status.pending > 0 && !isSyncingRef.current && !hasNotifiedRef.current) {
          // Try to sync automatically
          isSyncingRef.current = true;
          try {
            await syncManagerRef.current.syncAll();
            
            // Check status again after sync attempt
            const newStatus = await getSyncStatus();
            
            // If sync failed (still have pending items)
            if (newStatus.pending > 0) {
              if (notificationService.isAllowed()) {
                await notificationService.showNotification('general', {
                  title: 'Sync Failed',
                  body: `Failed to sync ${newStatus.pending} pending change${newStatus.pending !== 1 ? 's' : ''}. Please sync manually.`,
                  icon: '/logo.png',
                  tag: 'sync-failed-reminder',
                  requireInteraction: true,
                  data: {
                    route: '/settings',
                    type: 'sync_reminder',
                    pendingCount: newStatus.pending,
                  },
                });
                
                hasNotifiedRef.current = true;
                
                setTimeout(() => {
                  hasNotifiedRef.current = false;
                }, 5 * 60 * 1000);
              }
            }
          } catch (syncError) {
            console.error('Periodic sync failed:', syncError);
            
            if (notificationService.isAllowed()) {
              await notificationService.showNotification('general', {
                title: 'Sync Failed',
                body: `Failed to sync ${status.pending} pending change${status.pending !== 1 ? 's' : ''}. Please sync manually.`,
                icon: '/logo.png',
                tag: 'sync-failed-reminder',
                requireInteraction: true,
                data: {
                  route: '/settings',
                  type: 'sync_reminder',
                  pendingCount: status.pending,
                },
              });
              
              hasNotifiedRef.current = true;
              
              setTimeout(() => {
                hasNotifiedRef.current = false;
              }, 5 * 60 * 1000);
            }
          } finally {
            isSyncingRef.current = false;
          }
        }
      } catch (error) {
        console.error('Error checking pending syncs:', error);
        isSyncingRef.current = false;
      }
    };

    // Check every 15 minutes when online (reduced frequency to avoid too many API calls)
    const interval = setInterval(checkPendingSyncs, 15 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);
}
