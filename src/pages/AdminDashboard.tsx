import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { 
  Users, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp, 
  Activity,
  Server,
  Database,
  Clock,
  AlertCircle,
  Radio,
  BarChart3,
  Trash2
} from "lucide-react";
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
  Area,
  AreaChart,
} from "recharts";
import { adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { UptimeTimeline } from "@/components/admin/UptimeTimeline";

interface SystemStats {
  totalUsers: number;
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  recentUsers: number;
  recentProducts: number;
  recentSales: number;
}

interface User {
  _id: string;
  name: string;
  email?: string;
  businessName?: string;
  createdAt: string;
  productCount: number;
  saleCount: number;
  totalRevenue: number;
  totalProfit: number;
}

interface ActivityData {
  products: any[];
  sales: any[];
  users: any[];
}

interface UserUsage {
  userId: string;
  name: string;
  email: string | null;
  businessName: string | null;
  joinedDate: string;
  totalProducts: number;
  recentProducts: number;
  totalSales: number;
  recentSales: number;
  totalRevenue: number;
  totalProfit: number;
  lastProductDate: string | null;
  lastSaleDate: string | null;
  activityScore: number;
  avgSalesPerDay: number;
  isActive: boolean;
}

interface UsageSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalProductsCreated: number;
  totalSalesMade: number;
  avgProductsPerUser: string;
  avgSalesPerUser: string;
}

interface SystemHealth {
  database: string;
  timestamp: string;
  uptime: number;
  serverStartTime?: string;
  memory: {
    used: number;
    total: number;
  };
}

interface ApiStats {
  totalRequests: number;
  recentRequests: number;
  dailyRequests: number;
  endpointStats: Array<{
    endpoint: string;
    count: number;
    avgResponseTime: number;
    errors: number;
  }>;
  hourlyRequests: Array<{
    hour: number;
    count: number;
    timestamp: string;
  }>;
  statusCodeDistribution: Record<string, number>;
  avgResponseTime: number;
  liveRequests: Array<{
    id: string;
    method: string;
    path: string;
    endpoint: string;
    timestamp: string;
    statusCode: number;
    responseTime: number;
  }>;
}

const AdminDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [userUsage, setUserUsage] = useState<UserUsage[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [apiStats, setApiStats] = useState<ApiStats | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "activity" | "health">("overview");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadApiStats = async () => {
    try {
      const apiStatsRes = await adminApi.getApiStats();
      if (apiStatsRes.data) setApiStats(apiStatsRes.data);
    } catch (error) {
      console.error("Error loading API stats:", error);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    // Refresh API stats more frequently (every 5 seconds) for live updates
    const apiInterval = setInterval(() => {
      loadApiStats();
    }, 5000);
    return () => {
      clearInterval(interval);
      clearInterval(apiInterval);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, activityRes, usageRes, healthRes, apiStatsRes] = await Promise.all([
        adminApi.getSystemStats(),
        adminApi.getAllUsers(),
        adminApi.getUserActivity(7),
        adminApi.getUserUsage(30),
        adminApi.getSystemHealth(),
        adminApi.getApiStats(),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (usersRes.data) setUsers(usersRes.data);
      if (activityRes.data) setActivity(activityRes.data);
      if (usageRes.data) {
        setUserUsage(usageRes.data.users || []);
        setUsageSummary(usageRes.data.summary || null);
      }
      if (healthRes.data) setHealth(healthRes.data);
      if (apiStatsRes.data) setApiStats(apiStatsRes.data);
    } catch (error: any) {
      console.error("Error loading admin dashboard:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      await adminApi.deleteUser(userToDelete._id);
      
      // Remove user from local state
      setUsers(prev => prev.filter(u => u._id !== userToDelete._id));
      
      // Reload dashboard data to update stats
      await loadDashboardData();
      
      toast({
        title: "User Deleted",
        description: `User "${userToDelete.name}" and all their data have been deleted successfully.`,
      });
      
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: error.response?.error || error.message || "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading && !stats) {
    return (
      <AdminLayout 
        title="Admin Dashboard"
        activeSection={activeTab}
        onSectionChange={setActiveTab}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Admin Dashboard"
      activeSection={activeTab}
      onSectionChange={setActiveTab}
    >
      <div className="space-y-6">

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-normal">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{stats?.totalUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.recentUsers || 0} new in last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-normal">Total Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{stats?.totalProducts || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.recentProducts || 0} new in last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-normal">Total Sales</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{stats?.totalSales || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.recentSales || 0} in last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-normal">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">
                    {stats?.totalRevenue ? formatCurrency(stats.totalRevenue) : "$0"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Profit: {stats?.totalProfit ? formatCurrency(stats.totalProfit) : "$0"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="font-normal">System Summary</CardTitle>
                  <CardDescription>Overall system statistics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Users</span>
                    <span>{stats?.totalUsers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Products</span>
                    <span>{stats?.totalProducts || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Sales</span>
                    <span>{stats?.totalSales || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Revenue</span>
                    <span>
                      {stats?.totalRevenue ? formatCurrency(stats.totalRevenue) : "$0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Profit</span>
                    <span className="text-green-600">
                      {stats?.totalProfit ? formatCurrency(stats.totalProfit) : "$0"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="font-normal">Recent Activity (7 Days)</CardTitle>
                  <CardDescription>New items in the last week</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">New Users</span>
                    <span>{stats?.recentUsers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">New Products</span>
                    <span>{stats?.recentProducts || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">New Sales</span>
                    <span>{stats?.recentSales || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="font-normal">All Users</CardTitle>
              <CardDescription>Complete list of registered users and their activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 text-sm">Name</th>
                      <th className="text-left p-2 text-sm">Email</th>
                      <th className="text-left p-2 text-sm">Business</th>
                      <th className="text-left p-2 text-sm">Products</th>
                      <th className="text-left p-2 text-sm">Sales</th>
                      <th className="text-left p-2 text-sm">Revenue</th>
                      <th className="text-left p-2 text-sm">Profit</th>
                      <th className="text-left p-2 text-sm">Joined</th>
                      <th className="text-left p-2 text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-sm">{user.name}</td>
                        <td className="p-2 text-sm text-muted-foreground">{user.email || "-"}</td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {user.businessName || "-"}
                        </td>
                        <td className="p-2 text-sm">{user.productCount}</td>
                        <td className="p-2 text-sm">{user.saleCount}</td>
                        <td className="p-2 text-sm">{formatCurrency(user.totalRevenue)}</td>
                        <td className="p-2 text-sm text-green-600">
                          {formatCurrency(user.totalProfit)}
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(user)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete user and all their data"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            {/* Usage Summary */}
            {usageSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal">Total Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl">{usageSummary.totalUsers}</div>
                    <p className="text-xs text-muted-foreground">
                      {usageSummary.activeUsers} active, {usageSummary.inactiveUsers} inactive
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal">Total Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl">{usageSummary.totalProductsCreated}</div>
                    <p className="text-xs text-muted-foreground">
                      Avg: {usageSummary.avgProductsPerUser} per user
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal">Total Sales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl">{usageSummary.totalSalesMade}</div>
                    <p className="text-xs text-muted-foreground">
                      Avg: {usageSummary.avgSalesPerUser} per user
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal">Active Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl text-green-600">{usageSummary.activeUsers}</div>
                    <p className="text-xs text-muted-foreground">
                      {usageSummary.totalUsers > 0 
                        ? Math.round((usageSummary.activeUsers / usageSummary.totalUsers) * 100) 
                        : 0}% of total users
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* User Usage Statistics */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="font-normal">User System Usage (Last 30 Days)</CardTitle>
                <CardDescription>How users are utilizing the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 text-sm">User</th>
                        <th className="text-left p-2 text-sm">Activity Score</th>
                        <th className="text-left p-2 text-sm">Products</th>
                        <th className="text-left p-2 text-sm">Sales</th>
                        <th className="text-left p-2 text-sm">Avg Sales/Day</th>
                        <th className="text-left p-2 text-sm">Revenue</th>
                        <th className="text-left p-2 text-sm">Last Product</th>
                        <th className="text-left p-2 text-sm">Last Sale</th>
                        <th className="text-left p-2 text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userUsage.length > 0 ? (
                        userUsage.map((usage) => (
                          <tr key={usage.userId} className="border-b hover:bg-gray-50">
                            <td className="p-2">
                              <div>
                                <p className="text-sm">{usage.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {usage.businessName || usage.email || "No business"}
                                </p>
                              </div>
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={cn(
                                      "h-2 rounded-full",
                                      usage.activityScore > 10
                                        ? "bg-green-500"
                                        : usage.activityScore > 5
                                        ? "bg-yellow-500"
                                        : usage.activityScore > 0
                                        ? "bg-orange-500"
                                        : "bg-gray-300"
                                    )}
                                    style={{
                                      width: `${Math.min(100, (usage.activityScore / 50) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm">{usage.activityScore}</span>
                              </div>
                            </td>
                            <td className="p-2 text-sm">
                              <div>
                                <span>{usage.totalProducts}</span>
                                {usage.recentProducts > 0 && (
                                  <span className="text-xs text-green-600 ml-1">
                                    (+{usage.recentProducts})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 text-sm">
                              <div>
                                <span>{usage.totalSales}</span>
                                {usage.recentSales > 0 && (
                                  <span className="text-xs text-green-600 ml-1">
                                    (+{usage.recentSales})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 text-sm">{usage.avgSalesPerDay.toFixed(2)}</td>
                            <td className="p-2 text-sm">{formatCurrency(usage.totalRevenue)}</td>
                            <td className="p-2 text-sm text-muted-foreground">
                              {usage.lastProductDate ? formatDate(usage.lastProductDate) : "Never"}
                            </td>
                            <td className="p-2 text-sm text-muted-foreground">
                              {usage.lastSaleDate ? formatDate(usage.lastSaleDate) : "Never"}
                            </td>
                            <td className="p-2">
                              <span
                                className={cn(
                                  "px-2 py-1 rounded-full text-xs",
                                  usage.isActive
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                )}
                              >
                                {usage.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="p-4 text-center text-sm text-muted-foreground">
                            No user usage data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="font-normal">Recent Product Creations</CardTitle>
                  <CardDescription>Products created in the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {activity?.products && activity.products.length > 0 ? (
                      activity.products.slice(0, 10).map((product: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                          <div>
                            <p className="text-sm">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              By: {product.userId?.name || "Unknown"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(product.createdAt)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent product creations</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="font-normal">Recent Sales</CardTitle>
                  <CardDescription>Sales made in the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {activity?.sales && activity.sales.length > 0 ? (
                      activity.sales.slice(0, 10).map((sale: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                          <div>
                            <p className="text-sm">{sale.product}</p>
                            <p className="text-xs text-muted-foreground">
                              Qty: {sale.quantity} • By: {sale.userId?.name || "Unknown"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{formatCurrency(sale.revenue)}</p>
                            <p className="text-xs text-green-600">Profit: {formatCurrency(sale.profit)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent sales</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* System Health Tab */}
        {activeTab === "health" && (
          <div className="space-y-4">
            {/* System Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        health?.database === "connected" ? "bg-green-500" : "bg-red-500"
                      )}
                    />
                    <span className="text-sm capitalize">{health?.database || "Unknown"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uptime: {health ? formatUptime(health.uptime) : "N/A"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal flex items-center gap-2">
                    <Radio className="h-4 w-4" />
                    API Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{apiStats?.recentRequests || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Last hour • {apiStats?.dailyRequests || 0} today
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Avg Response
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{apiStats?.avgResponseTime || 0}ms</div>
                  <p className="text-xs text-muted-foreground">
                    {apiStats?.totalRequests || 0} total requests
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Memory
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{health?.memory.used || 0} MB</div>
                  <p className="text-xs text-muted-foreground">
                    {health ? Math.round((health.memory.used / health.memory.total) * 100) : 0}% used
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Uptime Wave Visualization */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="font-normal flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Uptime Timeline
                </CardTitle>
                <CardDescription>Visual representation of system availability</CardDescription>
              </CardHeader>
              <CardContent>
                {health && (
                  <UptimeTimeline 
                    uptime={health.uptime} 
                    serverStartTime={health.serverStartTime}
                  />
                )}
              </CardContent>
            </Card>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* API Requests Over Time */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="font-normal flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    API Requests (Last 24 Hours)
                  </CardTitle>
                  <CardDescription>Hourly request distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  {apiStats?.hourlyRequests && apiStats.hourlyRequests.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={apiStats.hourlyRequests}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="label" 
                            tick={{ fontSize: 11 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No API request data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Endpoint Distribution Pie Chart */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="font-normal flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Endpoint Distribution
                  </CardTitle>
                  <CardDescription>Most used API endpoints</CardDescription>
                </CardHeader>
                <CardContent>
                  {apiStats?.endpointStats && apiStats.endpointStats.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={apiStats.endpointStats.slice(0, 5)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ endpoint, percent }) => {
                              const parts = typeof endpoint === 'string' ? endpoint.split(' ') : [];
                              const path = parts.length > 1 ? parts[1] : (endpoint || 'Unknown');
                              return `${path}: ${(percent * 100).toFixed(0)}%`;
                            }}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {apiStats.endpointStats.slice(0, 5).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No endpoint data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Live API Requests and Endpoint Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Live API Requests */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="font-normal flex items-center gap-2">
                    <Radio className="h-5 w-5" />
                    Live API Requests
                  </CardTitle>
                  <CardDescription>Most recent API calls</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {apiStats?.liveRequests && apiStats.liveRequests.length > 0 ? (
                      apiStats.liveRequests.slice(0, 20).map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded text-sm">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-xs",
                              request.method === "GET" ? "bg-blue-100 text-blue-700" :
                              request.method === "POST" ? "bg-green-100 text-green-700" :
                              request.method === "PUT" ? "bg-yellow-100 text-yellow-700" :
                              request.method === "DELETE" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-700"
                            )}>
                              {request.method}
                            </span>
                            <span className="truncate">{request.path}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className={cn(
                              request.statusCode >= 400 ? "text-red-600" : "text-green-600"
                            )}>
                              {request.statusCode}
                            </span>
                            <span>{request.responseTime}ms</span>
                            <span>{new Date(request.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent API requests</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Endpoint Statistics Table */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="font-normal flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Endpoint Statistics
                  </CardTitle>
                  <CardDescription>Top API endpoints by usage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {apiStats?.endpointStats && apiStats.endpointStats.length > 0 ? (
                      apiStats.endpointStats.slice(0, 10).map((endpoint: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{endpoint.endpoint}</p>
                            <p className="text-xs text-muted-foreground">
                              Avg: {endpoint.avgResponseTime}ms
                              {endpoint.errors > 0 && (
                                <span className="text-red-600 ml-2">• {endpoint.errors} errors</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{endpoint.count}</p>
                            <p className="text-xs text-muted-foreground">requests</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No endpoint statistics available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button onClick={loadDashboardData} variant="outline">
            Refresh Data
          </Button>
        </div>

        {/* Delete User Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{userToDelete?.name}</strong>? 
                This action will permanently delete:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>The user account</li>
                  <li>All products ({userToDelete?.productCount || 0})</li>
                  <li>All sales ({userToDelete?.saleCount || 0})</li>
                  <li>All associated data</li>
                </ul>
                <span className="text-red-600 font-semibold mt-2 block">This action cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "Deleting..." : "Delete User"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
