import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KPICard } from "@/components/dashboard/KPICard";
import { DollarSign, TrendingUp, Package, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const reportData = [
  { product: "iPhone 15 Pro Max", quantity: 24, revenue: 28776, profit: 4800 },
  { product: "Samsung Galaxy S24", quantity: 18, revenue: 16182, profit: 1800 },
  { product: "MacBook Pro 16\"", quantity: 8, revenue: 19992, profit: 2400 },
  { product: "AirPods Pro 2", quantity: 45, revenue: 11205, profit: 2250 },
  { product: "Apple Watch Ultra", quantity: 15, revenue: 11985, profit: 1500 },
];

const Reports = () => {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState("2025-01-10");
  const [reportType, setReportType] = useState("weekly");
  const [showReport, setShowReport] = useState(true);

  const totalRevenue = reportData.reduce((sum, item) => sum + item.revenue, 0);
  const totalCost = reportData.reduce((sum, item) => sum + (item.revenue - item.profit), 0);
  const totalProfit = reportData.reduce((sum, item) => sum + item.profit, 0);
  const bestSelling = reportData.reduce((best, item) =>
    item.quantity > best.quantity ? item : best
  );

  const handleGenerateReport = () => {
    setShowReport(true);
    toast({
      title: "Report Generated",
      description: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report from ${startDate} to ${endDate}`,
    });
  };

  const handleExport = (format: string) => {
    toast({
      title: "Export Started",
      description: `Exporting report as ${format.toUpperCase()}...`,
    });
  };

  return (
    <AppLayout title="Reports">
      {/* Report Filters */}
      <div className="form-card mb-6">
        <h3 className="section-title flex items-center gap-2">
          <FileText size={20} />
          Generate Report
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="input-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleGenerateReport} className="btn-primary w-full">
              Generate Report
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => handleExport("pdf")} variant="outline" className="btn-secondary gap-2">
            <Download size={16} />
            Export PDF
          </Button>
          <Button onClick={() => handleExport("excel")} variant="outline" className="btn-secondary gap-2">
            <Download size={16} />
            Export Excel
          </Button>
        </div>
      </div>

      {showReport && (
        <>
          {/* Report Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              title="Total Revenue"
              value={`$${totalRevenue.toLocaleString()}`}
              icon={DollarSign}
            />
            <KPICard
              title="Total Cost"
              value={`$${totalCost.toLocaleString()}`}
              icon={Package}
            />
            <KPICard
              title="Total Profit"
              value={`$${totalProfit.toLocaleString()}`}
              icon={TrendingUp}
            />
            <KPICard
              title="Best-Selling Product"
              value={bestSelling.product.split(" ").slice(0, 2).join(" ")}
              subtitle={`${bestSelling.quantity} units sold`}
              icon={Package}
            />
          </div>

          {/* Report Table */}
          <div className="kpi-card overflow-x-auto">
            <h3 className="section-title">Detailed Report</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity Sold</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((item, index) => (
                  <tr key={index}>
                    <td className="font-medium">{item.product}</td>
                    <td>{item.quantity}</td>
                    <td>${item.revenue.toLocaleString()}</td>
                    <td className="font-semibold">${item.profit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/50">
                  <td className="font-semibold py-4 px-4">Total</td>
                  <td className="font-semibold py-4 px-4">
                    {reportData.reduce((sum, item) => sum + item.quantity, 0)}
                  </td>
                  <td className="font-semibold py-4 px-4">${totalRevenue.toLocaleString()}</td>
                  <td className="font-semibold py-4 px-4">${totalProfit.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default Reports;
