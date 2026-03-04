import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminQueryFn, adminApiRequest } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Finishing } from "../../../../../shared/schema";

interface FinishingForm {
  name: string; type: string; priceModifier: string; multiplier: string; active: boolean; sortOrder: number;
}

const defaultForm: FinishingForm = { name: "", type: "laminacao", priceModifier: "0", multiplier: "1.0", active: true, sortOrder: 0 };

export default function Finishings() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FinishingForm>(defaultForm);

  const { data: finishings } = useQuery<Finishing[]>({
    queryKey: ["/api/admin/finishings"],
    queryFn: getAdminQueryFn(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        await adminApiRequest("PATCH", `/api/admin/finishings/${editId}`, form);
      } else {
        await adminApiRequest("POST", "/api/admin/finishings", form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finishings"] });
      setOpen(false); setEditId(null); setForm(defaultForm);
      toast.success(editId ? "Atualizado" : "Criado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await adminApiRequest("DELETE", `/api/admin/finishings/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/finishings"] }); toast.success("Removido"); },
  });

  const openEdit = (f: Finishing) => {
    setEditId(f.id);
    setForm({ name: f.name, type: f.type, priceModifier: f.priceModifier, multiplier: f.multiplier, active: f.active, sortOrder: f.sortOrder });
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Acabamentos</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditId(null); setForm(defaultForm); }}><Plus className="h-4 w-4 mr-2" />Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Acabamento</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laminacao">Laminação</SelectItem>
                    <SelectItem value="verniz">Verniz</SelectItem>
                    <SelectItem value="refile">Refile</SelectItem>
                    <SelectItem value="corte_especial">Corte Especial</SelectItem>
                    <SelectItem value="dobra">Dobra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Modificador (R$)</Label><Input value={form.priceModifier} onChange={(e) => setForm({ ...form, priceModifier: e.target.value })} /></div>
                <div className="space-y-2"><Label>Multiplicador</Label><Input value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Ordem</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} /></div>
                <div className="flex items-center gap-2 pt-6"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{editId ? "Salvar" : "Criar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Modificador</TableHead>
              <TableHead className="text-right">Multiplicador</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-center">Ordem</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(finishings || []).map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell>{f.type}</TableCell>
                <TableCell className="text-right">R$ {parseFloat(f.priceModifier).toFixed(4)}</TableCell>
                <TableCell className="text-right">{parseFloat(f.multiplier).toFixed(2)}x</TableCell>
                <TableCell className="text-center">{f.active ? "Sim" : "Não"}</TableCell>
                <TableCell className="text-center">{f.sortOrder}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(f.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
