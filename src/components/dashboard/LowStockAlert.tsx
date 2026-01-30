import { useState, useMemo, useEffect } from "react";
import { AlertTriangle, Edit2, Check, X, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { playUpdateBeep, playWarningBeep, playDeleteBeep, playErrorBeep, initAudio } from "@/lib/sound";
import { useApi } from "@/hooks/useApi";
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
  stock: number;
  minStock?: number;
  manufacturedDate?: string;
  expiryDate?: string;
}

interface LowStockItem {
  id: string | number;
  name: string;
  stock: number;
  minStock?: number;
  isOutOfStock?: boolean;
  isExpiringSoon?: boolean;
}

export function LowStockAlert() {
  const { toast } = useToast();
  const {
    items: products,
    update: updateProduct,
    remove: removeProduct,
    refresh: refreshProducts,
  } = useApi<Product>({
    endpoint: "products",
    defaultValue: [],
  });

  // Filter products with low stock and out of stock (stock = 0)
  const lowStockItems = useMemo(() => {
    return products
      .filter((product) => {
        const minStock = product.minStock || 0;
        // Check expiry window (30 days) if expiryDate exists
        const expiryDateStr = (product as any).expiryDate as string | undefined;
        let isExpiringSoon = false;

        if (expiryDateStr) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const expiryDate = new Date(expiryDateStr);
          expiryDate.setHours(0, 0, 0, 0);

          const diffMs = expiryDate.getTime() - today.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          if (diffDays >= 0 && diffDays <= 30) {
            isExpiringSoon = true;
          }
        }

        // Show products with stock equals minStock (exact match) OR stock < minStock OR stock = 0 (out of stock)
        // OR products that are expiring soon
        return product.stock === minStock || product.stock < minStock || product.stock === 0 || isExpiringSoon;
      })
      .map((product) => ({
        id: product._id || product.id || '',
        name: product.name,
        stock: product.stock,
        minStock: product.minStock,
        isOutOfStock: product.stock === 0,
        isExpiringSoon: (() => {
          const expiryDateStr = (product as any).expiryDate as string | undefined;
          if (!expiryDateStr) return false;

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const expiryDate = new Date(expiryDateStr);
          expiryDate.setHours(0, 0, 0, 0);

          const diffMs = expiryDate.getTime() - today.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 30;
        })(),
      }))
      .sort((a, b) => {
        // Sort: out of stock first, then expiring soon, then by stock level (lowest first)
        if (a.isOutOfStock && !b.isOutOfStock) return -1;
        if (!a.isOutOfStock && b.isOutOfStock) return 1;
        if (a.isExpiringSoon && !b.isExpiringSoon) return -1;
        if (!a.isExpiringSoon && b.isExpiringSoon) return 1;
        return a.stock - b.stock;
      })
      .slice(0, 10); // Show top 10 low stock items (including out of stock)
  }, [products]);

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editStock, setEditStock] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<LowStockItem | null>(null);

  // Auto-refresh when products are updated, added, or sales are made
  useEffect(() => {
    let debounceTimeout: NodeJS.Timeout | null = null;
    let lastRefreshTime = 0;
    const DEBOUNCE_DELAY = 1000; // 1 second debounce
    const MIN_REFRESH_INTERVAL = 30 * 1000; // 30 seconds minimum between refreshes (increased to reduce API calls)

    const handleProductUpdate = () => {
      const now = Date.now();
      
      // Clear any pending debounced refresh
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }
      
      // Check if enough time has passed since last refresh
      if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        // Debounce the refresh
        debounceTimeout = setTimeout(() => {
          lastRefreshTime = Date.now();
          refreshProducts();
        }, DEBOUNCE_DELAY);
      } else {
        // Refresh immediately
        lastRefreshTime = Date.now();
        refreshProducts();
      }
    };

    // Listen for custom events when products are created, updated, or sales are made
    window.addEventListener('products-should-refresh', handleProductUpdate);
    window.addEventListener('sale-recorded', handleProductUpdate);

    return () => {
      window.removeEventListener('products-should-refresh', handleProductUpdate);
      window.removeEventListener('sale-recorded', handleProductUpdate);
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [refreshProducts]);

  const handleEdit = (item: LowStockItem) => {
    setEditingId(item.id);
    setEditStock(item.stock.toString());
  };

  const handleSave = async (id: string | number) => {
    const stockValue = parseInt(editStock);
    if (isNaN(stockValue) || stockValue < 0) {
      playWarningBeep();
      toast({
        title: "Invalid Stock",
        description: "Please enter a valid stock quantity.",
        variant: "destructive",
      });
      return;
    }

    const product = products.find((p) => {
      const productId = (p as any)._id || p.id;
      return productId?.toString() === id.toString();
    });

    if (product) {
      try {
        await updateProduct({ ...product, stock: stockValue } as any);
        await refreshProducts();
        setEditingId(null);
        setEditStock("");

        playUpdateBeep();
        toast({
          title: "Stock Updated",
          description: "Stock quantity has been updated successfully.",
        });
      } catch (error) {
        playWarningBeep();
        toast({
          title: "Update Failed",
          description: "Failed to update stock. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditStock("");
  };

  const handleDeleteClick = (item: LowStockItem) => {
    setProductToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    initAudio();
    const product = products.find((p) => {
      const productId = (p as any)._id || p.id;
      return productId?.toString() === productToDelete.id.toString();
    });

    if (product) {
      try {
        await removeProduct(product);
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
    }
  };

  return (
    <div className="kpi-card border border-transparent lg:bg-white/80 lg:backdrop-blur-md bg-white/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 !border-0 outline-none flex items-center justify-center" style={{ border: 'none', background: 'transparent' }}>
          <AlertTriangle size={20} className="text-red-600" style={{ border: 'none', outline: 'none' }} />
        </div>
        <h3 className="text-lg font-bold text-red-600">Low Stock Alert</h3>
      </div>
      <div className="space-y-3">
        {lowStockItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No low stock items
          </p>
        ) : (
          lowStockItems.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center justify-between py-2 border-b border-transparent last:border-0 gap-2 hover:bg-gray-100 transition-colors rounded-md px-2",
              item.isOutOfStock && "bg-red-50 border-red-200"
            )}
          >
            <span
              className={cn(
                "font-medium text-sm flex-1 min-w-0 truncate",
                item.isOutOfStock
                  ? "text-red-700 font-semibold"
                  : item.isExpiringSoon
                  ? "text-orange-700 font-semibold"
                  : "text-gray-800"
              )}
            >
              {item.name}
              {item.isOutOfStock && (
                <span className="ml-2 text-xs text-red-600 font-normal">
                  (Out of Stock)
                </span>
              )}
              {!item.isOutOfStock && item.isExpiringSoon && (
                <span className="ml-2 text-xs text-orange-600 font-normal">
                  (Expiring Soon)
                </span>
              )}
            </span>
            {editingId === item.id ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                  className="w-20 h-8 text-sm border-2 border-transparent focus:border-transparent focus:ring-2 focus:ring-blue-300"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-green-100 rounded-full"
                  onClick={() => handleSave(item.id)}
                >
                  <Check size={14} className="text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-red-100 rounded-full"
                  onClick={handleCancel}
                >
                  <X size={14} className="text-red-600" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-bold whitespace-nowrap px-2 py-1 rounded",
                    item.isOutOfStock
                      ? "text-red-700 bg-red-100 border border-red-300"
                      : item.isExpiringSoon
                      ? "text-orange-700 bg-orange-100 border border-orange-300"
                      : "text-gray-700 bg-gray-100"
                  )}
                >
                  {item.isOutOfStock
                    ? "Out of Stock"
                    : item.isExpiringSoon
                    ? "Expiring Soon"
                    : `${item.stock} left`}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-gray-100 rounded-full"
                  onClick={() => handleEdit(item)}
                  title="Edit stock"
                >
                  <Edit2 size={14} className="text-gray-700" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-red-100 rounded-full"
                  onClick={() => handleDeleteClick(item)}
                  title="Delete product"
                >
                  <Trash2 size={14} className="text-red-600" />
                </Button>
              </div>
            )}
          </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{productToDelete?.name}</strong>? 
              This action cannot be undone and will permanently remove this product from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setProductToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
