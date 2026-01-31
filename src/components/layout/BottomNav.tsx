import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Calendar,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { RecordSaleModal } from "@/components/mobile/RecordSaleModal";

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
  ];
};

export function BottomNav() {
  const location = useLocation();
  const { t, language } = useTranslation();
  const menuItems = getMenuItems(t);
  const [saleModalOpen, setSaleModalOpen] = useState(false);

  return (
    <>
      {/* Floating Add Sale Button - Only on mobile */}
      <button
        onClick={() => setSaleModalOpen(true)}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 lg:hidden w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center backdrop-blur-sm"
        aria-label="Add new sale"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* Record Sale Modal */}
      <RecordSaleModal 
        open={saleModalOpen} 
        onOpenChange={setSaleModalOpen}
      />

      <nav 
        className="fixed bottom-4 left-4 right-4 z-40 bg-white/80 backdrop-blur-md border border-gray-200/50 lg:hidden rounded-3xl shadow-lg"
        style={{ 
          paddingBottom: 'max(0.5rem, calc(env(safe-area-inset-bottom) + 0.25rem))',
        }}
      >
        <div className="flex items-center justify-around h-14 px-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 ease-in-out relative",
                  isActive 
                    ? "text-blue-600" 
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <div className="relative">
                  <item.icon 
                    size={22} 
                    fill={isActive ? "currentColor" : "none"}
                    className={cn(
                      "transition-all duration-300 ease-in-out",
                      isActive 
                        ? "text-blue-600 scale-110" 
                        : "text-gray-500 scale-100"
                    )} 
                  />
                  {item.showNew && item.path === "/schedules" && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1 rounded">
                      NEW
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-xs transition-all duration-300 ease-in-out",
                  isActive 
                    ? "text-blue-600 font-bold" 
                    : "text-gray-500 font-medium"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
