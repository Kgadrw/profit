import { useState } from "react";
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
import { ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Sale {
  id: number;
  product: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  date: string;
}

const products = [
  { id: 1, name: "iPhone 15 Pro Max", price: 1199, cost: 999 },
  { id: 2, name: "Samsung Galaxy S24", price: 899, cost: 799 },
  { id: 3, name: "MacBook Pro 16\"", price: 2499, cost: 2199 },
  { id: 4, name: "AirPods Pro 2", price: 249, cost: 199 },
  { id: 5, name: "Apple Watch Ultra", price: 799, cost: 699 },
];

const initialSales: Sale[] = [
  { id: 1, product: "iPhone 15 Pro Max", quantity: 2, revenue: 2398, cost: 1998, profit: 400, date: "2025-01-10" },
  { id: 2, product: "AirPods Pro 2", quantity: 5, revenue: 1245, cost: 995, profit: 250, date: "2025-01-10" },
  { id: 3, product: "Samsung Galaxy S24", quantity: 1, revenue: 899, cost: 799, profit: 100, date: "2025-01-09" },
  { id: 4, product: "MacBook Pro 16\"", quantity: 1, revenue: 2499, cost: 2199, profit: 300, date: "2025-01-09" },
  { id: 5, product: "Apple Watch Ultra", quantity: 3, revenue: 2397, cost: 2097, profit: 300, date: "2025-01-08" },
];

const Sales = () => {
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);

  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId);
    const product = products.find((p) => p.id.toString() === productId);
    if (product) {
      setSellingPrice(product.price.toString());
    }
  };

  const handleRecordSale = () => {
    if (!selectedProduct || !quantity || !sellingPrice || !paymentMethod) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const product = products.find((p) => p.id.toString() === selectedProduct);
    if (!product) return;

    const qty = parseInt(quantity);
    const price = parseFloat(sellingPrice);
    const revenue = qty * price;
    const cost = qty * product.cost;
    const profit = revenue - cost;

    const newSale: Sale = {
      id: Date.now(),
      product: product.name,
      quantity: qty,
      revenue,
      cost,
      profit,
      date: saleDate,
    };

    setSales([newSale, ...sales]);

    // Reset form
    setSelectedProduct("");
    setQuantity("1");
    setSellingPrice("");
    setPaymentMethod("");
    setSaleDate(new Date().toISOString().split("T")[0]);

    toast({
      title: "Sale Recorded",
      description: `Successfully recorded sale of ${qty}x ${product.name}`,
    });
  };

  return (
    <AppLayout title="Sales">
      {/* Record Sale Form */}
      <div className="form-card mb-6">
        <h3 className="section-title flex items-center gap-2">
          <ShoppingCart size={20} />
          Record New Sale
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Select Product</Label>
            <Select value={selectedProduct} onValueChange={handleProductChange}>
              <SelectTrigger className="input-field">
                <SelectValue placeholder="Choose a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id.toString()}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label>Selling Price ($)</Label>
            <Input
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="input-field">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sale Date</Label>
            <Input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleRecordSale} className="btn-primary w-full">
              Record Sale
            </Button>
          </div>
        </div>
      </div>

      {/* Sales History Table */}
      <div className="kpi-card overflow-x-auto">
        <h3 className="section-title">Sales History</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Revenue</th>
              <th>Cost</th>
              <th>Profit</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td className="font-medium">{sale.product}</td>
                <td>{sale.quantity}</td>
                <td>${sale.revenue.toLocaleString()}</td>
                <td className="text-muted-foreground">${sale.cost.toLocaleString()}</td>
                <td className="font-semibold">${sale.profit.toLocaleString()}</td>
                <td className="text-muted-foreground">{sale.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
};

export default Sales;
