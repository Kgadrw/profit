import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Settings,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

export function BottomNav() {
  const location = useLocation();
  const { t, language } = useTranslation();
  const menuItems = getMenuItems(t);

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 lg:hidden"
      style={{ 
        paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive 
                  ? "text-blue-600" 
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <div className="relative">
                <item.icon 
                  size={22} 
                  className={cn(
                    "transition-colors",
                    isActive ? "text-blue-600" : "text-gray-500"
                  )} 
                />
                {item.showNew && item.path === "/schedules" && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1 rounded">
                    NEW
                  </span>
                )}
              </div>
              <span className={cn(
                "text-xs font-medium transition-colors",
                isActive ? "text-blue-600" : "text-gray-500"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
