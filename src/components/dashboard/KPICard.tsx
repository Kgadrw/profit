import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";

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
  linkTo?: string;
  linkText?: string;
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, showMoneyToggle, showMoney, onToggleMoney, bgColor, valueColor, linkTo, linkText }: KPICardProps) {
  return (
    <div className={cn("kpi-card", bgColor)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 sm:space-y-2 flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <p className={cn("text-lg sm:text-2xl font-semibold sm:font-normal leading-tight truncate", valueColor || "text-gray-800")}>{value}</p>
            {showMoneyToggle && onToggleMoney && (
              <button
                onClick={onToggleMoney}
                className="text-gray-500 hover:text-gray-700 transition-colors p-0.5 sm:p-1 shrink-0"
                title={showMoney ? "Hide money" : "Show money"}
              >
                {showMoney ? <EyeOff size={14} className="sm:w-4 sm:h-4" /> : <Eye size={14} className="sm:w-4 sm:h-4" />}
              </button>
            )}
          </div>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-[10px] sm:text-xs font-semibold mt-0.5 sm:mt-1",
                trend.positive ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.positive ? "↑" : "↓"} {trend.value} vs yesterday
            </p>
          )}
          {linkTo && linkText && (
            <Link
              to={linkTo}
              className="text-[10px] sm:text-xs text-blue-600 hover:text-blue-800 underline mt-1 sm:mt-2 inline-block truncate"
            >
              {linkText}
            </Link>
          )}
        </div>
        <div className="ml-2 sm:ml-4 shrink-0">
          <div className="w-8 h-8 sm:w-12 sm:h-12 !border-0 outline-none flex items-center justify-center" style={{ border: 'none', background: 'transparent' }}>
            <Icon size={18} className="sm:w-6 sm:h-6 text-gray-700" style={{ border: 'none', outline: 'none' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
