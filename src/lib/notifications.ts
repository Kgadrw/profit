// Notification Service for Browser Notifications
// Handles permission requests, notification display, and notification management

export type NotificationType = 'new_user' | 'low_stock' | 'schedule' | 'new_sale' | 'new_product' | 'general';

export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string; // Used to replace existing notifications with same tag
  requireInteraction?: boolean;
  silent?: boolean;
  data?: any; // Additional data for notification click handling
}

class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';
  private notificationPermissionKey = 'profit-pilot-notification-permission';
  private lastNotificationTimes: Map<string, number> = new Map();
  private notificationDebounceTime = 5000; // 5 seconds between same notifications

  private constructor() {
    this.permission = this.getStoredPermission();
    this.checkPermission();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Check current notification permission status
   */
  public checkPermission(): NotificationPermission {
    if ('Notification' in window) {
      this.permission = Notification.permission;
      this.savePermission();
    } else {
      this.permission = 'denied';
      console.warn('Browser does not support notifications');
    }
    return this.permission;
  }

  /**
   * Request notification permission from user
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      this.savePermission();
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      this.permission = 'denied';
      return 'denied';
    }
  }

  /**
   * Check if notifications are allowed
   */
  public isAllowed(): boolean {
    return this.permission === 'granted';
  }

  /**
   * Check if permission was previously denied
   */
  public isDenied(): boolean {
    return this.permission === 'denied';
  }

  /**
   * Check if permission needs to be requested
   */
  public needsPermission(): boolean {
    return this.permission === 'default';
  }

  /**
   * Show a notification (prefers service worker for background support)
   */
  public async showNotification(
    type: NotificationType,
    data: NotificationData
  ): Promise<void> {
    if (!this.isAllowed()) {
      console.warn('Notifications not allowed. Permission:', this.permission);
      return;
    }

    // Check debounce - prevent duplicate notifications
    const notificationKey = `${type}-${data.tag || data.title}`;
    const lastTime = this.lastNotificationTimes.get(notificationKey);
    const now = Date.now();

    if (lastTime && now - lastTime < this.notificationDebounceTime) {
      console.log('Notification debounced:', notificationKey);
      return;
    }

    this.lastNotificationTimes.set(notificationKey, now);

    try {
      // Try to use service worker for background notifications
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        // Send notification to service worker (works even when app is closed)
        registration.active?.postMessage({
          type: 'SHOW_NOTIFICATION',
          notification: {
            title: data.title,
            body: data.body,
            icon: data.icon || '/logo.png',
            badge: data.badge || '/logo.png',
            tag: data.tag || notificationKey,
            requireInteraction: data.requireInteraction || false,
            silent: data.silent || false,
            data: data.data || {},
          },
        });

        // Also show directly as fallback
        await registration.showNotification(data.title, {
          body: data.body,
          icon: data.icon || '/logo.png',
          badge: data.badge || '/logo.png',
          tag: data.tag || notificationKey,
          requireInteraction: data.requireInteraction || false,
          silent: data.silent || false,
          data: data.data || {},
        });
      } else {
        // Fallback to regular Notification API
        const notificationOptions: NotificationOptions = {
          body: data.body,
          icon: data.icon || '/logo.png',
          badge: data.badge || '/logo.png',
          tag: data.tag || notificationKey,
          requireInteraction: data.requireInteraction || false,
          silent: data.silent || false,
          data: data.data || {},
        };

        const notification = new Notification(data.title, notificationOptions);

        // Handle notification click
        notification.onclick = (event) => {
          event.preventDefault();
          window.focus();
          
          // Handle navigation if data contains route
          if (data.data?.route) {
            window.location.href = data.data.route;
          }
          
          notification.close();
        };

        // Auto-close after 5 seconds (unless requireInteraction is true)
        if (!data.requireInteraction) {
          setTimeout(() => {
            notification.close();
          }, 5000);
        }
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Show notification for new user registration (admin)
   */
  public async notifyNewUser(userName: string, userEmail: string): Promise<void> {
    await this.showNotification('new_user', {
      title: 'New User Registered',
      body: `${userName} (${userEmail}) has just registered`,
      icon: '/logo.png',
      tag: 'new-user',
      requireInteraction: true,
      data: {
        route: '/admin',
        type: 'new_user',
      },
    });
  }

  /**
   * Show notification for low stock
   */
  public async notifyLowStock(
    productName: string,
    currentStock: number,
    minStock: number
  ): Promise<void> {
    await this.showNotification('low_stock', {
      title: 'Low Stock Alert',
      body: `${productName} is running low (${currentStock} left, minimum: ${minStock})`,
      icon: '/logo.png',
      tag: `low-stock-${productName}`,
      requireInteraction: false,
      data: {
        route: '/products',
        type: 'low_stock',
        productName,
      },
    });
  }

  /**
   * Show notification for upcoming schedule
   */
  public async notifySchedule(
    scheduleTitle: string,
    dueDate: string,
    clientName?: string
  ): Promise<void> {
    const clientText = clientName ? ` for ${clientName}` : '';
    await this.showNotification('schedule', {
      title: 'Upcoming Schedule',
      body: `${scheduleTitle}${clientText} is due on ${new Date(dueDate).toLocaleDateString()}`,
      icon: '/logo.png',
      tag: `schedule-${scheduleTitle}`,
      requireInteraction: true,
      data: {
        route: '/schedules',
        type: 'schedule',
        scheduleTitle,
      },
    });
  }

  /**
   * Show notification for new sale recorded
   */
  public async notifyNewSale(
    productName: string,
    quantity: number,
    revenue: number
  ): Promise<void> {
    await this.showNotification('new_sale', {
      title: 'Sale Recorded',
      body: `${quantity} ${quantity === 1 ? 'item' : 'items'} of ${productName} sold for rwf ${revenue.toLocaleString()}`,
      icon: '/logo.png',
      tag: `sale-${Date.now()}`,
      requireInteraction: false,
      data: {
        route: '/sales',
        type: 'new_sale',
        productName,
      },
    });
  }

  /**
   * Show notification for new product added
   */
  public async notifyNewProduct(
    productName: string,
    category?: string
  ): Promise<void> {
    const categoryText = category ? ` (${category})` : '';
    await this.showNotification('new_product', {
      title: 'New Product Added',
      body: `${productName}${categoryText} has been added to your inventory`,
      icon: '/logo.png',
      tag: `product-${productName}`,
      requireInteraction: false,
      data: {
        route: '/products',
        type: 'new_product',
        productName,
      },
    });
  }

  /**
   * Clear all notifications with a specific tag
   */
  public clearNotifications(tag: string): void {
    if ('serviceWorker' in navigator && 'getNotifications' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.getNotifications({ tag }).then((notifications) => {
          notifications.forEach((notification) => notification.close());
        });
      });
    }
  }

  /**
   * Get current permission status
   */
  public getPermission(): NotificationPermission {
    return this.permission;
  }

  /**
   * Save permission to localStorage
   */
  private savePermission(): void {
    try {
      localStorage.setItem(this.notificationPermissionKey, this.permission);
    } catch (error) {
      console.error('Error saving notification permission:', error);
    }
  }

  /**
   * Get stored permission from localStorage
   */
  private getStoredPermission(): NotificationPermission {
    try {
      const stored = localStorage.getItem(this.notificationPermissionKey);
      if (stored && ['default', 'granted', 'denied'].includes(stored)) {
        return stored as NotificationPermission;
      }
    } catch (error) {
      console.error('Error reading notification permission:', error);
    }
    return 'default';
  }
}

export const notificationService = NotificationService.getInstance();
