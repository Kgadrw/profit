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
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AdminSidebar({ 
  collapsed, 
  onToggle, 
  onMobileClose,
  activeSection,
  onSectionChange 
}: AdminSidebarProps) {
  const navigate = useNavigate();
  const { clearAuth } = usePinAuth();
  const { toast } = useToast();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

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

  return (
    <aside
      className={cn(
        "fixed z-50 bg-blue-500 transition-all duration-300 flex flex-col shadow-lg overflow-hidden",
        "left-0 top-0 h-screen w-64",
        "lg:left-2 lg:top-2 lg:h-[calc(100vh-1rem)] lg:border lg:border-blue-600 lg:rounded-lg",
        !collapsed && "lg:w-64",
        collapsed && "lg:w-16"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-blue-600 bg-blue-500 lg:rounded-t-lg">
        {!collapsed && (
          <span className="text-lg font-bold text-white">
            Admin
          </span>
        )}
        <button
          onClick={onToggle}
          className="p-2 hover:bg-blue-600 text-white transition-colors rounded"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
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
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="text-white" />
              {!collapsed && <span className="text-white">{item.label}</span>}
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
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={20} />
          {!collapsed && <span>Logout</span>}
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
