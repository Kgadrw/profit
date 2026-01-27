import { useState, useEffect } from "react";
import { Bell, X, Trash2, CheckCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { notificationService } from "@/lib/notifications";
import { notificationStore, StoredNotification } from "@/lib/notificationStore";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MobileHeaderProps {
  onNotificationClick?: () => void;
}

export function MobileHeader({ onNotificationClick }: MobileHeaderProps) {
  const { user } = useCurrentUser();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.name) {
      const names = user.name.split(" ");
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  // Load notifications and listen for updates
  useEffect(() => {
    const loadNotifications = () => {
      const allNotifications = notificationStore.getAllNotifications();
      setNotifications(allNotifications);
      setUnreadCount(notificationStore.getUnreadCount());
    };

    loadNotifications();

    // Listen for notification updates
    const handleNotificationUpdate = () => {
      loadNotifications();
    };

    window.addEventListener('notifications-updated', handleNotificationUpdate);
    return () => {
      window.removeEventListener('notifications-updated', handleNotificationUpdate);
    };
  }, []);

  const handleNotificationClick = () => {
    setNotificationOpen(!notificationOpen);
    onNotificationClick?.();
  };

  const handleMarkAsRead = (notificationId: string) => {
    notificationStore.markAsRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    notificationStore.markAllAsRead();
  };

  const handleDeleteNotification = (notificationId: string) => {
    notificationStore.deleteNotification(notificationId);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-0 flex items-center justify-between px-4 z-50 lg:hidden rounded-3xl m-2 shadow-sm">
      {/* Left side - Account Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10 rounded-full border border-blue-600 flex-shrink-0">
          <AvatarFallback className="bg-white text-blue-600 font-bold">
            {getUserInitials()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-600">Hi,</span>
            <span className="text-sm font-semibold text-gray-900 truncate">
              {user?.name || "User"}
            </span>
          </div>
          {user?.businessName && (
            <span className="text-xs text-gray-500 truncate">
              {user.businessName}
            </span>
          )}
        </div>
      </div>

      {/* Right side - Notification Bell */}
      <div className="flex-shrink-0 ml-2">
        <button
          onClick={handleNotificationClick}
          className={cn(
            "relative p-2 rounded-full transition-colors",
            notificationService.isAllowed()
              ? "text-gray-700 hover:bg-gray-100"
              : "text-gray-400"
          )}
        >
          <Bell size={22} />
          {/* Notification indicator dot */}
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
            </span>
          )}
        </button>

        {/* Notification Sheet Modal */}
        <Sheet open={notificationOpen} onOpenChange={setNotificationOpen}>
          <SheetContent side="right" className="w-full sm:w-[400px] p-0">
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-xl font-bold">Notifications</SheetTitle>
                {notifications.length > 0 && unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    <CheckCheck size={14} className="mr-1" />
                    Mark all read
                  </Button>
                )}
              </div>
              <SheetDescription className="text-xs text-gray-500">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                  : notifications.length > 0
                  ? 'All caught up!'
                  : 'No notifications yet'}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-120px)]">
              <div className="px-4 py-4">
                {notifications.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600 mb-1">No notifications</p>
                    <p className="text-xs text-gray-500">
                      You'll see alerts here when they arrive
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-4 rounded-lg border transition-colors cursor-pointer",
                          notification.read
                            ? "bg-white border-gray-200"
                            : "bg-blue-50 border-blue-200"
                        )}
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <span className="h-2 w-2 bg-blue-600 rounded-full flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                              {notification.body}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {formatTime(notification.timestamp)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNotification(notification.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
