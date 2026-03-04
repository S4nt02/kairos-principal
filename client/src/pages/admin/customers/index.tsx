import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAdminQueryFn } from "@/lib/admin-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface CustomerRow {
  id: string; name: string; email: string; phone: string | null;
  orderCount: number; totalSpent: number; createdAt: string;
}

export default function CustomersList() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", "20");
  if (search) params.set("search", search);

  const { data } = useQuery<{ data: CustomerRow[]; total: number; totalPages: number }>({
    queryKey: [`/api/admin/customers?${params.toString()}`],
    queryFn: getAdminQueryFn(),
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Clientes</h1>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou email..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="text-center">Pedidos</TableHead>
              <TableHead className="text-right">Total Gasto</TableHead>
              <TableHead>Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.data || []).map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/customers/${c.id}`)}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.phone || "—"}</TableCell>
                <TableCell className="text-center">{c.orderCount}</TableCell>
                <TableCell className="text-right">R$ {c.totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{data.total} cliente(s)</span>
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
