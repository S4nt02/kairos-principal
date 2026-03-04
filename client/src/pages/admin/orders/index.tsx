import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminQueryFn } from "@/lib/admin-api";
import OrdersTable from "@/components/admin/orders-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Order } from "../../../../../shared/schema";

const statusOptions = [
  { value: "all", label: "Todos os status" },
  { value: "pending", label: "Pendente" },
  { value: "confirmed", label: "Confirmado" },
  { value: "production", label: "Produção" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregue" },
  { value: "cancelled", label: "Cancelado" },
];

const paymentOptions = [
  { value: "all", label: "Todos pagamentos" },
  { value: "pending", label: "Pendente" },
  { value: "approved", label: "Aprovado" },
  { value: "rejected", label: "Rejeitado" },
];

export default function OrdersList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [search, setSearch] = useState("");
  const pageSize = 20;

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (status !== "all") params.set("status", status);
  if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
  if (search) params.set("search", search);

  const { data } = useQuery<{ data: Order[]; total: number; totalPages: number }>({
    queryKey: [`/api/admin/orders?${params.toString()}`],
    queryFn: getAdminQueryFn(),
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Pedidos</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={paymentStatus} onValueChange={(v) => { setPaymentStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {paymentOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <OrdersTable orders={data?.data || []} />

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {data.total} pedido{data.total !== 1 ? "s" : ""} encontrado{data.total !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Página {page} de {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
