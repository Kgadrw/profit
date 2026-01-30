import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { playUpdateBeep, playErrorBeep, initAudio } from "@/lib/sound";

interface Product {
  id?: number;
  _id?: string;
  name: string;
  stock: number;
  minStock?: number;
}

interface StockUpdateDialogProps {
  productId: string | number | null;
  productName?: string;
  currentStock?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockUpdateDialog({
  productId,
  productName,
  currentStock,
  open,
  onOpenChange,
}: StockUpdateDialogProps) {
  const { toast } = useToast();
  const {
    items: products,
    update: updateProduct,
    refresh: refreshProducts,
  } = useApi<Product>({
    endpoint: "products",
    defaultValue: [],
  });

  const [stockValue, setStockValue] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Find the product when productId changes
  const product = productId
    ? products.find((p) => {
        const id = (p as any)._id || p.id;
        return id?.toString() === productId.toString();
      })
    : null;

  // Update stock value when product or currentStock changes
  useEffect(() => {
    if (product) {
      setStockValue(product.stock.toString());
    } else if (currentStock !== undefined) {
      setStockValue(currentStock.toString());
    }
  }, [product, currentStock]);

  const handleUpdate = async () => {
    if (!productId || !product) {
      return;
    }

    initAudio();
    setIsUpdating(true);

    const stockNum = parseInt(stockValue);
    if (isNaN(stockNum) || stockNum < 0) {
      playErrorBeep();
      toast({
        title: "Invalid Stock",
        description: "Please enter a valid stock quantity.",
        variant: "destructive",
      });
      setIsUpdating(false);
      return;
    }

    try {
      await updateProduct({ ...product, stock: stockNum } as any);
      await refreshProducts();
      
      // ✅ Trigger notification check immediately after stock update
      // This ensures stale notifications are closed if stock is now resolved
      if ('serviceWorker' in navigator) {
        try {
          const { backgroundSyncManager } = await import('@/lib/backgroundSync');
          await backgroundSyncManager.requestNotificationCheck();
        } catch (error) {
          // Silently fail - notification check is not critical
        }
      }
      
      playUpdateBeep();
      toast({
        title: "Stock Updated",
        description: `Stock for ${product.name} has been updated to ${stockNum}.`,
      });
      onOpenChange(false);
    } catch (error) {
      playErrorBeep();
      toast({
        title: "Update Failed",
        description: "Failed to update stock. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const displayName = product?.name || productName || "Product";
  const displayStock = product?.stock ?? currentStock ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Stock</DialogTitle>
          <DialogDescription>
            Update stock quantity for {displayName}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="stock">Stock Quantity</Label>
            <Input
              id="stock"
              type="number"
              min="0"
              value={stockValue}
              onChange={(e) => setStockValue(e.target.value)}
              placeholder="Enter stock quantity"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleUpdate();
                }
              }}
            />
            {product?.minStock !== undefined && (
              <p className="text-xs text-muted-foreground">
                Minimum stock: {product.minStock}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
