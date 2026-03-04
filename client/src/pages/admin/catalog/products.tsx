import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAdminQueryFn, adminApiRequest } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { Product, Category } from "../../../../../shared/schema";

export default function Products() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", "20");
  if (categoryId !== "all") params.set("categoryId", categoryId);
  if (search) params.set("search", search);

  const { data } = useQuery<{ data: Product[]; total: number; totalPages: number }>({
    queryKey: [`/api/admin/products?${params.toString()}`],
    queryFn: getAdminQueryFn(),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
    queryFn: getAdminQueryFn(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await adminApiRequest("DELETE", `/api/admin/products/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] }); toast.success("Produto removido"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const catMap = new Map((categories || []).map(c => [c.id, c.name]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Button onClick={() => navigate("/catalog/products/new")}>
          <Plus className="h-4 w-4 mr-2" />Novo Produto
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {(categories || []).map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Preço Base</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.data || []).map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-muted-foreground">{catMap.get(product.categoryId) || "—"}</TableCell>
                <TableCell className="text-right">R$ {parseFloat(product.basePrice).toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={product.active ? "default" : "outline"}>{product.active ? "Sim" : "Não"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/catalog/products/${product.id}/edit`)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover produto?")) deleteMutation.mutate(product.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{data.total} produto(s)</span>
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
