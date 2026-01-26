// Notification Manager Component
// Handles notification permission requests and manages notification checks

import { useState, useEffect } from 'react';
import { NotificationPermissionModal } from './NotificationPermissionModal';
import { notificationService } from '@/lib/notifications';
import { useNotifications } from '@/hooks/useNotifications';
import { useCurrentUser } from '@/hooks/useCurrentUser';

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

  const handlePermissionGranted = () => {
    setShowPermissionModal(false);
    // Clear any previous decline status
    localStorage.removeItem('profit-pilot-notification-declined');
  };

  return (
    <NotificationPermissionModal
      open={showPermissionModal}
      onOpenChange={setShowPermissionModal}
      onPermissionGranted={handlePermissionGranted}
    />
  );
}
