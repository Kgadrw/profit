import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, ArrowLeft, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { playProductBeep, playErrorBeep, playWarningBeep, initAudio } from "@/lib/sound";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Product {
  id?: number;
  _id?: string;
  name: string;
  category: string;
  manufacturedDate?: string;
  expiryDate?: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  isPackage?: boolean;
  packageQuantity?: number;
  productType?: string;
  minStock?: number;
}

interface ProductFormData {
  name: string;
  category: string;
  manufacturedDate: string;
  expiryDate: string;
  costPrice: string;
  sellingPrice: string;
  stock: string;
  isPackage: boolean;
  packageQuantity: string;
  priceType: "perQuantity" | "perPackage";
  costPriceType: "perQuantity" | "perPackage";
  productType: string;
  minStock: string;
}

const AddProduct = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category");
  const isBulkMode = searchParams.get("mode") === "bulk";
  
  const { toast } = useToast();
  const {
    items: products,
    isLoading,
    add: addProduct,
    update: updateProduct,
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
      console.error("Error with products:", error);
    },
  });

  const [mode, setMode] = useState<"single" | "bulk">(isBulkMode ? "bulk" : "single");
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    category: categoryFromUrl || "",
    manufacturedDate: "",
    expiryDate: "",
    costPrice: "",
    sellingPrice: "",
    stock: "",
    isPackage: false,
    packageQuantity: "",
    priceType: "perQuantity",
    costPriceType: "perQuantity",
    productType: "",
    minStock: "",
  });
  const [bulkProducts, setBulkProducts] = useState<ProductFormData[]>([
    { name: "", category: categoryFromUrl || "", manufacturedDate: "", expiryDate: "", costPrice: "", sellingPrice: "", stock: "", isPackage: false, packageQuantity: "", priceType: "perQuantity", costPriceType: "perQuantity", productType: "", minStock: "" }
  ]);
  
  // State for out-of-stock duplicate dialog
  const [outOfStockDialogOpen, setOutOfStockDialogOpen] = useState(false);
  const [outOfStockProduct, setOutOfStockProduct] = useState<Product | null>(null);
  const [pendingProductData, setPendingProductData] = useState<any>(null);


  const addBulkRow = () => {
    setBulkProducts([...bulkProducts, { name: "", category: categoryFromUrl || "", manufacturedDate: "", expiryDate: "", costPrice: "", sellingPrice: "", stock: "", isPackage: false, packageQuantity: "", productType: "", minStock: "" }]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkProducts.length > 1) {
      setBulkProducts(bulkProducts.filter((_, i) => i !== index));
    }
  };

  const updateBulkProduct = (index: number, field: keyof ProductFormData, value: string) => {
    const updated = [...bulkProducts];
    updated[index] = { ...updated[index], [field]: value };
    setBulkProducts(updated);
  };

  // Helper function to check if a product is a duplicate and return the existing product
  const findDuplicate = (product: { name: string; category: string; productType?: string }) => {
    const normalizedName = product.name.trim().toLowerCase();
    const normalizedCategory = product.category.trim().toLowerCase();
    const productType = product.productType?.trim() || null;

    return products.find((existingProduct) => {
      const existingName = existingProduct.name.trim().toLowerCase();
      const existingCategory = existingProduct.category.trim().toLowerCase();
      const existingType = existingProduct.productType?.trim() || null;

      return (
        existingName === normalizedName &&
        existingCategory === normalizedCategory &&
        existingType === productType
      );
    });
  };
  
  // Helper function to check if a product is a duplicate (for backward compatibility)
  const isDuplicate = (product: { name: string; category: string; productType?: string }) => {
    return findDuplicate(product) !== undefined;
  };
  
  // Handle updating out-of-stock product instead of creating duplicate
  const handleUpdateOutOfStockProduct = async () => {
    if (!outOfStockProduct || !pendingProductData) return;
    
    try {
      const productId = outOfStockProduct._id || outOfStockProduct.id;
      const newStock = parseInt(pendingProductData.stock) || 0;
      const currentStock = outOfStockProduct.stock || 0;
      
      // Update product with new stock (add to existing stock)
      const updatedProduct = {
        ...outOfStockProduct,
        stock: currentStock + newStock,
        // Update other fields if provided
        costPrice: pendingProductData.costPrice !== undefined ? parseFloat(pendingProductData.costPrice) : outOfStockProduct.costPrice,
        sellingPrice: pendingProductData.sellingPrice !== undefined ? parseFloat(pendingProductData.sellingPrice) : outOfStockProduct.sellingPrice,
        minStock: pendingProductData.minStock ? parseInt(pendingProductData.minStock) : outOfStockProduct.minStock,
      };
      
      await updateProduct(updatedProduct as any);
      await refreshProducts();
      
      setOutOfStockDialogOpen(false);
      setOutOfStockProduct(null);
      setPendingProductData(null);
      
      playProductBeep();
      toast({
        title: "Product Restocked",
        description: `Successfully updated ${outOfStockProduct.name}. Stock increased by ${newStock} to ${currentStock + newStock}.`,
      });
      
      navigate("/products");
    } catch (error: any) {
      // Don't show errors for connection issues (offline mode)
      if (error?.response?.silent || error?.response?.connectionError) {
        // Product was saved locally, show success message
        playProductBeep();
        toast({
          title: "Product Restocked",
          description: "Product has been updated. It will sync when you're back online.",
        });
        navigate("/products");
        return;
      }
      playErrorBeep();
      toast({
        title: "Update Failed",
        description: "Failed to update product. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    initAudio();

    if (mode === "bulk") {
      // Bulk add mode
      const newProducts = bulkProducts
        .filter((p) => p.name.trim() !== "") // Only add products with names
        .map((p) => ({
          name: p.name,
          category: p.category,
          manufacturedDate: p.manufacturedDate || undefined,
          expiryDate: p.expiryDate || undefined,
          costPrice: parseFloat(p.costPrice) || 0,
          sellingPrice: parseFloat(p.sellingPrice) || 0,
          stock: parseInt(p.stock) || 0,
          isPackage: p.packageQuantity && p.packageQuantity.trim() !== "" ? true : false,
          packageQuantity: p.packageQuantity && p.packageQuantity.trim() !== "" ? parseInt(p.packageQuantity) : undefined,
          priceType: p.packageQuantity && p.packageQuantity.trim() !== "" ? p.priceType : undefined,
          costPriceType: p.packageQuantity && p.packageQuantity.trim() !== "" ? p.costPriceType : undefined,
          productType: p.productType || undefined,
          minStock: p.minStock ? parseInt(p.minStock) : undefined,
        }));
      
      if (newProducts.length > 0) {
        // Check for duplicates and separate out-of-stock ones
        const outOfStockDuplicates: { product: any; existing: Product }[] = [];
        const regularDuplicates: any[] = [];
        
        newProducts.forEach((product) => {
          const existing = findDuplicate(product);
          if (existing) {
            if (existing.stock === 0) {
              outOfStockDuplicates.push({ product, existing });
            } else {
              regularDuplicates.push(product);
            }
          }
        });
        
        if (regularDuplicates.length > 0) {
          playWarningBeep();
          toast({
            title: "Duplicate Products Found",
            description: `The following product(s) already exist: ${regularDuplicates.map(p => p.name).join(", ")}`,
            variant: "destructive",
          });
          return;
        }
        
        // Handle out-of-stock duplicates - update them instead
        if (outOfStockDuplicates.length > 0) {
          try {
            let updatedCount = 0;
            for (const { product, existing } of outOfStockDuplicates) {
              const productId = existing._id || existing.id;
              const newStock = parseInt(product.stock) || 0;
              const currentStock = existing.stock || 0;
              
              const updatedProduct = {
                ...existing,
                stock: currentStock + newStock,
                costPrice: product.costPrice !== undefined ? parseFloat(product.costPrice) : existing.costPrice,
                sellingPrice: product.sellingPrice !== undefined ? parseFloat(product.sellingPrice) : existing.sellingPrice,
              };
              
              await updateProduct(updatedProduct as any);
              updatedCount++;
            }
            
            // Remove out-of-stock duplicates from newProducts
            const outOfStockNames = new Set(outOfStockDuplicates.map(d => d.product.name.toLowerCase()));
            const productsToAdd = newProducts.filter(p => !outOfStockNames.has(p.name.toLowerCase()));
            
            // Add remaining new products
            let addedCount = 0;
            for (const product of productsToAdd) {
              try {
                await addProduct(product as any);
                addedCount++;
              } catch (error: any) {
                if (error?.status === 409 && error?.response?.outOfStock && error?.response?.existingProduct) {
                  // Handle backend-detected out-of-stock duplicates
                  const existing = error.response.existingProduct;
                  const productId = existing._id;
                  const newStock = parseInt(product.stock) || 0;
                  const updatedProduct = {
                    ...existing,
                    stock: (existing.stock || 0) + newStock,
                    costPrice: product.costPrice !== undefined ? parseFloat(product.costPrice) : existing.costPrice,
                    sellingPrice: product.sellingPrice !== undefined ? parseFloat(product.sellingPrice) : existing.sellingPrice,
                  };
                  await updateProduct(updatedProduct as any);
                  updatedCount++;
                } else {
                  console.warn(`Failed to add product: ${product.name}`, error);
                }
              }
            }
            
            await refreshProducts();
            
            if (addedCount > 0 || updatedCount > 0) {
              playProductBeep();
              toast({
                title: "Products Processed",
                description: `Successfully added ${addedCount} new product(s) and restocked ${updatedCount} out-of-stock product(s).`,
              });
              navigate("/products");
            }
          } catch (error: any) {
            // Don't show errors for connection issues (offline mode)
            if (error?.response?.silent || error?.response?.connectionError) {
              // Products were saved locally, show success message
              playProductBeep();
              toast({
                title: "Products Processed",
                description: "Products have been saved. They will sync when you're back online.",
              });
              
              // Send notification about offline save
              const { notificationService } = await import("@/lib/notifications");
              if (notificationService.isAllowed()) {
                await notificationService.showNotification('general', {
                  title: 'Products Saved Offline',
                  body: `${productsToAdd.length} product(s) have been saved locally. Remember to sync when back online.`,
                  icon: '/logo.png',
                  tag: `offline-products-${Date.now()}`,
                  data: {
                    route: '/products',
                    type: 'offline_save',
                    count: productsToAdd.length,
                  },
                });
              }
              
              navigate("/products");
              return;
            }
            playErrorBeep();
            toast({
              title: "Processing Failed",
              description: "Failed to process some products. Please try again.",
              variant: "destructive",
            });
          }
          return;
        }

        try {
          // Add products one by one (API doesn't have bulk add for products yet)
          let addedCount = 0;
          let skippedCount = 0;
          for (const product of newProducts) {
            try {
              await addProduct(product as any);
              addedCount++;
            } catch (error: any) {
              // Check if it's a duplicate error from the backend
              if (error?.message?.toLowerCase().includes("duplicate") || error?.response?.duplicate || error?.status === 409) {
                skippedCount++;
                console.warn(`Skipping duplicate product: ${product.name}`);
              } else {
                throw error; // Re-throw if it's a different error
              }
            }
          }
          await refreshProducts();
          
          if (addedCount > 0) {
            playProductBeep();
            toast({
              title: "Products Added",
              description: `Successfully added ${addedCount} product(s).${skippedCount > 0 ? ` ${skippedCount} duplicate(s) were skipped.` : ""}`,
            });
            navigate("/products");
          } else {
            playWarningBeep();
            toast({
              title: "No Products Added",
              description: "All products were duplicates and were skipped.",
              variant: "destructive",
            });
          }
        } catch (error: any) {
          // Don't show errors for connection issues (offline mode)
          if (error?.response?.silent || error?.response?.connectionError) {
            // Products were saved locally, show success message
            playProductBeep();
            toast({
              title: "Products Added",
              description: "Products have been saved. They will sync when you're back online.",
            });
            
            // Send notification about offline save
            const { notificationService } = await import("@/lib/notifications");
            if (notificationService.isAllowed()) {
              await notificationService.showNotification('general', {
                title: 'Products Saved Offline',
                body: `${addedCount} product(s) have been saved locally. Remember to sync when back online.`,
                icon: '/logo.png',
                tag: `offline-products-${Date.now()}`,
                data: {
                  route: '/products',
                  type: 'offline_save',
                  count: addedCount,
                },
              });
            }
            
            navigate("/products");
            return;
          }
          playErrorBeep();
          toast({
            title: "Add Failed",
            description: "Failed to add products. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        playWarningBeep();
        toast({
          title: "No Products Added",
          description: "Please enter at least one product name.",
          variant: "destructive",
        });
      }
    } else {
      // Single add mode
      if (!formData.name.trim()) {
        playWarningBeep();
        toast({
          title: "Missing Information",
          description: "Please enter a product name.",
          variant: "destructive",
        });
        return;
      }
      
      const newProduct = {
        name: formData.name,
        category: formData.category,
        manufacturedDate: formData.manufacturedDate || undefined,
        expiryDate: formData.expiryDate || undefined,
        costPrice: parseFloat(formData.costPrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        stock: parseInt(formData.stock) || 0,
        isPackage: formData.packageQuantity && formData.packageQuantity.trim() !== "" ? true : false,
        packageQuantity: formData.packageQuantity && formData.packageQuantity.trim() !== "" ? parseInt(formData.packageQuantity) : undefined,
        priceType: formData.packageQuantity && formData.packageQuantity.trim() !== "" ? formData.priceType : undefined,
        costPriceType: formData.packageQuantity && formData.packageQuantity.trim() !== "" ? formData.costPriceType : undefined,
        productType: formData.productType || undefined,
        minStock: formData.minStock ? parseInt(formData.minStock) : undefined,
      };

      // Check for duplicate
      const existingProduct = findDuplicate(newProduct);
      if (existingProduct) {
        // If duplicate is out of stock, offer to update instead
        if (existingProduct.stock === 0) {
          setOutOfStockProduct(existingProduct);
          setPendingProductData(newProduct);
          setOutOfStockDialogOpen(true);
          playWarningBeep();
          return;
        } else {
        playWarningBeep();
        toast({
          title: "Duplicate Product",
          description: "A product with the same name, category, and type already exists.",
          variant: "destructive",
        });
        return;
        }
      }
      
      try {
        await addProduct(newProduct as any);
        await refreshProducts();
        playProductBeep();
        toast({
          title: "Product Added",
          description: "Product has been added successfully.",
        });
        navigate("/products");
      } catch (error: any) {
        // Don't show errors for connection issues (offline mode)
        if (error?.response?.silent || error?.response?.connectionError) {
          // Product was saved locally, show success message
          playProductBeep();
          toast({
            title: "Product Added",
            description: "Product has been saved. It will sync when you're back online.",
          });
          
          // Send notification about offline save
          const { notificationService } = await import("@/lib/notifications");
          if (notificationService.isAllowed()) {
            await notificationService.showNotification('general', {
              title: 'Product Saved Offline',
              body: `${formData.name} has been saved locally. Remember to sync when back online.`,
              icon: '/logo.png',
              tag: `offline-product-${Date.now()}`,
              data: {
                route: '/products',
                type: 'offline_save',
                productName: formData.name,
              },
            });
          }
          
          navigate("/products");
          return;
        }
        playErrorBeep();
        // Check if it's a duplicate error from the backend with out of stock info
        if (error?.status === 409 && error?.response?.outOfStock && error?.response?.existingProduct) {
          setOutOfStockProduct(error.response.existingProduct);
          setPendingProductData(newProduct);
          setOutOfStockDialogOpen(true);
        } else if (error?.message?.toLowerCase().includes("duplicate") || error?.response?.duplicate || error?.status === 409) {
          toast({
            title: "Duplicate Product",
            description: "A product with the same name, category, and type already exists.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Add Failed",
            description: "Failed to add product. Please try again.",
            variant: "destructive",
          });
        }
      }
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Add Product">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={mode === "bulk" ? t("bulkAddProducts") : t("addProduct")}>
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/products")}
              className="hover:bg-blue-500 hover:text-white p-2"
              title={t("backToProducts")}
            >
              <ArrowLeft size={18} />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant={mode === "single" ? "default" : "outline"}
              onClick={() => setMode("single")}
              className={mode === "single" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
            >
              {t("language") === "rw" ? "Icuruzwa kimwe" : "Single Product"}
            </Button>
            <Button
              variant={mode === "bulk" ? "default" : "outline"}
              onClick={() => setMode("bulk")}
              className={mode === "bulk" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
            >
              {t("bulkAdd")}
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="form-card lg:bg-white bg-white/80 backdrop-blur-sm">
          {mode === "bulk" ? (
            /* Bulk Add Form */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <p className="text-sm text-muted-foreground">{t("addMultipleProducts")}</p>
                <Button 
                  onClick={addBulkRow} 
                  className="bg-blue-500 text-white hover:bg-blue-600 border border-transparent shadow-sm hover:shadow transition-all font-medium px-4 py-3 h-12 text-base w-full sm:w-auto"
                >
                  <Plus size={18} />
                  <span className="ml-2">{t("addProduct")}</span>
                  </Button>
              </div>
              
              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-4">
                {bulkProducts.map((product, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 lg:bg-white bg-white/80 backdrop-blur-sm space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">Product #{index + 1}</span>
                      {bulkProducts.length > 1 && (
                        <button
                          onClick={() => removeBulkRow(index)}
                          className="p-2 hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors rounded"
                          aria-label="Remove product"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-1 block">{t("productName")}</Label>
                        <Input
                          value={product.name}
                          onChange={(e) => updateBulkProduct(index, "name", e.target.value)}
                          className="h-12 text-base"
                          placeholder={t("enterProductName")}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-1 block">{t("category")}</Label>
                        <Input
                          value={product.category}
                          onChange={(e) => updateBulkProduct(index, "category", e.target.value)}
                          className="h-12 text-base"
                          placeholder={t("enterCategory")}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-1 block">{t("productType")}</Label>
                          <Input
                            value={product.productType}
                            onChange={(e) => updateBulkProduct(index, "productType", e.target.value)}
                            className="h-12 text-base"
                            placeholder="e.g., Small"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-1 block">{t("packageQuantity")}</Label>
                          <Input
                            type="number"
                            min="1"
                            value={product.packageQuantity}
                            onChange={(e) => updateBulkProduct(index, "packageQuantity", e.target.value)}
                            className="h-12 text-base"
                            placeholder={t("language") === "rw" ? "Bibasha" : "Optional"}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-1 block">{t("costPrice")}</Label>
                          <Input
                            type="number"
                            value={product.costPrice}
                            onChange={(e) => updateBulkProduct(index, "costPrice", e.target.value)}
                            className="h-12 text-base"
                            placeholder="0.00"
                          />
                          {product.packageQuantity && product.packageQuantity.trim() !== "" && (
                            <Select
                              value={product.costPriceType}
                              onValueChange={(value: "perQuantity" | "perPackage") => updateBulkProduct(index, "costPriceType", value)}
                            >
                              <SelectTrigger className="h-10 text-sm mt-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="perQuantity">
                                  {t("language") === "rw" ? "Igiciro cy'umubare" : "Cost per Quantity"}
                                </SelectItem>
                                <SelectItem value="perPackage">
                                  {t("language") === "rw" ? "Igiciro cy'igipaki" : "Cost per Package"}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-1 block">{t("sellingPrice")}</Label>
                          <Input
                            type="number"
                            value={product.sellingPrice}
                            onChange={(e) => updateBulkProduct(index, "sellingPrice", e.target.value)}
                            className="h-12 text-base"
                            placeholder="0.00"
                          />
                          {product.packageQuantity && product.packageQuantity.trim() !== "" && (
                            <Select
                              value={product.priceType}
                              onValueChange={(value: "perQuantity" | "perPackage") => updateBulkProduct(index, "priceType", value)}
                            >
                              <SelectTrigger className="h-10 text-sm mt-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="perQuantity">
                                  {t("language") === "rw" ? "Igiciro cy'umubare" : "Price per Quantity"}
                                </SelectItem>
                                <SelectItem value="perPackage">
                                  {t("language") === "rw" ? "Igiciro cy'igipaki" : "Price per Package"}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-1 block">Stock</Label>
                          <Input
                            type="number"
                            min="0"
                            value={product.stock}
                            onChange={(e) => updateBulkProduct(index, "stock", e.target.value)}
                            className="h-12 text-base"
                            placeholder="0"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("language") === "rw" 
                              ? "Umubare w'ibicuruzwa bisigaye" 
                              : "Remaining quantity"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-1 block">Min Stock</Label>
                          <Input
                            type="number"
                            min="0"
                            value={product.minStock}
                            onChange={(e) => updateBulkProduct(index, "minStock", e.target.value)}
                            className="h-12 text-base"
                            placeholder="5"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-1 block">Manufactured Date (Optional)</Label>
                          <div className="relative">
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                            <Input
                              type="date"
                              value={product.manufacturedDate}
                              onChange={(e) => updateBulkProduct(index, "manufacturedDate", e.target.value)}
                              className="h-12 text-base pr-10"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-1 block">Expiration Date (Optional)</Label>
                          <div className="relative">
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                            <Input
                              type="date"
                              value={product.expiryDate}
                              onChange={(e) => updateBulkProduct(index, "expiryDate", e.target.value)}
                              className="h-12 text-base pr-10"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden md:block border border-transparent overflow-x-auto">
                <table className="w-full">
                  <thead className="lg:bg-white bg-white/80 backdrop-blur-sm border-b border-transparent">
                    <tr>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Product Name</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Category</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Type</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Package</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Cost Price</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Selling Price</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Stock</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Min Stock</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">MFD (Optional)</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">EXP (Optional)</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkProducts.map((product, index) => (
                      <tr key={index} className="border-b border-transparent last:border-0">
                        <td className="p-2">
                          <Input
                            value={product.name}
                            onChange={(e) => updateBulkProduct(index, "name", e.target.value)}
                            className="input-field h-9 text-sm"
                            placeholder="Enter product name"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={product.category}
                            onChange={(e) => updateBulkProduct(index, "category", e.target.value)}
                            className="input-field h-9 text-sm"
                            placeholder="Enter category"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={product.productType}
                            onChange={(e) => updateBulkProduct(index, "productType", e.target.value)}
                            className="input-field h-9 text-sm"
                            placeholder="e.g., Small, Large"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="1"
                            value={product.packageQuantity}
                            onChange={(e) => updateBulkProduct(index, "packageQuantity", e.target.value)}
                            className="input-field h-9 text-sm"
                            placeholder="Optional"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={product.costPrice}
                            onChange={(e) => updateBulkProduct(index, "costPrice", e.target.value)}
                            className="input-field h-9 text-sm"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={product.sellingPrice}
                            onChange={(e) => updateBulkProduct(index, "sellingPrice", e.target.value)}
                            className="input-field h-9 text-sm"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={product.stock}
                            onChange={(e) => updateBulkProduct(index, "stock", e.target.value)}
                            className="input-field h-9 text-sm"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={product.minStock}
                            onChange={(e) => updateBulkProduct(index, "minStock", e.target.value)}
                            className="input-field h-9 text-sm"
                            placeholder="5"
                          />
                        </td>
                        <td className="p-2">
                          <div className="relative">
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                            <Input
                              type="date"
                              value={product.manufacturedDate}
                              onChange={(e) => updateBulkProduct(index, "manufacturedDate", e.target.value)}
                              className="input-field h-9 text-sm pr-9"
                            />
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="relative">
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                            <Input
                              type="date"
                              value={product.expiryDate}
                              onChange={(e) => updateBulkProduct(index, "expiryDate", e.target.value)}
                              className="input-field h-9 text-sm pr-9"
                            />
                          </div>
                        </td>
                        <td className="p-2">
                          {bulkProducts.length > 1 && (
                            <button
                              onClick={() => removeBulkRow(index)}
                              className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="text-xs text-muted-foreground">
                * Products with empty names will be skipped
              </div>
            </div>
          ) : (
            /* Single Add Form */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="Enter product name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input-field"
                    placeholder="Enter category"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Type/Variant (Optional)</Label>
                  <Input
                    value={formData.productType}
                    onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Small, Large, Medium, etc."
                  />
                  <p className="text-xs text-muted-foreground">For products with variants like sizes (Small, Large, etc.)</p>
                </div>
                <div className="space-y-2">
                  <Label>Package Quantity (Optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.packageQuantity}
                    onChange={(e) => setFormData({ ...formData, packageQuantity: e.target.value })}
                    className="input-field"
                    placeholder="e.g., 12 (for a box of 12)"
                  />
                  <p className="text-xs text-muted-foreground">Leave empty if product is not packaged. Number of individual items in one package/box</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Manufactured Date (Optional)</Label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                    <Input
                      type="date"
                      value={formData.manufacturedDate}
                      onChange={(e) => setFormData({ ...formData, manufacturedDate: e.target.value })}
                      className="input-field pr-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date (Optional)</Label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                    <Input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="input-field pr-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Used for tracking expiry of perishable products.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Cost Price (rwf)</Label>
                  <Input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="input-field"
                    placeholder="0.00"
                  />
                  {formData.packageQuantity && formData.packageQuantity.trim() !== "" && (
                    <>
                      <Select
                        value={formData.costPriceType}
                        onValueChange={(value: "perQuantity" | "perPackage") => setFormData({ ...formData, costPriceType: value })}
                      >
                        <SelectTrigger className="input-field mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="perQuantity">
                            {t("language") === "rw" ? "Igiciro cy'umubare w'ibicuruzwa" : "Cost per Quantity (per item)"}
                          </SelectItem>
                          <SelectItem value="perPackage">
                            {t("language") === "rw" ? "Igiciro cy'igipaki cyose" : "Cost per Package (whole box)"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {formData.costPriceType === "perQuantity"
                          ? (t("language") === "rw" 
                              ? "Igiciro cy'umubare w'ibicuruzwa (urugero: 80 rwf kuri buri gicuruzwa)"
                              : "Cost per individual item (e.g., 80 rwf per item)")
                          : (t("language") === "rw"
                              ? "Igiciro cy'igipaki cyose (urugero: 1500 rwf kuri gipaki cyose)"
                              : "Cost for whole package (e.g., 1500 rwf for whole box)")}
                      </p>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Selling Price (rwf)</Label>
                  <Input
                    type="number"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="input-field"
                    placeholder="0.00"
                  />
                  {formData.packageQuantity && formData.packageQuantity.trim() !== "" && (
                    <>
                      <Select
                        value={formData.priceType}
                        onValueChange={(value: "perQuantity" | "perPackage") => setFormData({ ...formData, priceType: value })}
                      >
                        <SelectTrigger className="input-field mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="perQuantity">
                            {t("language") === "rw" ? "Igiciro cy'umubare w'ibicuruzwa" : "Price per Quantity (per item)"}
                          </SelectItem>
                          <SelectItem value="perPackage">
                            {t("language") === "rw" ? "Igiciro cy'igipaki cyose" : "Price per Package (whole box)"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {formData.priceType === "perQuantity"
                          ? (t("language") === "rw" 
                              ? "Igiciro cy'umubare w'ibicuruzwa (urugero: 100 rwf kuri buri gicuruzwa)"
                              : "Price per individual item (e.g., 100 rwf per item)")
                          : (t("language") === "rw"
                              ? "Igiciro cy'igipaki cyose (urugero: 1200 rwf kuri gipaki cyose)"
                              : "Price for whole package (e.g., 1200 rwf for whole box)")}
                      </p>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Initial Stock Quantity</Label>
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
                  <Label>Minimum Stock Alert</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                    className="input-field"
                    placeholder="5"
                  />
                  <p className="text-xs text-muted-foreground">Alert when stock reaches this level</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Footer Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button variant="outline" onClick={() => navigate("/products")} className="btn-secondary">
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow transition-all font-semibold rounded-lg">
              {mode === "bulk" ? "Add Products" : "Add Product"}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Out of Stock Duplicate Dialog */}
      <AlertDialog open={outOfStockDialogOpen} onOpenChange={setOutOfStockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Product Already Exists (Out of Stock)</AlertDialogTitle>
            <AlertDialogDescription>
              A product named "{outOfStockProduct?.name}" already exists in category "{outOfStockProduct?.category}" 
              {outOfStockProduct?.productType && ` (Type: ${outOfStockProduct.productType})`} but is currently out of stock.
              <br /><br />
              Would you like to update the existing product and increase its stock instead of creating a duplicate?
              <br /><br />
              <strong>Current stock:</strong> {outOfStockProduct?.stock || 0}
              <br />
              <strong>New stock to add:</strong> {pendingProductData?.stock || 0}
              <br />
              <strong>Total stock after update:</strong> {(outOfStockProduct?.stock || 0) + (parseInt(pendingProductData?.stock) || 0)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setOutOfStockDialogOpen(false);
              setOutOfStockProduct(null);
              setPendingProductData(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdateOutOfStockProduct} className="bg-green-600 hover:bg-green-700">
              Yes, Update & Restock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AddProduct;
