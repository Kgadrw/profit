// Hook for managing notifications based on user role and data changes

import { useEffect, useRef } from 'react';
import { notificationService } from '@/lib/notifications';
import { useCurrentUser } from './useCurrentUser';
import { useApi } from './useApi';
import { adminApi } from '@/lib/api';
import { backgroundSyncManager } from '@/lib/backgroundSync';

interface Product {
  id?: number;
  _id?: string;
  name: string;
  stock: number;
  minStock?: number;
  manufacturedDate?: string;
  expiryDate?: string;
}

interface Schedule {
  id?: number;
  _id?: string;
  title: string;
  dueDate: string | Date;
  clientId?: string | any;
  notifyUser: boolean;
  advanceNotificationDays: number;
  status: 'pending' | 'completed' | 'cancelled';
}

interface Sale {
  id?: number;
  _id?: string;
  product: string;
  quantity: number;
  revenue: number;
  date: string | Date;
  createdAt?: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

/**
 * Hook for admin to check for new user registrations
 */
export function useAdminNotifications() {
  const { user } = useCurrentUser();
  const lastCheckedUsers = useRef<Set<string>>(new Set());
  const checkInterval = useRef<NodeJS.Timeout | null>(null);
  const isAdmin = localStorage.getItem('profit-pilot-is-admin') === 'true';

  useEffect(() => {
    if (!isAdmin || !user || !notificationService.isAllowed()) {
      return;
    }

    // Send userId to service worker for background checks
    const userId = localStorage.getItem('profit-pilot-user-id');
    backgroundSyncManager.sendUserIdToServiceWorker(userId);

    // Initial check
    checkNewUsers();

    // Check every 10 minutes for new users (reduced frequency to avoid too many API calls)
    // Admin dashboard already loads users, so we don't need frequent polling here
    checkInterval.current = setInterval(() => {
      checkNewUsers();
    }, 10 * 60 * 1000); // 10 minutes instead of 2 minutes

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, [isAdmin, user]);

  const checkNewUsers = async () => {
    try {
      const response = await adminApi.getAllUsers();
      if (response.data && Array.isArray(response.data)) {
        const users = response.data as User[];
        
        // Find new users (not in lastCheckedUsers)
        const newUsers = users.filter(
          (u) => !lastCheckedUsers.current.has(u._id)
        );

        // Notify about new users
        for (const newUser of newUsers) {
          // Only notify if user was created in the last 5 minutes (to avoid old data)
          const createdAt = new Date(newUser.createdAt);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          
          if (createdAt > fiveMinutesAgo) {
            await notificationService.notifyNewUser(
              newUser.name,
              newUser.email
            );
          }
          
          lastCheckedUsers.current.add(newUser._id);
        }

        // Update the set to only keep recent users (prevent memory leak)
        if (lastCheckedUsers.current.size > 100) {
          const userIds = new Set(users.map((u) => u._id));
          lastCheckedUsers.current = userIds;
        }
      }
    } catch (error) {
      console.error('Error checking for new users:', error);
    }
  };
}

/**
 * Hook for users to check for low stock products
 */
export function useLowStockNotifications() {
  const { user } = useCurrentUser();
  const lastNotifiedProducts = useRef<Set<string>>(new Set());
  const checkInterval = useRef<NodeJS.Timeout | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const isAdmin = localStorage.getItem('profit-pilot-is-admin') === 'true';
  const userId = localStorage.getItem('profit-pilot-user-id');

  const {
    items: products,
    isLoading,
    refresh: refreshProducts,
  } = useApi<Product>({
    endpoint: 'products',
    defaultValue: [],
  });

  // Clear notification tracking when user changes
  useEffect(() => {
    if (userId && lastUserIdRef.current && lastUserIdRef.current !== userId) {
      console.log('[Notifications] User changed, clearing notification tracking');
      lastNotifiedProducts.current.clear();
    }
    lastUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    // Wait for user to be loaded
    if (!user || !userId || isAdmin || !notificationService.isAllowed()) {
      // Clear tracking if user logged out
      if (!userId && lastNotifiedProducts.current.size > 0) {
        lastNotifiedProducts.current.clear();
      }
      return;
    }

    // Send userId to service worker for background checks
    backgroundSyncManager.sendUserIdToServiceWorker(userId);

    // Wait for products to load before initial check
    // Add extra delay to ensure user data and products are fully loaded from database
    if (!isLoading && products && user) {
      // Longer delay to ensure all data is loaded from database
      const timer = setTimeout(() => {
        // Double-check user is still logged in before checking
        const currentUserId = localStorage.getItem('profit-pilot-user-id');
        if (currentUserId === userId) {
          checkLowStock();
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user, isAdmin, products, userId, isLoading]);

  useEffect(() => {
    if (!user || !userId || isAdmin || !notificationService.isAllowed()) {
      return;
    }

    // Check every 10 minutes for low stock (reduced frequency to avoid too many API calls)
    // Service worker handles background checks, so we don't need frequent polling here
    // Don't call refreshProducts() - useApi already manages products and will refresh when needed
    checkInterval.current = setInterval(() => {
      // Use existing products from useApi (no additional API call needed)
      // Products are already being refreshed by useApi hook with proper caching
      checkLowStock();
    }, 10 * 60 * 1000); // 10 minutes - products are already managed by useApi

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, [user, isAdmin, userId]); // Removed refreshProducts dependency - we don't need to refresh

  const checkLowStock = async () => {
    // Verify user is still logged in
    const currentUserId = localStorage.getItem('profit-pilot-user-id');
    if (!currentUserId || currentUserId !== userId) {
      console.log('[Notifications] User changed or logged out, skipping low stock check');
      return;
    }

    // First verify products exist and are loaded
    if (!products || products.length === 0) {
      console.log('[Notifications] No products found, skipping low stock check');
      return;
    }

    // Verify we have valid product data (not just empty array)
    const validProducts = products.filter(p => 
      p && 
      (p._id || p.id) && 
      p.name && 
      typeof p.stock === 'number'
    );

    if (validProducts.length === 0) {
      console.log('[Notifications] No valid products found, skipping low stock check');
      return;
    }

    console.log(`[Notifications] Checking ${validProducts.length} products for low stock (user: ${userId})`);

    for (const product of validProducts) {
      const productId = product._id || product.id?.toString() || '';
      const minStock = product.minStock || 0;
      const currentStock = product.stock || 0;
      const expiryDateStr = (product as any).expiryDate as string | undefined;
      let isExpiringSoon = false;

      if (expiryDateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiryDate = new Date(expiryDateStr);
        expiryDate.setHours(0, 0, 0, 0);

        const diffMs = expiryDate.getTime() - today.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        // Consider "expiring soon" if expiry is within the next 30 days (and not already expired)
        if (diffDays >= 0 && diffDays <= 30) {
          isExpiringSoon = true;
        }
      }

      // Verify product data is valid before checking stock
      if (!product.name || typeof currentStock !== 'number' || isNaN(currentStock)) {
        console.warn(`[Notifications] Invalid product data for ${productId}, skipping`);
        continue;
      }

      // Notify if stock equals minStock (exact match) OR stock is below minStock OR stock is 0 (out of stock)
      // OR if product is expiring soon (within 30 days)
      // This mostly matches the LowStockAlert component logic, with added expiry check
      if (currentStock === minStock || currentStock < minStock || currentStock === 0 || isExpiringSoon) {
        // Only notify if we haven't notified about this product recently
        if (!lastNotifiedProducts.current.has(productId)) {
          console.log(`[Notifications] Sending low stock notification for ${product.name} (stock: ${currentStock}, min: ${minStock})`);
          await notificationService.notifyLowStock(
            product.name,
            currentStock,
            minStock,
            productId // Pass productId for quick update functionality
          );
          lastNotifiedProducts.current.add(productId);
        }
      } else if (currentStock > minStock && !isExpiringSoon) {
        // Remove from notified set if stock is back above minStock
        // and product is not expiring soon anymore
        lastNotifiedProducts.current.delete(productId);
      }
    }
  };
}

/**
 * Hook for users to check for upcoming schedules
 */
export function useScheduleNotifications() {
  const { user } = useCurrentUser();
  const lastNotifiedSchedules = useRef<Set<string>>(new Set());
  const checkInterval = useRef<NodeJS.Timeout | null>(null);
  const isAdmin = localStorage.getItem('profit-pilot-is-admin') === 'true';
  const userId = localStorage.getItem('profit-pilot-user-id');

  const {
    items: schedules,
  } = useApi<Schedule>({
    endpoint: 'schedules',
    defaultValue: [],
  });

  useEffect(() => {
    if (!user || !userId || isAdmin || !notificationService.isAllowed()) {
      return;
    }

    // Send userId to service worker for background checks
    backgroundSyncManager.sendUserIdToServiceWorker(userId);

    // Initial check
    checkUpcomingSchedules();

    // Check every 15 minutes for upcoming schedules (reduced frequency to avoid too many API calls)
    // Schedules are already loaded by useApi hook, so we don't need frequent polling
    checkInterval.current = setInterval(() => {
      checkUpcomingSchedules();
    }, 15 * 60 * 1000); // 15 minutes instead of 5 minutes

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, [user, isAdmin, schedules, userId]);

  const checkUpcomingSchedules = async () => {
    if (!schedules || schedules.length === 0) return;

    const now = new Date();
    
    for (const schedule of schedules) {
      // Only check pending schedules with user notifications enabled
      if (schedule.status !== 'pending' || !schedule.notifyUser) {
        continue;
      }

      const scheduleId = schedule._id || schedule.id?.toString() || '';
      const dueDate = new Date(schedule.dueDate);
      const advanceDays = schedule.advanceNotificationDays || 1;
      
      // Calculate notification date (dueDate - advanceDays)
      const notificationDate = new Date(dueDate);
      notificationDate.setDate(notificationDate.getDate() - advanceDays);
      notificationDate.setHours(0, 0, 0, 0);

      // Check if we should notify (within notification window)
      const notificationWindowEnd = new Date(notificationDate);
      notificationWindowEnd.setDate(notificationWindowEnd.getDate() + 1);

      if (
        now >= notificationDate &&
        now < notificationWindowEnd &&
        !lastNotifiedSchedules.current.has(scheduleId)
      ) {
        const clientName = 
          typeof schedule.clientId === 'object' && schedule.clientId?.name
            ? schedule.clientId.name
            : undefined;

        await notificationService.notifySchedule(
          schedule.title,
          dueDate.toISOString(),
          clientName
        );
        
        lastNotifiedSchedules.current.add(scheduleId);
      }

      // Remove from notified set if schedule is past or completed
      if (dueDate < now || schedule.status !== 'pending') {
        lastNotifiedSchedules.current.delete(scheduleId);
      }
    }
  };
}

/**
 * Hook for tracking new sales and notifying
 */
export function useSaleNotifications() {
  const { user } = useCurrentUser();
  const lastNotifiedSales = useRef<Set<string>>(new Set());
  const previousSaleIds = useRef<Set<string>>(new Set());
  const userId = localStorage.getItem('profit-pilot-user-id');
  const isAdmin = localStorage.getItem('profit-pilot-is-admin') === 'true';

  const {
    items: sales,
  } = useApi<Sale>({
    endpoint: 'sales',
    defaultValue: [],
  });

  useEffect(() => {
    if (!user || !userId || !notificationService.isAllowed()) {
      return;
    }

    // Check for new sales
    checkNewSales();
  }, [user, userId, sales]);

  const checkNewSales = async () => {
    if (!sales || sales.length === 0) {
      // Reset tracking if sales list is empty
      previousSaleIds.current = new Set();
      return;
    }

    // Get current sale IDs
    const currentSaleIds = new Set(
      sales
        .map((s) => s._id || s.id?.toString() || '')
        .filter(Boolean)
    );

    // Find new sales (in current but not in previous)
    const newSaleIds = Array.from(currentSaleIds).filter(
      (id) => !previousSaleIds.current.has(id)
    );

    // Notify about new sales (only if we've seen sales before - skip initial load)
    if (previousSaleIds.current.size > 0 && newSaleIds.length > 0) {
      for (const saleId of newSaleIds) {
        const sale = sales.find(
          (s) => (s._id || s.id?.toString() || '') === saleId
        );
        
        if (sale && !lastNotifiedSales.current.has(saleId)) {
          // Also check if sale was created recently (within last 5 minutes) to avoid old data
          const saleDate = sale.createdAt 
            ? new Date(sale.createdAt)
            : sale.date 
            ? new Date(sale.date)
            : null;

          if (saleDate) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            if (saleDate > fiveMinutesAgo) {
              await notificationService.notifyNewSale(
                sale.product,
                sale.quantity,
                sale.revenue
              );
              lastNotifiedSales.current.add(saleId);
            }
          } else {
            // If no date, assume it's new and notify
            await notificationService.notifyNewSale(
              sale.product,
              sale.quantity,
              sale.revenue
            );
            lastNotifiedSales.current.add(saleId);
          }
        }
      }
    }

    // Update previous sale IDs for next comparison
    previousSaleIds.current = currentSaleIds;

    // Clean up old sale IDs (keep only last 50)
    if (lastNotifiedSales.current.size > 50) {
      const recentSaleIds = new Set(
        sales
          .slice(-50)
          .map((s) => s._id || s.id?.toString() || '')
          .filter(Boolean)
      );
      lastNotifiedSales.current = recentSaleIds;
    }
  };
}

/**
 * Hook for tracking new products and notifying
 */
export function useProductNotifications() {
  const { user } = useCurrentUser();
  const lastNotifiedProducts = useRef<Set<string>>(new Set());
  const previousProductIds = useRef<Set<string>>(new Set());
  const userId = localStorage.getItem('profit-pilot-user-id');
  const isAdmin = localStorage.getItem('profit-pilot-is-admin') === 'true';

  const {
    items: products,
  } = useApi<Product>({
    endpoint: 'products',
    defaultValue: [],
  });

  useEffect(() => {
    if (!user || !userId || !notificationService.isAllowed()) {
      return;
    }

    // Check for new products
    checkNewProducts();
  }, [user, userId, products]);

  const checkNewProducts = async () => {
    if (!products || products.length === 0) {
      // Reset tracking if products list is empty
      previousProductIds.current = new Set();
      return;
    }

    // Get current product IDs
    const currentProductIds = new Set(
      products
        .map((p) => p._id || p.id?.toString() || '')
        .filter(Boolean)
    );

    // Find new products (in current but not in previous)
    const newProductIds = Array.from(currentProductIds).filter(
      (id) => !previousProductIds.current.has(id)
    );

    // Notify about new products (only if we've seen products before - skip initial load)
    if (previousProductIds.current.size > 0 && newProductIds.length > 0) {
      for (const productId of newProductIds) {
        const product = products.find(
          (p) => (p._id || p.id?.toString() || '') === productId
        );
        
        if (product && !lastNotifiedProducts.current.has(productId)) {
          await notificationService.notifyNewProduct(
            product.name,
            product.category
          );
          lastNotifiedProducts.current.add(productId);
        }
      }
    }

    // Update previous product IDs for next comparison
    previousProductIds.current = currentProductIds;

    // Clean up old notified product IDs (keep only last 100)
    if (lastNotifiedProducts.current.size > 100) {
      const recentProductIds = new Set(
        products
          .slice(-100)
          .map((p) => p._id || p.id?.toString() || '')
          .filter(Boolean)
      );
      lastNotifiedProducts.current = recentProductIds;
    }
  };
}

/**
 * Main hook that combines all notification checks
 */
export function useNotifications() {
  useAdminNotifications();
  useLowStockNotifications();
  useScheduleNotifications();
  useSaleNotifications();
  useProductNotifications();
}
