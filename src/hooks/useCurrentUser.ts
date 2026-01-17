// Hook to get current logged-in user data
import { useState, useEffect, useCallback } from "react";

const USER_NAME_KEY = "profit-pilot-user-name";
const USER_EMAIL_KEY = "profit-pilot-user-email";
const BUSINESS_NAME_KEY = "profit-pilot-business-name";

export interface CurrentUser {
  name: string;
  email?: string;
  businessName?: string;
}

export const useCurrentUser = () => {
  const [user, setUser] = useState<CurrentUser | null>(null);

  // Load user data from localStorage
  const loadUser = useCallback(() => {
    const name = localStorage.getItem(USER_NAME_KEY);
    const email = localStorage.getItem(USER_EMAIL_KEY);
    const businessName = localStorage.getItem(BUSINESS_NAME_KEY);

    if (name) {
      setUser({
        name,
        email: email || undefined,
        businessName: businessName || undefined,
      });
    } else {
      setUser(null);
    }
  }, []);

  // Load user on mount
  useEffect(() => {
    loadUser();

    // Listen for storage changes
    const handleStorageChange = () => {
      loadUser();
    };

    window.addEventListener("storage", handleStorageChange);
    // Also listen for custom event for same-window updates
    window.addEventListener("user-data-changed", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("user-data-changed", handleStorageChange);
    };
  }, [loadUser]);

  // Update user data (only updates name, email, businessName - never changes userId)
  const updateUser = useCallback((userData: Partial<CurrentUser>) => {
    // Ensure we have a userId before updating user data (prevents switching users)
    const currentUserId = localStorage.getItem("profit-pilot-user-id");
    if (!currentUserId) {
      console.warn("Cannot update user data: No userId found in localStorage");
      return;
    }

    if (userData.name) {
      localStorage.setItem(USER_NAME_KEY, userData.name);
    }
    if (userData.email !== undefined) {
      if (userData.email) {
        localStorage.setItem(USER_EMAIL_KEY, userData.email);
      } else {
        localStorage.removeItem(USER_EMAIL_KEY);
      }
    }
    if (userData.businessName !== undefined) {
      if (userData.businessName) {
        localStorage.setItem(BUSINESS_NAME_KEY, userData.businessName);
      } else {
        localStorage.removeItem(BUSINESS_NAME_KEY);
      }
    }
    
    // Verify userId hasn't changed after update (safety check)
    const userIdAfterUpdate = localStorage.getItem("profit-pilot-user-id");
    if (userIdAfterUpdate !== currentUserId) {
      console.error("User ID changed during update! Restoring original userId.");
      localStorage.setItem("profit-pilot-user-id", currentUserId);
    }
    
    // Trigger event to update other components
    window.dispatchEvent(new Event("user-data-changed"));
    loadUser();
  }, [loadUser]);

  // Clear user data
  const clearUser = useCallback(() => {
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    localStorage.removeItem(BUSINESS_NAME_KEY);
    setUser(null);
    window.dispatchEvent(new Event("user-data-changed"));
  }, []);

  return {
    user,
    updateUser,
    clearUser,
    refreshUser: loadUser,
  };
};
