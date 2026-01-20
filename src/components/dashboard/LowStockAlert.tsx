import { useState, useMemo } from "react";
import { AlertTriangle, Edit2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { playUpdateBeep, playWarningBeep, initAudio } from "@/lib/sound";
import { useApi } from "@/hooks/useApi";

interface Product {
  id?: number;
  _id?: string;
  name: string;
  stock: number;
  minStock?: number;
}

interface LowStockItem {
  id: string | number;
  name: string;
  stock: number;
  minStock?: number;
  isOutOfStock?: boolean;
}

export function LowStockAlert() {
  const { toast } = useToast();
  const {
    items: products,
    update: updateProduct,
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
        // Show products with stock <= minStock OR stock = 0 (out of stock)
        return product.stock <= minStock || product.stock === 0;
      })
      .map((product) => ({
        id: product._id || product.id || '',
        name: product.name,
        stock: product.stock,
        minStock: product.minStock,
        isOutOfStock: product.stock === 0,
      }))
      .sort((a, b) => {
        // Sort: out of stock products first, then by stock level (lowest first)
        if (a.isOutOfStock && !b.isOutOfStock) return -1;
        if (!a.isOutOfStock && b.isOutOfStock) return 1;
        return a.stock - b.stock;
      })
      .slice(0, 10); // Show top 10 low stock items (including out of stock)
  }, [products]);

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editStock, setEditStock] = useState<string>("");

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

  return (
    <div className="kpi-card border border-transparent bg-white">
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
            <span className={cn(
              "font-medium text-sm flex-1 min-w-0 truncate",
              item.isOutOfStock ? "text-red-700 font-semibold" : "text-gray-800"
            )}>
              {item.name}
              {item.isOutOfStock && (
                <span className="ml-2 text-xs text-red-600 font-normal">(Out of Stock)</span>
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
                <span className={cn(
                  "text-sm font-bold whitespace-nowrap px-2 py-1 rounded",
                  item.isOutOfStock 
                    ? "text-red-700 bg-red-100 border border-red-300" 
                    : "text-gray-700 bg-gray-100"
                )}>
                  {item.isOutOfStock ? "Out of Stock" : `${item.stock} left`}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-gray-100 rounded-full"
                  onClick={() => handleEdit(item)}
                >
                  <Edit2 size={14} className="text-gray-700" />
                </Button>
              </div>
            )}
          </div>
          ))
        )}
      </div>
    </div>
  );
}
