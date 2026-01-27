import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Sale {
  date: string | Date;
  revenue: number;
}

interface SalesTrendChartProps {
  sales?: Sale[];
}

export function SalesTrendChart({ sales = [] }: SalesTrendChartProps) {
  // Calculate last 7 days sales data
  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    return last7Days.map((date, index) => {
      const dateStr = date.toISOString().split('T')[0];
      const daySales = sales.filter((sale) => {
        const saleDate = typeof sale.date === 'string' 
          ? sale.date.split('T')[0] 
          : new Date(sale.date).toISOString().split('T')[0];
        return saleDate === dateStr;
      });
      
      const totalRevenue = daySales.reduce((sum, sale) => sum + sale.revenue, 0);
      
      return {
        day: days[date.getDay()],
        sales: totalRevenue,
      };
    });
  }, [sales]);
  return (
    <div className="kpi-card lg:bg-white/80 lg:backdrop-blur-md bg-white/80 backdrop-blur-sm">
      <h3 className="section-title text-gray-600">Sales Trend (Last 7 Days)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5b8fc7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#5b8fc7" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#475569", fontSize: 12, fontWeight: 500 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#475569", fontSize: 12, fontWeight: 500 }}
              tickFormatter={(value) => `rwf ${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              }}
              labelStyle={{ color: "#475569", fontWeight: 600 }}
              itemStyle={{ color: "#5b8fc7", fontWeight: 600 }}
              formatter={(value: number) => [`rwf ${value.toLocaleString()}`, "Sales"]}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#5b8fc7"
              strokeWidth={2}
              fill="url(#salesGradient)"
              dot={{ fill: "#5b8fc7", strokeWidth: 2, r: 4, stroke: "#ffffff" }}
              activeDot={{ r: 6, fill: "#5b8fc7", stroke: "#ffffff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
