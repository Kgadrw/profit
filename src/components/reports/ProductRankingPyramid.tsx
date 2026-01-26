import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductRanking {
  productId: string;
  productName: string;
  totalQuantity: number;
  stock: number;
}

interface ProductRankingPyramidProps {
  rankings: ProductRanking[];
}

export function ProductRankingPyramid({ rankings }: ProductRankingPyramidProps) {
  if (rankings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <p>No product sales data available</p>
        </div>
      </div>
    );
  }

  // Calculate max quantity for percentage calculations
  const maxQuantity = Math.max(...rankings.map(r => r.totalQuantity), 1);

  // Get color for each product based on performance (trading-style colors)
  const getProductColor = (index: number, percentage: number) => {
    // Top performers: Green shades (best)
    if (percentage >= 80) {
      return "#10B981"; // Emerald green - excellent
    }
    // Good performers: Light green to yellow-green
    if (percentage >= 60) {
      return "#22C55E"; // Green - good
    }
    // Medium performers: Yellow to orange
    if (percentage >= 40) {
      return "#F59E0B"; // Amber - moderate
    }
    // Lower performers: Orange to red
    if (percentage >= 20) {
      return "#F97316"; // Orange - below average
    }
    // Poor performers: Red
    return "#EF4444"; // Red - poor performance
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-50">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Rank</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Product</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Best Performance (higher is better)</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Stock</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((product, index) => {
            const percentage = (product.totalQuantity / maxQuantity) * 100;
            const color = getProductColor(index, percentage);

            return (
              <tr
                key={product.productId}
                className={cn(
                  "border-b border-gray-200 hover:bg-gray-50 transition-colors",
                  index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                )}
              >
                {/* Rank */}
                <td className="py-3 px-3 text-sm font-semibold text-gray-700">
                  {index + 1}
                </td>

                {/* Product Name with Color Square */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-300"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-gray-900 font-medium">
                      {product.productName}
                    </span>
                  </div>
                </td>

                {/* Best Performance with Bar Chart */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-3 min-w-[300px]">
                    {/* Numerical Value */}
                    <span className="text-sm font-semibold text-gray-900 min-w-[80px]">
                      {product.totalQuantity.toLocaleString()}
                    </span>

                    {/* Horizontal Bar Chart */}
                    <div className="flex-1 relative h-7 bg-gray-200 rounded overflow-hidden border border-gray-300">
                      <div
                        className="h-full rounded transition-all shadow-sm"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>

                    {/* Percentage */}
                    <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-right">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </td>

                {/* Stock */}
                <td className="py-3 px-3">
                  <span className="text-sm text-gray-700">
                    {product.stock}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
