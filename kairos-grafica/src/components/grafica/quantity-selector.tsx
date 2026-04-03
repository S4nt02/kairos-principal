import { cn } from "@/lib/utils";

interface QuantitySelectorProps {
  steps: number[];
  value: number;
  onChange: (qty: number) => void;
}

export function QuantitySelector({ steps, value, onChange }: QuantitySelectorProps) {
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
