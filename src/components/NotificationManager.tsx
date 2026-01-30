// Notification Manager Component
// Handles notification permission checks and background notification setup

import { useState, useEffect, useRef } from 'react';
import { notificationService } from '@/lib/notifications';
import { useNotifications } from '@/hooks/useNotifications';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { backgroundSyncManager } from '@/lib/backgroundSync';
import { notificationStore } from '@/lib/notificationStore';

export function NotificationManager() {
  const { user } = useCurrentUser();
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Initialize notification checks (only if permission is granted)
  useNotifications();

  // Clear notifications when user changes
  useEffect(() => {
    const currentUserId = localStorage.getItem('profit-pilot-user-id');
    
    if (currentUserId && lastUserIdRef.current && lastUserIdRef.current !== currentUserId) {
      console.log('[NotificationManager] User changed, clearing old notifications');
      notificationStore.clearForUser(lastUserIdRef.current);
    }
    
    if (!currentUserId && lastUserIdRef.current) {
      // User logged out
      console.log('[NotificationManager] User logged out, clearing notifications');
      notificationStore.clearAll();
    }
    
    lastUserIdRef.current = currentUserId;
  }, [user]);

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

  // ✅ Poll service worker to check notifications every 60 seconds while app is open
  // This ensures stale notifications get closed quickly when stock changes
  useEffect(() => {
    if (!notificationService.isAllowed() || !user) {
      return;
    }

    // Trigger notification check using the background sync manager
    const triggerNotificationCheck = async () => {
      try {
        await backgroundSyncManager.requestNotificationCheck();
      } catch (error) {
        console.error('Error triggering notification check:', error);
      }
    };

    // Check immediately on mount
    triggerNotificationCheck();

    // Then check every 15 minutes while app is open (reduced frequency to avoid too many API calls)
    // Service worker handles background checks, so we don't need frequent polling here
    const interval = setInterval(() => {
      triggerNotificationCheck();
    }, 15 * 60 * 1000); // 15 minutes instead of 5 minutes

    // ✅ Also listen for product update events to trigger immediate check
    const handleProductUpdate = () => {
      triggerNotificationCheck();
    };

    window.addEventListener('products-should-refresh', handleProductUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('products-should-refresh', handleProductUpdate);
    };
  }, [user]);

  // No custom modal UI – rely entirely on the browser's system notification prompt
  return null;
}
