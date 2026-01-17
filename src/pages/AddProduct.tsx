import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { playProductBeep, playErrorBeep, playWarningBeep, initAudio } from "@/lib/sound";
import { Checkbox } from "@/components/ui/checkbox";

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

const AddProduct = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category");
  const isBulkMode = searchParams.get("mode") === "bulk";
  
  const { toast } = useToast();
  const {
    items: products,
    isLoading,
    add: addProduct,
    refresh: refreshProducts,
  } = useApi<Product>({
    endpoint: "products",
    defaultValue: [],
    onError: (error) => {
      console.error("Error with products:", error);
    },
  });

  const [mode, setMode] = useState<"single" | "bulk">(isBulkMode ? "bulk" : "single");
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    category: categoryFromUrl || "",
    costPrice: "",
    sellingPrice: "",
    stock: "",
    isPackage: false,
    packageQuantity: "",
    productType: "",
    minStock: "",
  });
  const [bulkProducts, setBulkProducts] = useState<ProductFormData[]>([
    { name: "", category: categoryFromUrl || "", costPrice: "", sellingPrice: "", stock: "", isPackage: false, packageQuantity: "", productType: "", minStock: "" }
  ]);


  const addBulkRow = () => {
    setBulkProducts([...bulkProducts, { name: "", category: categoryFromUrl || "", costPrice: "", sellingPrice: "", stock: "", isPackage: false, packageQuantity: "", productType: "", minStock: "" }]);
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

  // Helper function to check if a product is a duplicate
  const isDuplicate = (product: { name: string; category: string; productType?: string }) => {
    const normalizedName = product.name.trim().toLowerCase();
    const normalizedCategory = product.category.trim().toLowerCase();
    const productType = product.productType?.trim() || null;

    return products.some((existingProduct) => {
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

  const handleSave = async () => {
    initAudio();

    if (mode === "bulk") {
      // Bulk add mode
      const newProducts = bulkProducts
        .filter((p) => p.name.trim() !== "") // Only add products with names
        .map((p) => ({
          name: p.name,
          category: p.category,
          costPrice: parseFloat(p.costPrice) || 0,
          sellingPrice: parseFloat(p.sellingPrice) || 0,
          stock: parseInt(p.stock) || 0,
          isPackage: p.packageQuantity && p.packageQuantity.trim() !== "" ? true : false,
          packageQuantity: p.packageQuantity && p.packageQuantity.trim() !== "" ? parseInt(p.packageQuantity) : undefined,
          productType: p.productType || undefined,
          minStock: p.minStock ? parseInt(p.minStock) : undefined,
        }));
      
      if (newProducts.length > 0) {
        // Check for duplicates
        const duplicates = newProducts.filter((product) => isDuplicate(product));
        if (duplicates.length > 0) {
          playWarningBeep();
          toast({
            title: "Duplicate Products Found",
            description: `The following product(s) already exist with the same name, category, and type: ${duplicates.map(p => p.name).join(", ")}`,
            variant: "destructive",
          });
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
        } catch (error) {
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
        costPrice: parseFloat(formData.costPrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        stock: parseInt(formData.stock) || 0,
        isPackage: formData.packageQuantity && formData.packageQuantity.trim() !== "" ? true : false,
        packageQuantity: formData.packageQuantity && formData.packageQuantity.trim() !== "" ? parseInt(formData.packageQuantity) : undefined,
        productType: formData.productType || undefined,
        minStock: formData.minStock ? parseInt(formData.minStock) : undefined,
      };

      // Check for duplicate
      if (isDuplicate(newProduct)) {
        playWarningBeep();
        toast({
          title: "Duplicate Product",
          description: "A product with the same name, category, and type already exists.",
          variant: "destructive",
        });
        return;
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
        playErrorBeep();
        // Check if it's a duplicate error from the backend
        if (error?.message?.toLowerCase().includes("duplicate") || error?.response?.duplicate || error?.status === 409) {
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
    <AppLayout title={mode === "bulk" ? "Bulk Add Products" : "Add Product"}>
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/products")}
              className="hover:bg-blue-500 hover:text-white p-2"
              title="Back to Products"
            >
              <ArrowLeft size={18} />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant={mode === "single" ? "default" : "outline"}
              onClick={() => setMode("single")}
              className={mode === "single" ? "bg-blue-700 text-white hover:bg-blue-800" : ""}
            >
              Single Product
            </Button>
            <Button
              variant={mode === "bulk" ? "default" : "outline"}
              onClick={() => setMode("bulk")}
              className={mode === "bulk" ? "bg-blue-700 text-white hover:bg-blue-800" : ""}
            >
              Bulk Add
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="form-card">
          {mode === "bulk" ? (
            /* Bulk Add Form */
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">Add multiple products at once</p>
                <div className="flex gap-2">
                  <Button onClick={addBulkRow} size="sm" className="bg-blue-500 text-white hover:bg-blue-600 border border-transparent shadow-sm hover:shadow transition-all font-medium px-3 py-2 gap-2">
                    <Plus size={14} />
                    Add Row
                  </Button>
                </div>
              </div>
              
              <div className="border border-transparent overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white border-b border-transparent">
                    <tr>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Product Name</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Category</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Type</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Package</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Cost Price</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Selling Price</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Stock</th>
                      <th className="text-left p-2 text-xs font-medium text-foreground">Min Stock</th>
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
            <Button onClick={handleSave} className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow transition-all font-semibold rounded-lg">
              {mode === "bulk" ? "Add Products" : "Add Product"}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AddProduct;
