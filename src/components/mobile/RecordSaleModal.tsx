import { useState, useEffect, useMemo } from "react";
import { X, Plus, ShoppingCart, Search, ChevronsUpDown } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { playSaleBeep, playErrorBeep, playWarningBeep } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useOffline } from "@/hooks/useOffline";

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
}

interface Sale {
  id?: number;
  _id?: string;
  product: string;
  quantity: number;
  revenue: number;
  profit: number;
  cost: number;
  date: string;
  timestamp?: string; // ISO timestamp of when the sale was recorded
  paymentMethod: string;
}

interface RecordSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaleRecorded?: () => void;
}

const ProductCombobox = ({ value, onValueChange, products, placeholder = "Search products by name, category, or type...", className, onError }: {
  value: string;
  onValueChange: (value: string) => void;
  products: Product[];
  placeholder?: string;
  className?: string;
  onError?: (message: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
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
                  filteredProducts.map((product) => {
                    const id = (product as any)._id || product.id;
                    return (
                      <CommandItem
                        key={id}
                        value={`${product.name} ${product.category} ${product.productType || ""}`}
                        onSelect={() => {
                          if (product.stock > 0) {
                            onValueChange(id.toString());
                            setOpen(false);
                            setSearchQuery("");
                          } else {
                            onError?.(`${product.name} is out of stock`);
                          }
                        }}
                      >
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
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold ml-2">
                          rwf {product.sellingPrice.toLocaleString()}
                        </div>
                      </CommandItem>
                    );
                  })
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

export function RecordSaleModal({ open, onOpenChange, onSaleRecorded }: RecordSaleModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isOnline } = useOffline();
  const {
    items: products,
    isLoading: productsLoading,
    update: updateProduct,
  } = useApi<Product>({
    endpoint: "products",
    defaultValue: [],
  });
  const {
    add: addSale,
    refresh: refreshSales,
  } = useApi<Sale>({
    endpoint: "sales",
    defaultValue: [],
  });

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isRecordingSale, setIsRecordingSale] = useState(false);
  const [packageSaleMode, setPackageSaleMode] = useState<"quantity" | "wholePackage">("quantity"); // For package products: sell by quantity or whole package

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedProduct("");
      setQuantity("1");
      setSellingPrice("");
      setPaymentMethod("cash");
      setSaleDate(new Date().toISOString().split("T")[0]);
    }
  }, [open]);

  // Calculate selling price based on product priceType and sale mode
  const calculateSellingPrice = (product: Product, saleMode: "quantity" | "wholePackage"): number => {
    if (!product.isPackage || !product.packageQuantity) {
      // Regular product - use selling price as is
      return product.sellingPrice;
    }
    
    if (product.priceType === "perQuantity") {
      // Price is per individual item
      if (saleMode === "wholePackage") {
        // Selling whole package: multiply by package quantity
        return product.sellingPrice * product.packageQuantity;
      } else {
        // Selling by quantity: use price as is (per item)
        return product.sellingPrice;
      }
    } else {
      // priceType === "perPackage" - Price is for whole package
      if (saleMode === "wholePackage") {
        // Selling whole package: use price as is
        return product.sellingPrice;
      } else {
        // Selling by quantity: divide by package quantity to get price per item
        return product.sellingPrice / product.packageQuantity;
      }
    }
  };

  // Auto-fill selling price when product is selected
  useEffect(() => {
    if (selectedProduct) {
      const product = products.find((p) => {
        const id = (p as any)._id || p.id;
        return id?.toString() === selectedProduct;
      });
      if (product) {
        // Reset package sale mode when product changes
        if (product.isPackage) {
          setPackageSaleMode("quantity");
        }
        // Calculate and set selling price based on product and sale mode
        const calculatedPrice = calculateSellingPrice(product, product.isPackage ? "quantity" : "quantity");
        setSellingPrice(calculatedPrice.toString());
      }
    }
  }, [selectedProduct, products]);

  // Update selling price when sale mode changes for package products
  useEffect(() => {
    if (selectedProduct) {
      const product = products.find((p) => {
        const id = (p as any)._id || p.id;
        return id?.toString() === selectedProduct;
      });
      
      if (product && product.isPackage && product.packageQuantity) {
        const calculatedPrice = calculateSellingPrice(product, packageSaleMode);
        setSellingPrice(calculatedPrice.toString());
      }
    }
  }, [packageSaleMode, selectedProduct, products]);

  const handleRecordSale = async () => {
    if (!selectedProduct) {
      playErrorBeep();
      toast({
        title: "Error",
        description: "Please select a product.",
        variant: "destructive",
      });
      return;
    }

    const product = products.find((p) => {
      const id = (p as any)._id || p.id;
      return id?.toString() === selectedProduct;
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
        return;
      }
      
      stockReduction = qty;
      const price = parseFloat(sellingPrice);
      revenue = qty * price;
      cost = qty * product.costPrice;
    }
    
    const profit = revenue - cost;

    setIsRecordingSale(true);

    try {
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
        quantity: qty,
        revenue,
        profit,
        cost,
        date: saleDateTime.toISOString(),
        timestamp: new Date().toISOString(), // Record exact time when sale was recorded
        paymentMethod,
      };

      await addSale(newSale);
      playSaleBeep();
      
      // Check if offline mode
      const isOfflineMode = !isOnline;
      
      if (isOfflineMode) {
        toast({
          title: "Sale Recorded (Offline Mode)",
          description: `${qty} ${qty === 1 ? 'item' : 'items'} of ${product.name} sold for RWF ${revenue.toLocaleString()}. Changes will sync when you're back online.`,
        });
      } else {
        toast({
          title: "Sale Recorded!",
          description: `${qty} ${qty === 1 ? 'item' : 'items'} of ${product.name} sold for RWF ${revenue.toLocaleString()}`,
        });
      }

      // Reduce product stock locally immediately for instant UI feedback
      try {
        // Ensure we have the correct ID format
        const productId = (product as any)._id || product.id;
        const updatedProduct = {
          ...product,
          _id: productId,
          id: productId,
          stock: Math.max(0, product.stock - stockReduction),
        };
        await updateProduct(updatedProduct);
        console.log(`[RecordSaleModal] Stock updated: ${product.name} - ${product.stock} -> ${updatedProduct.stock}`);
      } catch (updateError) {
        console.warn("Failed to update product stock in modal:", updateError);
      }

      // Reset form
      setSelectedProduct("");
      setQuantity("1");
      setSellingPrice("");
      setPaymentMethod("cash");
      setSaleDate(new Date().toISOString().split("T")[0]);

      // Refresh sales (only if online, otherwise skip to avoid errors)
      if (isOnline) {
        try {
          await refreshSales();
        } catch (refreshError) {
          // Silently ignore refresh errors when offline
        }
      }
      
      // Dispatch custom event to notify all pages (especially Sales page and Dashboard) to refresh
      window.dispatchEvent(new CustomEvent('sale-recorded', { 
        detail: { sale: newSale, productId: product._id || product.id, stockReduction } 
      }));
      window.dispatchEvent(new CustomEvent('sales-should-refresh'));
      
      onSaleRecorded?.();
      
      // Close modal after a short delay
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    } catch (error: any) {
      // Check if it's an offline/connection error
      if (error?.response?.silent || error?.response?.connectionError || !isOnline) {
        // Offline mode - treat as success
        playSaleBeep();
        toast({
          title: "Sale Recorded (Offline Mode)",
          description: `${qty} ${qty === 1 ? 'item' : 'items'} of ${product.name} sold for RWF ${revenue.toLocaleString()}. Changes will sync when you're back online.`,
        });
        
        // Reset form
        setSelectedProduct("");
        setQuantity("1");
        setSellingPrice("");
        setPaymentMethod("cash");
        setSaleDate(new Date().toISOString().split("T")[0]);
        
        // Dispatch custom event to notify all pages (especially Sales page) to refresh
        window.dispatchEvent(new CustomEvent('sale-recorded', { 
          detail: { sale: { product: product.name, quantity: qty, revenue } } 
        }));
        
        onSaleRecorded?.();
        
        // Close modal after a short delay
        setTimeout(() => {
          onOpenChange(false);
        }, 500);
      } else {
        // Real error - show error message with details
        playErrorBeep();
        console.error("Error recording sale:", error);
        toast({
          title: "Error Recording Sale",
          description: error?.message || error?.response?.error || "Failed to record sale. Please check your connection and try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsRecordingSale(false);
    }
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => {
      const id = (p as any)._id || p.id;
      return id.toString() === productId;
    });
    
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
    } else {
      setSellingPrice("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] max-h-[85vh] overflow-y-auto p-0 bg-white border-gray-200 rounded-2xl shadow-xl">
        <div className="p-4">
          <DialogHeader className="mb-3 pb-3 border-b border-gray-100">
            <DialogTitle className="flex items-center justify-between text-gray-900 text-lg font-semibold">
              <span className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Plus size={18} className="text-white" />
                </div>
                <span>{t("recordNewSale")}</span>
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Compact Form */}
          <div className="space-y-3">
            {/* Product Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">{t("selectProduct")}</Label>
              <ProductCombobox
                value={selectedProduct}
                onValueChange={handleProductChange}
                products={products}
                placeholder="Search product..."
                className="h-10 text-base"
                onError={(message) => {
                  playErrorBeep();
                  toast({
                    title: "Product Out of Stock",
                    description: message,
                    variant: "destructive",
                  });
                }}
              />
              {selectedProduct && (() => {
                const product = products.find(p => {
                  const id = (p as any)._id || p.id;
                  return id.toString() === selectedProduct;
                });
                return (
                  <p className="text-xs text-gray-500">
                    Stock: {product?.stock || 0}
                    {product?.isPackage && product.packageQuantity && (
                      <span className="ml-2">• Box of {product.packageQuantity}</span>
                    )}
                  </p>
                );
              })()}
            </div>

            {/* Package Sale Mode Selector - Only for package products */}
            {selectedProduct && (() => {
              const product = products.find(p => {
                const id = (p as any)._id || p.id;
                return id.toString() === selectedProduct;
              });
              if (product?.isPackage && product.packageQuantity) {
                return (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      {t("language") === "rw" ? "Uburyo bwo kugurisha" : "Sale Mode"}
                    </Label>
                    <Select
                      value={packageSaleMode}
                      onValueChange={(value: "quantity" | "wholePackage") => setPackageSaleMode(value)}
                    >
                      <SelectTrigger className="h-10 text-base bg-gray-50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quantity">
                          {t("language") === "rw" ? "Kugurisha ku mubare" : "Sell by Quantity"}
                        </SelectItem>
                        <SelectItem value="wholePackage">
                          {t("language") === "rw" ? "Kugurisha igipaki cyose" : "Sell Whole Package"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return null;
            })()}

            {/* Quantity and Price in Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">
                  {selectedProduct && (() => {
                    const product = products.find(p => {
                      const id = (p as any)._id || p.id;
                      return id.toString() === selectedProduct;
                    });
                    if (product?.isPackage && packageSaleMode === "wholePackage") {
                      return t("language") === "rw" ? "Igipaki" : "Package";
                    }
                    return t("quantity");
                  })()}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedProduct ? products.find(p => {
                    const id = (p as any)._id || p.id;
                    return id.toString() === selectedProduct;
                  })?.stock || 0 : undefined}
                  value={selectedProduct && (() => {
                    const product = products.find(p => {
                      const id = (p as any)._id || p.id;
                      return id.toString() === selectedProduct;
                    });
                    if (product?.isPackage && packageSaleMode === "wholePackage") {
                      return product.packageQuantity?.toString() || "1";
                    }
                    return quantity;
                  })()}
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
                        setQuantity(product.stock.toString());
                        playErrorBeep();
                        toast({
                          title: "Maximum Quantity",
                          description: `Only ${product.stock} ${product.stock === 1 ? 'item' : 'items'} available.`,
                          variant: "destructive",
                        });
                        return;
                      }
                    }
                    setQuantity(value);
                  }}
                  disabled={selectedProduct && (() => {
                    const product = products.find(p => {
                      const id = (p as any)._id || p.id;
                      return id.toString() === selectedProduct;
                    });
                    return product?.isPackage && packageSaleMode === "wholePackage";
                  })()}
                  className="h-10 text-base bg-gray-50 border-gray-200"
                  placeholder="Qty"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Price (rwf)</Label>
                <Input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="h-10 text-base bg-gray-50 border-gray-200"
                  placeholder="Price"
                />
                {selectedProduct && (() => {
                  const product = products.find(p => {
                    const id = (p as any)._id || p.id;
                    return id.toString() === selectedProduct;
                  });
                  if (product?.isPackage && product.packageQuantity) {
                    return (
                      <p className="text-xs text-gray-500 mt-1">
                        {packageSaleMode === "wholePackage"
                          ? (product.priceType === "perPackage"
                              ? `Price for whole package (${product.packageQuantity} items)`
                              : `Price per item × ${product.packageQuantity} = ${(parseFloat(sellingPrice) || 0) * product.packageQuantity} rwf`)
                          : (product.priceType === "perPackage"
                              ? `Price per item (${product.sellingPrice} ÷ ${product.packageQuantity})`
                              : `Price per individual item`)}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Payment and Date in Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Payment</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-10 text-base bg-gray-50 border-gray-200">
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
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">Date</Label>
                <Input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="h-10 text-base bg-gray-50 border-gray-200"
                />
              </div>
            </div>

            {/* Profit Preview - Compact */}
            {selectedProduct && quantity && sellingPrice && parseInt(quantity) > 0 && parseFloat(sellingPrice) > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-600">Revenue</p>
                        <p className="text-sm font-semibold text-gray-900">rwf {revenue.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Profit</p>
                        <p className={`text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {profit >= 0 ? '+' : ''}rwf {profit.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Submit Button */}
            <Button 
              onClick={handleRecordSale} 
              disabled={isRecordingSale || !selectedProduct || !quantity || !sellingPrice}
              className="w-full h-11 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold shadow-md hover:shadow-lg transition-all rounded-lg gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart size={18} />
              {isRecordingSale ? t("recording") : t("recordSale")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
