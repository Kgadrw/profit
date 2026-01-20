import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePinAuth } from "@/hooks/usePinAuth";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/hooks/useTranslation";

const getMenuItems = (t: (key: string) => string) => [
  { icon: LayoutDashboard, label: t("dashboard"), path: "/dashboard" },
  { icon: Package, label: t("products"), path: "/products" },
  { icon: ShoppingCart, label: t("sales"), path: "/sales" },
  { icon: FileText, label: t("reports"), path: "/reports" },
  { icon: Settings, label: t("settings"), path: "/settings" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMobileClose?: () => void;
  onMobileToggle?: () => void;
  onHoverChange?: (isHovered: boolean) => void;
}

export function Sidebar({ collapsed, onToggle, onMobileClose, onMobileToggle, onHoverChange }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearAuth } = usePinAuth();
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [menuItems, setMenuItems] = useState(getMenuItems(t));
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  // Update menu items when language changes
  useEffect(() => {
    setMenuItems(getMenuItems(t));
  }, [language, t]);

  const handleNavClick = () => {
    // Close mobile menu when navigating on mobile
    if (window.innerWidth < 1024 && onMobileClose) {
      onMobileClose();
    }
  };

  const handleLogoutClick = () => {
    // Close mobile menu when clicking logout on mobile
    if (window.innerWidth < 1024 && onMobileClose) {
      onMobileClose();
    }
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    // Clear authentication state
    clearAuth();
    
    // Clear user ID and all user data
    localStorage.removeItem("profit-pilot-user-id");
    localStorage.removeItem("profit-pilot-user-name");
    localStorage.removeItem("profit-pilot-user-email");
    localStorage.removeItem("profit-pilot-business-name");
    localStorage.removeItem("profit-pilot-is-admin");
    
    // Clear session storage completely
    sessionStorage.clear();
    
    // Clear IndexedDB data (for complete data isolation)
    try {
      const { clearAllStores } = await import("@/lib/indexedDB");
      await clearAllStores();
    } catch (error) {
      console.error("Error clearing IndexedDB on logout:", error);
    }
    
    // Dispatch authentication change event
    window.dispatchEvent(new Event("pin-auth-changed"));
    
    // Show logout confirmation
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out. All your data has been cleared.",
    });
    
    // Clear browser history and redirect to homepage
    // This prevents back button from accessing protected pages
    window.history.replaceState(null, "", "/");
    
    setLogoutDialogOpen(false);
    
    // Navigate to home page (don't force reload immediately to allow login)
    navigate("/", { replace: true });
  };

  // Determine if sidebar should appear expanded (hover overrides collapsed state on desktop)
  const isExpanded = isHovered || !collapsed;

  // Handle touch start for swipe detection
  const onTouchStart = (e: React.TouchEvent) => {
    // Only handle on mobile
    if (window.innerWidth >= 1024) return;
    
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  // Handle touch move for swipe detection
  const onTouchMove = (e: React.TouchEvent) => {
    // Only handle on mobile
    if (window.innerWidth >= 1024) return;
    
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  // Handle touch end and detect swipe to close
  const onTouchEnd = () => {
    // Only handle on mobile
    if (window.innerWidth >= 1024) return;
    
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);

    // Only handle horizontal swipes
    if (isVerticalSwipe) return;

    // Swipe from right edge of sidebar (within 30px from right) to left to close
    const sidebarWidth = 224; // 56 * 4 = 224px (w-56)
    if (isLeftSwipe && touchStart.x > sidebarWidth - 30 && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <aside
      className={cn(
        "fixed z-50 bg-white transition-all duration-300 flex flex-col overflow-hidden shadow-lg",
        "left-0 top-0 h-screen w-56",
        "lg:left-0 lg:top-0 lg:h-screen lg:border-r lg:border-gray-200 lg:shadow-none",
        isExpanded && "lg:w-56",
        !isExpanded && collapsed && "lg:w-16"
      )}
      onMouseEnter={() => {
        // Only auto-expand on desktop when collapsed
        if (window.innerWidth >= 1024 && collapsed) {
          setIsHovered(true);
          onHoverChange?.(true);
        }
      }}
      onMouseLeave={() => {
        // Only auto-collapse on desktop if it was auto-expanded
        if (window.innerWidth >= 1024) {
          setIsHovered(false);
          onHoverChange?.(false);
        }
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 bg-white">
        {isExpanded && (
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Trippo Logo" 
              className="h-8 w-8 object-contain"
            />
            <span className="text-xl font-normal text-gray-700 lowercase">trippo</span>
          </div>
        )}
        {!isExpanded && (
          <div className="flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Trippo Logo" 
              className="h-8 w-8 object-contain"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 text-gray-700 transition-colors rounded hidden lg:block"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={cn(
                "sidebar-item",
                isActive && "sidebar-item-active",
                !isExpanded && "justify-center px-0"
              )}
              title={!isExpanded ? item.label : undefined}
            >
              <item.icon size={20} className={isActive ? "text-white" : ""} />
              {isExpanded && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
        <div className="p-2">
        <button
          onClick={handleLogoutClick}
          className={cn(
            "sidebar-item w-full hover:bg-red-100 hover:text-red-700 transition-colors text-gray-700",
            !isExpanded && "justify-center px-0"
          )}
          title={!isExpanded ? "Logout" : undefined}
        >
          <LogOut size={20} />
                 {isExpanded && <span>{t("logout")}</span>}
        </button>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
                 <AlertDialogTitle>{t("logout")}</AlertDialogTitle>
                 <AlertDialogDescription>
                   {language === "rw" 
                     ? "Urasabye gusohoka? Uzakenera kwinjira nanone kugirango wongere wongere ikibaho." 
                     : "Are you sure you want to logout? You will need to login again to access your dashboard."}
                 </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogoutConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
