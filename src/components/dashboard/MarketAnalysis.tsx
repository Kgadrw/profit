import { useMemo } from "react";
import { Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface Sale {
  id?: number;
  _id?: string;
  product: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  date: string;
}

interface Product {
  id?: number;
  _id?: string;
  name: string;
  stock: number;
  costPrice: number;
  sellingPrice: number;
}

interface MarketAnalysisProps {
  sales: Sale[];
  products: Product[];
  isLoading?: boolean;
}

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export function MarketAnalysis({ sales, products, isLoading }: MarketAnalysisProps) {
  const { t } = useTranslation();

  const analysisData = useMemo(() => {
    if (!sales.length || !products.length) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter sales by date ranges
    const recentSales = sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate >= last7Days;
    });

    const previousWeekSales = sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate >= last14Days && saleDate < last7Days;
    });

    const monthlySales = sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate >= last30Days;
    });

    // Calculate period totals
    const recentTotal = recentSales.reduce((acc, sale) => ({
      revenue: acc.revenue + sale.revenue,
      profit: acc.profit + sale.profit,
      quantity: acc.quantity + sale.quantity,
    }), { revenue: 0, profit: 0, quantity: 0 });

    const previousTotal = previousWeekSales.reduce((acc, sale) => ({
      revenue: acc.revenue + sale.revenue,
      profit: acc.profit + sale.profit,
      quantity: acc.quantity + sale.quantity,
    }), { revenue: 0, profit: 0, quantity: 0 });

    const monthlyTotal = monthlySales.reduce((acc, sale) => ({
      revenue: acc.revenue + sale.revenue,
      profit: acc.profit + sale.profit,
      quantity: acc.quantity + sale.quantity,
    }), { revenue: 0, profit: 0, quantity: 0 });

    // Top products by revenue
    const productRevenue = monthlySales.reduce((acc, sale) => {
      const productName = typeof sale.product === 'string' ? sale.product : sale.product;
      if (!acc[productName]) {
        acc[productName] = { revenue: 0, quantity: 0, profit: 0 };
      }
      acc[productName].revenue += sale.revenue;
      acc[productName].quantity += sale.quantity;
      acc[productName].profit += sale.profit;
      return acc;
    }, {} as Record<string, { revenue: number; quantity: number; profit: number }>);

    const topProducts = Object.entries(productRevenue)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 5);

    // Monthly breakdown for recent period
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() - i);
      monthDate.setDate(1);
      monthDate.setHours(0, 0, 0, 0);
      
      const monthEnd = new Date(monthDate);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      const monthSales = sales.filter((sale) => {
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= monthDate && saleDate < monthEnd;
      });

      const monthTotal = monthSales.reduce((acc, sale) => ({
        revenue: acc.revenue + sale.revenue,
        profit: acc.profit + sale.profit,
        quantity: acc.quantity + sale.quantity,
      }), { revenue: 0, profit: 0, quantity: 0 });

      monthlyData.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        revenue: monthTotal.revenue,
        profit: monthTotal.profit,
        quantity: monthTotal.quantity,
      });
    }

    // Daily breakdown for last 30 days
    const dailyData = [];
    for (let i = 29; i >= 0; i--) {
      const dayDate = new Date(now);
      dayDate.setDate(dayDate.getDate() - i);
      dayDate.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayDate);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const daySales = sales.filter((sale) => {
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= dayDate && saleDate < dayEnd;
      });

      const dayTotal = daySales.reduce((acc, sale) => ({
        revenue: acc.revenue + sale.revenue,
        profit: acc.profit + sale.profit,
      }), { revenue: 0, profit: 0 });

      dailyData.push({
        day: dayDate.getDate(),
        revenue: dayTotal.revenue,
        profit: dayTotal.profit,
      });
    }

    // Pie chart data (revenue by top products)
    const pieData = topProducts.map(([name, data]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      value: data.revenue,
      fullName: name,
    }));

    // Bar chart data (comparison)
    const barChartData = [
      {
        name: t("language") === "rw" ? "Icyumweru cyashize" : "Last Week",
        revenue: previousTotal.revenue,
        profit: previousTotal.profit,
        quantity: previousTotal.quantity,
      },
      {
        name: t("language") === "rw" ? "Icyumweru gikurikira" : "This Week",
        revenue: recentTotal.revenue,
        profit: recentTotal.profit,
        quantity: recentTotal.quantity,
      },
    ];

    // Top products bar chart data (horizontal bars)
    const topProductsBarData = topProducts.map(([name, data]) => ({
      name: name.length > 20 ? name.substring(0, 20) + '...' : name,
      fullName: name,
      revenue: data.revenue,
      profit: data.profit,
      quantity: data.quantity,
    }));

    // Profit margin calculation
    const profitMarginData = topProducts.map(([name, data]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      fullName: name,
      margin: data.revenue > 0 ? ((data.profit / data.revenue) * 100) : 0,
      revenue: data.revenue,
    }));

    // Weekly trend data (last 4 weeks)
    const weeklyTrendData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7 + 6));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      const weekSales = sales.filter((sale) => {
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= weekStart && saleDate < weekEnd;
      });

      const weekTotal = weekSales.reduce((acc, sale) => ({
        revenue: acc.revenue + sale.revenue,
        profit: acc.profit + sale.profit,
        quantity: acc.quantity + sale.quantity,
      }), { revenue: 0, profit: 0, quantity: 0 });

      weeklyTrendData.push({
        week: t("language") === "rw" ? `Icyumweru ${4 - i}` : `Week ${4 - i}`,
        revenue: weekTotal.revenue,
        profit: weekTotal.profit,
        quantity: weekTotal.quantity,
      });
    }

    return {
      summary: {
        lastWeek: previousTotal,
        thisWeek: recentTotal,
        monthly: monthlyTotal,
      },
      topProducts,
      monthlyData,
      dailyData,
      pieData,
      barChartData,
      topProductsBarData,
      profitMarginData,
      weeklyTrendData,
    };
  }, [sales, products, t]);

  if (isLoading) {
    return (
      <div className="lg:bg-white/80 lg:backdrop-blur-md bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-64 w-full mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="lg:bg-white/80 lg:backdrop-blur-md bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-6">
        <div className="text-center py-12 text-gray-500">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            {t("language") === "rw" ? "Nta makuru y'ubucuruzi aboneka" : "No sales data available for analysis"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t("language") === "rw" ? "Gusuzuma isoko n'ubucuruzi" : "AI Market Analysis"}
          </h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {t("language") === "rw" ? "Inyigisho z'ubucuruzi n'ibitekerezo by'ubucuruzi" : "AI-powered insights and business predictions"}
        </p>
      </div>

      {/* Week Comparison Chart */}
      <div className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          {t("language") === "rw" ? "Icyumweru cyashize n'icyumweru gikurikira" : "Week Comparison"}
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={analysisData.barChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12, fill: '#6b7280' }} 
              tickFormatter={(value) => {
                if (value >= 1000000) return `rwf ${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `rwf ${(value / 1000).toFixed(0)}k`;
                return `rwf ${value}`;
              }} 
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'quantity') return [value, t("language") === "rw" ? "Umubare" : "Quantity"];
                return [`rwf ${value.toLocaleString()}`, name === 'revenue' ? (t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue") : (t("language") === "rw" ? "Inyungu" : "Profit")];
              }}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name={t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"} radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="profit" fill="#10b981" name={t("language") === "rw" ? "Inyungu" : "Profit"} radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="quantity" stroke="#f59e0b" strokeWidth={2} name={t("language") === "rw" ? "Umubare" : "Quantity"} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products Bar Chart */}
      <div className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          {t("language") === "rw" ? "Ibyicuruzwa byagurishwe cyane" : "Top Products by Revenue"}
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analysisData.topProductsBarData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => {
              if (value >= 1000000) return `rwf ${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `rwf ${(value / 1000).toFixed(0)}k`;
              return `rwf ${value}`;
            }} />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={120}
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'revenue') return [`rwf ${value.toLocaleString()}`, t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"];
                if (name === 'profit') return [`rwf ${value.toLocaleString()}`, t("language") === "rw" ? "Inyungu" : "Profit"];
                return [value, t("language") === "rw" ? "Umubare" : "Quantity"];
              }}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#3b82f6" name={t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"} radius={[0, 4, 4, 0]} />
            <Bar dataKey="profit" fill="#10b981" name={t("language") === "rw" ? "Inyungu" : "Profit"} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Revenue Distribution */}
        <div className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            {t("language") === "rw" ? "Gutandukanya ingengo y'amafaranga" : "Revenue Distribution"}
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analysisData.pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {analysisData.pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`rwf ${value.toLocaleString()}`, '']}
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Profit Margin Chart */}
        <div className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            {t("language") === "rw" ? "Inyungu y'ibicuruzwa" : "Profit Margin by Product"}
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analysisData.profitMarginData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => `${value.toFixed(0)}%`}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)}%`, t("language") === "rw" ? "Inyungu" : "Profit Margin"]}
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
              />
              <Bar dataKey="margin" fill="#8b5cf6" name={t("language") === "rw" ? "Inyungu (%)" : "Profit Margin (%)"} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Trend Area Chart */}
      <div className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          {t("language") === "rw" ? "Imiterere y'icyumweru (Icyumweru 4)" : "Weekly Trends (Last 4 Weeks)"}
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={analysisData.weeklyTrendData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => {
                if (value >= 1000000) return `rwf ${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `rwf ${(value / 1000).toFixed(0)}k`;
                return `rwf ${value}`;
              }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'revenue') return [`rwf ${value.toLocaleString()}`, t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"];
                if (name === 'profit') return [`rwf ${value.toLocaleString()}`, t("language") === "rw" ? "Inyungu" : "Profit"];
                return [value, t("language") === "rw" ? "Umubare" : "Quantity"];
              }}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <Legend />
            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" name={t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"} />
            <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" name={t("language") === "rw" ? "Inyungu" : "Profit"} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Trends Chart */}
      <div className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          {t("language") === "rw" ? "Imiterere y'umunsi (Iminsi 30)" : "Daily Trends (Last 30 Days)"}
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={analysisData.dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 10, fill: '#6b7280' }}
              interval={4}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => {
                if (value >= 1000000) return `rwf ${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `rwf ${(value / 1000).toFixed(0)}k`;
                return `rwf ${value}`;
              }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                return [`rwf ${value.toLocaleString()}`, name === 'revenue' ? (t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue") : (t("language") === "rw" ? "Inyungu" : "Profit")];
              }}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#3b82f6" name={t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"} radius={[2, 2, 0, 0]} />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="#10b981" 
              strokeWidth={2}
              name={t("language") === "rw" ? "Inyungu" : "Profit"}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Trend Chart */}
      <div className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          {t("language") === "rw" ? "Imiterere y'ukwezi (Amezi 12)" : "Monthly Trends (Last 12 Months)"}
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={analysisData.monthlyData}>
            <defs>
              <linearGradient id="colorMonthlyRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMonthlyProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => {
                if (value >= 1000000) return `rwf ${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `rwf ${(value / 1000).toFixed(0)}k`;
                return `rwf ${value}`;
              }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'revenue') return [`rwf ${value.toLocaleString()}`, t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"];
                if (name === 'profit') return [`rwf ${value.toLocaleString()}`, t("language") === "rw" ? "Inyungu" : "Profit"];
                return [value, t("language") === "rw" ? "Umubare" : "Quantity"];
              }}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <Legend />
            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorMonthlyRevenue)" name={t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"} />
            <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorMonthlyProfit)" name={t("language") === "rw" ? "Inyungu" : "Profit"} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
