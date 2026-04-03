import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Package, Clock, CheckCircle, Truck, MapPin, ArrowLeft,
  Loader2, AlertCircle, RefreshCw, Upload, ShoppingCart, XCircle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { Footer } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/grafica/price-engine";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { OrderWithItems } from "@shared/types";
import { cn } from "@/lib/utils";
import { trackPurchase } from "@/hooks/use-analytics";

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

interface TrackingEvent {
  status: string;
  date: string;
  location: string;
  description: string;
}

function TrackingTimeline({ orderId }: { orderId: string }) {
  const { data, isLoading } = useQuery<{ trackingCode: string; events: TrackingEvent[] }>({
    queryKey: ["/api/grafica/orders", orderId, "tracking"],
    queryFn: async () => {
      const res = await fetch(`/api/grafica/orders/${orderId}/tracking`);
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="rounded-xl border border-border/50 p-5"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Buscando rastreamento...
        </div>
      </motion.div>
    );
  }

  if (!data?.events?.length) return null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
      className="rounded-xl border border-border/50 p-5"
    >
      <h2 className="font-display font-bold mb-4 flex items-center gap-2">
        <Truck className="w-5 h-5 text-primary" />
        Rastreamento
      </h2>
      <div className="relative ml-3">
        {data.events.map((event, i) => (
          <div key={i} className="relative pl-6 pb-5 last:pb-0">
            {/* Vertical line */}
            {i < data.events.length - 1 && (
              <div className="absolute left-[5px] top-3 bottom-0 w-px bg-border" />
            )}
            {/* Dot */}
            <div className={cn(
              "absolute left-0 top-1 w-[11px] h-[11px] rounded-full border-2",
              i === 0
                ? "bg-primary border-primary"
                : "bg-background border-muted-foreground/40",
            )} />
            <p className="text-sm font-medium">{event.description || event.status}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {event.date && (
                <span className="text-xs text-muted-foreground">
                  {new Date(event.date).toLocaleDateString("pt-BR", {
                    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              )}
              {event.location && (
                <span className="text-xs text-muted-foreground">
                  — {event.location}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

interface GraficaPedidoProps {
  id: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Aguardando pagamento", color: "text-yellow-500", icon: Clock },
  confirmed: { label: "Pagamento confirmado", color: "text-blue-500", icon: CheckCircle },
  production: { label: "Em produção", color: "text-purple-500", icon: Package },
  shipped: { label: "Enviado", color: "text-indigo-500", icon: Truck },
  delivered: { label: "Entregue", color: "text-green-500", icon: CheckCircle },
  cancelled: { label: "Cancelado", color: "text-red-500", icon: Clock },
};

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "text-yellow-500" },
  approved: { label: "Aprovado", color: "text-green-500" },
  rejected: { label: "Recusado", color: "text-red-500" },
  refunded: { label: "Reembolsado", color: "text-orange-500" },
};

/**
 * Parse MercadoPago back_url query params.
 * MP redirects with ?mp_status=approved|rejected|pending
 * and also adds collection_id, collection_status, payment_id, etc.
 */
function getMpParamsFromUrl(): { mpStatus: string | null; paymentId: string | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    mpStatus: params.get("mp_status") || params.get("collection_status") || null,
    paymentId: params.get("payment_id") || params.get("collection_id") || null,
  };
}

export default function GraficaPedido({ id }: GraficaPedidoProps) {
  const [mpStatus, setMpStatus] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch order with auto-refetch when payment is pending (webhook may update it)
  const { data: order, isLoading, error, refetch } = useQuery<OrderWithItems>({
    queryKey: ["/api/grafica/orders", id],
    refetchInterval: (query) => {
      const data = query.state.data;
      // Auto-poll every 5s while payment is pending (waiting for webhook)
      if (data && data.paymentStatus === "pending") return 5000;
      return false;
    },
  });

  // On mount: parse MP redirect params and actively verify payment with backend
  useEffect(() => {
    const { mpStatus: status, paymentId } = getMpParamsFromUrl();
    setMpStatus(status);

    if (paymentId && !verified) {
      setVerified(true);
      fetch(`/api/grafica/orders/${id}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.updated) refetch();
        })
        .catch(() => {});
    }
  }, [id, verified, refetch]);

  // Track purchase event when payment approved
  const purchaseTracked = useRef(false);
  useEffect(() => {
    if (order && order.paymentStatus === "approved" && !purchaseTracked.current) {
      purchaseTracked.current = true;
      trackPurchase(order.id, parseFloat(order.total), order.items.map((i) => ({
        id: i.productId,
        name: i.productName,
        price: parseFloat(i.unitPrice),
        quantity: i.quantity,
      })));
    }
  }, [order]);

  async function handleUpload(orderItemId: string) {
    const file = fileInputRefs.current[orderItemId]?.files?.[0];
    if (!file) return;

    setUploadingItem(orderItemId);
    try {
      const token = localStorage.getItem("kairos_auth_token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("orderItemId", orderItemId);

      const resp = await fetch("/api/grafica/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Erro", description: err.message || "Erro ao enviar arquivo" });
        return;
      }

      toast({ title: "Arte enviada", description: "Seu arquivo foi enviado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["/api/grafica/orders", id] });
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Erro ao enviar arquivo. Tente novamente." });
    } finally {
      setUploadingItem(null);
    }
  }

  // Cancel order
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("kairos_auth_token");
      const res = await fetch(`/api/grafica/orders/${id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao cancelar pedido");
      }
    },
    onSuccess: () => {
      toast({ title: "Pedido cancelado", description: "Seu pedido foi cancelado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["/api/grafica/orders", id] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });

  // Reorder — add all items to cart
  const [reordering, setReordering] = useState(false);

  async function handleReorder() {
    if (!order) return;
    setReordering(true);
    try {
      const sessionId = localStorage.getItem("kairos_cart_session") || crypto.randomUUID();
      localStorage.setItem("kairos_cart_session", sessionId);

      for (const item of order.items) {
        await fetch("/api/grafica/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            productId: item.productId,
            variantId: item.variantId || undefined,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            specifications: item.specifications || {},
          }),
        });
      }

      toast({ title: "Itens adicionados ao carrinho", description: "Você pode revisar antes de finalizar." });
      queryClient.invalidateQueries({ queryKey: ["/api/grafica/cart"] });
      navigate("/grafica/carrinho");
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Erro ao adicionar itens ao carrinho." });
    } finally {
      setReordering(false);
    }
  }

  const statusInfo = order ? STATUS_MAP[order.status] ?? STATUS_MAP.pending : STATUS_MAP.pending;
  const StatusIcon = statusInfo.icon;
  const paymentInfo = order ? PAYMENT_STATUS_MAP[order.paymentStatus] ?? PAYMENT_STATUS_MAP.pending : PAYMENT_STATUS_MAP.pending;

  // Show MP redirect banner based on URL params
  const showMpBanner = mpStatus && order?.paymentStatus === "pending";

  return (
    <div className="min-h-screen bg-background font-sans">
      <GraficaNavbar breadcrumbs={[{ label: `Pedido #${id.slice(0, 8)}` }]} />

      <div className="container mx-auto px-6 pt-8 pb-24">
        <Link href="/grafica">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao catálogo
          </div>
        </Link>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : error || !order ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Pedido não encontrado.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <h1 className="text-3xl font-display font-bold tracking-tight">
                Pedido <span className="font-mono text-primary">#{order.id.slice(0, 8)}</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Realizado em {new Date(order.createdAt).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </p>
            </motion.div>

            {/* MercadoPago redirect banner */}
            {showMpBanner && mpStatus === "approved" && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="rounded-xl border border-green-500/30 bg-green-500/5 p-5 flex items-start gap-3"
              >
                <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
                <div>
                  <p className="font-medium text-green-500">Pagamento realizado!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Seu pagamento foi processado pelo Mercado Pago. Aguardando confirmação final...
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Atualizando status automaticamente</span>
                  </div>
                </div>
              </motion.div>
            )}

            {showMpBanner && mpStatus === "pending" && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 flex items-start gap-3"
              >
                <Clock className="w-6 h-6 text-yellow-500 shrink-0" />
                <div>
                  <p className="font-medium text-yellow-500">Pagamento pendente</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Seu pagamento está sendo processado. Você receberá a confirmação em breve.
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Atualizando status automaticamente</span>
                  </div>
                </div>
              </motion.div>
            )}

            {showMpBanner && mpStatus === "rejected" && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 flex items-start gap-3"
              >
                <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                <div>
                  <p className="font-medium text-red-500">Pagamento não aprovado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O pagamento não foi aprovado. Você pode tentar novamente com outro método de pagamento.
                  </p>
                </div>
              </motion.div>
            )}

            {mpStatus === "error" && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5 flex items-start gap-3"
              >
                <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" />
                <div>
                  <p className="font-medium text-orange-500">Erro na criação do pagamento</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Houve um erro ao conectar com o Mercado Pago. Entre em contato conosco para finalizar o pagamento.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Status */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="rounded-xl border border-border/50 p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon className={cn("w-6 h-6", statusInfo.color)} />
                  <div>
                    <p className={cn("font-medium", statusInfo.color)}>{statusInfo.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Pagamento: <span className={paymentInfo.color}>{paymentInfo.label}</span>
                      {order.paymentMethod && ` (${order.paymentMethod})`}
                    </p>
                  </div>
                </div>
                {order.paymentStatus === "pending" && (
                  <button
                    onClick={() => refetch()}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    title="Atualizar status"
                  >
                    <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {order.shippingTrackingCode && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Rastreio:</span>
                  <span className="font-mono font-medium">{order.shippingTrackingCode}</span>
                </div>
              )}
            </motion.div>

            {/* Tracking Timeline */}
            {order.shippingTrackingCode && <TrackingTimeline orderId={order.id} />}

            {/* Items */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
              className="rounded-xl border border-border/50 p-5 space-y-4"
            >
              <h2 className="font-display font-bold">Itens do Pedido</h2>
              {order.items.map((item) => (
                <div key={item.id} className="py-3 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary/20">
                        {item.productName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity.toLocaleString("pt-BR")} un. x {formatCurrency(parseFloat(item.unitPrice))}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-sm">
                      {formatCurrency(parseFloat(item.subtotal))}
                    </span>
                  </div>
                  {item.artStatus === "pending" && order.paymentStatus === "approved" && (
                    <div className="mt-3 ml-15 flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.ai,.eps"
                        ref={(el) => { fileInputRefs.current[item.id] = el; }}
                        className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
                      />
                      <button
                        onClick={() => handleUpload(item.id)}
                        disabled={uploadingItem === item.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {uploadingItem === item.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</>
                        ) : (
                          <><Upload className="w-3 h-3" /> Enviar arte</>
                        )}
                      </button>
                    </div>
                  )}
                  {item.artStatus === "uploaded" && (
                    <p className="mt-2 ml-15 text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Arte enviada
                    </p>
                  )}
                </div>
              ))}
            </motion.div>

            {/* Totals */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
              className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2"
            >
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{formatCurrency(parseFloat(order.subtotal))}</span>
              </div>
              {order.discountAmount && parseFloat(order.discountAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-500">Desconto {order.couponCode ? `(${order.couponCode})` : ""}</span>
                  <span className="font-mono text-green-500">-{formatCurrency(parseFloat(order.discountAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frete</span>
                <span className="font-mono">{formatCurrency(parseFloat(order.shippingCost))}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between">
                <span className="font-display font-bold">Total</span>
                <span className="text-xl font-bold text-primary font-mono">
                  {formatCurrency(parseFloat(order.total))}
                </span>
              </div>
            </motion.div>

            {/* Actions: Cancel + Reorder */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
              className="flex flex-wrap gap-3"
            >
              {/* Reorder button (visible when not pending) */}
              {order.status !== "pending" && (
                <button
                  onClick={handleReorder}
                  disabled={reordering}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full border border-border hover:border-primary/50 transition-colors disabled:opacity-50"
                >
                  {reordering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  Comprar novamente
                </button>
              )}

              {/* Cancel button (visible when pending or confirmed) */}
              {["pending", "confirmed"].includes(order.status) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors">
                      <XCircle className="w-4 h-4" />
                      Cancelar pedido
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.
                        {order.paymentStatus === "approved" && " O reembolso será processado automaticamente."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelMutation.mutate()}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        {cancelMutation.isPending ? "Cancelando..." : "Confirmar cancelamento"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </motion.div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
