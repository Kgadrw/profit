import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { SalesTrendChart } from "@/components/dashboard/SalesTrendChart";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ShoppingCart, DollarSign, TrendingUp, Package, Plus, Eye, EyeOff, X, Check, ChevronsUpDown, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { playSaleBeep, playErrorBeep, playWarningBeep, initAudio } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";

interface Product {
  id?: number;
  _id?: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  isPackage?: boolean;
  packageQuantity?: number;
  productType?: string;
  minStock?: number;
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

interface BulkSaleFormData {
  product: string;
  quantity: string;
  sellingPrice: string;
  paymentMethod: string;
  saleDate: string;
}

// Product Combobox Component
interface ProductComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  products: Product[];
  placeholder?: string;
  className?: string;
  onError?: (message: string) => void;
}

const ProductCombobox = ({ value, onValueChange, products, placeholder = "Search products by name, category, or type...", className, onError }: ProductComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
    // Filter out products with stock <= 0 (sold out)
    const availableProducts = products.filter((product) => product.stock > 0);
    
    if (!searchQuery) return availableProducts;
    const query = searchQuery.toLowerCase();
    return availableProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        (product.productType && product.productType.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  const selectedProduct = products.find((p) => {
    const id = (p as any)._id || p.id;
    return id.toString() === value;
  });

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              type="text"
              value={selectedProduct ? selectedProduct.name : searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!open) setOpen(true);
                if (e.target.value === "") {
                  onValueChange("");
                }
              }}
              onFocus={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
              placeholder={placeholder}
              className={cn("pl-10 pr-10 cursor-text", className)}
            />
            {selectedProduct && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onValueChange("");
                  setSearchQuery("");
                  setOpen(true);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {!selectedProduct && (
              <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[var(--radix-popover-trigger-width)] p-0" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Prevent closing when clicking on the input
            const target = e.target as HTMLElement;
            if (target.closest('[role="combobox"]') || target.closest('.relative')) {
              e.preventDefault();
            }
          }}
        >
          <Command shouldFilter={false}>
            <CommandList>
              <CommandEmpty>No products found.</CommandEmpty>
              <CommandGroup>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={`${product.name} ${product.category} ${product.productType || ""}`}
                      onSelect={() => {
                        // Double-check stock before allowing selection
                        if (product.stock > 0) {
                          onValueChange(product.id.toString());
                          setOpen(false);
                          setSearchQuery("");
                        } else {
                          if (onError) {
                            onError(`${product.name} is currently out of stock and cannot be sold.`);
                          }
                        }
                      }}
                      disabled={product.stock <= 0}
                      className={cn(
                        "flex items-center justify-between",
                        product.stock <= 0 && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            value === product.id.toString() ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="truncate font-medium">{product.name}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{product.category}</span>
                            {product.productType && (
                              <>
                                <span>•</span>
                                <span>{product.productType}</span>
                              </>
                            )}
                            {product.isPackage && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Package size={10} />
                                  Box of {product.packageQuantity}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold ml-2">
                          rwf {product.sellingPrice.toLocaleString()}
                        </div>
                      </div>
                    </CommandItem>
                  ))
                ) : (
                  <CommandEmpty>No products found. Try a different search.</CommandEmpty>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const Dashboard = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    items: products,
    isLoading: productsLoading,
  } = useApi<Product>({
    endpoint: "products",
    defaultValue: [],
    onError: (error) => {
      // Only log, don't show toast here - let the skeleton handle the loading state
      console.error("Error loading products:", error);
    },
  });
  const {
    items: sales,
    isLoading: salesLoading,
    add: addSale,
    bulkAdd: bulkAddSales,
    refresh: refreshSales,
  } = useApi<Sale>({
    endpoint: "sales",
    defaultValue: [],
    onError: (error) => {
      // Only log, don't show toast here - let the skeleton handle the loading state
      console.error("Error with sales:", error);
    },
  });
  const getTodayDate = () => new Date().toISOString().split("T")[0];
  
  // Calculate KPI values from real data
  const todayStats = useMemo(() => {
    const today = getTodayDate();
    const todaySales = sales.filter((sale) => {
      // Handle both string dates and Date objects from MongoDB
      const saleDate = typeof sale.date === 'string' 
        ? sale.date.split('T')[0] 
        : new Date(sale.date).toISOString().split('T')[0];
      return saleDate === today;
    });
    
    const totalItems = todaySales.reduce((sum, sale) => sum + sale.quantity, 0);
    const totalRevenue = todaySales.reduce((sum, sale) => sum + sale.revenue, 0);
    const totalProfit = todaySales.reduce((sum, sale) => sum + sale.profit, 0);
    
    return { totalItems, totalRevenue, totalProfit };
  }, [sales]);
  
  const stockStats = useMemo(() => {
    const totalStockValue = products.reduce(
      (sum, product) => sum + product.costPrice * product.stock,
      0
    );
    const totalItems = products.reduce((sum, product) => sum + product.stock, 0);
    
    return { totalStockValue, totalItems };
  }, [products]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saleDate, setSaleDate] = useState(getTodayDate());
  const [bulkSales, setBulkSales] = useState<BulkSaleFormData[]>([
    { product: "", quantity: "1", sellingPrice: "", paymentMethod: "cash", saleDate: getTodayDate() }
  ]);
  const [isRecordingSale, setIsRecordingSale] = useState(false);

  // Sync sale date with today's date on component mount
  useEffect(() => {
    setSaleDate(getTodayDate());
    setPaymentMethod("cash"); // Set default payment method to cash
  }, []);

  // Clear selected product if it becomes out of stock
  useEffect(() => {
    if (selectedProduct) {
      const product = products.find((p) => {
        const id = (p as any)._id || p.id;
        return id.toString() === selectedProduct;
      });
      if (product && product.stock <= 0) {
        setSelectedProduct("");
        setSellingPrice("");
        playWarningBeep();
        toast({
          title: "Product Out of Stock",
          description: `${product.name} is now out of stock and has been removed from selection.`,
          variant: "destructive",
        });
      }
    }
  }, [products, selectedProduct]);

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => {
      const id = (p as any)._id || p.id;
      return id.toString() === productId;
    });
    
    // Prevent selecting products with stock <= 0
    if (product && product.stock <= 0) {
      playErrorBeep();
      toast({
        title: "Product Out of Stock",
        description: `${product.name} is currently out of stock and cannot be sold.`,
        variant: "destructive",
      });
      setSelectedProduct("");
      setSellingPrice("");
      return;
    }
    
    setSelectedProduct(productId);
    if (product) {
      // Suggest the existing selling price, but allow user to change it
      setSellingPrice(product.sellingPrice.toString());
    } else {
      setSellingPrice("");
    }
  };

  const addBulkRow = () => {
    setBulkSales([...bulkSales, { product: "", quantity: "1", sellingPrice: "", paymentMethod: "cash", saleDate: getTodayDate() }]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkSales.length > 1) {
      setBulkSales(bulkSales.filter((_, i) => i !== index));
    }
  };

  const updateBulkSale = (index: number, field: keyof BulkSaleFormData, value: string) => {
    const updated = [...bulkSales];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-fill selling price when product is selected
    if (field === "product" && value) {
      const product = products.find((p) => {
        const id = (p as any)._id || p.id;
        return id.toString() === value;
      });
      if (product) {
        updated[index].sellingPrice = product.sellingPrice.toString();
      }
    }
    
    setBulkSales(updated);
  };


  const handleRecordSale = async () => {
    // Prevent duplicate submissions
    if (isRecordingSale) {
      return;
    }

    // Initialize audio immediately on button click (user interaction ensures audio works)
    initAudio();
    
    // Set loading state
    setIsRecordingSale(true);

    try {
      if (isBulkMode) {
      // Bulk add mode
      // Validate all bulk sales before creating them
      const invalidSales: string[] = [];
      const salesToCreate = bulkSales
        .filter((sale) => sale.product.trim() !== "" && sale.quantity && sale.sellingPrice)
        .map((sale) => {
          const product = products.find((p) => {
            const id = (p as any)._id || p.id;
            return id.toString() === sale.product;
          });
          if (!product) return null;
          
          const qty = parseInt(sale.quantity) || 1;
          
          // Validate quantity is valid
          if (isNaN(qty) || qty <= 0) {
            invalidSales.push(`${product.name}: Invalid quantity`);
            return null;
          }
          
          // Check if quantity exceeds stock (strict check)
          if (qty > product.stock || product.stock <= 0) {
            invalidSales.push(`${product.name}: Only ${product.stock} ${product.stock === 1 ? 'item' : 'items'} available`);
            return null;
          }
          
          const price = parseFloat(sale.sellingPrice) || 0;
          const revenue = qty * price;
          const cost = qty * product.costPrice;
          const profit = revenue - cost;

          return {
            product: product.name,
            productId: product._id || product.id,
            quantity: qty,
            revenue,
            cost,
            profit,
            date: sale.saleDate || getTodayDate(),
            paymentMethod: sale.paymentMethod || "cash",
          };
        })
        .filter((sale): sale is any => sale !== null);
      
        // Show error if any sales have insufficient stock
        if (invalidSales.length > 0) {
          playErrorBeep();
          toast({
            title: "Insufficient Stock",
            description: `Cannot record sales for: ${invalidSales.join(', ')}. You cannot sell more than available quantity.`,
            variant: "destructive",
          });
          setIsRecordingSale(false);
          return;
        }

        if (salesToCreate.length > 0) {
          await bulkAddSales(salesToCreate as any);
          await refreshSales();

          playSaleBeep();

          // Reset bulk form
          setBulkSales([{ product: "", quantity: "1", sellingPrice: "", paymentMethod: "cash", saleDate: getTodayDate() }]);
          setIsBulkMode(false);

          toast({
            title: "Sales Recorded",
            description: `Successfully recorded ${salesToCreate.length} sale(s).`,
          });
        } else {
          playWarningBeep();
          toast({
            title: "No Sales Recorded",
            description: "Please fill in at least one complete sale entry.",
            variant: "destructive",
          });
        }
    } else {
      // Single sale mode
      if (!selectedProduct || !quantity || !sellingPrice || !paymentMethod) {
        // Play error beep immediately (we're in user interaction context)
        playErrorBeep();
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        setIsRecordingSale(false);
        return;
      }

      const product = products.find((p) => {
        const id = (p as any)._id || p.id;
        return id.toString() === selectedProduct;
      });
      if (!product) {
        setIsRecordingSale(false);
        return;
      }

      const qty = parseInt(quantity);
      
      // Validate quantity is valid
      if (isNaN(qty) || qty <= 0) {
        playErrorBeep();
        toast({
          title: "Invalid Quantity",
          description: "Please enter a valid quantity greater than 0.",
          variant: "destructive",
        });
        setIsRecordingSale(false);
        return;
      }
      
      // Validate quantity doesn't exceed available stock (strict check)
      if (qty > product.stock || product.stock <= 0) {
        playErrorBeep();
        toast({
          title: "Insufficient Stock",
          description: `Only ${product.stock} ${product.stock === 1 ? 'item' : 'items'} available in stock. You cannot sell more than available quantity.`,
          variant: "destructive",
        });
        setIsRecordingSale(false);
        return;
      }
      
      const price = parseFloat(sellingPrice);
      const revenue = qty * price;
      const cost = qty * product.costPrice;
      const profit = revenue - cost;

      const newSale = {
        product: product.name,
        productId: product._id || product.id,
        quantity: qty,
        revenue,
        cost,
        profit,
        date: saleDate,
        paymentMethod: paymentMethod,
      };

        await addSale(newSale as any);
        await refreshSales();

        // Play sale beep after recording (audio context should still be active from button click)
        // The playSaleBeep function will handle resuming if needed
        playSaleBeep();

        // Reset form
        setSelectedProduct("");
        setQuantity("1");
        setSellingPrice("");
        setPaymentMethod("cash"); // Reset to default cash
        setSaleDate(getTodayDate()); // Reset to today's date

        toast({
          title: "Sale Recorded",
          description: `Successfully recorded sale of ${qty}x ${product.name}`,
        });
      }
    } catch (error) {
      playErrorBeep();
      toast({
        title: "Record Failed",
        description: "Failed to record sale. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Always reset loading state
      setIsRecordingSale(false);
    }
  };

  const isLoading = productsLoading || salesLoading;

  // KPI Card Skeleton Component
  const KPICardSkeleton = () => (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="ml-4 shrink-0">
          <Skeleton className="w-12 h-12 rounded" />
        </div>
      </div>
    </div>
  );

  // Chart Skeleton Component
  const ChartSkeleton = () => (
    <div className="kpi-card">
      <Skeleton className="h-6 w-48 mb-4" />
      <div className="h-64 flex items-center justify-center">
        <div className="w-full h-full space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-3/6" />
          <Skeleton className="h-4 w-2/6" />
        </div>
      </div>
    </div>
  );

  // Low Stock Alert Skeleton Component
  const LowStockSkeleton = () => (
    <div className="kpi-card border border-transparent bg-white">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-10 h-10 rounded" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between py-2 px-2">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-7 w-7 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AppLayout title="Dashboard">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              title={t("todaysItems")}
              value={todayStats.totalItems.toString()}
              subtitle={t("language") === "rw" ? "ibintu byagurishwe" : "items sold"}
              icon={ShoppingCart}
            />
            <KPICard
              title={t("todaysRevenue")}
              value={`${todayStats.totalRevenue.toLocaleString()} rwf`}
              icon={DollarSign}
            />
            <KPICard
              title={t("todaysProfit")}
              value={`${todayStats.totalProfit.toLocaleString()} rwf`}
              icon={TrendingUp}
            />
            <KPICard
              title={t("currentStockValue")}
              value={`${stockStats.totalStockValue.toLocaleString()} rwf`}
              subtitle={`${stockStats.totalItems} ${t("items")}`}
              icon={Package}
            />
          </>
        )}
      </div>

      {/* Record New Sale Form */}
      <div className="form-card mb-6 border-transparent">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title flex items-center gap-2 text-gray-800">
            <Plus size={20} className="text-gray-700" />
            {t("recordNewSale")}
          </h3>
          <div className="flex gap-2">
            {!isBulkMode && (
              <Button
                onClick={() => setIsBulkMode(true)}
                className="bg-gray-500 text-white hover:bg-gray-600 border border-transparent shadow-sm hover:shadow transition-all font-medium px-4 py-2 gap-2"
              >
                <Plus size={16} />
                {t("bulkAdd")}
              </Button>
            )}
            {isBulkMode && (
              <Button
                onClick={() => {
                  setIsBulkMode(false);
                  setBulkSales([{ product: "", quantity: "1", sellingPrice: "", paymentMethod: "cash", saleDate: getTodayDate() }]);
                }}
                variant="ghost"
                className="text-gray-700"
              >
                {t("singleSale")}
              </Button>
            )}
          </div>
        </div>

        {isBulkMode ? (
          /* Bulk Add Form */
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">Add multiple sales at once</p>
              <Button
                onClick={addBulkRow}
                className="bg-gray-500 text-white hover:bg-gray-600 border border-transparent shadow-sm hover:shadow transition-all font-medium px-3 py-2 gap-2"
              >
                <Plus size={14} />
                {t("addRow")}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white border-b border-transparent">
                  <tr>
                    <th className="text-left p-2 text-xs font-medium text-foreground">Product</th>
                    <th className="text-left p-2 text-xs font-medium text-foreground">{t("quantity")}</th>
                    <th className="text-left p-2 text-xs font-medium text-foreground">{t("sellingPrice")} (rwf)</th>
                    <th className="text-left p-2 text-xs font-medium text-foreground">{t("paymentMethod")}</th>
                    <th className="text-left p-2 text-xs font-medium text-foreground">{t("saleDate")}</th>
                    <th className="text-left p-2 text-xs font-medium text-foreground w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkSales.map((sale, index) => (
                    <tr key={index} className="border-b border-transparent last:border-0">
                      <td className="p-2">
                        <ProductCombobox
                          value={sale.product}
                          onValueChange={(value) => updateBulkSale(index, "product", value)}
                          products={products}
                          placeholder="Search products by name, category, or type..."
                          className="h-9"
                          onError={(message) => {
                            playErrorBeep();
                            toast({
                              title: "Product Out of Stock",
                              description: message,
                              variant: "destructive",
                            });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="1"
                          max={sale.product ? (() => {
                            const product = products.find(p => {
                              const id = (p as any)._id || p.id;
                              return id.toString() === sale.product;
                            });
                            return product?.stock || 0;
                          })() : undefined}
                          value={sale.quantity}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "") {
                              updateBulkSale(index, "quantity", "");
                              return;
                            }
                            if (sale.product) {
                              const product = products.find(p => {
                                const id = (p as any)._id || p.id;
                                return id.toString() === sale.product;
                              });
                              const numValue = parseInt(value);
                              if (product && numValue > product.stock) {
                                // Prevent entering more than available stock
                                updateBulkSale(index, "quantity", product.stock.toString());
                                playErrorBeep();
                                toast({
                                  title: "Maximum Quantity",
                                  description: `${product.name}: Only ${product.stock} ${product.stock === 1 ? 'item' : 'items'} available in stock.`,
                                  variant: "destructive",
                                });
                                return;
                              }
                            }
                            updateBulkSale(index, "quantity", value);
                          }}
                          className="input-field h-9"
                          placeholder="1"
                        />
                        {sale.product && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Stock: {products.find(p => {
                              const id = (p as any)._id || p.id;
                              return id.toString() === sale.product;
                            })?.stock || 0}
                          </p>
                        )}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={sale.sellingPrice}
                          onChange={(e) => updateBulkSale(index, "sellingPrice", e.target.value)}
                          className="input-field h-9"
                          placeholder="Enter price"
                        />
                      </td>
                      <td className="p-2">
                        <Select
                          value={sale.paymentMethod}
                          onValueChange={(value) => updateBulkSale(index, "paymentMethod", value)}
                        >
                          <SelectTrigger className="input-field h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">{t("cash")}</SelectItem>
                            <SelectItem value="momo">{t("momoPay")}</SelectItem>
                            <SelectItem value="card">{t("card")}</SelectItem>
                            <SelectItem value="airtel">{t("airtelPay")}</SelectItem>
                            <SelectItem value="transfer">{t("bankTransfer")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="date"
                          value={sale.saleDate}
                          onChange={(e) => updateBulkSale(index, "saleDate", e.target.value)}
                          className="input-field h-9"
                        />
                      </td>
                      <td className="p-2">
                        {bulkSales.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-red-100 rounded-full"
                            onClick={() => removeBulkRow(index)}
                          >
                            <X size={14} className="text-red-600" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-4">
              <Button
                onClick={handleRecordSale}
                disabled={isRecordingSale}
                className="bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow transition-all font-semibold px-4 py-2 border border-transparent gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={16} />
                {isRecordingSale ? t("recording") : t("recordSales")}
              </Button>
            </div>
          </div>
        ) : (
          /* Single Sale Form */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("selectProduct")}</Label>
              <ProductCombobox
                value={selectedProduct}
                onValueChange={handleProductChange}
                products={products}
                placeholder="Search products by name, category, or type..."
                onError={(message) => {
                  playErrorBeep();
                  toast({
                    title: "Product Out of Stock",
                    description: message,
                    variant: "destructive",
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("quantity")}</Label>
              <Input
                type="number"
                min="1"
                max={selectedProduct ? products.find(p => {
                  const id = (p as any)._id || p.id;
                  return id.toString() === selectedProduct;
                })?.stock || 0 : undefined}
                value={quantity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setQuantity("");
                    return;
                  }
                  const numValue = parseInt(value);
                  if (selectedProduct) {
                    const product = products.find(p => {
                      const id = (p as any)._id || p.id;
                      return id.toString() === selectedProduct;
                    });
                    if (product && numValue > product.stock) {
                      // Prevent entering more than available stock
                      setQuantity(product.stock.toString());
                      playErrorBeep();
                      toast({
                        title: "Maximum Quantity",
                        description: `Only ${product.stock} ${product.stock === 1 ? 'item' : 'items'} available in stock.`,
                        variant: "destructive",
                      });
                      return;
                    }
                  }
                  setQuantity(value);
                }}
                className="input-field"
                placeholder="1"
              />
              {selectedProduct && (
                <p className="text-xs text-muted-foreground/70">
                  {t("availableStock")}: {products.find(p => {
                    const id = (p as any)._id || p.id;
                    return id.toString() === selectedProduct;
                  })?.stock || 0} {products.find(p => {
                    const id = (p as any)._id || p.id;
                    return id.toString() === selectedProduct;
                  })?.stock === 1 ? 'item' : 'items'}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("sellingPrice")} (rwf)</Label>
              <Input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="input-field"
                placeholder={selectedProduct ? "Enter price" : "Select product first"}
              />
              {selectedProduct && (
                <p className="text-xs text-muted-foreground/70">
                  {t("suggestedPrice")}: rwf {products.find(p => {
                    const id = (p as any)._id || p.id;
                    return id.toString() === selectedProduct;
                  })?.sellingPrice.toLocaleString() || ""} - You can change this
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("paymentMethod")}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="input-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("cash")}</SelectItem>
                  <SelectItem value="momo">{t("momoPay")}</SelectItem>
                  <SelectItem value="card">{t("card")}</SelectItem>
                  <SelectItem value="airtel">{t("airtelPay")}</SelectItem>
                  <SelectItem value="transfer">{t("bankTransfer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("saleDate")}</Label>
              <Input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleRecordSale} 
                disabled={isRecordingSale}
                className="bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow transition-all font-semibold px-4 py-2 border border-transparent w-full gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={16} />
                {isRecordingSale ? t("recording") : t("recordSale")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Charts and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <SalesTrendChart sales={sales} />
          )}
        </div>
        <div>
          {isLoading ? (
            <LowStockSkeleton />
          ) : (
            <LowStockAlert />
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
