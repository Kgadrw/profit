import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check authentication status - run on every location change
    const checkAuth = () => {
      const userId = localStorage.getItem("profit-pilot-user-id");
      const authenticated = sessionStorage.getItem("profit-pilot-authenticated") === "true";
      const adminStatus = localStorage.getItem("profit-pilot-is-admin") === "true";

      // For admin routes, check admin status instead of regular userId
      if (requireAdmin) {
        if (adminStatus && authenticated && userId === "admin") {
          setIsAuthenticated(true);
          setIsAdmin(true);
          setIsChecking(false);
          return;
        } else {
          setIsAuthenticated(false);
          setIsAdmin(false);
          setIsChecking(false);
          return;
        }
      }

      // For regular routes, require userId and authentication
      if (!userId || !authenticated) {
        setIsAuthenticated(false);
        setIsAdmin(false);
        setIsChecking(false);
        return;
      }

      setIsAuthenticated(true);
      setIsAdmin(adminStatus);
      setIsChecking(false);
    };

    // Check immediately on mount and location change
    checkAuth();

    // Listen for authentication changes
    const handleAuthChange = () => {
      checkAuth();
    };

    // Listen for storage changes (logout from another tab/window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "profit-pilot-user-id" || e.key === "profit-pilot-authenticated") {
        checkAuth();
      }
    };

    window.addEventListener("pin-auth-changed", handleAuthChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("pin-auth-changed", handleAuthChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [requireAdmin, location.pathname]); // Re-check on route change

  // Prevent back button navigation to protected routes without authentication
  useEffect(() => {
    const handlePopState = () => {
      // Small delay to allow location to update
      setTimeout(() => {
        const userId = localStorage.getItem("profit-pilot-user-id");
        const authenticated = sessionStorage.getItem("profit-pilot-authenticated") === "true";
        const currentPath = window.location.pathname;
        const protectedRoutes = ['/dashboard', '/products', '/sales', '/reports', '/settings', '/admin-dashboard'];
        const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));

        if (isProtectedRoute && (!userId || !authenticated)) {
          // User is not authenticated but trying to access protected route via back button
          // Replace current history entry and redirect to home
          window.history.replaceState(null, "", "/");
          window.location.replace("/");
        }
      }, 0);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Just redirect to home - Home page has its own login modal
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    // Just redirect to home - Home page has its own login modal
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
