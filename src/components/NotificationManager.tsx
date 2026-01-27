// Notification Manager Component
// Handles notification permission checks and background notification setup

import { useState, useEffect } from 'react';
import { notificationService } from '@/lib/notifications';
import { useNotifications } from '@/hooks/useNotifications';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { backgroundSyncManager } from '@/lib/backgroundSync';

export function NotificationManager() {
  const { user } = useCurrentUser();
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);

  // Initialize notification checks (only if permission is granted)
  useNotifications();

  // Ask for permission using the browser's system notification prompt
  useEffect(() => {
    if (!user || hasCheckedPermission) return;

    const permission = notificationService.checkPermission();

    if (permission === 'default') {
      const timer = setTimeout(async () => {
        try {
          const result = await notificationService.requestPermission();

          if (result === 'granted') {
            // Register background sync for background notifications
            await backgroundSyncManager.registerPeriodicSync();

            // Send userId to service worker
            const userId = localStorage.getItem('profit-pilot-user-id');
            await backgroundSyncManager.sendUserIdToServiceWorker(userId);
          }
        } finally {
          setHasCheckedPermission(true);
        }
      }, 3000); // Wait 3 seconds after login

      return () => clearTimeout(timer);
    } else {
      setHasCheckedPermission(true);
    }
  }, [user, hasCheckedPermission]);

  // Set up background sync when permission is already granted
  useEffect(() => {
    if (notificationService.isAllowed() && user) {
      backgroundSyncManager.registerPeriodicSync();

      const userId = localStorage.getItem('profit-pilot-user-id');
      backgroundSyncManager.sendUserIdToServiceWorker(userId);
    }
  }, [user]);

  // No custom modal UI – rely entirely on the browser's system notification prompt
  return null;
}
