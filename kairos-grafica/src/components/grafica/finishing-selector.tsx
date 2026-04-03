import { cn } from "@/lib/utils";
import type { Finishing } from "@shared/schema";
import { formatCurrency } from "@/lib/grafica/price-engine";

interface FinishingSelectorProps {
  finishings: Finishing[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function FinishingSelector({ finishings, selected, onChange }: FinishingSelectorProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Acabamento <span className="text-muted-foreground font-normal">(opcional)</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {finishings.map((fin) => {
          const isSelected = selected.includes(fin.id);
          const price = parseFloat(fin.priceModifier);
          return (
            <button
              key={fin.id}
              onClick={() => toggle(fin.id)}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/50",
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground/30",
                )}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-primary" : "text-foreground",
                )}>
                  {fin.name}
                </span>
              </div>
              {price > 0 && (
                <span className="text-xs font-mono text-muted-foreground">
                  +{formatCurrency(price)}/un.
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
