import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAdminQueryFn, adminApiRequest } from "@/lib/admin-api";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import OrderTimeline from "@/components/admin/order-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Save, Truck, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AdminOrderDetail } from "../../../../../shared/types";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["production", "cancelled"],
  production: ["shipped"],
  shipped: ["delivered"],
};

export default function OrderDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { hasRole } = useAdminAuth();
  const [trackingCode, setTrackingCode] = useState("");

  const { data: order } = useQuery<AdminOrderDetail>({
    queryKey: [`/api/admin/orders/${id}`],
    queryFn: getAdminQueryFn(),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      await adminApiRequest("PATCH", `/api/admin/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/orders/${id}`] });
      toast.success("Status atualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const trackingMutation = useMutation({
    mutationFn: async () => {
      await adminApiRequest("PATCH", `/api/admin/orders/${id}/tracking`, { trackingCode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/orders/${id}`] });
      toast.success("Código de rastreio atualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!order) return <div className="p-6">Carregando...</div>;

  const nextStatuses = STATUS_TRANSITIONS[order.status] || [];
  const canEdit = hasRole("admin", "operador");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Pedido #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="pt-6">
          <OrderTimeline currentStatus={order.status} />
          {canEdit && nextStatuses.length > 0 && (
            <div className="flex gap-2 mt-4">
              {nextStatuses.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "cancelled" ? "destructive" : "default"}
                  onClick={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                >
                  {s === "cancelled" ? "Cancelar" : `Mover para ${s}`}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead>Arte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">R$ {parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                      <TableCell className="text-right">R$ {parseFloat(item.subtotal).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={item.artStatus === "uploaded" ? "default" : "outline"}>
                          {item.artStatus || "pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer */}
          {order.customer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{order.customer.name}</p>
                <p className="text-muted-foreground">{order.customer.email}</p>
                {order.customer.phone && <p className="text-muted-foreground">{order.customer.phone}</p>}
              </CardContent>
            </Card>
          )}

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {parseFloat(order.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span>R$ {parseFloat(order.shippingCost).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Total</span>
                <span>R$ {parseFloat(order.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={order.paymentStatus === "approved" ? "default" : order.paymentStatus === "rejected" ? "destructive" : "outline"}>
                  {order.paymentStatus}
                </Badge>
              </div>
              {order.paymentMethod && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Método</span>
                  <span>{order.paymentMethod}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping Label */}
          {(order as any).shippingLabelUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Etiqueta de Envio</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() => window.open((order as any).shippingLabelUrl, "_blank")}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Etiqueta
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Shipping Address */}
          {(order as any).shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereço de Entrega</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>{(order as any).shippingAddress.street}, {(order as any).shippingAddress.number}</p>
                {(order as any).shippingAddress.complement && <p>{(order as any).shippingAddress.complement}</p>}
                <p>{(order as any).shippingAddress.neighborhood}</p>
                <p>{(order as any).shippingAddress.city} - {(order as any).shippingAddress.state}</p>
                <p className="font-mono">{(order as any).shippingAddress.cep}</p>
              </CardContent>
            </Card>
          )}

          {/* Tracking */}
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rastreamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {order.shippingTrackingCode && (
                  <p className="text-sm font-mono">{order.shippingTrackingCode}</p>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Código de rastreio"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    className="text-sm"
                  />
                  <Button size="icon" onClick={() => trackingMutation.mutate()} disabled={!trackingCode || trackingMutation.isPending}>
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
