import { cn } from "@/lib/utils";
import type { WireoOption } from "@shared/schema";
import { formatCurrency } from "@/lib/grafica/price-engine";

interface WireoSelectorProps {
  options: WireoOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}

export function WireoSelector({ options, value, onChange }: WireoSelectorProps) {
  if (options.length === 0) return null;

  const toggle = (id: string) => {
    onChange(value === id ? null : id);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Wire-o <span className="text-muted-foreground font-normal">(opcional)</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((opt) => {
          const isSelected = value === opt.id;
          const price = parseFloat(opt.priceModifier);
          const outOfStock = opt.stockQuantity === 0;
          return (
            <button
              key={opt.id}
              onClick={() => !outOfStock && toggle(opt.id)}
              disabled={outOfStock}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all duration-200",
                outOfStock
                  ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                  : isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/50",
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                  isSelected && !outOfStock ? "border-primary bg-primary" : "border-muted-foreground/30",
                )}>
                  {isSelected && !outOfStock && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                </div>
                <div className="flex items-center gap-2">
                  {opt.colorHex && (
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-border/50 inline-block flex-shrink-0"
                      style={{ backgroundColor: opt.colorHex }}
                    />
                  )}
                  <div>
                    <span className={cn(
                      "text-sm font-medium block",
                      outOfStock ? "text-muted-foreground" : isSelected ? "text-primary" : "text-foreground",
                    )}>
                      {opt.name}
                    </span>
                    {opt.sizeMm && (
                      <span className="text-xs text-muted-foreground font-mono">{opt.sizeMm}mm</span>
                    )}
                  </div>
                </div>
              </div>
              {outOfStock ? (
                <span className="text-xs font-mono text-destructive/70 whitespace-nowrap ml-2">Esgotado</span>
              ) : price > 0 ? (
                <span className="text-xs font-mono text-muted-foreground whitespace-nowrap ml-2">
                  +{formatCurrency(price)}/un.
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
