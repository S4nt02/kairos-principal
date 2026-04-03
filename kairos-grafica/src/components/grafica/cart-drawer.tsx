import { Link } from "wouter";
import { X, ShoppingCart, Trash2, Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/grafica/price-engine";
import { cn } from "@/lib/utils";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { cart, isLoading, updateItem, removeItem } = useCart();
  const items = cart?.items ?? [];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <h2 className="font-display font-bold text-lg">Carrinho</h2>
                {items.length > 0 && (
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {cart?.itemCount ?? 0}
                  </span>
                )}
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <ShoppingCart className="w-12 h-12 text-muted-foreground/30" />
                  <div>
                    <p className="font-medium text-muted-foreground">Carrinho vazio</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Adicione produtos para começar
                    </p>
                  </div>
                  <Link href="/grafica">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
                    >
                      Ver produtos
                    </button>
                  </Link>
                </div>
              ) : (
                items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    className="p-3 rounded-lg border border-border/50 bg-card"
                  >
                    <div className="flex gap-3">
                      <div className="w-14 h-14 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                        <span className="text-xl font-display font-bold uppercase text-foreground/15">
                          {item.product?.name?.charAt(0) ?? "P"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.product?.name ?? "Produto"}
                        </p>
                        {item.specifications && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {Object.values(item.specifications).join(" · ")}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (item.quantity > 1) {
                                  const steps = item.product?.quantitySteps as number[] | null;
                                  if (steps && steps.length > 0) {
                                    const idx = steps.indexOf(item.quantity);
                                    if (idx > 0) updateItem.mutate({ id: item.id, quantity: steps[idx - 1] });
                                  } else {
                                    updateItem.mutate({ id: item.id, quantity: item.quantity - 1 });
                                  }
                                }
                              }}
                              className="p-1 rounded hover:bg-muted transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-mono w-12 text-center">
                              {item.quantity.toLocaleString("pt-BR")}
                            </span>
                            <button
                              onClick={() => {
                                const steps = item.product?.quantitySteps as number[] | null;
                                if (steps && steps.length > 0) {
                                  const idx = steps.indexOf(item.quantity);
                                  if (idx < steps.length - 1) updateItem.mutate({ id: item.id, quantity: steps[idx + 1] });
                                } else {
                                  updateItem.mutate({ id: item.id, quantity: item.quantity + 1 });
                                }
                              }}
                              className="p-1 rounded hover:bg-muted transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-primary font-mono">
                              {formatCurrency(parseFloat(item.unitPrice) * item.quantity)}
                            </span>
                            <button
                              onClick={() => removeItem.mutate(item.id)}
                              className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-4 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold">Subtotal</span>
                  <span className="text-xl font-bold text-primary font-mono">
                    {formatCurrency(cart?.subtotal ?? 0)}
                  </span>
                </div>
                <Link href="/grafica/carrinho">
                  <button
                    onClick={onClose}
                    className={cn(
                      "w-full py-3 rounded-full font-medium text-sm transition-colors",
                      "bg-foreground text-background hover:bg-primary",
                    )}
                  >
                    Finalizar Pedido
                  </button>
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
