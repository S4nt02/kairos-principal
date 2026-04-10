import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminQueryFn, adminApiRequest } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/grafica/price-engine";
import type { AddonCategory, AddonItem } from "@shared/schema";

// ── Addon Categories & Items ────────────────────────────────────

function AddonCategoriesTab() {
  const qc = useQueryClient();
  const [catOpen, setCatOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ name: "", description: "", active: true, sortOrder: 0 });
  const [itemForm, setItemForm] = useState({ addonCategoryId: "", name: "", description: "", priceModifier: "0", stockQuantity: 0, active: true, sortOrder: 0 });

  const { data: categories = [] } = useQuery<(AddonCategory & { items: AddonItem[] })[]>({
    queryKey: ["/api/admin/addon-categories"],
    queryFn: getAdminQueryFn(),
  });

  const saveCat = useMutation({
    mutationFn: async () => {
      if (editCatId) {
        await adminApiRequest("PUT", `/api/admin/addon-categories/${editCatId}`, catForm);
      } else {
        await adminApiRequest("POST", "/api/admin/addon-categories", catForm);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/addon-categories"] });
      setCatOpen(false); setEditCatId(null);
      setCatForm({ name: "", description: "", active: true, sortOrder: 0 });
      toast.success(editCatId ? "Categoria atualizada" : "Categoria criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCat = useMutation({
    mutationFn: (id: string) => adminApiRequest("DELETE", `/api/admin/addon-categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/addon-categories"] }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      if (editItemId) {
        await adminApiRequest("PUT", `/api/admin/addon-items/${editItemId}`, itemForm);
      } else {
        await adminApiRequest("POST", "/api/admin/addon-items", itemForm);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/addon-categories"] });
      setItemOpen(false); setEditItemId(null);
      setItemForm({ addonCategoryId: "", name: "", description: "", priceModifier: "0", stockQuantity: 0, active: true, sortOrder: 0 });
      toast.success(editItemId ? "Item atualizado" : "Item criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delItem = useMutation({
    mutationFn: (id: string) => adminApiRequest("DELETE", `/api/admin/addon-items/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/addon-categories"] }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Categorias e itens de adereços vinculáveis a produtos.</p>
        <Button size="sm" onClick={() => { setEditCatId(null); setCatForm({ name: "", description: "", active: true, sortOrder: 0 }); setCatOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova Categoria
        </Button>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} className="rounded-lg border border-border">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-3">
              <span className="font-medium">{cat.name}</span>
              <Badge variant={cat.active ? "default" : "secondary"}>{cat.active ? "Ativo" : "Inativo"}</Badge>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => {
                setEditCatId(cat.id);
                setCatForm({ name: cat.name, description: cat.description ?? "", active: cat.active, sortOrder: cat.sortOrder });
                setCatOpen(true);
              }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => delCat.mutate(cat.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                setSelectedCatId(cat.id);
                setItemForm({ addonCategoryId: cat.id, name: "", description: "", priceModifier: "0", stockQuantity: 0, active: true, sortOrder: 0 });
                setItemOpen(true);
              }}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Item
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Adicional</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cat.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.name}</span>
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {parseFloat(item.priceModifier) > 0 ? `+${formatCurrency(parseFloat(item.priceModifier))}` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={item.stockQuantity === 0 ? "text-destructive font-medium" : ""}>{item.stockQuantity}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setEditItemId(item.id);
                        setItemForm({ addonCategoryId: item.addonCategoryId, name: item.name, description: item.description ?? "", priceModifier: item.priceModifier, stockQuantity: item.stockQuantity, active: item.active, sortOrder: item.sortOrder });
                        setItemOpen(true);
                      }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => delItem.mutate(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {cat.items.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-sm">Nenhum item nesta categoria.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ))}
      {categories.length === 0 && (
        <div className="text-center text-muted-foreground py-12">Nenhuma categoria de adereço cadastrada.</div>
      )}

      {/* Category Dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCatId ? "Editar Categoria" : "Nova Categoria de Adereço"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Ex: Porta-crachás" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input type="number" min="0" value={catForm.sortOrder} onChange={(e) => setCatForm({ ...catForm, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={catForm.active} onCheckedChange={(v) => setCatForm({ ...catForm, active: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
            <Button className="w-full" onClick={() => saveCat.mutate()} disabled={saveCat.isPending || !catForm.name}>
              {saveCat.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItemId ? "Editar Item" : "Novo Item de Adereço"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Ex: Cordão azul" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Preço adicional (R$)</Label>
                <Input type="number" step="0.01" min="0" value={itemForm.priceModifier} onChange={(e) => setItemForm({ ...itemForm, priceModifier: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Estoque</Label>
                <Input type="number" min="0" value={itemForm.stockQuantity} onChange={(e) => setItemForm({ ...itemForm, stockQuantity: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input type="number" min="0" value={itemForm.sortOrder} onChange={(e) => setItemForm({ ...itemForm, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={itemForm.active} onCheckedChange={(v) => setItemForm({ ...itemForm, active: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
            <Button className="w-full" onClick={() => saveItem.mutate()} disabled={saveItem.isPending || !itemForm.name}>
              {saveItem.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function Personalizacoes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Personalizações</h1>
        <p className="text-muted-foreground mt-1">Gerencie adereços disponíveis para os produtos.</p>
      </div>

      <AddonCategoriesTab />
    </div>
  );
}
