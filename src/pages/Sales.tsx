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
import { ShoppingCart, Plus, X, Check, ChevronsUpDown, Package, Search, Calendar, Filter, ArrowUpDown, Trash2, Lock, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { playSaleBeep, playErrorBeep, playWarningBeep, playUpdateBeep, initAudio } from "@/lib/sound";
import { toast as sonnerToast } from "@/components/ui/sonner";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  priceType?: "perQuantity" | "perPackage"; // "perQuantity" = price per individual item, "perPackage" = price for whole package
  costPriceType?: "perQuantity" | "perPackage"; // "perQuantity" = cost price per individual item, "perPackage" = cost price for whole package
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
  timestamp?: string; // ISO timestamp of when the sale was recorded
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
    update: updateProduct,
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
    remove: removeSale,
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

  // Refresh sales every time this page is opened (only once on mount)
  useEffect(() => {
    console.log('[Sales] Page opened, dispatching refresh event');
    window.dispatchEvent(new CustomEvent('page-opened'));
    // Note: useApi hook will handle the actual refresh via the event listener
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount, not when refreshSales changes
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
  const [packageSaleMode, setPackageSaleMode] = useState<"quantity" | "wholePackage">("quantity"); // For package products: sell by quantity or whole package
  const [bulkSales, setBulkSales] = useState<BulkSaleFormData[]>([
    { product: "", quantity: "1", sellingPrice: "", paymentMethod: "cash", saleDate: getTodayDate() }
  ]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "product-asc" | "product-desc" | "revenue-desc" | "revenue-asc" | "profit-desc" | "profit-asc">("date-desc");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // Selection and deletion states
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
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

  // Listen for sale-recorded events to auto-refresh the sales list
  useEffect(() => {
    let debounceTimeout: NodeJS.Timeout | null = null;
    let lastRefreshTime = 0;
    const DEBOUNCE_DELAY = 2000; // 2 second debounce
    const MIN_REFRESH_INTERVAL = 30 * 1000; // 30 seconds minimum between refreshes (increased to reduce API calls)

    const handleSaleRecorded = async () => {
      const now = Date.now();
      
      // Clear any pending debounced refresh
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }
      
      // Check if enough time has passed since last refresh
      if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        // Debounce the refresh
        debounceTimeout = setTimeout(async () => {
          lastRefreshTime = Date.now();
          try {
            await refreshSales();
            // Also refresh products to update stock levels
            await refreshProducts();
          } catch (error) {
            // Silently handle errors - the useApi hook will handle offline scenarios
            console.log("Auto-refresh after sale recorded:", error);
          }
        }, DEBOUNCE_DELAY);
      } else {
        // Refresh immediately
        lastRefreshTime = Date.now();
        try {
          await refreshSales();
          // Also refresh products to update stock levels
          await refreshProducts();
        } catch (error) {
          // Silently handle errors - the useApi hook will handle offline scenarios
          console.log("Auto-refresh after sale recorded:", error);
        }
      }
    };

    window.addEventListener('sale-recorded', handleSaleRecorded);
    window.addEventListener('sales-should-refresh', handleSaleRecorded);

    return () => {
      window.removeEventListener('sale-recorded', handleSaleRecorded);
      window.removeEventListener('sales-should-refresh', handleSaleRecorded);
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [refreshSales, refreshProducts]);

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
      // Reset package sale mode when product changes
      if (product.isPackage) {
        setPackageSaleMode("quantity");
      }
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

          // Combine selected date with current time to preserve hours/minutes/seconds
          const now = new Date();
          let saleDateTime: Date;
          if (sale.saleDate) {
            // Parse the date string and combine with current time
            const selectedDate = new Date(sale.saleDate + 'T00:00:00');
            saleDateTime = new Date(selectedDate);
            saleDateTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
          } else {
            saleDateTime = now;
          }

          return {
            product: product.name,
            productId: (product as any)._id || product.id,
            quantity: qty,
            revenue,
            cost,
            profit,
            date: saleDateTime.toISOString(),
            timestamp: new Date().toISOString(), // Record exact time when sale was recorded
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
            
            // Reduce product stock locally immediately for instant UI feedback
            // Group sales by productId to handle multiple sales of the same product
            const stockReductions = new Map<string, number>();
            salesToCreate.forEach((sale: any) => {
              const productId = sale.productId?.toString();
              if (productId) {
                const currentReduction = stockReductions.get(productId) || 0;
                stockReductions.set(productId, currentReduction + sale.quantity);
              }
            });
            
            // Update each product's stock
            for (const [productId, totalQuantity] of stockReductions.entries()) {
              try {
                const product = products.find((p) => {
                  const id = (p as any)._id || p.id;
                  return id.toString() === productId;
                });
                if (product) {
                  const updatedProduct = {
                    ...product,
                    stock: Math.max(0, product.stock - totalQuantity),
                  };
                  await updateProduct(updatedProduct);
                }
              } catch (updateError) {
                // Silently ignore update errors - backend will handle stock reduction
                console.warn(`Failed to update product stock locally for product ${productId}:`, updateError);
              }
            }
            
            // Refresh sales to ensure table updates immediately with latest data
            try {
              await refreshSales();
            } catch (refreshError) {
              // Silently ignore refresh errors
            }
            // Refresh products to sync with backend
            try {
              await refreshProducts();
            } catch (refreshError) {
              // Silently ignore refresh errors
            }
            
            // Dispatch event to notify other pages (like Products page) to refresh
            window.dispatchEvent(new CustomEvent('products-should-refresh'));

            playSaleBeep();
            sonnerToast.success("Sales Recorded", {
              description: `Successfully recorded ${salesToCreate.length} sale(s).`,
            });

            // Reset bulk form
            setBulkSales([{ product: "", quantity: "1", sellingPrice: "", paymentMethod: "cash", saleDate: getTodayDate() }]);
            setIsBulkMode(false);

            toast({
              title: "Sales Recorded",
              description: `Successfully recorded ${salesToCreate.length} sale(s).`,
            });
          } catch (bulkError: any) {
            // Check if it's a connection error
            if (bulkError?.response?.connectionError) {
              playErrorBeep();
              toast({
                title: "Connection Error",
                description: bulkError.message || "Cannot record sales while offline. Please check your internet connection.",
                variant: "destructive",
              });
            } else {
              // Real error - show error message with details
              playErrorBeep();
              console.error("Error recording bulk sales:", bulkError);
              toast({
                title: "Record Failed",
                description: bulkError?.message || bulkError?.response?.error || "Failed to record sales. Please check your connection and try again.",
                variant: "destructive",
              });
            }
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

      // Handle package products
      let qty: number;
      let stockReduction: number;
      let revenue: number;
      let cost: number;
      
      if (product.isPackage && product.packageQuantity) {
        if (packageSaleMode === "wholePackage") {
          // Selling whole package
          qty = product.packageQuantity; // Record the actual quantity sold
          stockReduction = product.packageQuantity;
          
          // Calculate revenue based on price type
          if (product.priceType === "perPackage") {
            // Price is for whole package
            revenue = parseFloat(sellingPrice);
          } else {
            // Price is per quantity, so multiply by package quantity
            revenue = parseFloat(sellingPrice) * product.packageQuantity;
          }
          
          // Calculate cost based on cost price type
          if (product.costPriceType === "perPackage") {
            // Cost is for whole package
            cost = product.costPrice;
          } else {
            // Cost is per quantity, so multiply by package quantity
            cost = product.costPrice * product.packageQuantity;
          }
        } else {
          // Selling by quantity
          qty = parseInt(quantity);
          
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
          
          // Validate quantity doesn't exceed available stock
          if (qty > product.stock || product.stock <= 0) {
            playErrorBeep();
            toast({
              title: "Insufficient Stock",
              description: `Only ${product.stock} ${product.stock === 1 ? 'item' : 'items'} available in stock.`,
              variant: "destructive",
            });
            setIsRecordingSale(false);
            return;
          }
          
          stockReduction = qty;
          
          // Calculate revenue based on price type
          if (product.priceType === "perPackage") {
            // Price is for whole package, calculate per item
            const pricePerItem = parseFloat(sellingPrice) / product.packageQuantity;
            revenue = pricePerItem * qty;
          } else {
            // Price is per quantity
            revenue = parseFloat(sellingPrice) * qty;
          }
          
          // Calculate cost based on cost price type
          if (product.costPriceType === "perPackage") {
            // Cost is for whole package, calculate per item
            const costPerItem = product.costPrice / product.packageQuantity;
            cost = costPerItem * qty;
          } else {
            // Cost is per quantity
            cost = product.costPrice * qty;
          }
        }
      } else {
        // Regular product (not a package)
        qty = parseInt(quantity);
        
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
        
        // Validate quantity doesn't exceed available stock
        if (qty > product.stock || product.stock <= 0) {
          playErrorBeep();
          toast({
            title: "Insufficient Stock",
            description: `Only ${product.stock} ${product.stock === 1 ? 'item' : 'items'} available in stock.`,
            variant: "destructive",
          });
          setIsRecordingSale(false);
          return;
        }
        
        stockReduction = qty;
        const price = parseFloat(sellingPrice);
        revenue = qty * price;
        cost = qty * product.costPrice;
      }
      
      const profit = revenue - cost;

      // Combine selected date with current time to preserve hours/minutes/seconds
      const now = new Date();
      let saleDateTime: Date;
      if (saleDate) {
        // Parse the date string and combine with current time
        const selectedDate = new Date(saleDate + 'T00:00:00');
        saleDateTime = new Date(selectedDate);
        saleDateTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      } else {
        saleDateTime = now;
      }

      const newSale = {
        product: product.name,
        productId: (product as any)._id || product.id,
        quantity: qty,
        revenue,
        cost,
        profit,
        date: saleDateTime.toISOString(),
        timestamp: new Date().toISOString(), // Record exact time when sale was recorded
        paymentMethod: paymentMethod,
      };

        try {
          await addSale(newSale as any);
          
          // Play sale beep immediately after successful sale recording
          playSaleBeep();
          
          // Show success toast immediately
          sonnerToast.success("Sale Recorded", {
            description: `Successfully recorded sale of ${qty}x ${product.name}`,
          });
          
          toast({
            title: "Sale Recorded",
            description: `Successfully recorded sale of ${qty}x ${product.name}`,
          });
          
          // Reduce product stock locally immediately for instant UI feedback
          try {
            const updatedProduct = {
              ...product,
              stock: Math.max(0, product.stock - stockReduction),
            };
            await updateProduct(updatedProduct);
          } catch (updateError) {
            // Silently ignore update errors - backend will handle stock reduction
            console.warn("Failed to update product stock locally:", updateError);
          }
          
          // Refresh sales to ensure table updates immediately with latest data
          try {
            await refreshSales();
          } catch (refreshError) {
            // Silently ignore refresh errors
          }
          // Refresh products to sync with backend
          try {
            await refreshProducts();
          } catch (refreshError) {
            // Silently ignore refresh errors
          }
          
          // Dispatch event to notify other pages (like Products page and Dashboard) to refresh
          window.dispatchEvent(new CustomEvent('products-should-refresh'));
          window.dispatchEvent(new CustomEvent('sales-should-refresh'));

          // Reset form
          setSelectedProduct("");
          setQuantity("1");
          setSellingPrice("");
          setPaymentMethod("cash");
          setSaleDate(getTodayDate());
        } catch (saleError: any) {
          // Check if it's a connection error
          if (saleError?.response?.connectionError) {
            playErrorBeep();
            toast({
              title: "Connection Error",
              description: saleError.message || "Cannot record sales while offline. Please check your internet connection.",
              variant: "destructive",
            });
          } else {
            // Real error - show error message with details
            playErrorBeep();
            console.error("Error recording sale:", saleError);
            toast({
              title: "Record Failed",
              description: saleError?.message || saleError?.response?.error || "Failed to record sale. Please check your connection and try again.",
              variant: "destructive",
            });
          }
        }
      }
      } catch (error: any) {
        // Errors are already handled in inner catch blocks
        if (!error?.response?.connectionError) {
          playErrorBeep();
          console.error("Error recording sale:", error);
          toast({
            title: "Record Failed",
            description: error?.message || error?.response?.error || "Failed to record sale. Please check your connection and try again.",
            variant: "destructive",
          });
        }
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
          // Use timestamp if available (when sale was recorded), otherwise use date
          const aTime = (a as any).timestamp || a.date;
          const bTime = (b as any).timestamp || b.date;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        case "date-asc":
          const aTimeAsc = (a as any).timestamp || a.date;
          const bTimeAsc = (b as any).timestamp || b.date;
          return new Date(aTimeAsc).getTime() - new Date(bTimeAsc).getTime();
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

  // Clear selection when exiting selection mode
  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedSales(new Set());
    }
  }, [isSelectionMode]);

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

  // Handle delete all sales
  const handleDeleteAll = () => {
    if (sales.length === 0) {
      toast({
        title: "No Sales",
        description: "There are no sales to delete.",
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
    setDeleteMode("all");
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
        // Delete all sales - delete one by one using remove function for proper UI updates
        let deletedCount = 0;
        let failedCount = 0;

        for (const sale of sales) {
          try {
            await removeSale(sale);
            deletedCount++;
            playDeleteBeep();
          } catch (error: any) {
            failedCount++;
            console.error(`Failed to delete sale:`, error);
            playErrorBeep();
            toast({
              title: "Failed to Delete Sale",
              description: error?.message || error?.response?.error || "Unknown error",
              variant: "destructive",
            });
          }
        }

        // Clear selection
        setSelectedSales(new Set());
        
        // Force refresh to ensure UI is updated (bypass cache)
        refreshSales(true);
        refreshProducts(true);
        
        // Dispatch event to notify other pages
        window.dispatchEvent(new CustomEvent('sales-should-refresh'));
        window.dispatchEvent(new CustomEvent('products-should-refresh'));
        
        playUpdateBeep();
        toast({
          title: "All Sales Cleared",
          description: `Successfully deleted ${deletedCount} sale(s).${failedCount > 0 ? ` ${failedCount} failed.` : ''}`,
        });
      } else if (deleteMode === "selected") {
        // Delete selected sales using remove function for proper UI updates
        const selectedArray = Array.from(selectedSales);
        const salesToDelete = sales.filter((sale) => {
          const saleId = (sale as any)._id || sale.id;
          return saleId && selectedArray.includes(saleId.toString());
        });
        
        // First, restore stock for selected sales before deleting
        const stockRestorations = new Map<string, number>();
        for (const sale of salesToDelete) {
          const productId = (sale as any).productId?.toString();
          if (productId) {
            const currentQuantity = stockRestorations.get(productId) || 0;
            stockRestorations.set(productId, currentQuantity + sale.quantity);
          }
        }

        // Restore stock for each product
        for (const [productId, totalQuantity] of stockRestorations.entries()) {
          try {
            const product = products.find((p) => {
              const id = (p as any)._id || p.id;
              return id.toString() === productId;
            });
            if (product) {
              const updatedProduct = {
                ...product,
                stock: product.stock + totalQuantity,
              };
              await updateProduct(updatedProduct);
            }
          } catch (updateError) {
            console.warn(`Failed to restore stock for product ${productId}:`, updateError);
          }
        }
        
        let deletedCount = 0;
        let failedCount = 0;

        for (const sale of salesToDelete) {
          try {
            await removeSale(sale);
            deletedCount++;
            playDeleteBeep();
          } catch (error: any) {
            failedCount++;
            console.error(`Failed to delete sale:`, error);
            playErrorBeep();
            toast({
              title: "Failed to Delete Sale",
              description: error?.message || error?.response?.error || "Unknown error",
              variant: "destructive",
            });
          }
        }

        // Clear selection
        setSelectedSales(new Set());
        
        // Force refresh to ensure UI is updated (bypass cache)
        refreshSales(true);
        refreshProducts(true);
        
        // Dispatch event to notify other pages
        window.dispatchEvent(new CustomEvent('sales-should-refresh'));
        window.dispatchEvent(new CustomEvent('products-should-refresh'));

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
        // Delete single sale using remove function for proper UI updates
        try {
          // First, restore stock for this sale before deleting
          const productId = (singleSaleToDelete as any).productId?.toString();
          if (productId) {
            try {
              const product = products.find((p) => {
                const id = (p as any)._id || p.id;
                return id.toString() === productId;
              });
              if (product) {
                const updatedProduct = {
                  ...product,
                  stock: product.stock + singleSaleToDelete.quantity,
                };
                await updateProduct(updatedProduct);
              }
            } catch (updateError) {
              console.warn("Failed to restore stock locally:", updateError);
              // Continue with deletion even if stock restore fails
            }
          }

          await removeSale(singleSaleToDelete);
          
          // Remove from selection if it was selected
          const saleId = (singleSaleToDelete as any)._id || singleSaleToDelete.id;
          if (saleId) {
            setSelectedSales((prev) => {
              const newSet = new Set(prev);
              newSet.delete(saleId.toString());
              return newSet;
            });
          }
          
          // Force refresh to ensure UI is updated (bypass cache)
          refreshSales(true);
          refreshProducts(true);
          
          // Dispatch event to notify other pages
          window.dispatchEvent(new CustomEvent('sales-should-refresh'));
          window.dispatchEvent(new CustomEvent('products-should-refresh'));
          
          playDeleteBeep();
          toast({
            title: "Sale Deleted",
            description: "Sale has been successfully deleted.",
          });
        } catch (error: any) {
          playErrorBeep();
          console.error("Error deleting sale:", error);
          toast({
            title: "Delete Failed",
            description: error?.message || error?.response?.error || "Failed to delete sale. Please check your connection and try again.",
            variant: "destructive",
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
      <div className="flex flex-col min-h-0 pb-4 lg:pb-4">

        {/* Filters and Table Container Skeleton */}
        <div className="lg:bg-white flex-1 flex flex-col lg:min-h-0 lg:overflow-hidden rounded-lg">
          {/* Filter Section Skeleton */}
          <div className="lg:bg-white lg:border-b lg:border-gray-200 lg:px-4 lg:py-4 flex-shrink-0">
            {/* Mobile Filter Card Skeleton */}
            <div className="lg:hidden rounded-lg p-4 mb-4 space-y-3 bg-white/80 backdrop-blur-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-6 w-24 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
            
            {/* Desktop Filter Section Skeleton */}
            <div className="hidden lg:flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-6 w-24 rounded-lg" />
              </div>
              <div className="grid grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          {/* Sales Table Skeleton */}
          <div className="hidden lg:block overflow-auto flex-1">
            <div className="rounded-b-lg overflow-hidden">
              <table className="w-full data-table">
                <thead className="sticky top-16 z-10 bg-white shadow-sm">
                  <tr className="border-b border-transparent">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <th key={i} className="text-left py-3 px-4">
                        <Skeleton className="h-4 w-20" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-transparent">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <tr key={i}>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Mobile Cards Skeleton */}
          <div className="lg:hidden p-4 space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white/80 backdrop-blur-md rounded-lg p-4 border border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
            ))}
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

      {/* Sales History Table - Static Header with Scrollable Body */}
      <div className="lg:bg-white lg:flex-1 lg:flex lg:flex-col lg:min-h-0 lg:overflow-hidden rounded-lg">
        {/* Filter Section */}
        <div className="lg:bg-white lg:border-b lg:border-gray-200 lg:px-4 lg:py-4 flex-shrink-0">
          {/* Mobile Filter Section */}
          <div className="lg:hidden mb-4 space-y-3">
            {/* Search Bar with Filter Icon */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <Input
                  placeholder={t("search") + " " + (t("language") === "rw" ? "ku bicuruzwa" : "by product...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-500 rounded-lg w-full"
                  autoComplete="off"
                  name="search-products"
                />
              </div>
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className={cn(
                  "bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 rounded-lg px-3 py-2",
                  showFilters && "bg-blue-50 border-blue-300 text-blue-700"
                )}
              >
                <Filter size={18} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 rounded-lg px-3 py-2"
                  >
                    <MoreVertical size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsSelectionMode(!isSelectionMode)}>
                    {isSelectionMode ? "Cancel Selection" : (t("selectSales") || "Select Sales")}
                  </DropdownMenuItem>
                  {isSelectionMode && (
                    <DropdownMenuItem onClick={() => handleSelectAll(true)}>
                      {t("selectAll") || "Select All"}
                    </DropdownMenuItem>
                  )}
                  {isSelectionMode && selectedSales.size > 0 && (
                    <DropdownMenuItem 
                      onClick={handleDeleteSelected}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      {t("delete")} Selected ({selectedSales.size})
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={handleDeleteAll}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    {t("delete")} All Sales
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Selected Sales Indicator */}
            {selectedSales.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg">
                <span className="text-xs font-semibold text-gray-700">
                  {selectedSales.size} {selectedSales.size === 1 ? 'sale' : 'sales'} selected
                </span>
              </div>
            )}
            
            {/* Filter Options - Collapsible */}
            {showFilters && (
              <div className="rounded-lg p-4 bg-white/80 backdrop-blur-sm border border-gray-200 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {/* Start Date */}
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-9 h-10 text-base lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg w-full"
                      style={{
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        colorScheme: 'light'
                      }}
                    />
                  </div>
                  
                  {/* End Date */}
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-9 h-10 text-base lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg w-full"
                      style={{
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        colorScheme: 'light'
                      }}
                    />
                  </div>
                  
                  {/* Sort By */}
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg w-full">
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
                    className="bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 rounded-lg w-full"
                  >
                    <X size={14} className="mr-2" />
                    {t("cancel")}
                  </Button>
                  
                  {/* Delete Selected Sales - Hidden */}
                  {false && selectedSales.size > 0 && (
                    <Button
                      onClick={handleDeleteSelected}
                      className="bg-red-600 hover:bg-red-700 text-white border-0 rounded-lg px-4 py-2 font-semibold flex items-center gap-2 w-full col-span-2"
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
            )}
          </div>
          
          {/* Desktop Filter Section */}
          <div className="hidden lg:flex flex-col gap-4">
            {/* Search Bar with Filter Icon */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <Input
                  placeholder={t("search") + " " + (t("language") === "rw" ? "ku bicuruzwa" : "by product...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-500 rounded-lg w-full"
                  autoComplete="off"
                  name="search-products"
                />
              </div>
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className={cn(
                  "bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 rounded-lg px-4 py-2",
                  showFilters && "bg-blue-50 border-blue-300 text-blue-700"
                )}
              >
                <Filter size={18} className="mr-2" />
                {t("filter")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 rounded-lg px-4 py-2"
                  >
                    <MoreVertical size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsSelectionMode(!isSelectionMode)}>
                    {isSelectionMode ? "Cancel Selection" : (t("selectSales") || "Select Sales")}
                  </DropdownMenuItem>
                  {isSelectionMode && (
                    <DropdownMenuItem onClick={() => handleSelectAll(true)}>
                      {t("selectAll") || "Select All"}
                    </DropdownMenuItem>
                  )}
                  {isSelectionMode && selectedSales.size > 0 && (
                    <DropdownMenuItem 
                      onClick={handleDeleteSelected}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      {t("delete")} Selected ({selectedSales.size})
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={handleDeleteAll}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    {t("delete")} All Sales
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Selected Sales Indicator */}
            {selectedSales.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg">
                <span className="text-xs font-semibold text-gray-700">
                  {selectedSales.size} {selectedSales.size === 1 ? 'sale' : 'sales'} selected
                </span>
              </div>
            )}
            
            {/* Filter Options - Collapsible */}
            {showFilters && (
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-3">
                  {/* Start Date */}
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-9 h-10 text-base bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg"
                      style={{
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        colorScheme: 'light'
                      }}
                    />
                  </div>
                  
                  {/* End Date */}
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-9 h-10 text-base bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg"
                      style={{
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        colorScheme: 'light'
                      }}
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
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 rounded-lg"
                  >
                    <X size={14} className="mr-2" />
                    {t("cancel")}
                  </Button>
                  
                  {/* Delete Selected Sales - Hidden */}
                  {false && selectedSales.size > 0 && (
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
            )}
          </div>
        </div>
        
        {/* Desktop Table - Sticky Header with Scrollable Body */}
        <div className="hidden lg:block overflow-auto flex-1 pb-4">
          {/* Desktop Table View */}
          <div>
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-100 border-b border-gray-200">
              <tr>
                {isSelectionMode && (
                  <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6 w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      className="h-4 w-4"
                    />
                  </th>
                )}
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("product")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("quantity")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("revenue")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("language") === "rw" ? "Agaciro" : "Cost"}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("profit")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("paymentMethod")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("date")}</th>
              </tr>
            </thead>
            <tbody className="bg-white">
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
                      {isSelectionMode && (
                        <td className="py-4 px-6 w-12">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleSelectSale(idString)}
                            className="h-4 w-4"
                          />
                        </td>
                      )}
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-900">{sale.product}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-700">{sale.quantity}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-700">{sale.revenue.toLocaleString()} rwf</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-700">{sale.cost.toLocaleString()} rwf</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className={cn(
                          "text-sm",
                          sale.profit >= 0 ? "text-green-700" : "text-red-700"
                        )}>
                          {sale.profit >= 0 ? "+" : ""}{sale.profit.toLocaleString()} rwf
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-700">
                          {sale.paymentMethod === 'cash' && t("cash")}
                          {sale.paymentMethod === 'card' && t("card")}
                          {sale.paymentMethod === 'momo' && t("momoPay")}
                          {sale.paymentMethod === 'airtel' && t("airtelPay")}
                          {sale.paymentMethod === 'transfer' && t("bankTransfer")}
                          {!sale.paymentMethod && t("cash")}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-700">{formatDateWithTime(sale.timestamp || sale.date)}</div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isSelectionMode ? 8 : 7} className="py-12 text-center px-6">
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
          
      {/* Mobile Table View - Full Page Scroll - Outside flex container */}
      <div className="lg:hidden mt-4 pb-20">
            
            <div className="overflow-auto">
              <div className="min-w-full">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-gray-100 border-b border-gray-200">
                    <tr>
                      {isSelectionMode && (
                        <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3 w-10">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={handleSelectAll}
                            className="h-4 w-4"
                          />
                        </th>
                      )}
                      <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3">{t("product")}</th>
                      <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3">{t("quantity")}</th>
                      <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3">{t("revenue")}</th>
                      <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3">{t("profit")}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredSales.length > 0 ? (
                      filteredSales.map((sale, index) => {
                        const saleId = (sale as any)._id || sale.id;
                        const idString = saleId?.toString() || '';
                        const isSelected = selectedSales.has(idString);
                        return (
                          <tr key={saleId || sale.id} className={cn(
                            "border-b border-gray-200",
                            index % 2 === 0 ? "bg-white" : "bg-gray-50",
                            isSelected && "bg-blue-50"
                          )}>
                            {isSelectionMode && (
                              <td className="py-3 px-3 w-10">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleSelectSale(idString)}
                                  className="h-4 w-4"
                                />
                              </td>
                            )}
                            <td className="py-3 px-3">
                              <div className="flex flex-col gap-1">
                                <div className="text-xs font-medium text-gray-900">{sale.product}</div>
                                <div className="text-[10px] text-gray-500">
                                  {formatDateWithTime(sale.timestamp || sale.date)}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {sale.paymentMethod === 'cash' && t("cash")}
                                  {sale.paymentMethod === 'card' && t("card")}
                                  {sale.paymentMethod === 'momo' && t("momoPay")}
                                  {sale.paymentMethod === 'airtel' && t("airtelPay")}
                                  {sale.paymentMethod === 'transfer' && t("bankTransfer")}
                                  {!sale.paymentMethod && t("cash")}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-xs text-gray-700">{sale.quantity}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-xs text-gray-700">{sale.revenue.toLocaleString()} rwf</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className={cn(
                                "text-xs font-medium",
                                sale.profit >= 0 ? "text-green-700" : "text-red-700"
                              )}>
                                {sale.profit >= 0 ? "+" : ""}{sale.profit.toLocaleString()} rwf
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={isSelectionMode ? 5 : 4} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center text-gray-400">
                            <ShoppingCart size={48} className="mb-4 opacity-50" />
                            <p className="text-sm font-medium">No sales found matching your filters</p>
                            <p className="text-xs mt-1">Try adjusting your search or date range</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
