import { useState, useEffect } from "react";
import { Bell, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notificationService } from "@/lib/notifications";
import { cn } from "@/lib/utils";

interface NotificationPermissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPermissionGranted?: () => void;
}

export function NotificationPermissionModal({
  open,
  onOpenChange,
  onPermissionGranted,
}: NotificationPermissionModalProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (open) {
      setPermissionStatus(notificationService.getPermission());
    }
  }, [open]);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const permission = await notificationService.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        // Show a test notification
        await notificationService.showNotification('general', {
          title: 'Notifications Enabled!',
          body: 'You will now receive important updates from Trippo.',
          icon: '/logo.png',
          tag: 'permission-granted',
        });
        
        onPermissionGranted?.();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDecline = () => {
    onOpenChange(false);
    // Store that user declined
    try {
      localStorage.setItem('profit-pilot-notification-declined', 'true');
    } catch (error) {
      console.error('Error saving decline status:', error);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-300">
      <div className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 backdrop-blur-xl rounded-2xl shadow-2xl p-6 max-w-md mx-4 border-0 overflow-hidden animate-slide-down-fade">
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
        
        {/* Close button */}
        <button
          onClick={handleDecline}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-all duration-200 z-10"
        >
          <X size={18} />
        </button>

        <div className="relative z-10">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl shadow-lg">
              <Bell className="text-white" size={32} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Enable Notifications
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-600 text-center mb-6 leading-relaxed">
            Stay updated with important alerts even when you're not using Trippo.
          </p>

          {/* Benefits list */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-gray-900">Low Stock Alerts</p>
                <p className="text-xs text-gray-600">Get notified before products run out</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-gray-900">Schedule Reminders</p>
                <p className="text-xs text-gray-600">Never miss important appointments</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-gray-900">New User Notifications</p>
                <p className="text-xs text-gray-600">Admins get alerts for new registrations</p>
              </div>
            </div>
          </div>

          {/* Permission status */}
          {permissionStatus === 'denied' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-900">Notifications are blocked</p>
                <p className="text-xs text-red-700 mt-1">
                  Please enable notifications in your browser settings to receive alerts.
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleRequestPermission}
              disabled={isRequesting || permissionStatus === 'granted'}
              className={cn(
                "flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold",
                permissionStatus === 'granted' && "opacity-50 cursor-not-allowed"
              )}
            >
              {isRequesting ? (
                'Requesting...'
              ) : permissionStatus === 'granted' ? (
                <>
                  <CheckCircle2 size={16} className="mr-2" />
                  Enabled
                </>
              ) : (
                <>
                  <Bell size={16} className="mr-2" />
                  Enable Notifications
                </>
              )}
            </Button>
            <Button
              onClick={handleDecline}
              variant="ghost"
              className="flex-1 rounded-full hover:bg-gray-100/80 transition-all duration-200 font-medium"
            >
              Not Now
            </Button>
          </div>

          {/* Privacy note */}
          <p className="text-xs text-gray-500 text-center mt-4">
            We respect your privacy. Notifications are only sent for important business updates.
          </p>
        </div>
      </div>
    </div>
  );
}
