import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Activity,
  Server,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
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

const adminMenuItems = [
  { icon: LayoutDashboard, label: "Overview", section: "overview" },
  { icon: Users, label: "Users", section: "users" },
  { icon: Activity, label: "Activity", section: "activity" },
  { icon: Server, label: "System Health", section: "health" },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMobileClose?: () => void;
  onMobileToggle?: () => void;
  onHoverChange?: (isHovered: boolean) => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AdminSidebar({ 
  collapsed, 
  onToggle, 
  onMobileClose,
  onMobileToggle,
  onHoverChange,
  activeSection,
  onSectionChange 
}: AdminSidebarProps) {
  const navigate = useNavigate();
  const { clearAuth } = usePinAuth();
  const { toast } = useToast();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const handleNavClick = (section: string) => {
    onSectionChange(section);
    // Close mobile menu when navigating on mobile
    if (window.innerWidth < 1024 && onMobileClose) {
      onMobileClose();
    }
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = () => {
    // Clear authentication state
    clearAuth();
    
    // Clear user ID
    localStorage.removeItem("profit-pilot-user-id");
    
    // Clear session storage
    sessionStorage.clear();
    
    // Clear admin flag
    localStorage.removeItem("profit-pilot-is-admin");
    
    // Show logout confirmation
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    
    // Redirect to homepage
    navigate("/");
    setLogoutDialogOpen(false);
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
        "fixed z-50 bg-blue-500 transition-all duration-300 flex flex-col shadow-lg overflow-hidden",
        "left-0 top-0 h-screen w-56",
        "lg:left-2 lg:top-2 lg:h-[calc(100vh-1rem)] lg:border lg:border-blue-600 lg:rounded-lg",
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
      <div className="flex items-center justify-between h-16 px-4 border-b border-blue-600 bg-blue-500 lg:rounded-t-lg">
        {isExpanded && (
          <span className="text-lg font-bold text-white">
            Admin
          </span>
        )}
        <div className="flex items-center gap-2">
          {onMobileToggle && (
            <button
              onClick={onMobileToggle}
              className="p-2 hover:bg-blue-600 text-white transition-colors rounded lg:hidden"
            >
              <Menu size={20} />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-2 hover:bg-blue-600 text-white transition-colors rounded hidden lg:block"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {adminMenuItems.map((item) => {
          const isActive = activeSection === item.section;
          return (
            <button
              key={item.section}
              onClick={() => handleNavClick(item.section)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 w-full text-left text-white hover:bg-blue-600 transition-colors cursor-pointer rounded-md",
                isActive && "bg-blue-700 text-white font-semibold shadow-sm",
                !isExpanded && "justify-center px-0"
              )}
              title={!isExpanded ? item.label : undefined}
            >
              <item.icon size={20} className="text-white" />
              {isExpanded && <span className="text-white">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-blue-600 lg:rounded-b-lg">
        <button
          onClick={handleLogoutClick}
          className={cn(
            "sidebar-item w-full hover:bg-red-600 hover:text-white transition-colors text-white",
            !isExpanded && "justify-center px-0"
          )}
          title={!isExpanded ? "Logout" : undefined}
        >
          <LogOut size={20} />
          {isExpanded && <span>Logout</span>}
        </button>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout? You will need to login again to access the admin dashboard.
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
