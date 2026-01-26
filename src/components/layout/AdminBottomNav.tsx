import {
  LayoutDashboard,
  Users,
  Activity,
  Server,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminMenuItems = [
  { icon: LayoutDashboard, label: "Overview", section: "overview" },
  { icon: Users, label: "Users", section: "users" },
  { icon: Activity, label: "Activity", section: "activity" },
  { icon: Calendar, label: "Schedules", section: "schedules" },
  { icon: Server, label: "System Health", section: "health" },
];

interface AdminBottomNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AdminBottomNav({ activeSection, onSectionChange }: AdminBottomNavProps) {
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 lg:hidden"
      style={{ 
        paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {adminMenuItems.map((item) => {
          const isActive = activeSection === item.section;
          return (
            <button
              key={item.section}
              onClick={() => onSectionChange(item.section)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive 
                  ? "text-blue-600" 
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <item.icon 
                size={22} 
                className={cn(
                  "transition-colors",
                  isActive ? "text-blue-600" : "text-gray-500"
                )} 
              />
              <span className={cn(
                "text-xs font-medium transition-colors",
                isActive ? "text-blue-600" : "text-gray-500"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
