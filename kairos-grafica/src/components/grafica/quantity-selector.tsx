import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantitySelectorProps {
  steps: number[];
  value: number;
  onChange: (qty: number) => void;
  min?: number;
}

export function QuantitySelector({ steps, value, onChange, min = 1 }: QuantitySelectorProps) {
  const hasSteps = steps.length > 0;

  if (hasSteps) {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Quantidade</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {steps.map((qty) => (
            <button
              key={qty}
              onClick={() => onChange(qty)}
              className={cn(
                "px-3 py-2.5 text-sm font-mono rounded-lg border transition-all duration-200",
                value === qty
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {qty.toLocaleString("pt-BR")}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Free counter mode
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">Quantidade</label>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className={cn(
            "w-10 h-10 rounded-lg border flex items-center justify-center transition-all duration-200",
            value <= min
              ? "border-border text-muted-foreground/30 cursor-not-allowed"
              : "border-border hover:border-primary/50 text-foreground hover:bg-muted",
          )}
        >
          <Minus className="w-4 h-4" />
        </button>

        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v) && v >= min) onChange(v);
          }}
          className="w-20 text-center font-mono text-lg font-bold bg-background border border-border rounded-lg py-2 focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        <button
          onClick={() => onChange(value + 1)}
          className="w-10 h-10 rounded-lg border border-border hover:border-primary/50 flex items-center justify-center transition-all duration-200 hover:bg-muted"
        >
          <Plus className="w-4 h-4" />
        </button>

        {min > 1 && (
          <span className="text-xs text-muted-foreground">mín. {min.toLocaleString("pt-BR")}</span>
        )}
      </div>
    </div>
  );
}
