import type { ProductDiscount } from "@shared/schema";
import { formatCurrency } from "@/lib/grafica/price-engine";
import { Tag } from "lucide-react";

interface DiscountBadgeProps {
  discount: ProductDiscount;
}

export function DiscountBadge({ discount }: DiscountBadgeProps) {
  const label =
    discount.discountType === "percentage"
      ? `${parseFloat(discount.discountValue).toFixed(0)}% OFF`
      : `${formatCurrency(parseFloat(discount.discountValue))} OFF`;

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
      <Tag className="w-3 h-3" />
      <span>{discount.name} — {label}</span>
    </div>
  );
}
