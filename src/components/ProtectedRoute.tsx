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
    // Check authentication status
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
  }, [requireAdmin]);

  // Prevent back button navigation after logout
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const userId = localStorage.getItem("profit-pilot-user-id");
      const authenticated = sessionStorage.getItem("profit-pilot-authenticated") === "true";

      if (!userId || !authenticated) {
        // User is not authenticated, prevent back navigation
        e.preventDefault();
        window.history.pushState(null, "", location.pathname);
      }
    };

    // Push current state to prevent back navigation to logged-out state
    window.history.pushState(null, "", location.pathname);

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [location.pathname]);

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
