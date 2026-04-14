import { cn } from "@/lib/utils";

type ColorOption = "4x0" | "4x1" | "4x4";

interface ColorSelectorProps {
  value: ColorOption;
  onChange: (value: ColorOption) => void;
}

const options: { value: ColorOption; label: string; description: string }[] = [
  { value: "4x0", label: "4x0", description: "Colorido frente, sem verso" },
  { value: "4x1", label: "4x1", description: "Colorido frente, P&B verso" },
  { value: "4x4", label: "4x4", description: "Colorido frente e verso" },
];

export function ColorSelector({ value, onChange }: ColorSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">Cores</label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-3 rounded-lg border text-center transition-all duration-200",
              value === opt.value
                ? "border-primary bg-primary/10"
                : "border-border bg-background hover:border-primary/50",
            )}
          >
            <p className={cn(
              "text-lg font-bold font-mono",
              value === opt.value ? "text-primary" : "text-foreground",
            )}>
              {opt.label}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
