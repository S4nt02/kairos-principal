import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminQueryFn, adminApiRequest } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, AlertTriangle, Package2 } from "lucide-react";
import { toast } from "sonner";

interface StockItem {
  id: string;
  name: string;
  entityType: "product" | "finishing" | "wireo_option" | "addon_item";
  stockQuantity: number;
}

const typeLabel: Record<string, string> = {
  product: "Produto",
  finishing: "Acabamento",
  wireo_option: "Wire-o",
  addon_item: "Adereço",
};

const typeVariant = (type: string): "default" | "secondary" | "outline" => {
  if (type === "product") return "default";
  if (type === "finishing") return "secondary";
  if (type === "wireo_option") return "outline";
  return "outline";
};

export default function Estoque() {
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [newQty, setNewQty] = useState(0);

  const { data: items = [], isLoading } = useQuery<StockItem[]>({
    queryKey: ["/api/admin/stock"],
    queryFn: getAdminQueryFn(),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editItem) return;
      const path =
        editItem.entityType === "product"
          ? `/api/admin/products/${editItem.id}/stock`
          : editItem.entityType === "finishing"
          ? `/api/admin/finishings/${editItem.id}/stock`
          : editItem.entityType === "wireo_option"
          ? `/api/admin/wireo-options/${editItem.id}/stock`
          : `/api/admin/addon-items/${editItem.id}/stock`;
      await adminApiRequest("PATCH", path, { stockQuantity: newQty });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/stock"] });
      setEditItem(null);
      toast.success("Estoque atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const zeroStock = items.filter((i) => i.stockQuantity === 0);
  const lowStock = items.filter((i) => i.stockQuantity > 0 && i.stockQuantity <= 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estoque de Insumos</h1>
        <p className="text-muted-foreground mt-1">Controle de estoque para capas, wire-o e adereços.</p>
      </div>

      {/* Alerts */}
      {(zeroStock.length > 0 || lowStock.length > 0) && (
        <div className="space-y-2">
          {zeroStock.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span><strong>{zeroStock.length} item{zeroStock.length !== 1 ? "s" : ""}</strong> sem estoque: {zeroStock.map((i) => i.name).join(", ")}</span>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm text-orange-600 dark:text-orange-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span><strong>{lowStock.length} item{lowStock.length !== 1 ? "s" : ""}</strong> com estoque baixo (≤10).</span>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Package2 className="w-6 h-6 mr-2 animate-pulse" />
          Carregando estoque...
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.entityType}-${item.id}`}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant={typeVariant(item.entityType)}>
                    {typeLabel[item.entityType] ?? item.entityType}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">{item.stockQuantity}</TableCell>
                <TableCell>
                  {item.stockQuantity === 0 ? (
                    <Badge variant="destructive">Sem estoque</Badge>
                  ) : item.stockQuantity <= 10 ? (
                    <Badge className="bg-orange-500 hover:bg-orange-500">Baixo</Badge>
                  ) : (
                    <Badge variant="secondary">OK</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => { setEditItem(item); setNewQty(item.stockQuantity); }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Nenhum item de estoque cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Estoque</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4 py-2">
              <div>
                <p className="text-sm font-medium">{editItem.name}</p>
                <p className="text-xs text-muted-foreground">{typeLabel[editItem.entityType]}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Nova quantidade</Label>
                <Input
                  type="number"
                  min="0"
                  value={newQty}
                  onChange={(e) => setNewQty(parseInt(e.target.value) || 0)}
                />
              </div>
              <Button className="w-full" onClick={() => update.mutate()} disabled={update.isPending}>
                {update.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
