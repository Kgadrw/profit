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

  // Auto-fill selling price when product is selected
  useEffect(() => {
    if (selectedProduct) {
      const product = products.find((p) => {
        const id = (p as any)._id || p.id;
        return id?.toString() === selectedProduct;
      });
      if (product) {
        setSellingPrice(product.sellingPrice.toString());
      }
    }
  }, [selectedProduct, products]);

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

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      playErrorBeep();
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (qty > product.stock || product.stock <= 0) {
      playErrorBeep();
      toast({
        title: "Insufficient Stock",
        description: `Only ${product.stock} ${product.stock === 1 ? 'item' : 'items'} available in stock.`,
        variant: "destructive",
      });
      return;
    }

    const price = parseFloat(sellingPrice);
    const revenue = qty * price;
    const cost = qty * product.costPrice;
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

      // Reset form
      setSelectedProduct("");
      setQuantity("1");
      setSellingPrice("");
      setPaymentMethod("cash");
      setSaleDate(new Date().toISOString().split("T")[0]);

      // Refresh sales and products (only if online, otherwise skip to avoid errors)
      if (isOnline) {
        try {
          await refreshSales();
        } catch (refreshError) {
          // Silently ignore refresh errors when offline
        }
      }
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
        
        onSaleRecorded?.();
        
        // Close modal after a short delay
        setTimeout(() => {
          onOpenChange(false);
        }, 500);
      } else {
        // Real error - show error message
        playErrorBeep();
        toast({
          title: "Error",
          description: error.message || "Failed to record sale. Please try again.",
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
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto lg:max-w-md p-0 bg-blue-500 border-blue-600">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Plus size={20} className="text-white" />
              {t("recordNewSale")}
            </DialogTitle>
          </DialogHeader>

          {/* Single Sale Form */}
          <div className="grid grid-cols-1 gap-4">
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
                  })?.sellingPrice.toLocaleString() || ""} - You can change this
                </p>
              )}
            </div>
            {/* Revenue, Cost, and Profit Preview */}
            {selectedProduct && quantity && sellingPrice && parseInt(quantity) > 0 && parseFloat(sellingPrice) > 0 && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-blue-600/30 rounded-lg border border-blue-400/30">
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
                <SelectTrigger className="input-field w-full">
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
                className="input-field w-full"
              />
            </div>
            <div className="flex items-end pt-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
