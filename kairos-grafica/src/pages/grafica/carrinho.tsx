import { Link } from "wouter";
import { motion } from "framer-motion";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ArrowLeft } from "lucide-react";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { Footer } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/grafica/price-engine";

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export default function GraficaCarrinho() {
  const { cart, isLoading, updateItem, removeItem, clearCart } = useCart();
  const items = cart?.items ?? [];

  return (
    <div className="min-h-screen bg-background font-sans">
      <GraficaNavbar breadcrumbs={[{ label: "Carrinho" }]} />

      <div className="container mx-auto px-6 pt-8 pb-24">
        <Link href="/grafica">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Continuar comprando
          </div>
        </Link>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <h1 className="text-3xl font-display font-bold tracking-tight mb-8">
            Carrinho
          </h1>
        </motion.div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            className="text-center py-20"
          >
            <ShoppingCart className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-xl font-display font-bold text-muted-foreground">
              Seu carrinho está vazio
            </p>
            <p className="text-muted-foreground mt-2">
              Explore nossos produtos e monte seu pedido
            </p>
            <Link href="/grafica">
              <button className="mt-6 px-6 py-3 bg-foreground text-background rounded-full text-sm font-medium hover:bg-primary transition-colors">
                Ver catálogo
              </button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Items list */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
                  className="p-4 rounded-xl border border-border/50 bg-card"
                >
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                      <span className="text-3xl font-display font-bold uppercase text-foreground/10">
                        {item.product?.name?.charAt(0) ?? "P"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display font-bold">{item.product?.name ?? "Produto"}</h3>
                          {item.specifications && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {Object.entries(item.specifications)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem.mutate(item.id)}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const steps = item.product?.quantitySteps as number[] | null;
                              if (steps && steps.length > 0) {
                                const idx = steps.indexOf(item.quantity);
                                if (idx > 0) updateItem.mutate({ id: item.id, quantity: steps[idx - 1] });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-border hover:border-primary/50 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm font-mono w-16 text-center">
                            {item.quantity.toLocaleString("pt-BR")} un.
                          </span>
                          <button
                            onClick={() => {
                              const steps = item.product?.quantitySteps as number[] | null;
                              if (steps && steps.length > 0) {
                                const idx = steps.indexOf(item.quantity);
                                if (idx < steps.length - 1) updateItem.mutate({ id: item.id, quantity: steps[idx + 1] });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-border hover:border-primary/50 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(parseFloat(item.unitPrice))} / un.
                          </p>
                          <p className="text-lg font-bold text-primary font-mono">
                            {formatCurrency(parseFloat(item.unitPrice) * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              <button
                onClick={() => clearCart.mutate()}
                className="text-sm text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1.5 mt-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar carrinho
              </button>
            </div>

            {/* Summary */}
            <div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
                className="lg:sticky lg:top-24 space-y-4"
              >
                <div className="rounded-xl border border-border/50 p-5 space-y-4">
                  <h2 className="font-display font-bold text-lg">Resumo do Pedido</h2>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Itens ({cart?.itemCount ?? 0})
                      </span>
                      <span className="font-mono">{formatCurrency(cart?.subtotal ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frete</span>
                      <span className="text-muted-foreground text-xs">calculado no checkout</span>
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <div className="flex justify-between">
                    <span className="font-display font-bold">Subtotal</span>
                    <span className="text-xl font-bold text-primary font-mono">
                      {formatCurrency(cart?.subtotal ?? 0)}
                    </span>
                  </div>
                </div>

                <Link href="/grafica/checkout">
                  <button className="w-full py-3.5 rounded-full bg-foreground text-background font-medium text-sm hover:bg-primary transition-colors flex items-center justify-center gap-2">
                    Ir para o Checkout
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
