import { cn } from "@/lib/utils";
import type { AddonCategoryWithItems } from "@shared/types";
import { formatCurrency } from "@/lib/grafica/price-engine";

interface AddonSelectorProps {
  categories: AddonCategoryWithItems[];
  value: string[];
  onChange: (ids: string[]) => void;
}

export function AddonSelector({ categories, value, onChange }: AddonSelectorProps) {
  if (categories.length === 0) return null;

  const toggle = (itemId: string, maxAllowed: number, categoryItemIds: string[]) => {
    if (value.includes(itemId)) {
      onChange(value.filter((id) => id !== itemId));
    } else {
      const alreadySelected = value.filter((id) => categoryItemIds.includes(id));
      if (alreadySelected.length >= maxAllowed) {
        const remaining = value.filter((id) => !categoryItemIds.includes(id));
        onChange([...remaining, ...alreadySelected.slice(1), itemId]);
      } else {
        onChange([...value, itemId]);
      }
    }
  };

  return (
    <div className="space-y-5">
      {categories.map((cat) => {
        const categoryItemIds = cat.items.map((i) => i.id);
        const selectedInCat = value.filter((id) => categoryItemIds.includes(id));

        return (
          <div key={cat.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                {cat.name}
                {cat.maxAllowed > 1 && (
                  <span className="text-muted-foreground font-normal ml-1">
                    (até {cat.maxAllowed})
                  </span>
                )}
              </label>
              {selectedInCat.length > 0 && (
                <span className="text-xs font-mono text-primary">
                  {selectedInCat.length}/{cat.maxAllowed} selecionado{selectedInCat.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cat.items.map((item) => {
                const isSelected = value.includes(item.id);
                const price = parseFloat(item.priceModifier);
                const outOfStock = item.stockQuantity === 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => !outOfStock && toggle(item.id, cat.maxAllowed, categoryItemIds)}
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
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                        isSelected && !outOfStock ? "border-primary bg-primary" : "border-muted-foreground/30",
                      )}>
                        {isSelected && !outOfStock && (
                          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-8 h-8 rounded object-cover border border-border/50 flex-shrink-0"
                        />
                      )}
                      <div>
                        <span className={cn(
                          "text-sm font-medium block",
                          outOfStock ? "text-muted-foreground" : isSelected ? "text-primary" : "text-foreground",
                        )}>
                          {item.name}
                        </span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        )}
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
      })}
    </div>
  );
}
