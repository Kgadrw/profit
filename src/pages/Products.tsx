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
import { Plus, Search, Pencil, Trash2, ArrowUpDown, X, Package, AlertTriangle, Filter } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
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
        <div className="bg-white flex-1 flex flex-col lg:min-h-0 lg:overflow-hidden">
          {/* Filter Section Skeleton */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-28" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          {/* Desktop Table Skeleton */}
          <div className="hidden lg:block overflow-auto flex-1">
            <div className="rounded-b-lg overflow-hidden">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-gray-200">
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
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-6 w-20" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
      <div className="bg-white flex-1 flex flex-col lg:min-h-0 lg:overflow-hidden rounded-lg">
          {/* Filter Section */}
          <div className="bg-white border-b border-gray-200 px-4 py-4 flex-shrink-0">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-gray-700" />
                  <h3 className="text-sm font-semibold text-gray-800">{t("filter")} {t("products")}</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button onClick={openAddModal} className="bg-blue-600 text-white hover:bg-blue-700 font-semibold px-4 py-2 gap-2 w-full sm:w-auto">
                    <Plus size={18} />
                    <span className="hidden xs:inline">{t("addProduct")}</span>
                    <span className="xs:hidden">{t("add")}</span>
                  </Button>
                  <Button onClick={openBulkAddModal} className="bg-green-600 text-white hover:bg-green-700 border border-transparent font-medium px-4 py-2 gap-2 w-full sm:w-auto">
                    <Plus size={18} />
                    <span className="hidden xs:inline">{t("bulkAddProducts")}</span>
                    <span className="xs:hidden">{t("bulkAdd")}</span>
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <Input
                  placeholder={t("search") + " " + t("products").toLowerCase() + "..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-500 rounded-lg"
                />
              </div>
                
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
                    {/* Out of stock products are shown in Low Stock Alert, not in product list */}
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
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <X size={14} className="mr-2" />
                  {t("cancel")}
              </Button>
              </div>
              <div className="text-xs text-gray-500">
                {t("language") === "rw" ? "Byerekana" : "Showing"} {filteredProducts.length} {t("language") === "rw" ? "bya" : "of"} {products.length} {t("products").toLowerCase()}
            </div>
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
                  <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("productName")}</th>
                  <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("productType")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("costPrice")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("sellingPrice")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("stock")}</th>
                <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("status")}</th>
                  <th className="text-left text-sm font-semibold text-gray-700 py-4 px-6">{t("actions")}</th>
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
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  )}>
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
                        <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-2 text-blue-600 rounded"
                          title={t("editProduct")}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(product)}
                          className="p-2 text-red-600 rounded"
                          title={t("deleteProduct")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
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
          
          {/* Mobile Card View - Full Page Scroll */}
          <div className="lg:hidden p-4 space-y-4 pb-20">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const status = getStockStatus(product);
                const productId = (product as any)._id || product.id;
                return (
                  <div key={productId} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h4 className="text-base font-semibold text-gray-900 truncate">{product.name}</h4>
                          {product.isPackage && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded shrink-0">
                              <Package size={12} />
                              Box of {product.packageQuantity}
                            </span>
                          )}
                        </div>
                        {product.productType && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded mb-2">
                            {product.productType}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-2 text-gray-700 hover:bg-gray-50 rounded transition-colors"
                          title={t("editProduct")}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(product)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t("deleteProduct")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Cost:</span>
                        <span className="ml-2 font-medium text-gray-900">{product.costPrice.toLocaleString()} rwf</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Price:</span>
                        <span className="ml-2 font-semibold text-gray-900">{product.sellingPrice.toLocaleString()} rwf</span>
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-500">Stock:</span>
                          <span className="font-medium text-gray-900">
                            {product.stock} {t("language") === "rw" ? "ibicuruzwa" : "units"}
                            {product.minStock && (
                              <span className="text-xs text-gray-500 ml-1">(min: {product.minStock})</span>
                            )}
                          </span>
                        </div>
                        {/* Stock Level Meter */}
                        <div className="w-full">
                          <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
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
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={cn("ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded", status.className)}>
                          {status.icon && <status.icon size={12} />}
                          {status.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">Category: </span>
                      <span className="text-xs font-medium text-gray-700">{product.category}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No products found
              </div>
            )}
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
    </AppLayout>
  );
};

export default Products;
