import { AlertTriangle } from "lucide-react";

const lowStockItems = [
  { name: "iPhone 15 Pro Max", stock: 3 },
  { name: "Samsung Galaxy S24", stock: 5 },
  { name: "MacBook Pro 16\"", stock: 2 },
  { name: "AirPods Pro 2", stock: 8 },
];

export function LowStockAlert() {
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={18} className="text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Low Stock Alert</h3>
      </div>
      <div className="space-y-3">
        {lowStockItems.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
          >
            <span className="font-medium text-foreground">{item.name}</span>
            <span className="text-sm text-muted-foreground">
              {item.stock} left
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
