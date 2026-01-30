import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Plus, Search, Pencil, Trash2, ArrowUpDown, X, Package, AlertTriangle, Filter, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { playUpdateBeep, playDeleteBeep, playErrorBeep } from "@/lib/sound";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { usePinAuth } from "@/hooks/usePinAuth";
import { PinDialog } from "@/components/PinDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

type SortOption = "newest" | "oldest" | "name-asc" | "name-desc" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc";

interface ProductFormData {
  name: string;
  category: string;
  costPrice: string;
  sellingPrice: string;
  stock: string;
  isPackage: boolean;
  packageQuantity: string;
  productType: string;
  minStock: string;
}

const Products = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    items: products,
    isLoading,
    update: updateProduct,
    remove: removeProduct,
    refresh: refreshProducts,
  } = useApi<Product>({
    endpoint: "products",
    defaultValue: [],
    onError: (error) => {
      console.error("Error with products:", error);
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
    onError: (error) => {
      // Silently handle errors for offline mode
      console.log("Error loading sales:", error);
    },
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"all" | "selected">("all");
  const { hasPin, verifyPin } = usePinAuth();
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    category: "",
    costPrice: "",
    sellingPrice: "",
    stock: "",
    isPackage: false,
    packageQuantity: "",
    productType: "",
    minStock: "",
  });

  // Calculate today's items and current stock
  const getTodayDate = () => new Date().toISOString().split("T")[0];
  
  const todayStats = useMemo(() => {
    const today = getTodayDate();
    const todaySales = sales.filter((sale) => {
      const saleDate = typeof sale.date === 'string' 
        ? sale.date.split('T')[0] 
        : new Date(sale.date).toISOString().split('T')[0];
      return saleDate === today;
    });
    
    const totalItems = todaySales.reduce((sum, sale) => sum + sale.quantity, 0);
    return { totalItems };
  }, [sales]);
  
  const stockStats = useMemo(() => {
    const totalItems = products.reduce((sum, product) => sum + product.stock, 0);
    return { totalItems };
  }, [products]);

  // Refresh products when sales are made (listen for custom event)
  useEffect(() => {
    const handleProductUpdate = () => {
      // Refresh products when sales are made from other pages
      refreshProducts();
    };

    // Listen for custom event when sales are created
    window.addEventListener('products-should-refresh', handleProductUpdate);
    
    // Also refresh when window gains focus (user switches back to this tab)
    const handleFocus = () => {
      refreshProducts();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('products-should-refresh', handleProductUpdate);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshProducts]);

  // Get unique categories and product types for filters
  const uniqueCategories = useMemo(() => {
    const categories = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [products]);

  const uniqueProductTypes = useMemo(() => {
    const types = new Set(products.map(p => p.productType).filter(Boolean));
    return Array.from(types).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    // Always exclude products with stock = 0 from the product list
    // (they are shown in Low Stock Alert instead)
    let filtered = products.filter(p => p.stock > 0);
    
    // Filter by search query (name, category, productType)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.productType && p.productType.toLowerCase().includes(query))
      );
    }
    
    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    // Filter by stock status (only in-stock and low-stock, out-of-stock is always excluded)
    if (stockStatusFilter !== "all") {
      filtered = filtered.filter(p => {
        const minStock = p.minStock || 5;
        switch (stockStatusFilter) {
          case "in-stock":
            return p.stock > minStock;
          case "low-stock":
            return p.stock <= minStock && p.stock > 0;
          // out-of-stock filter removed - products with stock = 0 are never shown in product list
          default:
            return true;
        }
      });
    }
    
    // Filter by product type
    if (productTypeFilter !== "all") {
      filtered = filtered.filter(p => p.productType === productTypeFilter);
    }
    
    // Filter by package
    if (packageFilter !== "all") {
      filtered = filtered.filter(p => {
        if (packageFilter === "package") {
          return p.isPackage === true;
        } else if (packageFilter === "non-package") {
          return !p.isPackage;
        }
        return true;
      });
    }
    
    // Sort products
    filtered.sort((a, b) => {
      const aId = (a as any)._id || a.id || 0;
      const bId = (b as any)._id || b.id || 0;
      switch (sortBy) {
        case "newest":
          // For MongoDB _id, newer items have later timestamps in ObjectId
          // For now, we'll use a simple comparison
          return String(bId).localeCompare(String(aId));
        case "oldest":
          return String(aId).localeCompare(String(bId));
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return a.sellingPrice - b.sellingPrice;
        case "price-desc":
          return b.sellingPrice - a.sellingPrice;
        case "stock-asc":
          return a.stock - b.stock;
        case "stock-desc":
          return b.stock - a.stock;
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [products, searchQuery, selectedCategory, stockStatusFilter, productTypeFilter, packageFilter, sortBy]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setStockStatusFilter("all");
    setProductTypeFilter("all");
    setPackageFilter("all");
    setSortBy("newest");
  };

  const openAddModal = () => {
    navigate(`/products/add`);
  };

  const openBulkAddModal = () => {
    navigate(`/products/add?mode=bulk`);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      costPrice: product.costPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      stock: product.stock.toString(),
      isPackage: product.isPackage || false,
      packageQuantity: product.packageQuantity?.toString() || "",
      productType: product.productType || "",
      minStock: product.minStock?.toString() || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingProduct) return;

      const updatedProduct: Product = {
        ...editingProduct,
        name: formData.name,
        category: formData.category,
      costPrice: parseFloat(formData.costPrice) || 0,
      sellingPrice: parseFloat(formData.sellingPrice) || 0,
      stock: parseInt(formData.stock) || 0,
      isPackage: formData.packageQuantity && formData.packageQuantity.trim() !== "" ? true : false,
      packageQuantity: formData.packageQuantity && formData.packageQuantity.trim() !== "" ? parseInt(formData.packageQuantity) : undefined,
      productType: formData.productType || undefined,
      minStock: formData.minStock ? parseInt(formData.minStock) : undefined,
      };
      
      try {
        await updateProduct(updatedProduct);
        await refreshProducts();
        playUpdateBeep();
        toast({
          title: "Product Updated",
          description: "Product has been updated successfully.",
        });
        setIsModalOpen(false);
      setEditingProduct(null);
      } catch (error) {
        playErrorBeep();
        toast({
          title: "Update Failed",
          description: "Failed to update product. Please try again.",
          variant: "destructive",
        });
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  // Handle individual product selection
  const handleSelectProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredProducts.map((p) => {
        const id = (p as any)._id || p.id;
        return id?.toString() || '';
      }).filter(Boolean));
      setSelectedProducts(allIds);
    } else {
      setSelectedProducts(new Set());
    }
  };

  const allSelected = filteredProducts.length > 0 && filteredProducts.every((p) => {
    const id = (p as any)._id || p.id;
    return selectedProducts.has(id?.toString() || '');
  });

  // Handle delete selected products
  const handleDeleteSelected = () => {
    if (selectedProducts.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one product to delete.",
        variant: "destructive",
      });
      return;
    }
    if (!hasPin) {
      toast({
        title: "PIN Required",
        description: "Please set a PIN in Settings before deleting products.",
        variant: "destructive",
      });
      return;
    }
    setDeleteMode("selected");
    setShowPinDialog(true);
    setPinInput("");
  };

  // Handle delete all products
  const handleDeleteAll = () => {
    if (products.length === 0) {
      toast({
        title: "No Products",
        description: "There are no products to delete.",
        variant: "destructive",
      });
      return;
    }
    if (!hasPin) {
      toast({
        title: "PIN Required",
        description: "Please set a PIN in Settings before deleting products.",
        variant: "destructive",
      });
      return;
    }
    setDeleteMode("all");
    setShowPinDialog(true);
    setPinInput("");
  };

  // Handle PIN verification
  const handlePinVerification = async () => {
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

    // PIN verified, proceed with deletion
    setIsDeleting(true);
    try {
      if (deleteMode === "all") {
        // Delete all products
        let deletedCount = 0;
        let failedCount = 0;

        for (const product of products) {
          try {
            await removeProduct(product);
            deletedCount++;
            playDeleteBeep();
          } catch (error) {
            failedCount++;
            console.error("Error deleting product:", error);
          }
        }

        await refreshProducts();
        setSelectedProducts(new Set());
        
        playUpdateBeep();
        toast({
          title: "All Products Deleted",
          description: `Successfully deleted ${deletedCount} product(s).${failedCount > 0 ? ` ${failedCount} failed.` : ''}`,
        });
      } else {
        // Delete selected products
        const productsToDelete = filteredProducts.filter((p) => {
          const id = (p as any)._id || p.id;
          return selectedProducts.has(id?.toString() || '');
        });

        let deletedCount = 0;
        let failedCount = 0;

        for (const product of productsToDelete) {
          try {
            await removeProduct(product);
            deletedCount++;
            playDeleteBeep();
          } catch (error) {
            failedCount++;
            console.error("Error deleting product:", error);
          }
        }

        await refreshProducts();
        setSelectedProducts(new Set());
        setIsSelectionMode(false);
        
        playUpdateBeep();
        toast({
          title: "Products Deleted",
          description: `Successfully deleted ${deletedCount} product(s).${failedCount > 0 ? ` ${failedCount} failed.` : ''}`,
        });
      }
    } catch (error) {
      playErrorBeep();
      toast({
        title: "Delete Failed",
        description: "Failed to delete products. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowPinDialog(false);
      setPinInput("");
    }
  };

  // Clear selection when exiting selection mode
  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedProducts(new Set());
    }
  }, [isSelectionMode]);

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    
    try {
      await removeProduct(productToDelete);
      await refreshProducts();
      playDeleteBeep();
      toast({
        title: "Product Deleted",
        description: "Product has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (error) {
      playErrorBeep();
      toast({
        title: "Delete Failed",
        description: "Failed to delete product. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStockStatus = (product: Product) => {
    const minStock = product.minStock || 5;
    if (product.stock <= minStock) {
      return { 
        label: "Low Stock", 
        className: "text-red-600 font-medium",
        icon: AlertTriangle 
      };
    }
    return { 
      label: "In Stock", 
      className: "text-muted-foreground",
      icon: null 
    };
  };

  // Products Page Skeleton
  const ProductsSkeleton = () => (
    <AppLayout title="Products">
      <div className="flex flex-col lg:h-[calc(100vh-3rem)]">
        <div className="lg:bg-white flex-1 flex flex-col lg:min-h-0 lg:overflow-hidden rounded-lg">
          {/* Filter Section Skeleton */}
          <div className="lg:bg-white lg:border-b lg:border-gray-200 lg:px-4 lg:py-4 flex-shrink-0">
            {/* Mobile Filter Card Skeleton */}
            <div className="lg:hidden rounded-lg p-4 mb-4 space-y-3 bg-white/80 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="flex flex-row gap-2">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="h-10 flex-1 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
            
            {/* Desktop Filter Section Skeleton */}
            <div className="hidden lg:flex flex-col gap-4">
              <div className="flex flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="flex flex-row gap-2">
                  <Skeleton className="h-10 w-32 rounded-lg" />
                  <Skeleton className="h-10 w-36 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-4 xl:grid-cols-7 gap-3">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          
          {/* Desktop Table Skeleton */}
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
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="py-4 px-4">
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-1">
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
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

  if (isLoading) {
    return <ProductsSkeleton />;
  }

  return (
    <AppLayout title="Products">
      <div className="flex flex-col lg:h-[calc(100vh-3rem)]">
      <div className="lg:bg-white flex-1 flex flex-col lg:min-h-0 lg:overflow-hidden rounded-lg">
          {/* Add Product Buttons - Desktop - Below Card */}
          <div className="hidden lg:flex justify-end lg:px-4 lg:py-2 flex-shrink-0">
            <div className="flex flex-row gap-2">
              <Button onClick={openAddModal} className="bg-blue-600 text-white hover:bg-blue-700 font-semibold px-4 py-2 gap-2">
                <Plus size={18} />
                <span>{t("addProduct")}</span>
              </Button>
              <Button onClick={openBulkAddModal} className="bg-green-600 text-white hover:bg-green-700 border border-transparent font-medium px-4 py-2 gap-2">
                <Plus size={18} />
                <span>{t("bulkAddProducts")}</span>
              </Button>
            </div>
          </div>
          
          {/* Add Product Buttons - Mobile - Below Card */}
          <div className="lg:hidden flex justify-end px-4 py-2 flex-shrink-0">
            <div className="flex flex-row gap-2">
              <Button onClick={openAddModal} className="bg-blue-600 text-white hover:bg-blue-700 font-semibold px-3 py-2 gap-2">
                <Plus size={18} />
                <span>{t("add")}</span>
              </Button>
              <Button onClick={openBulkAddModal} className="bg-green-600 text-white hover:bg-green-700 border border-transparent font-medium px-3 py-2 gap-2">
                <Plus size={18} />
                <span>{t("bulkAdd")}</span>
              </Button>
            </div>
          </div>
          
          {/* Filter Section */}
          <div className="lg:bg-white lg:border-b lg:border-gray-200 lg:px-4 lg:py-4 flex-shrink-0">
            {/* Mobile Filter Section */}
            <div className="lg:hidden mb-4 space-y-3">
              {/* Search Bar with Filter Icon */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <Input
                    placeholder={t("search") + " " + t("products").toLowerCase() + "..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-500 rounded-lg w-full"
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
              </div>
              
              {/* Selected Products Indicator */}
              {selectedProducts.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg">
                  <span className="text-xs font-semibold text-gray-700">
                    {selectedProducts.size} {selectedProducts.size === 1 ? 'product' : 'products'} selected
                  </span>
                </div>
              )}
              
              {/* Filter Options - Collapsible */}
              {showFilters && (
                <div className="rounded-lg p-4 bg-white/80 backdrop-blur-sm border border-gray-200 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Category Filter */}
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg w-full">
                        <SelectValue placeholder={t("allCategories")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allCategories")}</SelectItem>
                        {uniqueCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Stock Status Filter */}
                    <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
                      <SelectTrigger className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg w-full">
                        <SelectValue placeholder={t("status")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allStatus")}</SelectItem>
                        <SelectItem value="in-stock">{t("inStock")}</SelectItem>
                        <SelectItem value="low-stock">{t("lowStock")}</SelectItem>
                        {/* Out of stock products are shown in Low Stock Alert, not in product list */}
                      </SelectContent>
                    </Select>
                    
                    {/* Product Type Filter */}
                    {uniqueProductTypes.length > 0 && (
                      <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                        <SelectTrigger className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg w-full">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {uniqueProductTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    {/* Package Filter */}
                    <Select value={packageFilter} onValueChange={setPackageFilter}>
                      <SelectTrigger className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg w-full">
                        <SelectValue placeholder="Package" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allProducts")}</SelectItem>
                        <SelectItem value="package">Packaged</SelectItem>
                        <SelectItem value="non-package">Non-Packaged</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Sort By */}
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                      <SelectTrigger className="lg:bg-white bg-white/80 backdrop-blur-sm border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg w-full">
                        <div className="flex items-center gap-2">
                          <ArrowUpDown size={14} className="text-gray-400" />
                          <SelectValue placeholder={t("sortBy")} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">{t("newest")}</SelectItem>
                        <SelectItem value="oldest">{t("oldest")}</SelectItem>
                        <SelectItem value="name-asc">{t("nameAsc")}</SelectItem>
                        <SelectItem value="name-desc">{t("nameDesc")}</SelectItem>
                        <SelectItem value="price-asc">{t("priceAsc")}</SelectItem>
                        <SelectItem value="price-desc">{t("priceDesc")}</SelectItem>
                        <SelectItem value="stock-asc">{t("stock")} ({t("language") === "rw" ? "Guke-Gukomeye" : "Low to High"})</SelectItem>
                        <SelectItem value="stock-desc">{t("stock")} ({t("language") === "rw" ? "Gukomeye-Guke" : "High to Low"})</SelectItem>
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
                  </div>
                  <div className="text-xs text-gray-500">
                    {t("language") === "rw" ? "Byerekana" : "Showing"} {filteredProducts.length} {t("language") === "rw" ? "bya" : "of"} {products.length} {t("products").toLowerCase()}
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
                    placeholder={t("search") + " " + t("products").toLowerCase() + "..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-500 rounded-lg w-full"
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
                      {isSelectionMode ? "Cancel Selection" : (t("selectProducts") || "Select Products")}
                    </DropdownMenuItem>
                    {isSelectionMode && (
                      <DropdownMenuItem onClick={() => handleSelectAll(true)}>
                        {t("selectAll") || "Select All"}
                      </DropdownMenuItem>
                    )}
                    {isSelectionMode && selectedProducts.size > 0 && (
                      <DropdownMenuItem 
                        onClick={handleDeleteSelected}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        {t("delete")} Selected ({selectedProducts.size})
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={handleDeleteAll}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      {t("delete")} All Products
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Selected Products Indicator */}
              {selectedProducts.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg">
                  <span className="text-xs font-semibold text-gray-700">
                    {selectedProducts.size} {selectedProducts.size === 1 ? 'product' : 'products'} selected
                  </span>
                </div>
              )}
              
              {/* Filter Options - Collapsible */}
              {showFilters && (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 xl:grid-cols-7 gap-3">
                    {/* Category Filter */}
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg">
                        <SelectValue placeholder={t("allCategories")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allCategories")}</SelectItem>
                        {uniqueCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Stock Status Filter */}
                    <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
                      <SelectTrigger className="bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg">
                        <SelectValue placeholder={t("status")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allStatus")}</SelectItem>
                        <SelectItem value="in-stock">{t("inStock")}</SelectItem>
                        <SelectItem value="low-stock">{t("lowStock")}</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Product Type Filter */}
                    {uniqueProductTypes.length > 0 && (
                      <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                        <SelectTrigger className="bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg">
                          <SelectValue placeholder="Product Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {uniqueProductTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    {/* Package Filter */}
                    <Select value={packageFilter} onValueChange={setPackageFilter}>
                      <SelectTrigger className="bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg">
                        <SelectValue placeholder="Package Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allProducts")}</SelectItem>
                        <SelectItem value="package">Packaged Only</SelectItem>
                        <SelectItem value="non-package">Non-Packaged Only</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Sort By */}
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                      <SelectTrigger className="bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded-lg">
                        <div className="flex items-center gap-2">
                          <ArrowUpDown size={14} className="text-gray-400" />
                          <SelectValue placeholder={t("sortBy")} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">{t("newest")}</SelectItem>
                        <SelectItem value="oldest">{t("oldest")}</SelectItem>
                        <SelectItem value="name-asc">{t("nameAsc")}</SelectItem>
                        <SelectItem value="name-desc">{t("nameDesc")}</SelectItem>
                        <SelectItem value="price-asc">{t("priceAsc")}</SelectItem>
                        <SelectItem value="price-desc">{t("priceDesc")}</SelectItem>
                        <SelectItem value="stock-asc">{t("stock")} ({t("language") === "rw" ? "Guke-Gukomeye" : "Low to High"})</SelectItem>
                        <SelectItem value="stock-desc">{t("stock")} ({t("language") === "rw" ? "Gukomeye-Guke" : "High to Low"})</SelectItem>
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
                  </div>
                  <div className="text-xs text-gray-500">
                    {t("language") === "rw" ? "Byerekana" : "Showing"} {filteredProducts.length} {t("language") === "rw" ? "bya" : "of"} {products.length} {t("products").toLowerCase()}
                  </div>
                </div>
              )}
            </div>
          </div>
          
        {/* Desktop Table - Sticky Header with Scrollable Body */}
        <div className="hidden lg:block overflow-auto flex-1">
            <div className="overflow-hidden">
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
                  <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6 w-12"></th>
                  <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("productName")}</th>
                  <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("productType")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("costPrice")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("sellingPrice")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("stock")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="bg-white">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product, index) => {
                    const status = getStockStatus(product);
                    const productId = (product as any)._id || product.id;
                return (
                  <tr key={productId} className={cn(
                    "border-b border-gray-200",
                    index % 2 === 0 ? "bg-white" : "bg-gray-50",
                    isSelectionMode && selectedProducts.has(productId?.toString() || '') && "bg-blue-50"
                  )}>
                        {isSelectionMode && (
                          <td className="py-4 px-6 w-12">
                            <Checkbox
                              checked={selectedProducts.has(productId?.toString() || '')}
                              onCheckedChange={() => handleSelectProduct(productId?.toString() || '')}
                              className="h-4 w-4"
                            />
                          </td>
                        )}
                        <td className="py-4 px-6 w-12">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                                <MoreVertical size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => openEditModal(product)}>
                                <Pencil size={14} className="mr-2" />
                                {t("editProduct")}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteClick(product)}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
                                <Trash2 size={14} className="mr-2" />
                                {t("deleteProduct")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                      <div className="text-sm text-gray-900">{product.name}</div>
                            {product.isPackage && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                                <Package size={12} />
                                Box of {product.packageQuantity}
                              </span>
                            )}
                          </div>
                    </td>
                    <td className="py-4 px-6">
                          <div className="text-sm">
                            {product.productType ? (
                              <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                                {product.productType}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-gray-700">{product.costPrice.toLocaleString()} rwf</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-gray-700">{product.sellingPrice.toLocaleString()} rwf</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-2 min-w-[120px]">
                        <div className="text-sm font-medium text-gray-900">
                          {product.stock} {t("language") === "rw" ? "ibicuruzwa" : "units"}
                        </div>
                        {/* Stock Level Meter */}
                        <div className="w-full">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              {(() => {
                                const minStock = product.minStock || 5;
                                const maxStock = Math.max(product.stock, minStock * 3, 10);
                                const stockPercentage = maxStock > 0 ? Math.min((product.stock / maxStock) * 100, 100) : 0;
                                const getColor = () => {
                                  if (product.stock === 0) return "bg-gray-400";
                                  if (product.stock <= minStock) return "bg-red-500";
                                  if (product.stock <= minStock * 2) return "bg-yellow-500";
                                  return "bg-green-500";
                                };
                                return (
                                  <div
                                    className={cn("h-full rounded-full transition-all duration-300", getColor())}
                                    style={{ width: `${stockPercentage}%` }}
                                  />
                                );
                              })()}
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {product.minStock ? `min: ${product.minStock}` : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                          <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded", 
                            status.label === "Low Stock" 
                              ? "bg-red-100 text-red-700" 
                              : "bg-green-100 text-green-700"
                          )}>
                            {status.icon && <status.icon size={12} />}
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
                  })
                ) : (
                  <tr>
                    <td colSpan={isSelectionMode ? 8 : 7} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Package size={48} className="mb-4 opacity-50" />
                        <p className="text-base font-medium">{t("noProducts")}</p>
                        <p className="text-sm mt-1">Try adjusting your filters or add a new product</p>
                      </div>
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
          </div>
            </div>
          </div>
          
          {/* Mobile Table View - Full Page Scroll */}
          <div className="lg:hidden overflow-auto pb-20">
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
                    <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3 w-10"></th>
                    <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3">{t("productName")}</th>
                    <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3">{t("costPrice")}</th>
                    <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3">{t("sellingPrice")}</th>
                    <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3">{t("stock")}</th>
                    <th className="text-left text-xs font-semibold text-gray-700 py-3 px-3">{t("status")}</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product, index) => {
                      const status = getStockStatus(product);
                      const productId = (product as any)._id || product.id;
                      return (
                        <tr key={productId} className={cn(
                          "border-b border-gray-200",
                          index % 2 === 0 ? "bg-white" : "bg-gray-50",
                          isSelectionMode && selectedProducts.has(productId?.toString() || '') && "bg-blue-50"
                        )}>
                          {isSelectionMode && (
                            <td className="py-3 px-3 w-10">
                              <Checkbox
                                checked={selectedProducts.has(productId?.toString() || '')}
                                onCheckedChange={() => handleSelectProduct(productId?.toString() || '')}
                                className="h-4 w-4"
                              />
                            </td>
                          )}
                          <td className="py-3 px-3 w-10">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                                  <MoreVertical size={14} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => openEditModal(product)}>
                                  <Pencil size={14} className="mr-2" />
                                  {t("editProduct")}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteClick(product)}
                                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  {t("deleteProduct")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1">
                              <div className="text-xs font-medium text-gray-900">{product.name}</div>
                              {product.isPackage && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded w-fit">
                                  <Package size={10} />
                                  Box of {product.packageQuantity}
                                </span>
                              )}
                              {product.productType && (
                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-700 rounded w-fit">
                                  {product.productType}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-500">{product.category}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-xs text-gray-700">{product.costPrice.toLocaleString()} rwf</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-xs text-gray-700">{product.sellingPrice.toLocaleString()} rwf</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1">
                              <div className="text-xs font-medium text-gray-900">
                                {product.stock} {t("language") === "rw" ? "ibicuruzwa" : "units"}
                              </div>
                              {product.minStock && (
                                <span className="text-[10px] text-gray-500">min: {product.minStock}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded", 
                              status.label === "Low Stock" 
                                ? "bg-red-100 text-red-700" 
                                : "bg-green-100 text-green-700"
                            )}>
                              {status.icon && <status.icon size={10} />}
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                      <tr>
                        <td colSpan={isSelectionMode ? 7 : 6} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Package size={48} className="mb-4 opacity-50" />
                          <p className="text-sm font-medium">{t("noProducts")}</p>
                          <p className="text-xs mt-1">Try adjusting your filters or add a new product</p>
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

      {/* Edit Modal - Only for editing existing products */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("editProduct")}</DialogTitle>
          </DialogHeader>
          
          {editingProduct && (
            <div className="py-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Column 1 */}
                <div className="space-y-4">
              <div className="space-y-2">
                    <Label>{t("productName")}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                      placeholder={t("enterProductName")}
                />
              </div>
              <div className="space-y-2">
                    <Label>{t("category")}</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-field"
                      placeholder={t("enterCategory")}
                />
              </div>
              <div className="space-y-2">
                    <Label>{t("productTypeVariant")}</Label>
                <Input
                  value={formData.productType}
                  onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Small, Large, Medium, etc."
                />
                    <p className="text-xs text-muted-foreground">{t("language") === "rw" ? "Kubwibicuruzwa bifite ibihindurwa nk'ubunini" : "For products with variants like sizes (Small, Large, etc.)"}</p>
              </div>
              <div className="space-y-2">
                    <Label>{t("packageQuantity")} ({t("language") === "rw" ? "Bibasha" : "Optional"})</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.packageQuantity}
                  onChange={(e) => setFormData({ ...formData, packageQuantity: e.target.value })}
                  className="input-field"
                  placeholder="e.g., 12 (for a box of 12)"
                />
                    <p className="text-xs text-muted-foreground">{t("language") === "rw" ? "Reka ubusa niba icuruzwa nticyari mu gipaki" : "Leave empty if product is not packaged. Number of individual items in one package/box"}</p>
                  </div>
              </div>

                {/* Column 2 */}
                <div className="space-y-4">
                <div className="space-y-2">
                    <Label>{t("costPrice")} (rwf)</Label>
                  <Input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                    <Label>{t("sellingPrice")} (rwf)</Label>
                  <Input
                    type="number"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
              <div className="space-y-2">
                    <Label>{t("stockQuantity")}</Label>
                <Input
                  type="number"
                    min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="input-field"
                  placeholder="0"
                />
                    <p className="text-xs text-muted-foreground">
                      {t("language") === "rw" 
                        ? "Umubare w'ibicuruzwa bisigaye mu stoki (bikurwaho igihe ubucuruzi bukorerwa)" 
                        : "Remaining quantity in stock (automatically reduced when sales are made)"}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label>{t("minStockAlert")}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                    className="input-field"
                    placeholder="5"
                  />
                    <p className="text-xs text-muted-foreground">{t("language") === "rw" ? "Icyitonderwa igihe ubwiyubwibwe bugera kuri ubu buryo" : "Alert when stock reaches this level"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsModalOpen(false);
              setEditingProduct(null);
            }} className="btn-secondary">
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 text-white hover:bg-blue-700 font-semibold rounded-lg">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 size={20} className="text-red-600" />
              {t("deleteProduct")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("areYouSure")} {t("language") === "rw" ? "gukoresha gusiba" : "you want to delete"} <strong>{productToDelete?.name}</strong>? 
              {t("thisActionCannotBeUndone")} {t("language") === "rw" ? "kandi kizasiba icuruzwa mu bwiyubwibwe bwawe." : "and will permanently remove this product from your inventory."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t("deleteProduct")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PIN Dialog for Delete Operations */}
      <PinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        pinInput={pinInput}
        onPinInputChange={setPinInput}
        onVerify={handlePinVerification}
        isLoading={isDeleting}
        title={deleteMode === "all" ? "Delete All Products" : "Delete Selected Products"}
        description={deleteMode === "all" 
          ? "Enter your PIN to delete all products. This action cannot be undone."
          : `Enter your PIN to delete ${selectedProducts.size} selected product(s). This action cannot be undone.`}
      />
    </AppLayout>
  );
};

export default Products;
