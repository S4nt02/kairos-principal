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
import type { PaperType } from "../../../../../shared/schema";

interface PaperForm {
  name: string; weightGsm: number; finish: string; costPerSheet: string; active: boolean; sortOrder: number;
}

const defaultForm: PaperForm = { name: "", weightGsm: 250, finish: "fosco", costPerSheet: "0.15", active: true, sortOrder: 0 };

const FINISH_OPTIONS = [
  { value: "fosco", label: "Fosco" },
  { value: "brilho", label: "Brilho" },
  { value: "natural", label: "Natural" },
];

const finishLabel = (v: string) => FINISH_OPTIONS.find((o) => o.value === v)?.label || v;

export default function PaperTypes() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PaperForm>(defaultForm);
  const [customFinish, setCustomFinish] = useState(false);

  const { data: papers } = useQuery<PaperType[]>({
    queryKey: ["/api/admin/paper-types"],
    queryFn: getAdminQueryFn(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Normaliza costPerSheet: troca vírgula por ponto (formato brasileiro)
      const payload = { ...form, costPerSheet: form.costPerSheet.replace(",", ".") };
      if (editId) {
        await adminApiRequest("PATCH", `/api/admin/paper-types/${editId}`, payload);
      } else {
        await adminApiRequest("POST", "/api/admin/paper-types", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/paper-types"] });
      setOpen(false); setEditId(null); setForm(defaultForm);
      toast.success(editId ? "Atualizado" : "Criado");
    },
    onError: (err: Error) => {
      try {
        const json = JSON.parse(err.message.replace(/^\d+:\s*/, ""));
        if (json.errors) {
          const msgs = Object.entries(json.errors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`);
          toast.error(msgs.join("\n") || json.message || "Erro ao salvar");
        } else {
          toast.error(json.message || "Erro ao salvar");
        }
      } catch {
        toast.error(err.message || "Erro ao salvar");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await adminApiRequest("DELETE", `/api/admin/paper-types/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/paper-types"] }); toast.success("Removido"); },
  });

  const openEdit = (p: PaperType) => {
    setEditId(p.id);
    setForm({ name: p.name, weightGsm: p.weightGsm, finish: p.finish, costPerSheet: p.costPerSheet, active: p.active, sortOrder: p.sortOrder });
    setCustomFinish(!FINISH_OPTIONS.some((o) => o.value === p.finish));
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tipos de Papel</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditId(null); setForm(defaultForm); setCustomFinish(false); }}><Plus className="h-4 w-4 mr-2" />Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Tipo de Papel</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Gramatura (gsm)</Label><Input type="number" min={1} value={form.weightGsm} onChange={(e) => setForm({ ...form, weightGsm: parseInt(e.target.value) || 0 })} /></div>
                <div className="space-y-2">
                  <Label>Acabamento</Label>
                  {customFinish ? (
                    <div className="flex gap-2">
                      <Input value={form.finish} onChange={(e) => setForm({ ...form, finish: e.target.value })} placeholder="Digite o acabamento..." required autoFocus />
                      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => { setCustomFinish(false); setForm({ ...form, finish: "fosco" }); }}>Voltar</Button>
                    </div>
                  ) : (
                    <Select value={form.finish} onValueChange={(v) => { if (v === "__custom__") { setCustomFinish(true); setForm({ ...form, finish: "" }); } else { setForm({ ...form, finish: v }); } }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FINISH_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        <SelectItem value="__custom__">Outro...</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Custo/Folha (R$)</Label><Input value={form.costPerSheet} onChange={(e) => setForm({ ...form, costPerSheet: e.target.value })} /></div>
                <div className="space-y-2"><Label>Ordem</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
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
              <TableHead className="text-center">Gramatura</TableHead>
              <TableHead>Acabamento</TableHead>
              <TableHead className="text-right">Custo/Folha</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-center">Ordem</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(papers || []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-center">{p.weightGsm}g</TableCell>
                <TableCell>{finishLabel(p.finish)}</TableCell>
                <TableCell className="text-right">R$ {parseFloat(p.costPerSheet).toFixed(4)}</TableCell>
                <TableCell className="text-center">{p.active ? "Sim" : "Não"}</TableCell>
                <TableCell className="text-center">{p.sortOrder}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
