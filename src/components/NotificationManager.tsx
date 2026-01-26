// Notification Manager Component
// Handles notification permission requests and manages notification checks

import { useState, useEffect } from 'react';
import { NotificationPermissionModal } from './NotificationPermissionModal';
import { notificationService } from '@/lib/notifications';
import { useNotifications } from '@/hooks/useNotifications';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { backgroundSyncManager } from '@/lib/backgroundSync';

export function NotificationManager() {
  const { user } = useCurrentUser();
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);

  // Initialize notification checks (only if permission is granted)
  useNotifications();

  useEffect(() => {
    if (!user || hasCheckedPermission) return;

    // Check if user previously declined
    const previouslyDeclined = localStorage.getItem('profit-pilot-notification-declined') === 'true';
    
    // Check current permission status
    const permission = notificationService.checkPermission();

    // Show modal if:
    // 1. Permission is default (not yet requested)
    // 2. User hasn't previously declined
    // 3. Wait a bit after login (3 seconds) to not interrupt user flow
    if (permission === 'default' && !previouslyDeclined) {
      const timer = setTimeout(() => {
        setShowPermissionModal(true);
        setHasCheckedPermission(true);
      }, 3000); // Wait 3 seconds after login

      return () => clearTimeout(timer);
    } else {
      setHasCheckedPermission(true);
    }
  }, [user, hasCheckedPermission]);

  // Set up background sync when permission is granted
  useEffect(() => {
    if (notificationService.isAllowed() && user) {
      // Register periodic background sync
      backgroundSyncManager.registerPeriodicSync();
      
      // Send userId to service worker
      const userId = localStorage.getItem('profit-pilot-user-id');
      backgroundSyncManager.sendUserIdToServiceWorker(userId);
    }
  }, [user, notificationService.isAllowed()]);

  const handlePermissionGranted = async () => {
    setShowPermissionModal(false);
    // Clear any previous decline status
    localStorage.removeItem('profit-pilot-notification-declined');
    
    // Register background sync for background notifications
    await backgroundSyncManager.registerPeriodicSync();
    
    // Send userId to service worker
    const userId = localStorage.getItem('profit-pilot-user-id');
    await backgroundSyncManager.sendUserIdToServiceWorker(userId);
  };

  return (
    <NotificationPermissionModal
      open={showPermissionModal}
      onOpenChange={setShowPermissionModal}
      onPermissionGranted={handlePermissionGranted}
    />
  );
}
