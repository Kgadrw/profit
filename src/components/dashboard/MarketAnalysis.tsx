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
      },
      {
        name: t("language") === "rw" ? "Icyumweru gikurikira" : "This Week",
        revenue: recentTotal.revenue,
        profit: recentTotal.profit,
      },
    ];

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
    };
  }, [sales, products, t]);

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
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
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
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
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
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

      {/* Summary Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary Table 1 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900">
              {t("language") === "rw" ? "Incamake y'ubucuruzi" : "Sales Summary"}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">
                    {t("language") === "rw" ? "Igihe" : "Period"}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">
                    {t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">
                    {t("language") === "rw" ? "Inyungu" : "Profit"}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">
                    {t("language") === "rw" ? "Umubare" : "Quantity"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {t("language") === "rw" ? "Icyumweru cyashize" : "Last Week"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    rwf {analysisData.summary.lastWeek.revenue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                    rwf {analysisData.summary.lastWeek.profit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    {analysisData.summary.lastWeek.quantity}
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {t("language") === "rw" ? "Icyumweru gikurikira" : "This Week"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    rwf {analysisData.summary.thisWeek.revenue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                    rwf {analysisData.summary.thisWeek.profit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    {analysisData.summary.thisWeek.quantity}
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 bg-blue-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {t("language") === "rw" ? "Igiteranyo" : "Total"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                    rwf {(analysisData.summary.lastWeek.revenue + analysisData.summary.thisWeek.revenue).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                    rwf {(analysisData.summary.lastWeek.profit + analysisData.summary.thisWeek.profit).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                    {analysisData.summary.lastWeek.quantity + analysisData.summary.thisWeek.quantity}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products Table */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900">
              {t("language") === "rw" ? "Ibyicuruzwa byagurishwe cyane" : "Top Products"}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">
                    {t("language") === "rw" ? "Icyicuruzwa" : "Product"}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">
                    {t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase">
                    {t("language") === "rw" ? "Umubare" : "Quantity"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analysisData.topProducts.slice(0, 5).map(([name, data], index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-[200px]">
                      {name}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      rwf {data.revenue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {data.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bar Chart - Week Comparison */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          {t("language") === "rw" ? "Icyumweru cyashize n'icyumweru gikurikira" : "Last Week vs This Week"}
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analysisData.barChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => {
              if (value >= 1000000) return `rwf ${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `rwf ${(value / 1000).toFixed(0)}k`;
              return `rwf ${value}`;
            }} />
            <Tooltip 
              formatter={(value: number) => [`rwf ${value.toLocaleString()}`, '']}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#3b82f6" name={t("language") === "rw" ? "Ingengo y'amafaranga" : "Revenue"} radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" fill="#10b981" name={t("language") === "rw" ? "Inyungu" : "Profit"} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Revenue Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
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

        {/* Combined Chart - Daily Trends */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            {t("language") === "rw" ? "Imiterere y'umunsi" : "Daily Trends (Last 30 Days)"}
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
                formatter={(value: number) => [`rwf ${value.toLocaleString()}`, '']}
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
      </div>
    </div>
  );
}
