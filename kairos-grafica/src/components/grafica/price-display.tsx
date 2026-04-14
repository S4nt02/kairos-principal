import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/grafica/price-engine";

interface PriceDisplayProps {
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  setupFee: number;
  isCalculating?: boolean;
}

export function PriceDisplay({ unitPrice, totalPrice, quantity, setupFee, isCalculating }: PriceDisplayProps) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Preço unitário</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={unitPrice}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="font-mono font-medium"
          >
            {isCalculating ? "..." : formatCurrency(unitPrice)}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Quantidade</span>
        <span className="font-mono">{quantity.toLocaleString("pt-BR")} un.</span>
      </div>

      {setupFee > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Taxa de setup</span>
          <span className="font-mono">{formatCurrency(setupFee)}</span>
        </div>
      )}

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between">
        <span className="font-display font-bold">Total</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={totalPrice}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="text-2xl font-bold text-primary font-mono"
          >
            {isCalculating ? "..." : formatCurrency(totalPrice)}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
