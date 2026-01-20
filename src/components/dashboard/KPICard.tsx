import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  showMoneyToggle?: boolean;
  showMoney?: boolean;
  onToggleMoney?: () => void;
  bgColor?: string;
  valueColor?: string;
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, showMoneyToggle, showMoney, onToggleMoney, bgColor, valueColor }: KPICardProps) {
  return (
    <div className={cn("kpi-card", bgColor)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-center gap-2">
            <p className={cn("text-2xl font-normal leading-tight", valueColor || "text-gray-800")}>{value}</p>
            {showMoneyToggle && onToggleMoney && (
              <button
                onClick={onToggleMoney}
                className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                title={showMoney ? "Hide money" : "Show money"}
              >
                {showMoney ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs font-semibold mt-1",
                trend.positive ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.positive ? "↑" : "↓"} {trend.value} vs yesterday
            </p>
          )}
        </div>
        <div className="ml-4 shrink-0">
          <div className="w-12 h-12 !border-0 outline-none flex items-center justify-center" style={{ border: 'none', background: 'transparent' }}>
            <Icon size={24} className="text-gray-700" style={{ border: 'none', outline: 'none' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
