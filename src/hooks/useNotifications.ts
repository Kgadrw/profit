// Hook for managing notifications based on user role and data changes

import { useEffect, useRef } from 'react';
import { notificationService } from '@/lib/notifications';
import { useCurrentUser } from './useCurrentUser';
import { useApi } from './useApi';
import { adminApi } from '@/lib/api';

interface Product {
  id?: number;
  _id?: string;
  name: string;
  stock: number;
  minStock?: number;
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

    // Initial check
    checkNewUsers();

    // Check every 30 seconds for new users
    checkInterval.current = setInterval(() => {
      checkNewUsers();
    }, 30000);

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
  const isAdmin = localStorage.getItem('profit-pilot-is-admin') === 'true';
  const userId = localStorage.getItem('profit-pilot-user-id');

  const {
    items: products,
  } = useApi<Product>({
    endpoint: 'products',
    defaultValue: [],
  });

  useEffect(() => {
    if (!user || !userId || isAdmin || !notificationService.isAllowed()) {
      return;
    }

    // Initial check
    checkLowStock();

    // Check every 60 seconds for low stock
    checkInterval.current = setInterval(() => {
      checkLowStock();
    }, 60000);

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, [user, isAdmin, products]);

  const checkLowStock = async () => {
    if (!products || products.length === 0) return;

    for (const product of products) {
      const productId = product._id || product.id?.toString() || '';
      const minStock = product.minStock || 5;
      const currentStock = product.stock || 0;

      // Check if stock is approaching minimum (within 20% of minStock)
      const threshold = Math.ceil(minStock * 1.2);
      
      if (currentStock <= threshold && currentStock > 0) {
        // Only notify if we haven't notified about this product recently
        if (!lastNotifiedProducts.current.has(productId)) {
          await notificationService.notifyLowStock(
            product.name,
            currentStock,
            minStock
          );
          lastNotifiedProducts.current.add(productId);
        }
      } else if (currentStock > threshold) {
        // Remove from notified set if stock is back above threshold
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

    // Initial check
    checkUpcomingSchedules();

    // Check every 5 minutes for upcoming schedules
    checkInterval.current = setInterval(() => {
      checkUpcomingSchedules();
    }, 5 * 60 * 1000);

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, [user, isAdmin, schedules]);

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
 * Main hook that combines all notification checks
 */
export function useNotifications() {
  useAdminNotifications();
  useLowStockNotifications();
  useScheduleNotifications();
}
