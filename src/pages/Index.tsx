import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { SalesTrendChart } from "@/components/dashboard/SalesTrendChart";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
import { ShoppingCart, DollarSign, TrendingUp, Package } from "lucide-react";

const Dashboard = () => {
  return (
    <AppLayout title="Dashboard">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Today's Sales"
          value="47"
          subtitle="items sold"
          icon={ShoppingCart}
          trend={{ value: "12%", positive: true }}
        />
        <KPICard
          title="Today's Revenue"
          value="$8,420"
          icon={DollarSign}
          trend={{ value: "8%", positive: true }}
        />
        <KPICard
          title="Today's Profit"
          value="$2,180"
          icon={TrendingUp}
          trend={{ value: "5%", positive: true }}
        />
        <KPICard
          title="Current Stock Value"
          value="$124,500"
          subtitle="892 items"
          icon={Package}
        />
      </div>

      {/* Charts and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesTrendChart />
        </div>
        <div>
          <LowStockAlert />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
