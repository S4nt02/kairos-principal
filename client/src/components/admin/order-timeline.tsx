import { cn } from "@/lib/utils";
import { Check, Clock, Package, Truck, CheckCircle, XCircle } from "lucide-react";

const statusSteps = [
  { key: "pending", label: "Pendente", icon: Clock },
  { key: "confirmed", label: "Confirmado", icon: Check },
  { key: "production", label: "Produção", icon: Package },
  { key: "shipped", label: "Enviado", icon: Truck },
  { key: "delivered", label: "Entregue", icon: CheckCircle },
];

interface OrderTimelineProps {
  currentStatus: string;
}

export default function OrderTimeline({ currentStatus }: OrderTimelineProps) {
  if (currentStatus === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <XCircle className="h-5 w-5" />
        <span className="font-medium">Pedido Cancelado</span>
      </div>
    );
  }

  const currentIndex = statusSteps.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center gap-2">
      {statusSteps.map((step, i) => {
        const isCompleted = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                isCompleted
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground/30 text-muted-foreground/50"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span
              className={cn(
                "text-xs font-medium hidden sm:inline",
                isCurrent ? "text-foreground" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/50"
              )}
            >
              {step.label}
            </span>
            {i < statusSteps.length - 1 && (
              <div className={cn("w-8 h-0.5", isCompleted ? "bg-primary" : "bg-muted-foreground/20")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
