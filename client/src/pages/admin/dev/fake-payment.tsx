import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminApiRequest, getAdminQueryFn } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface OrderSummary {
  id: string;
  status: string;
  paymentStatus: string;
  total: string;
  createdAt: string;
  notes: string | null;
}

function statusColor(s: string) {
  if (s === "approved" || s === "confirmed") return "default";
  if (s === "pending") return "secondary";
  return "destructive";
}

export default function FakePayment() {
  const [loading, setLoading] = useState<string | null>(null);

  const { data: orders = [], refetch, isLoading } = useQuery<OrderSummary[]>({
    queryKey: ["/api/dev/orders"],
    queryFn: getAdminQueryFn(),
    refetchInterval: 5000,
  });

  async function simulate(orderId: string, action: "approve" | "reject" | "cancel") {
    setLoading(`${orderId}-${action}`);
    try {
      const res = await adminApiRequest("POST", "/api/dev/simulate-payment", { orderId, action });
      const data = await res.json();
      toast.success(data.message);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro na simulação");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            Simulador de Pagamento
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Simula aprovação/rejeição do MercadoPago para testar controle de estoque. Disponível apenas em desenvolvimento.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {orders.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum pedido encontrado. Finalize um pedido no carrinho para testar.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {orders.map((order) => {
          const isPending = order.paymentStatus === "pending";
          return (
            <Card key={order.id} className={isPending ? "border-amber-500/40" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}…</span>
                      <Badge variant={statusColor(order.paymentStatus)}>
                        Pagamento: {order.paymentStatus}
                      </Badge>
                      <Badge variant={statusColor(order.status)}>
                        Pedido: {order.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total: <span className="font-medium text-foreground">R$ {parseFloat(order.total).toFixed(2)}</span>
                      {" · "}
                      {new Date(order.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={!!loading}
                        onClick={() => simulate(order.id, "approve")}
                      >
                        {loading === `${order.id}-approve` ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        )}
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!!loading}
                        onClick={() => simulate(order.id, "reject")}
                      >
                        {loading === `${order.id}-reject` ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                        )}
                        Rejeitar
                      </Button>
                    </div>
                  )}

                  {!isPending && (
                    <span className="text-xs text-muted-foreground italic flex-shrink-0">
                      {order.paymentStatus === "approved" ? "✓ Estoque confirmado" : "✗ Estoque liberado"}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
