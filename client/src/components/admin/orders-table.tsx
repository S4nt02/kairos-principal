import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Order } from "../../../../shared/schema";

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  production: "Produção",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  confirmed: "secondary",
  production: "default",
  shipped: "default",
  delivered: "secondary",
  cancelled: "destructive",
};

const paymentLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

const paymentVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
};

interface OrdersTableProps {
  orders: Order[];
  showCustomer?: boolean;
}

export default function OrdersTable({ orders, showCustomer = true }: OrdersTableProps) {
  const [, navigate] = useLocation();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                Nenhum pedido encontrado
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow
                key={order.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                <TableCell>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <Badge variant={statusVariants[order.status] || "outline"}>
                    {statusLabels[order.status] || order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={paymentVariants[order.paymentStatus] || "outline"}>
                    {paymentLabels[order.paymentStatus] || order.paymentStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  R$ {parseFloat(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
