import { useState, useEffect } from "react";
import { Bell, ArrowLeft, CheckCheck, ChevronDown, Package, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { StockUpdateDialog } from "@/components/StockUpdateDialog";
import { useApi } from "@/hooks/useApi";

interface MobileHeaderProps {
  onNotificationClick?: () => void;
}

interface Product {
  id?: number;
  _id?: string;
  name: string;
  stock: number;
  minStock?: number;
}

export function MobileHeader({ onNotificationClick }: MobileHeaderProps) {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<StoredNotification | null>(null);
  const [stockUpdateDialogOpen, setStockUpdateDialogOpen] = useState(false);
  
  const {
    items: products,
    refresh: refreshProducts,
  } = useApi<Product>({
    endpoint: "products",
    defaultValue: [],
  });

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

  // Get first name only
  const getFirstName = () => {
    if (user?.name) {
      return user.name.split(" ")[0];
    }
    return "User";
  };

  // Load notifications and listen for updates
  useEffect(() => {
    const loadNotifications = () => {
      // Get notifications filtered by current user
      const allNotifications = notificationStore.getAllNotifications();
      setNotifications(allNotifications);
      setUnreadCount(notificationStore.getUnreadCount());
    };

    // Load notifications when component mounts or user changes
    loadNotifications();

    // Listen for notification updates
    const handleNotificationUpdate = () => {
      loadNotifications();
    };

    window.addEventListener('notifications-updated', handleNotificationUpdate);
    
    // Also listen for storage changes (user login/logout)
    const handleStorageChange = () => {
      const currentUserId = localStorage.getItem('profit-pilot-user-id');
      if (currentUserId) {
        // User logged in - reload notifications for this user
        loadNotifications();
      } else {
        // User logged out - clear notifications
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('notifications-updated', handleNotificationUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]); // Re-run when user changes

  const handleNotificationBellClick = () => {
    setNotificationOpen(!notificationOpen);
    setSelectedNotification(null); // Reset selected notification when opening/closing
    onNotificationClick?.();
  };

  const handleMarkAsRead = (notificationId: string) => {
    notificationStore.markAsRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    notificationStore.markAllAsRead();
  };

  const handleNotificationClick = (notification: StoredNotification) => {
    handleMarkAsRead(notification.id);
    setSelectedNotification(notification);
  };

  const handleBackToList = () => {
    setSelectedNotification(null);
  };

  const handleUpdateStock = () => {
    if (selectedNotification?.data?.productId) {
      setStockUpdateDialogOpen(true);
    }
  };

  const handleStockUpdated = () => {
    setStockUpdateDialogOpen(false);
    setSelectedNotification(null);
    refreshProducts();
    // Reload notifications to update the list
    const allNotifications = notificationStore.getAllNotifications();
    setNotifications(allNotifications);
    setUnreadCount(notificationStore.getUnreadCount());
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
    <header className="fixed top-0 left-0 right-0 h-16 bg-blue-900 border-0 flex items-center justify-between px-4 z-50 lg:hidden shadow-sm">
      {/* Left side - Account Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10 rounded-full border border-blue-700 flex-shrink-0">
          <AvatarFallback className="bg-blue-700 text-white font-bold">
            {getUserInitials()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-blue-200">Hi,</span>
            <span className="text-sm font-semibold text-white truncate">
              {getFirstName()}
            </span>
            <ChevronDown 
              className="h-4 w-4 text-white flex-shrink-0 cursor-pointer hover:text-blue-200" 
              onClick={() => navigate("/settings")}
            />
          </div>
          {user?.businessName && (
            <span className="text-xs text-blue-200 truncate">
              {user.businessName}
            </span>
          )}
        </div>
      </div>

      {/* Right side - Notification Bell */}
      <div className="flex-shrink-0 ml-2">
        <button
          onClick={handleNotificationBellClick}
          className={cn(
            "relative p-2 rounded-full transition-colors",
            notificationService.isAllowed()
              ? "text-white hover:bg-blue-800"
              : "text-blue-300"
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
                {selectedNotification ? (
                  /* Notification Detail View */
                  <div className="space-y-4">
                    {/* Back Button */}
                    <button
                      onClick={handleBackToList}
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
                    >
                      <ArrowLeft size={18} />
                      <span className="text-sm font-medium">Back</span>
                    </button>

                    {/* Notification Details */}
                    <div className={cn(
                      "p-4 rounded-lg border",
                      selectedNotification.read
                        ? "bg-white border-gray-200"
                        : "bg-blue-50 border-blue-200"
                    )}>
                      <div className="flex items-start gap-3 mb-4">
                        <div className={cn(
                          "p-2 rounded-lg",
                          selectedNotification.type === 'low_stock' ? "bg-orange-100" : "bg-blue-100"
                        )}>
                          {selectedNotification.type === 'low_stock' ? (
                            <AlertTriangle size={20} className="text-orange-600" />
                          ) : (
                            <Bell size={20} className="text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-gray-900">
                              {selectedNotification.title}
                            </h3>
                            {!selectedNotification.read && (
                              <span className="h-2 w-2 bg-blue-600 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {selectedNotification.body}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatTime(selectedNotification.timestamp)}
                          </p>
                        </div>
                      </div>

                      {/* Actions for Low Stock Notifications */}
                      {selectedNotification.type === 'low_stock' && selectedNotification.data?.productId && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Package size={16} className="text-gray-500" />
                              <span>
                                <strong>Product:</strong> {selectedNotification.data.productName || 'Unknown Product'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <span>
                                <strong>Current Stock:</strong> {selectedNotification.data.currentStock ?? 0}
                              </span>
                            </div>
                            {selectedNotification.data.minStock !== undefined && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <span>
                                  <strong>Minimum Stock:</strong> {selectedNotification.data.minStock}
                                </span>
                              </div>
                            )}
                            <Button
                              onClick={handleUpdateStock}
                              className="w-full bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Package size={16} className="mr-2" />
                              Update Stock
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Action for other notification types */}
                      {selectedNotification.type !== 'low_stock' && selectedNotification.data?.route && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <Button
                            onClick={() => {
                              navigate(selectedNotification.data.route);
                              setNotificationOpen(false);
                              setSelectedNotification(null);
                            }}
                            className="w-full bg-blue-600 text-white hover:bg-blue-700"
                          >
                            View Details
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : notifications.length === 0 ? (
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
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Back Icon on Left */}
                          <ArrowLeft size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Stock Update Dialog */}
            {selectedNotification?.type === 'low_stock' && selectedNotification.data?.productId && (
              <StockUpdateDialog
                productId={selectedNotification.data.productId}
                productName={selectedNotification.data.productName}
                currentStock={selectedNotification.data.currentStock}
                open={stockUpdateDialogOpen}
                onOpenChange={(open) => {
                  setStockUpdateDialogOpen(open);
                  if (!open) {
                    handleStockUpdated();
                  }
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
