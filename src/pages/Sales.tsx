import { useState, useEffect, useMemo } from "react";
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
import { ShoppingCart, Plus, X, Check, ChevronsUpDown, Package, Search, Calendar, Filter, ArrowUpDown, Trash2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { playSaleBeep, playErrorBeep, playWarningBeep, playUpdateBeep, initAudio } from "@/lib/sound";
import { cn, formatDateWithTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { usePinAuth } from "@/hooks/usePinAuth";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { saleApi } from "@/lib/api";

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
  paymentMethod?: string;
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

  // Immediately clear selection if selected product becomes out of stock
  // Watch products array directly for faster reactivity
  useEffect(() => {
    if (value && products.length > 0) {
      const currentProduct = products.find((p) => {
        const id = (p as any)._id || p.id;
        return id.toString() === value;
      });
      
      if (currentProduct && currentProduct.stock <= 0) {
        onValueChange("");
        setSearchQuery("");
        if (onError) {
          onError(`${currentProduct.name} is now out of stock and has been removed from selection.`);
        }
      }
    }
  }, [value, products, onValueChange, onError]);

  // Only show selected product if it has stock > 0
  const displayProduct = selectedProduct && selectedProduct.stock > 0 ? selectedProduct : null;

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
              value={displayProduct ? displayProduct.name : searchQuery}
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
            {displayProduct && (
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
            {!displayProduct && (
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

const Sales = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    items: products,
    isLoading: productsLoading,
    refresh: refreshProducts,
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
    add: addSale,
    bulkAdd: bulkAddSales,
    refresh: refreshSales,
  } = useApi<Sale>({
    endpoint: "sales",
    defaultValue: [],
    onError: (error: any) => {
      // Don't show errors for connection issues (offline mode)
      if (error?.response?.silent || error?.response?.connectionError) {
        console.log("Offline mode: using local data");
        return;
      }
      console.error("Error with sales:", error);
    },
  });
  const { hasPin, verifyPin } = usePinAuth();
  const getTodayDate = () => new Date().toISOString().split("T")[0];
  const getYearStartDate = () => {
    const date = new Date();
    date.setMonth(0);
    date.setDate(1);
    return date.toISOString().split("T")[0];
  };
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saleDate, setSaleDate] = useState(getTodayDate());
  const [bulkSales, setBulkSales] = useState<BulkSaleFormData[]>([
    { product: "", quantity: "1", sellingPrice: "", paymentMethod: "cash", saleDate: getTodayDate() }
  ]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "product-asc" | "product-desc" | "revenue-desc" | "revenue-asc" | "profit-desc" | "profit-asc">("date-desc");
  
  // Selection and deletion states
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"all" | "selected" | "single">("all");
  const [singleSaleToDelete, setSingleSaleToDelete] = useState<Sale | null>(null);
  const [isRecordingSale, setIsRecordingSale] = useState(false);

  // Set defaults on mount
  useEffect(() => {
    setPaymentMethod("cash");
    setSaleDate(getTodayDate());
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
      setSellingPrice(product.sellingPrice.toString());
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
            productId: (product as any)._id || product.id,
            quantity: qty,
            revenue,
            cost,
            profit,
            date: sale.saleDate ? new Date(sale.saleDate).toISOString() : new Date().toISOString(),
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
          try {
            await bulkAddSales(salesToCreate as any);
            // Don't refresh sales - bulkAdd already updates the UI with synced items
            // Only refresh products to update stock levels
            await refreshProducts();

          playSaleBeep();

          // Reset bulk form
          setBulkSales([{ product: "", quantity: "1", sellingPrice: "", paymentMethod: "cash", saleDate: getTodayDate() }]);
          setIsBulkMode(false);

          toast({
            title: "Sales Recorded",
            description: `Successfully recorded ${salesToCreate.length} sale(s).`,
          });
          } catch (bulkError: any) {
            // Check if it's an offline error - if so, show success message
            if (bulkError?.response?.silent || bulkError?.response?.connectionError) {
              playSaleBeep();
              toast({
                title: "Sales Recorded",
                description: "Sales have been saved. They will sync when you're back online.",
              });
              // Reset bulk form
              setBulkSales([{ product: "", quantity: "1", sellingPrice: "", paymentMethod: "cash", saleDate: getTodayDate() }]);
              setIsBulkMode(false);
              // Refresh from local data
              await refreshSales();
              await refreshProducts();
              return;
            }
            // Re-throw other errors to be caught by outer catch
            throw bulkError;
          }
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
        productId: (product as any)._id || product.id,
        quantity: qty,
        revenue,
        cost,
        profit,
        date: saleDate ? new Date(saleDate).toISOString() : new Date().toISOString(),
        paymentMethod: paymentMethod,
      };

        try {
          await addSale(newSale as any);
          // Don't refresh sales - add already updates the UI with synced item
          // Only refresh products to update stock levels
          await refreshProducts();
        
        // Play sale beep after recording (audio context should still be active from button click)
        // The playSaleBeep function will handle resuming if needed
        playSaleBeep();

        // Reset form
        setSelectedProduct("");
        setQuantity("1");
        setSellingPrice("");
        setPaymentMethod("cash");
        setSaleDate(getTodayDate());

        toast({
          title: "Sale Recorded",
          description: `Successfully recorded sale of ${qty}x ${product.name}`,
        });
        } catch (saleError: any) {
          // Check if it's an offline error - if so, show success message
          if (saleError?.response?.silent || saleError?.response?.connectionError) {
            playSaleBeep();
            toast({
              title: "Sale Recorded",
              description: "Sale has been saved. It will sync when you're back online.",
            });
            // Reset form
            setSelectedProduct("");
            setQuantity("1");
            setSellingPrice("");
            setPaymentMethod("cash");
            setSaleDate(getTodayDate());
            // Refresh from local data
            await refreshSales();
            await refreshProducts();
            return;
          }
          // Re-throw other errors to be caught by outer catch
          throw saleError;
        }
      }
      } catch (error: any) {
        // Don't show errors for connection issues (offline mode)
        if (error?.response?.silent || error?.response?.connectionError) {
          // Sale was saved locally, show success message
          playSaleBeep();
          toast({
            title: "Sale Recorded",
            description: "Sale has been saved. It will sync when you're back online.",
          });
          return;
        }
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

  // Filter and sort sales
  const filteredSales = useMemo(() => {
    let filtered = [...sales];
    
    // Filter by search query (product name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sale => 
        sale.product.toLowerCase().includes(query)
      );
    }
    
    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter(sale => {
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
    }
    
    // Sort sales
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "date-asc":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "product-asc":
          return a.product.localeCompare(b.product);
        case "product-desc":
          return b.product.localeCompare(a.product);
        case "revenue-desc":
          return b.revenue - a.revenue;
        case "revenue-asc":
          return a.revenue - b.revenue;
        case "profit-desc":
          return b.profit - a.profit;
        case "profit-asc":
          return a.profit - b.profit;
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [sales, searchQuery, startDate, endDate, sortBy]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setSortBy("date-desc");
  };

  // Handle individual sale selection
  const handleSelectSale = (saleId: string) => {
    setSelectedSales((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(saleId)) {
        newSet.delete(saleId);
      } else {
        newSet.add(saleId);
      }
      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredSales.map((sale) => {
        const id = (sale as any)._id || sale.id;
        return id?.toString() || '';
      }).filter(Boolean));
      setSelectedSales(allIds);
    } else {
      setSelectedSales(new Set());
    }
  };

  // Check if all filtered sales are selected
  const allSelected = filteredSales.length > 0 && filteredSales.every((sale) => {
    const id = (sale as any)._id || sale.id;
    return selectedSales.has(id?.toString() || '');
  });

  // Handle delete single sale
  const handleDeleteSingle = (sale: Sale) => {
    if (!hasPin) {
      toast({
        title: "PIN Required",
        description: "Please set a PIN in Settings before deleting sales.",
        variant: "destructive",
      });
      return;
    }
    setSingleSaleToDelete(sale);
    setDeleteMode("single");
    setShowPinDialog(true);
    setPinInput("");
  };

  // Handle delete selected sales
  const handleDeleteSelected = () => {
    if (selectedSales.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one sale to delete.",
        variant: "destructive",
      });
      return;
    }
    if (!hasPin) {
      toast({
        title: "PIN Required",
        description: "Please set a PIN in Settings before deleting sales.",
        variant: "destructive",
      });
      return;
    }
    setDeleteMode("selected");
    setShowPinDialog(true);
    setPinInput("");
  };


  const handlePinVerification = async () => {
    initAudio();
    
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      playErrorBeep();
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 4 digits.",
        variant: "destructive",
      });
      return;
    }

    if (!verifyPin(pinInput)) {
      playErrorBeep();
      toast({
        title: "Incorrect PIN",
        description: "The PIN you entered is incorrect.",
        variant: "destructive",
      });
      setPinInput("");
      return;
    }

    // PIN verified, proceed with deletion based on mode
    setIsClearing(true);
    try {
      if (deleteMode === "all") {
        // Delete all sales
        await saleApi.deleteAll();
        await refreshSales();
        setSelectedSales(new Set());
        
        playUpdateBeep();
        toast({
          title: "All Sales Cleared",
          description: "All sales have been successfully deleted.",
        });
      } else if (deleteMode === "selected") {
        // Delete selected sales
        const selectedArray = Array.from(selectedSales);
        let deletedCount = 0;
        let failedCount = 0;

        for (const saleId of selectedArray) {
          try {
            await saleApi.delete(saleId);
            deletedCount++;
          } catch (error) {
            failedCount++;
            console.error(`Failed to delete sale ${saleId}:`, error);
          }
        }

        await refreshSales();
        setSelectedSales(new Set());

        if (failedCount > 0) {
          playWarningBeep();
          toast({
            title: "Partial Deletion",
            description: `Deleted ${deletedCount} sale(s). ${failedCount} sale(s) failed to delete.`,
            variant: "destructive",
          });
        } else {
          playUpdateBeep();
          toast({
            title: "Sales Deleted",
            description: `Successfully deleted ${deletedCount} sale(s).`,
          });
        }
      } else if (deleteMode === "single" && singleSaleToDelete) {
        // Delete single sale
        const saleId = (singleSaleToDelete as any)._id || singleSaleToDelete.id;
        if (saleId) {
          await saleApi.delete(saleId.toString());
          await refreshSales();
          
          // Remove from selection if it was selected
          setSelectedSales((prev) => {
            const newSet = new Set(prev);
            newSet.delete(saleId.toString());
            return newSet;
          });
          
          playUpdateBeep();
          toast({
            title: "Sale Deleted",
            description: "Sale has been successfully deleted.",
          });
        }
      }
      
      setShowPinDialog(false);
      setPinInput("");
      setSingleSaleToDelete(null);
    } catch (error) {
      playErrorBeep();
      toast({
        title: "Delete Failed",
        description: "Failed to delete sales. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Sales Page Skeleton
  const SalesSkeleton = () => (
      <AppLayout title="Sales">
      <div className="flex flex-col lg:h-[calc(100vh-3rem)]">
        {/* Record New Sale Form Skeleton */}
        <div className="form-card mb-6 border-transparent flex-shrink-0 bg-blue-500 border-blue-600">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-28" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Skeleton className="h-10 w-32 ml-auto" />
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="form-card mb-6 border-transparent flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Sales Table Skeleton */}
        <div className="bg-white flex-1 flex flex-col lg:min-h-0 lg:overflow-hidden rounded-lg">
          <div className="hidden lg:block overflow-auto flex-1">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-200">
                <tr>
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <th key={i} className="text-left py-3 px-4">
                      <Skeleton className="h-4 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <tr key={i}>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-20" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </AppLayout>
    );

  if (productsLoading || salesLoading) {
    return <SalesSkeleton />;
  }

  return (
    <AppLayout title="Sales">
      <div className="flex flex-col min-h-0 pb-4 lg:pb-4">
      {/* Record New Sale Form - Static */}
      <div className="form-card mb-6 border-transparent flex-shrink-0 bg-blue-500 border-blue-600">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="section-title flex items-center gap-2 text-white">
            <Plus size={20} className="text-white" />
            {t("recordNewSale")}
          </h3>
          <div className="flex gap-2 w-full sm:w-auto">
            {!isBulkMode && (
              <Button
                onClick={() => setIsBulkMode(true)}
                className="bg-green-600 text-white hover:bg-green-700 border border-transparent font-medium px-4 py-2 gap-2 w-full sm:w-auto"
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
                className="text-white hover:text-white/80 hover:bg-white/10 w-full sm:w-auto"
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
              <p className="text-sm text-white/90">{t("addMultipleSales")}</p>
              <Button
                onClick={addBulkRow}
                className="bg-blue-500 text-white hover:bg-blue-600 border border-transparent shadow-sm hover:shadow transition-all font-medium px-3 py-2 gap-2"
              >
                <Plus size={14} />
                {t("addRow")}
              </Button>
            </div>

            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full min-w-[600px]">
                <thead className="bg-blue-600 border-b border-blue-700">
                  <tr>
                    <th className="text-left p-2 text-xs font-medium text-white">{t("product")}</th>
                    <th className="text-left p-2 text-xs font-medium text-white">{t("quantity")}</th>
                    <th className="text-left p-2 text-xs font-medium text-white">{t("sellingPrice")} (rwf)</th>
                    <th className="text-left p-2 text-xs font-medium text-white">{t("paymentMethod")}</th>
                    <th className="text-left p-2 text-xs font-medium text-white">{t("saleDate")}</th>
                    <th className="text-left p-2 text-xs font-medium text-white w-12"></th>
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
                          placeholder={t("enterQuantity") || "Enter quantity"}
                        />
                        {sale.product && (
                          <p className="text-xs text-white/80 mt-1">
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
              className="bg-blue-600 text-white hover:bg-blue-700 font-semibold px-4 py-2 border border-transparent gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <Label className="text-white">{t("selectProduct")}</Label>
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
            <Label className="text-white">{t("quantity")}</Label>
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
              placeholder={t("enterQuantity") || "Enter quantity"}
            />
            {selectedProduct && (
              <p className="text-xs text-white/80">
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
            <Label className="text-white">{t("sellingPrice")} (rwf)</Label>
            <Input
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="input-field"
              placeholder={selectedProduct ? "Enter price" : "Select product first"}
            />
            {selectedProduct && (
              <p className="text-xs text-white/80">
                {t("suggestedPrice")}: rwf {products.find(p => {
                const id = (p as any)._id || p.id;
                return id.toString() === selectedProduct;
              })?.sellingPrice.toLocaleString() || ""} - {t("youCanChangeThis")}
              </p>
            )}
          </div>
          {/* Revenue, Cost, and Profit Preview */}
          {selectedProduct && quantity && sellingPrice && parseInt(quantity) > 0 && parseFloat(sellingPrice) > 0 && (
            <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              {(() => {
                const product = products.find(p => {
                  const id = (p as any)._id || p.id;
                  return id.toString() === selectedProduct;
                });
                if (!product) return null;
                const qty = parseInt(quantity) || 0;
                const price = parseFloat(sellingPrice) || 0;
                const revenue = qty * price;
                const cost = qty * product.costPrice;
                const profit = revenue - cost;
                
                return (
                  <>
                    <div className="text-center">
                      <p className="text-xs text-white/80 mb-1">Revenue</p>
                      <p className="text-lg font-semibold text-blue-200">rwf {revenue.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-white/80 mb-1">Cost</p>
                      <p className="text-lg font-semibold text-orange-200">rwf {cost.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-white/80 mb-1">Profit</p>
                      <p className={`text-lg font-semibold ${profit >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                        rwf {profit.toLocaleString()}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-white">{t("paymentMethod")}</Label>
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
            <Label className="text-white">{t("saleDate")}</Label>
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

      {/* Sales History Table - Static Header with Scrollable Body */}
      <div className="bg-white lg:flex-1 lg:flex lg:flex-col lg:min-h-0 lg:overflow-hidden rounded-lg">
        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex-shrink-0">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-700">{t("filterSales")}</h3>
              </div>
              {selectedSales.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg">
                  <span className="text-xs font-semibold text-gray-700">
                    {selectedSales.size} {selectedSales.size === 1 ? 'sale' : 'sales'} selected
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Input */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <Input
                  placeholder={t("search") + " " + t("language") === "rw" ? "ku bicuruzwa" : "by product..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-500 rounded-lg"
                  autoComplete="off"
                  name="search-products"
                />
              </div>
              
              {/* Start Date */}
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg"
                />
              </div>
              
              {/* End Date */}
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9 bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg"
                />
              </div>
              
              {/* Sort By */}
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown size={14} className="text-gray-400" />
                    <SelectValue placeholder={t("sortBy")} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                  <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                  <SelectItem value="product-asc">Product (A-Z)</SelectItem>
                  <SelectItem value="product-desc">Product (Z-A)</SelectItem>
                  <SelectItem value="revenue-desc">Revenue (High to Low)</SelectItem>
                  <SelectItem value="revenue-asc">Revenue (Low to High)</SelectItem>
                  <SelectItem value="profit-desc">Profit (High to Low)</SelectItem>
                  <SelectItem value="profit-asc">Profit (Low to High)</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Clear Filters */}
              <Button
                onClick={handleClearFilters}
                variant="outline"
                className="bg-white border border-gray-300 text-gray-700 hover:bg-blue-500 hover:text-white rounded-lg"
              >
                <X size={14} className="mr-2" />
                {t("cancel")}
              </Button>
              
              {/* Delete Selected Sales */}
              {selectedSales.size > 0 && (
                <Button
                  onClick={handleDeleteSelected}
                  className="bg-red-600 hover:bg-red-700 text-white border-0 rounded-lg px-4 py-2 font-semibold flex items-center gap-2"
                >
                  <div className="relative">
                    <Trash2 size={16} />
                    <span className="absolute -top-1 -right-1 bg-white text-red-600 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {selectedSales.size}
                    </span>
                  </div>
                  <span>{t("delete")} Selected</span>
                </Button>
              )}
              
            </div>
            <div className="text-xs text-gray-500">
              {t("language") === "rw" ? "Byerekana" : "Showing"} {filteredSales.length} {t("language") === "rw" ? "bya" : "of"} {sales.length} {t("sales").toLowerCase()}
            </div>
          </div>
        </div>
        
        {/* Desktop Table - Sticky Header with Scrollable Body */}
        <div className="hidden lg:block overflow-auto flex-1 pb-4">
          {/* Desktop Table View */}
          <div>
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="text-left text-sm font-semibold text-gray-700 py-2 px-4 w-12">
                  {selectedSales.size > 0 && (
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      className="h-4 w-4"
                    />
                  )}
                </th>
                <th className="text-left text-sm font-semibold text-gray-700 py-2 px-4">{t("product")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-2 px-4">{t("quantity")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-2 px-4">{t("revenue")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-2 px-4">{t("language") === "rw" ? "Agaciro" : "Cost"}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-2 px-4">{t("profit")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-2 px-4">{t("paymentMethod")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-2 px-4">{t("date")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-2 px-4">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.length > 0 ? (
                filteredSales.map((sale, index) => {
                  const saleId = (sale as any)._id || sale.id;
                  const idString = saleId?.toString() || '';
                  const isSelected = selectedSales.has(idString);
                  
                  return (
                    <tr key={saleId || index} className={cn(
                      "border-b border-gray-200",
                      index % 2 === 0 ? "bg-white" : "bg-gray-50",
                      isSelected && "bg-blue-50"
                    )}>
                      <td className="py-2 px-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleSelectSale(idString)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-xs text-gray-900">{sale.product}</div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-xs text-gray-700">{sale.quantity}</div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-xs text-gray-700">{sale.revenue.toLocaleString()} rwf</div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-xs text-gray-700">{sale.cost.toLocaleString()} rwf</div>
                      </td>
                      <td className="py-2 px-4">
                        <div className={cn(
                          "text-xs",
                          sale.profit >= 0 ? "text-green-700" : "text-red-700"
                        )}>
                          {sale.profit >= 0 ? "+" : ""}{sale.profit.toLocaleString()} rwf
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-xs text-gray-700">
                          {sale.paymentMethod === 'cash' && t("cash")}
                          {sale.paymentMethod === 'card' && t("card")}
                          {sale.paymentMethod === 'momo' && t("momoPay")}
                          {sale.paymentMethod === 'airtel' && t("airtelPay")}
                          {sale.paymentMethod === 'transfer' && t("bankTransfer")}
                          {!sale.paymentMethod && t("cash")}
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-xs text-gray-600">{formatDateWithTime(sale.date)}</div>
                      </td>
                      <td className="py-2 px-4">
                        <button
                          onClick={() => handleDeleteSingle(sale)}
                          className="p-1.5 text-red-600 rounded"
                          title="Delete sale"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <ShoppingCart size={48} className="mb-4 opacity-50" />
                      <p className="text-base font-medium">No sales found matching your filters</p>
                      <p className="text-sm mt-1">Try adjusting your search or date range</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
          
      {/* Mobile Card View - Full Page Scroll - Outside flex container */}
      <div className="lg:hidden bg-white rounded-lg mt-4 p-4 pb-20 space-y-4">
            {filteredSales.length > 0 ? (
              filteredSales.map((sale) => {
                const saleId = (sale as any)._id || sale.id;
                const idString = saleId?.toString() || '';
                const isSelected = selectedSales.has(idString);
                return (
                  <div key={saleId || sale.id} className={cn("bg-white border border-gray-200 rounded-lg p-4", isSelected && "bg-gray-50 border-gray-300")}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleSelectSale(idString)}
                            className="h-5 w-5 shrink-0"
                          />
                          <h4 className="text-base font-semibold text-gray-900 truncate">{sale.product}</h4>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {formatDateWithTime(sale.date)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSingle(sale)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                        title="Delete sale"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-3">
                      <div>
                        <span className="text-gray-500">Quantity:</span>
                        <span className="ml-2 font-medium text-gray-900">{sale.quantity}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Revenue:</span>
                        <span className="ml-2 font-semibold text-gray-900">{sale.revenue.toLocaleString()} rwf</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Cost:</span>
                        <span className="ml-2 text-gray-600">{sale.cost.toLocaleString()} rwf</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Profit:</span>
                        <span className="ml-2 font-semibold text-green-600">{sale.profit.toLocaleString()} rwf</span>
                      </div>
                      <div>
                        <span className="text-gray-500">{t("paymentMethod")}:</span>
                        <span className="ml-2 text-gray-600">
                          {sale.paymentMethod === 'cash' && t("cash")}
                          {sale.paymentMethod === 'card' && t("card")}
                          {sale.paymentMethod === 'momo' && t("momoPay")}
                          {sale.paymentMethod === 'airtel' && t("airtelPay")}
                          {sale.paymentMethod === 'transfer' && t("bankTransfer")}
                          {!sale.paymentMethod && t("cash")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No sales found matching your filters
              </div>
            )}
        </div>
      </div>
      </div>

      {/* PIN Verification Dialog for Clearing All Sales */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock size={20} className="text-red-600" />
              Verify PIN to {deleteMode === "all" ? "Clear All Sales" : deleteMode === "selected" ? "Delete Selected Sales" : "Delete Sale"}
            </DialogTitle>
            <DialogDescription>
              {deleteMode === "all" && (
                <>
                  This action will permanently delete all {sales.length} sale record(s). This cannot be undone.
                  <br />
                  <span className="font-semibold text-red-600 mt-2 block">Please enter your PIN to confirm.</span>
                </>
              )}
              {deleteMode === "selected" && (
                <>
                  This action will permanently delete {selectedSales.size} selected sale record(s). This cannot be undone.
                  <br />
                  <span className="font-semibold text-red-600 mt-2 block">Please enter your PIN to confirm.</span>
                </>
              )}
              {deleteMode === "single" && (
                <>
                  This action will permanently delete this sale record. This cannot be undone.
                  <br />
                  <span className="font-semibold text-red-600 mt-2 block">Please enter your PIN to confirm.</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Enter PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="input-field h-12 text-center text-2xl tracking-widest font-mono"
                placeholder="••••"
                autoFocus
                autoComplete="new-password"
                name="pin-verification"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pinInput.length === 4) {
                    handlePinVerification();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPinDialog(false);
                setPinInput("");
              }}
              disabled={isClearing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePinVerification}
              disabled={pinInput.length !== 4 || isClearing}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isClearing 
                ? "Deleting..." 
                : deleteMode === "all" 
                  ? "Clear All Sales" 
                  : deleteMode === "selected"
                    ? `Delete ${selectedSales.size} Sale(s)`
                    : "Delete Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Sales;
