import { useState, useMemo, useEffect } from "react";
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
import { ProductRankingPyramid } from "@/components/reports/ProductRankingPyramid";
import { DollarSign, TrendingUp, Package, Download, BarChart3, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playInfoBeep, initAudio } from "@/lib/sound";
import { useApi } from "@/hooks/useApi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Product {
  id?: number;
  _id?: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
}

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

const Reports = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    items: products,
    isLoading: productsLoading,
  } = useApi<Product>({
    endpoint: "products",
    defaultValue: [],
    onError: (error: any) => {
      // Don't show errors for connection issues (offline mode)
      if (error?.response?.silent || error?.response?.connectionError) {
        console.log("Offline mode: using local data");
        return;
      }
      console.error("Error loading products:", error);
      toast({
        title: "Error",
        description: "Failed to load products. Please try again.",
        variant: "destructive",
      });
    },
  });
  const {
    items: sales,
    isLoading: salesLoading,
  } = useApi<Sale>({
    endpoint: "sales",
    defaultValue: [],
    onError: (error: any) => {
      // Don't show errors for connection issues (offline mode)
      if (error?.response?.silent || error?.response?.connectionError) {
        console.log("Offline mode: using local data");
        return;
      }
      console.error("Error loading sales:", error);
      toast({
        title: "Error",
        description: "Failed to load sales. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getTodayDate = () => new Date().toISOString().split("T")[0];
  const getYearStartDate = () => {
    const date = new Date();
    date.setMonth(0);
    date.setDate(1);
    return date.toISOString().split("T")[0];
  };

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportType, setReportType] = useState("weekly");


  // Filter sales by date range
  const filteredSales = useMemo(() => {
    if (!startDate && !endDate) {
      // If no date filters, show all sales
      return sales;
    }
    
    return sales.filter(sale => {
      const saleDate = new Date(sale.date);
      saleDate.setHours(0, 0, 0, 0); // Normalize to start of day
      
      const start = startDate ? new Date(startDate) : null;
      if (start) {
        start.setHours(0, 0, 0, 0);
      }
      
      const end = endDate ? new Date(endDate) : null;
      if (end) {
        end.setHours(23, 59, 59, 999); // Set to end of day
      }
      
      if (start && end) {
      return saleDate >= start && saleDate <= end;
      } else if (start) {
        return saleDate >= start;
      } else if (end) {
        return saleDate <= end;
      }
      return true;
    });
  }, [sales, startDate, endDate]);

  // Aggregate sales data by product
  const salesByProduct = useMemo(() => {
    const aggregated: Record<string, { product: string; quantity: number; revenue: number; profit: number; cost: number }> = {};
    
    filteredSales.forEach(sale => {
      if (!aggregated[sale.product]) {
        aggregated[sale.product] = {
          product: sale.product,
          quantity: 0,
          revenue: 0,
          profit: 0,
          cost: 0,
        };
      }
      aggregated[sale.product].quantity += sale.quantity;
      aggregated[sale.product].revenue += sale.revenue;
      aggregated[sale.product].profit += sale.profit;
      aggregated[sale.product].cost += sale.cost;
    });

    return Object.values(aggregated).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  // Calculate product rankings by purchase frequency (quantity sold) - only for products in stock
  const productRankings = useMemo(() => {
    const productSales: Record<string, { productId: string; productName: string; totalQuantity: number; stock: number }> = {};
    
    // Aggregate sales by product
    filteredSales.forEach(sale => {
      const productIdentifier = sale.product;
      
      // Find product by ID or name
      const product = products.find(p => {
        const id = (p as any)._id || p.id;
        return id.toString() === productIdentifier || p.name === productIdentifier;
      });
      
      // Only process if product exists and is in stock
      if (product && product.stock > 0) {
        const productId = ((product as any)._id || product.id).toString();
        
        if (!productSales[productId]) {
          productSales[productId] = {
            productId,
            productName: product.name,
            totalQuantity: 0,
            stock: product.stock,
          };
        }
        
        productSales[productId].totalQuantity += sale.quantity;
      }
    });

    // Convert to array, sort by quantity (descending), and return top products
    return Object.values(productSales)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10); // Top 10 products for pyramid
  }, [filteredSales, products]);



  // Prepare sales over time data based on report type
  const salesOverTimeData = useMemo(() => {
    const timeMap: Record<string, { date: string; revenue: number; profit: number; quantity: number; label: string; monthDay: string }> = {};
    
    if (reportType === "daily") {
      // Daily: Show all days in the selected date range
      if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const currentDate = new Date(start);
      
      // Initialize all days in the range with zero values
      while (currentDate <= end) {
        const dateKey = currentDate.toISOString().split("T")[0];
        const date = new Date(currentDate);
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        
        timeMap[dateKey] = {
          date: dateKey,
          revenue: 0,
          profit: 0,
          quantity: 0,
          label: `${month} ${day}`,
          monthDay: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        };
        currentDate.setDate(currentDate.getDate() + 1);
        }
      }
      
      // Add sales data to the corresponding days
      filteredSales.forEach(sale => {
        const saleDate = sale.date;
        if (timeMap[saleDate]) {
          timeMap[saleDate].revenue += sale.revenue;
          timeMap[saleDate].profit += sale.profit;
          timeMap[saleDate].quantity += sale.quantity;
        } else if (!startDate && !endDate) {
          // If no date filter, create entries for all sales dates
          const date = new Date(saleDate);
          const month = date.toLocaleDateString('en-US', { month: 'short' });
          const day = date.getDate();
          
          if (!timeMap[saleDate]) {
            timeMap[saleDate] = {
              date: saleDate,
              revenue: 0,
              profit: 0,
              quantity: 0,
              label: `${month} ${day}`,
              monthDay: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            };
          }
          timeMap[saleDate].revenue += sale.revenue;
          timeMap[saleDate].profit += sale.profit;
          timeMap[saleDate].quantity += sale.quantity;
        }
      });
    } else if (reportType === "weekly") {
      // Weekly: Aggregate by weeks
      filteredSales.forEach(sale => {
        const date = new Date(sale.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
        const weekKey = weekStart.toISOString().split("T")[0];
        
        if (!timeMap[weekKey]) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          timeMap[weekKey] = {
            date: weekKey,
            revenue: 0,
            profit: 0,
            quantity: 0,
            label: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            monthDay: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          };
        }
        timeMap[weekKey].revenue += sale.revenue;
        timeMap[weekKey].profit += sale.profit;
        timeMap[weekKey].quantity += sale.quantity;
      });
    } else if (reportType === "monthly") {
      // Monthly: Aggregate by months
      filteredSales.forEach(sale => {
        const date = new Date(sale.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!timeMap[monthKey]) {
          const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          timeMap[monthKey] = {
            date: monthKey,
            revenue: 0,
            profit: 0,
            quantity: 0,
            label: monthName,
            monthDay: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          };
        }
        timeMap[monthKey].revenue += sale.revenue;
        timeMap[monthKey].profit += sale.profit;
        timeMap[monthKey].quantity += sale.quantity;
      });
      
      // For monthly, also generate empty months in the range for completeness
      if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const currentDate = new Date(start.getFullYear(), start.getMonth(), 1);
      
      while (currentDate <= end) {
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        if (!timeMap[monthKey]) {
          const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          timeMap[monthKey] = {
            date: monthKey,
            revenue: 0,
            profit: 0,
            quantity: 0,
            label: monthName,
            monthDay: currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          };
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
    }

    // Convert to array and sort
    return Object.values(timeMap)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales, reportType, startDate, endDate]);

  const totalRevenue = salesByProduct.reduce((sum, item) => sum + item.revenue, 0);
  const totalCost = salesByProduct.reduce((sum, item) => sum + item.cost, 0);
  const totalProfit = salesByProduct.reduce((sum, item) => sum + item.profit, 0);
  const totalQuantity = salesByProduct.reduce((sum, item) => sum + item.quantity, 0);
  const bestSelling = salesByProduct.length > 0 
    ? salesByProduct.reduce((best, item) => item.quantity > best.quantity ? item : best)
    : { product: "N/A", quantity: 0 };

  const handleExport = (format: string) => {
    playInfoBeep();
    
    if (format === "pdf") {
      exportToPDF();
    } else if (format === "excel") {
      exportToExcel();
    }
    
    toast({
      title: "Export Started",
      description: `Exporting report as ${format.toUpperCase()}...`,
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Add header with logo and report info on same line
    addHeader(doc, pageWidth, margin, reportType, startDate, endDate);
    
    // Start content after header
    let yPosition = 30;

    // Header already added above

    // Summary Section - Display as columns/headers
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Summary", margin, yPosition);
    yPosition += 8;

    // Summary as columns (headers with values below)
    const summaryHeaders = [
      'Total Revenue',
      'Total Cost', 
      'Total Profit',
      'Quantity Sold',
      'Best-Selling',
      'Best Qty',
      'Profit Margin'
    ];
    
    const summaryValues = [
      `rwf ${totalRevenue.toLocaleString()}`,
      `rwf ${totalCost.toLocaleString()}`,
      `rwf ${totalProfit.toLocaleString()}`,
      totalQuantity.toString(),
      bestSelling.product.length > 15 ? bestSelling.product.substring(0, 15) + '...' : bestSelling.product,
      `${bestSelling.quantity}`,
      totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : '0.0%'
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [summaryHeaders],
      body: [summaryValues],
      theme: 'striped',
      headStyles: { fillColor: [107, 114, 128], textColor: 255, fontStyle: 'normal', fontSize: 9 }, // Gray-500
      styles: { fontSize: 9, textColor: [31, 41, 55], halign: 'center' }, // Gray-800, centered
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'center' },
        1: { cellWidth: 'auto', halign: 'center' },
        2: { cellWidth: 'auto', halign: 'center' },
        3: { cellWidth: 'auto', halign: 'center' },
        4: { cellWidth: 'auto', halign: 'center' },
        5: { cellWidth: 'auto', halign: 'center' },
        6: { cellWidth: 'auto', halign: 'center' },
      },
      didDrawPage: (data: any) => {
        // Add header and footer on each page
        addHeader(doc, pageWidth, margin, reportType, startDate, endDate);
        addFooter(doc, pageWidth, pageHeight, margin);
      },
    });
    yPosition = (doc as any).lastAutoTable.finalY + 12;

    // Sales by Product Table
    if (salesByProduct.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Sales by Product", margin, yPosition);
      yPosition += 8;

      const tableData = salesByProduct.map(item => {
        const profitMargin = item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : '0.0';
        return [
          item.product,
          item.quantity.toString(),
          `rwf ${item.revenue.toLocaleString()}`,
          `rwf ${item.cost.toLocaleString()}`,
          `rwf ${item.profit.toLocaleString()}`,
          `${profitMargin}%`
        ];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['Product', 'Quantity', 'Revenue', 'Cost', 'Profit', 'Profit Margin']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [107, 114, 128], textColor: 255, fontStyle: 'normal' }, // Gray-500
        alternateRowStyles: { fillColor: [249, 250, 251] }, // Gray-50
        styles: { fontSize: 9, textColor: [31, 41, 55] }, // Gray-800
        margin: { left: margin, right: margin },
        didDrawPage: (data: any) => {
          // Add header and footer on each page
          addHeader(doc, pageWidth, margin, reportType, startDate, endDate);
          addFooter(doc, pageWidth, pageHeight, margin);
        },
      });
      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Sales Over Time Table
    if (salesOverTimeData.length > 0) {
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        addHeader(doc, pageWidth, margin, reportType, startDate, endDate);
        yPosition = 30; // Start after header
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text(`Sales Over Time (${reportType.charAt(0).toUpperCase() + reportType.slice(1)})`, margin, yPosition);
      yPosition += 8;

      const timeTableData = salesOverTimeData
        .filter(item => item.revenue > 0 || item.profit > 0) // Only show periods with sales
        .slice(0, 50) // Limit to 50 rows to avoid PDF being too large
        .map(item => {
          const dateLabel = reportType === "daily" 
            ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : reportType === "weekly"
            ? item.monthDay
            : item.monthDay;
          return [
            dateLabel,
            `rwf ${item.revenue.toLocaleString()}`,
            `rwf ${item.profit.toLocaleString()}`,
            item.quantity.toString()
          ];
        });

      if (timeTableData.length > 0) {
        autoTable(doc, {
          startY: yPosition,
          head: [['Period', 'Revenue', 'Profit', 'Quantity']],
          body: timeTableData,
          theme: 'striped',
          headStyles: { fillColor: [107, 114, 128], textColor: 255, fontStyle: 'normal' }, // Gray-500
          alternateRowStyles: { fillColor: [249, 250, 251] }, // Gray-50
          styles: { fontSize: 9, textColor: [31, 41, 55] }, // Gray-800
          margin: { left: margin, right: margin },
          didDrawPage: (data: any) => {
            // Add header and footer on each page
            addHeader(doc, pageWidth, margin, reportType, startDate, endDate);
            addFooter(doc, pageWidth, pageHeight, margin);
          },
        });
      }
    }

    // Add footer to the last page
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(doc, pageWidth, pageHeight, margin, i, totalPages);
    }

    // Save the PDF
    const fileName = `Sales_Report_${reportType}_${startDate}_to_${endDate}.pdf`;
    doc.save(fileName);
  };

  // Helper function to add header to each page (logo and report info on same line)
  const addHeader = (doc: jsPDF, pageWidth: number, margin: number, reportType?: string, startDate?: string, endDate?: string) => {
    // Try to add logo image
    let logoX = margin;
    let logoHeight = 6;
    let logoY = 12; // Vertical center alignment
    
    try {
      // Get logo from DOM if available (for synchronous access)
      const logoElement = document.querySelector('img[src="/logo.png"]') as HTMLImageElement;
      if (logoElement && logoElement.complete) {
        // Create canvas to convert image to base64
        const canvas = document.createElement('canvas');
        canvas.width = logoElement.naturalWidth || 32;
        canvas.height = logoElement.naturalHeight || 32;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(logoElement, 0, 0);
          const imgData = canvas.toDataURL('image/png');
          // Add logo image (6mm height, vertically centered)
          doc.addImage(imgData, 'PNG', margin, logoY, logoHeight, logoHeight);
          logoX = margin + logoHeight + 2; // 2mm spacing between logo and text
        }
      }
    } catch (error) {
      // Logo failed, continue with text only
    }
    
    // Add "trippo" text next to logo (vertically aligned)
    doc.setTextColor(55, 65, 81); // Gray-700 text
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    // Calculate text Y position to align with logo center (logoY + logoHeight/2 - textHeight/2)
    const textY = logoY + logoHeight / 2 + 2; // +2 for slight adjustment
    doc.text("trippo", logoX, textY);
    
    // Add report info on the same line (right side)
    if (reportType && startDate && endDate) {
      const reportTypeText = `Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`;
      const dateRangeText = `Date Range: ${startDate} to ${endDate}`;
      const generatedText = `Generated: ${new Date().toLocaleString()}`;
      const separator = "  •  ";
      const fullInfoText = `${reportTypeText}${separator}${dateRangeText}${separator}${generatedText}`;
      
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128); // Gray-500
      // Calculate text width and position it on the right, aligned with logo/text line
      const textWidth = doc.getTextWidth(fullInfoText);
      const infoX = pageWidth - margin - textWidth;
      doc.text(fullInfoText, infoX, textY); // Use same Y position as "trippo" text
    }
    
    // Draw a subtle line separator
    doc.setDrawColor(229, 231, 235); // Gray-200
    doc.line(margin, 20, pageWidth - margin, 20);
    
    // Reset text color for body
    doc.setTextColor(0, 0, 0); // Black text
  };

  // Helper function to add footer to each page
  const addFooter = (doc: jsPDF, pageWidth: number, pageHeight: number, margin: number, currentPage?: number, totalPages?: number) => {
    const footerY = pageHeight - 15;
    
    // Draw a line separator
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100); // Gray text
    
    // Left side - Generated by Trippo
    doc.text("Generated by Trippo", margin, footerY);
    
    // Right side - Page number and date
    const rightText = currentPage && totalPages 
      ? `Page ${currentPage} of ${totalPages} | ${new Date().toLocaleDateString()}`
      : new Date().toLocaleDateString();
    doc.text(rightText, pageWidth - margin, footerY, { align: 'right' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['Report Summary'],
      [''],
      ['Report Type', reportType.charAt(0).toUpperCase() + reportType.slice(1)],
      ['Start Date', startDate],
      ['End Date', endDate],
      ['Generated', new Date().toLocaleString()],
      [''],
      ['Total Revenue', `rwf ${totalRevenue.toLocaleString()}`],
      ['Total Cost', `rwf ${totalCost.toLocaleString()}`],
      ['Total Profit', `rwf ${totalProfit.toLocaleString()}`],
      ['Total Quantity Sold', totalQuantity],
      ['Best-Selling Product', bestSelling.product],
      ['Best-Selling Quantity', bestSelling.quantity],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Sales by Product Sheet
    if (salesByProduct.length > 0) {
      const productHeaders = ['Product', 'Quantity Sold', 'Revenue', 'Cost', 'Profit', 'Profit Margin %'];
      const productData = salesByProduct.map(item => {
        const profitMargin = item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : '0.0';
        return [
          item.product,
          item.quantity,
          item.revenue,
          item.cost,
          item.profit,
          parseFloat(profitMargin)
        ];
      });
      const productSheet = XLSX.utils.aoa_to_sheet([productHeaders, ...productData]);
      XLSX.utils.book_append_sheet(workbook, productSheet, 'Sales by Product');
    }

    // Sales Over Time Sheet
    if (salesOverTimeData.length > 0) {
      const timeHeaders = ['Period', 'Date', 'Revenue', 'Profit', 'Quantity'];
      const timeData = salesOverTimeData.map(item => {
        const dateLabel = reportType === "daily" 
          ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : reportType === "weekly"
          ? item.monthDay
          : item.monthDay;
        return [
          dateLabel,
          item.date,
          item.revenue,
          item.profit,
          item.quantity
        ];
      });
      const timeSheet = XLSX.utils.aoa_to_sheet([timeHeaders, ...timeData]);
      XLSX.utils.book_append_sheet(workbook, timeSheet, `Sales Over Time (${reportType})`);
    }

    // Save the Excel file
    const fileName = `Sales_Report_${reportType}_${startDate}_to_${endDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };


  // Reports Page Skeleton
  const ReportsSkeleton = () => (
    <AppLayout title="Reports">
      <div className="flex flex-col space-y-6 pb-6">
        {/* Report Filters Skeleton */}
        <div className="form-card border-transparent lg:bg-white bg-white/80 backdrop-blur-md">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Skeleton className="h-10 w-full sm:w-32 rounded-lg" />
            <Skeleton className="h-10 w-full sm:w-32 rounded-lg" />
          </div>
        </div>

        {/* Report Summary Cards Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="kpi-card">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
                <div className="ml-4 shrink-0">
                  <Skeleton className="w-12 h-12 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/80 backdrop-blur-md lg:bg-white border border-gray-200 rounded-lg p-4 sm:p-6 overflow-x-auto">
            <div className="flex items-center gap-2 mb-6">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-96 w-full rounded" />
          </div>
          <div className="bg-white/80 backdrop-blur-md lg:bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-6">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-96 w-full rounded" />
          </div>
        </div>
      </div>
    </AppLayout>
  );

  if (productsLoading || salesLoading) {
    return <ReportsSkeleton />;
  }

  return (
    <AppLayout title="Reports">
      <div className="flex flex-col space-y-6 pb-6">
      {/* Report Filters */}
      <div className="form-card border-transparent">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label>{t("startDate")}</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("endDate")}</Label>
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
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => handleExport("pdf")} className="bg-red-500 text-white hover:bg-red-600 border border-transparent shadow-sm hover:shadow transition-all font-medium px-4 py-2 gap-2 w-full sm:w-auto">
            <Download size={16} />
            {t("exportPdf")}
          </Button>
          <Button onClick={() => handleExport("excel")} className="bg-green-500 text-white hover:bg-green-600 border border-transparent shadow-sm hover:shadow transition-all font-medium px-4 py-2 gap-2 w-full sm:w-auto">
            <Download size={16} />
            {t("exportExcel")}
          </Button>
        </div>
      </div>

      {/* Report Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
            <KPICard
              title={t("totalRevenue")}
              value={`rwf ${totalRevenue.toLocaleString()}`}
              icon={DollarSign}
            />
            <KPICard
              title={t("language") === "rw" ? "Agaciro" : "Total Cost"}
              value={`rwf ${totalCost.toLocaleString()}`}
              icon={Package}
            />
            <KPICard
              title={t("totalProfit")}
              value={`rwf ${totalProfit.toLocaleString()}`}
              icon={TrendingUp}
            />
            <KPICard
              title={t("language") === "rw" ? "Icuruzwa cyagurishwe cyane" : "Best-Selling Product"}
              value={bestSelling.product.split(" ").slice(0, 2).join(" ")}
              subtitle={`${bestSelling.quantity} ${t("language") === "rw" ? "ibintu byagurishwe" : "units sold"}`}
              icon={Package}
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Over Time Histogram - Based on Report Type */}
            <div className="bg-white/80 backdrop-blur-md lg:bg-white border border-gray-200 rounded-lg p-4 sm:p-6 overflow-x-auto">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 size={20} className="text-gray-600 shrink-0" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                  {t("salesTrend")} - {reportType === "daily" ? (t("language") === "rw" ? "Buri munsi" : "Daily") : reportType === "weekly" ? (t("language") === "rw" ? "Buri cyumweru" : "Weekly") : (t("language") === "rw" ? "Buri kwezi" : "Monthly")}
                </h3>
              </div>
              {salesOverTimeData.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" minWidth={300} height={400}>
                  <BarChart data={salesOverTimeData} margin={{ top: 20, right: 30, left: 20, bottom: reportType === "daily" ? 80 : 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey={reportType === "monthly" ? "monthDay" : reportType === "weekly" ? "monthDay" : "monthDay"}
                      tick={{ fontSize: reportType === "daily" ? 9 : 11, fill: '#6b7280' }}
                      angle={reportType === "daily" ? -45 : -45}
                      textAnchor="end"
                      height={reportType === "daily" ? 100 : 80}
                      interval={reportType === "daily" ? Math.max(0, Math.floor(salesOverTimeData.length / 12) - 1) : reportType === "weekly" ? 0 : 0}
                      tickFormatter={(value) => {
                        if (reportType === "daily") {
                          const item = salesOverTimeData.find(d => d.monthDay === value);
                          if (item) {
                            const date = new Date(item.date);
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          }
                        }
                        return value;
                      }}
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
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '10px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      }}
                      labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '4px' }}
                      labelFormatter={(value) => {
                        const item = salesOverTimeData.find(d => d.monthDay === value);
                        if (!item) return value;
                        
                        if (reportType === "daily") {
                          const date = new Date(item.date);
                          return date.toLocaleDateString('en-US', { 
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });
                        } else if (reportType === "weekly") {
                          return item.label;
                        } else {
                          return item.label;
                        }
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'revenue') return [`rwf ${value.toLocaleString()}`, t("revenue")];
                        if (name === 'profit') return [`rwf ${value.toLocaleString()}`, t("profit")];
                        return [value, name];
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="rect"
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" name={t("revenue")} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="profit" fill="#10b981" name={t("profit")} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-gray-500">
                  {t("language") === "rw" ? "Nta makuru y'ubucuruzi aboneka" : "No sales data available"}
                      </div>
              )}
            </div>

            {/* Product Rankings Pyramid */}
            <div className="bg-white/80 backdrop-blur-md lg:bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Trophy size={20} className="text-gray-600 shrink-0" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                  {t("language") === "rw" ? "Icuruzwa cyagurishwe cyane" : "Product Rankings by Sales"}
                </h3>
              </div>
              <ProductRankingPyramid rankings={productRankings} />
            </div>
          </div>
      </div>
    </AppLayout>
  );
};

export default Reports;
