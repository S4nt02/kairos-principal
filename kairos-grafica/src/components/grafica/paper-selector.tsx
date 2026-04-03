import { cn } from "@/lib/utils";
import type { PaperType } from "@shared/schema";

interface PaperSelectorProps {
  papers: PaperType[];
  value: string | null;
  onChange: (id: string) => void;
}

export function PaperSelector({ papers, value, onChange }: PaperSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">Tipo de Papel</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {papers.map((paper) => (
          <button
            key={paper.id}
            onClick={() => onChange(paper.id)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all duration-200",
              value === paper.id
                ? "border-primary bg-primary/10"
                : "border-border bg-background hover:border-primary/50",
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
              value === paper.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}>
              {paper.weightGsm}g
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium truncate",
                value === paper.id ? "text-primary" : "text-foreground",
              )}>
                {paper.name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{paper.finish}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
