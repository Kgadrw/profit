import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Settings,
  LogOut,
  Pin,
  PinOff,
  Calendar,
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

const getMenuItems = (t: (key: string) => string) => {
  // Calculate if NEW banner should show (for one month from today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneMonthLater = new Date(today);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  const showNewBanner = new Date() <= oneMonthLater;
  
  return [
    { icon: LayoutDashboard, label: t("dashboard"), path: "/dashboard" },
    { icon: Package, label: t("products"), path: "/products" },
    { icon: ShoppingCart, label: t("sales"), path: "/sales" },
    { icon: Calendar, label: "Schedules", path: "/schedules", showNew: showNewBanner },
    { icon: FileText, label: t("reports"), path: "/reports" },
    { icon: Settings, label: t("settings"), path: "/settings" },
  ];
};

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
  const [shouldAnimateBanner, setShouldAnimateBanner] = useState(false);
  const [prevLocation, setPrevLocation] = useState(location.pathname);
  const [animationKey, setAnimationKey] = useState(0);
  
  // Determine if sidebar should appear expanded (hover overrides collapsed state on desktop)
  const isExpanded = isHovered || !collapsed;
  
  const [prevIsExpanded, setPrevIsExpanded] = useState(isExpanded);

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

  // Trigger banner animation when sidebar expands or when schedule page becomes active
  useEffect(() => {
    const isScheduleActive = location.pathname === "/schedules";
    const wasScheduleActive = prevLocation === "/schedules";
    
    // Animate when schedule page becomes active (navigating to schedules) and sidebar is expanded
    if (isScheduleActive && !wasScheduleActive && isExpanded) {
      setShouldAnimateBanner(true);
      setAnimationKey(prev => prev + 1);
      const timer = setTimeout(() => {
        setShouldAnimateBanner(false);
      }, 500);
      setPrevLocation(location.pathname);
      return () => clearTimeout(timer);
    }
    
    // Animate when sidebar expands while schedule is active
    if (isScheduleActive && isExpanded && !prevIsExpanded) {
      setShouldAnimateBanner(true);
      setAnimationKey(prev => prev + 1);
      const timer = setTimeout(() => {
        setShouldAnimateBanner(false);
      }, 500);
      setPrevIsExpanded(isExpanded);
      return () => clearTimeout(timer);
    }
    
    // Animate when sidebar expands (general case)
    if (isExpanded && !prevIsExpanded) {
      setShouldAnimateBanner(true);
      const timer = setTimeout(() => {
        setShouldAnimateBanner(false);
      }, 500);
      setPrevIsExpanded(isExpanded);
      return () => clearTimeout(timer);
    }
    
    // Update previous states
    setPrevIsExpanded(isExpanded);
    setPrevLocation(location.pathname);
  }, [isExpanded, prevIsExpanded, location.pathname, prevLocation]);

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
        "fixed z-50 bg-blue-600 transition-all duration-300 flex flex-col overflow-hidden shadow-lg rounded-lg",
        "left-2 top-2 h-[calc(100vh-1rem)] w-56",
        "lg:left-2 lg:top-2 lg:h-[calc(100vh-1rem)] lg:border-r lg:border-blue-700 lg:shadow-none lg:rounded-lg",
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
        <div className="flex items-center justify-between h-16 px-4 bg-blue-600 border-b border-blue-700">
        {isExpanded && (
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Trippo Logo" 
              className="h-8 w-8 object-contain"
            />
            <span className="text-xl font-normal text-white lowercase">trippo</span>
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
            className="p-2 hover:bg-blue-700 text-white transition-colors rounded hidden lg:block"
            title={collapsed ? "Pin sidebar" : "Unpin sidebar"}
          >
            <Pin 
              size={18} 
              className={cn(
                "transition-transform duration-300",
                collapsed ? "rotate-0" : "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isScheduleItem = item.path === "/schedules";
          const isScheduleActive = isScheduleItem && isActive;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={cn(
                "sidebar-item w-full",
                isActive && "sidebar-item-active",
                !isExpanded && "justify-center px-0"
              )}
              title={!isExpanded ? item.label : undefined}
            >
              <item.icon size={20} className={isActive ? "text-white" : "text-blue-100"} />
              {isExpanded && (
                <>
                  <span className={cn("flex-1", isActive ? "text-white" : "text-blue-100")}>{item.label}</span>
                  {item.showNew && (
                    <span 
                      className={cn(
                        "ml-auto px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap inline-block",
                        isScheduleActive 
                          ? "bg-red-600 text-white" 
                          : "bg-white text-blue-600"
                      )}
                    >
                      <span 
                        key={`banner-${animationKey}`}
                        className={cn(
                          "inline-block",
                          shouldAnimateBanner && isScheduleActive && "animate-banner-text"
                        )}
                      >
                        NEW
                      </span>
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
        <div className="p-2">
        <button
          onClick={handleLogoutClick}
          className={cn(
            "sidebar-item w-full hover:bg-red-500 hover:text-white transition-colors text-blue-100",
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
