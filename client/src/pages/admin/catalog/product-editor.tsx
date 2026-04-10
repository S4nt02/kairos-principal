import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAdminQueryFn, adminApiRequest } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Save, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Category, Product, ProductVariant, PaperType, Finishing, PriceRule, WireoOption, AddonCategory, AddonItem } from "../../../../../shared/schema";

function slugify(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface ProductData extends Product {
  variants: ProductVariant[];
  priceRules: PriceRule[];
}

export default function ProductEditor({ id }: { id?: string }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const isNew = !id;

  const [form, setForm] = useState({
    name: "", slug: "", categoryId: "", description: "", basePrice: "0.00",
    minQuantity: 1, imageUrl: "", active: true, seoTitle: "", seoDescription: "",
    quantitySteps: "" as string, // comma-separated, empty = free quantity mode
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
    queryFn: getAdminQueryFn(),
  });

  const { data: product } = useQuery<ProductData>({
    queryKey: [`/api/admin/products/${id}`],
    queryFn: getAdminQueryFn(),
    enabled: !!id,
  });

  const { data: paperTypes } = useQuery<PaperType[]>({
    queryKey: ["/api/admin/paper-types"],
    queryFn: getAdminQueryFn(),
  });

  const { data: finishingsList } = useQuery<Finishing[]>({
    queryKey: ["/api/admin/finishings"],
    queryFn: getAdminQueryFn(),
  });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name, slug: product.slug, categoryId: product.categoryId,
        description: product.description || "", basePrice: product.basePrice,
        minQuantity: product.minQuantity, imageUrl: product.imageUrl || "",
        active: product.active, seoTitle: product.seoTitle || "", seoDescription: product.seoDescription || "",
        quantitySteps: Array.isArray(product.quantitySteps) && product.quantitySteps.length > 0
          ? product.quantitySteps.join(", ")
          : "",
      });
    }
  }, [product]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const steps = form.quantitySteps
        .split(",")
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);
      const payload = { ...form, quantitySteps: steps.length > 0 ? steps : null };
      if (isNew) {
        const res = await adminApiRequest("POST", "/api/admin/products", payload);
        return res.json();
      } else {
        await adminApiRequest("PATCH", `/api/admin/products/${id}`, payload);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      if (id) queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${id}`] });
      toast.success(isNew ? "Produto criado" : "Produto atualizado");
      if (isNew && data?.id) navigate(`/catalog/products/${data.id}/edit`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Variant CRUD ──
  const [newVariant, setNewVariant] = useState({
    paperTypeId: "", finishingId: "", widthMm: 90, heightMm: 50,
    colorsFront: 4, colorsBack: 0, sku: "",
  });

  const addVariantMutation = useMutation({
    mutationFn: async () => {
      await adminApiRequest("POST", `/api/admin/products/${id}/variants`, {
        ...newVariant,
        finishingId: newVariant.finishingId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${id}`] });
      setNewVariant({ paperTypeId: "", finishingId: "", widthMm: 90, heightMm: 50, colorsFront: 4, colorsBack: 0, sku: "" });
      toast.success("Variante adicionada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (vid: string) => { await adminApiRequest("DELETE", `/api/admin/variants/${vid}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${id}`] });
      toast.success("Variante removida");
    },
  });

  // ── Price Rule CRUD ──
  const [newRule, setNewRule] = useState({ minQty: 1, maxQty: "" as string | number, pricePerUnit: "0.10", setupFee: "0" });

  const addRuleMutation = useMutation({
    mutationFn: async () => {
      const maxQty = newRule.maxQty === "" || newRule.maxQty === 0 ? 999999 : Number(newRule.maxQty);
      await adminApiRequest("POST", `/api/admin/products/${id}/price-rules`, { ...newRule, maxQty });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${id}`] });
      setNewRule({ minQty: 1, maxQty: "", pricePerUnit: "0.10", setupFee: "0" });
      toast.success("Regra de preço adicionada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (rid: string) => { await adminApiRequest("DELETE", `/api/admin/price-rules/${rid}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${id}`] });
      toast.success("Regra removida");
    },
  });

  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("kairos_admin_token");
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erro no upload");
      const { url } = await res.json();
      setForm((f) => ({ ...f, imageUrl: url }));
      toast.success("Imagem enviada");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  }

  // ── Product Finishings Assignment ──
  const { data: productFinishings, refetch: refetchProductFinishings } = useQuery<Finishing[]>({
    queryKey: [`/api/admin/products/${id}/finishings`],
    queryFn: getAdminQueryFn(),
    enabled: !!id,
  });

  const [selectedFinishingIds, setSelectedFinishingIds] = useState<string[]>([]);

  useEffect(() => {
    if (productFinishings) {
      setSelectedFinishingIds(productFinishings.map((f) => f.id));
    }
  }, [productFinishings]);

  const saveFinishingsMutation = useMutation({
    mutationFn: async () => {
      await adminApiRequest("PUT", `/api/admin/products/${id}/finishings`, { finishingIds: selectedFinishingIds });
    },
    onSuccess: () => {
      refetchProductFinishings();
      toast.success("Finalizações salvas");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleFinishing = (finishingId: string) => {
    setSelectedFinishingIds((prev) =>
      prev.includes(finishingId) ? prev.filter((id) => id !== finishingId) : [...prev, finishingId],
    );
  };

  // ── Wireo Options ──
  const { data: wireoOptions, refetch: refetchWireo } = useQuery<WireoOption[]>({
    queryKey: [`/api/admin/wireo-options`, id],
    queryFn: async () => {
      const token = localStorage.getItem("kairos_admin_token");
      const res = await fetch(`/api/admin/wireo-options?productId=${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Erro ao carregar wire-o");
      return res.json();
    },
    enabled: !!id,
  });

  const [newWireo, setNewWireo] = useState({ name: "", colorHex: "", sizeMm: "", priceModifier: "0", stockQuantity: 0, active: true, sortOrder: 0 });

  const addWireoMutation = useMutation({
    mutationFn: async () => {
      await adminApiRequest("POST", "/api/admin/wireo-options", {
        productId: id,
        name: newWireo.name,
        colorHex: newWireo.colorHex || null,
        sizeMm: newWireo.sizeMm ? parseInt(newWireo.sizeMm) : null,
        priceModifier: newWireo.priceModifier,
        stockQuantity: newWireo.stockQuantity,
        active: newWireo.active,
        sortOrder: newWireo.sortOrder,
      });
    },
    onSuccess: () => { refetchWireo(); setNewWireo({ name: "", colorHex: "", sizeMm: "", priceModifier: "0", stockQuantity: 0, active: true, sortOrder: 0 }); toast.success("Wire-o adicionado"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteWireoMutation = useMutation({
    mutationFn: async (wid: string) => { await adminApiRequest("DELETE", `/api/admin/wireo-options/${wid}`); },
    onSuccess: () => { refetchWireo(); toast.success("Wire-o removido"); },
  });

  // ── Addon Items Assignment ──
  const { data: allAddonCategories } = useQuery<(AddonCategory & { items: AddonItem[] })[]>({
    queryKey: ["/api/admin/addon-categories"],
    queryFn: getAdminQueryFn(),
  });

  const { data: productAddonItemsData, refetch: refetchAddonItems } = useQuery<AddonItem[]>({
    queryKey: [`/api/admin/products/${id}/addon-items`],
    queryFn: getAdminQueryFn(),
    enabled: !!id,
  });

  const [selectedAddonItemIds, setSelectedAddonItemIds] = useState<string[]>([]);

  useEffect(() => {
    if (productAddonItemsData) {
      setSelectedAddonItemIds(productAddonItemsData.map((i) => i.id));
    }
  }, [productAddonItemsData]);

  const saveAddonItemsMutation = useMutation({
    mutationFn: async () => {
      await adminApiRequest("PUT", `/api/admin/products/${id}/addon-items`, { addonItemIds: selectedAddonItemIds });
    },
    onSuccess: () => { refetchAddonItems(); toast.success("Adereços salvos"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleAddonItem = (itemId: string) => {
    setSelectedAddonItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((i) => i !== itemId) : [...prev, itemId],
    );
  };

  const paperMap = new Map((paperTypes || []).map(p => [p.id, p.name]));
  const finishingMap = new Map((finishingsList || []).map(f => [f.id, f.name]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/catalog/products")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{isNew ? "Novo Produto" : "Editar Produto"}</h1>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Geral</TabsTrigger>
          {!isNew && <TabsTrigger value="variants">Variantes</TabsTrigger>}
          {!isNew && <TabsTrigger value="pricing">Regras de Preço</TabsTrigger>}
          {!isNew && <TabsTrigger value="finishings">Finalizações</TabsTrigger>}
          {!isNew && <TabsTrigger value="wireo">Wire-o</TabsTrigger>}
          {!isNew && <TabsTrigger value="addons">Adereços</TabsTrigger>}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: isNew ? slugify(e.target.value) : form.slug })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {(categories || []).map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Preço Base</Label>
                    <Input value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Imagem do Produto</Label>
                    <div className="flex items-center gap-3">
                      {form.imageUrl && (
                        <img src={form.imageUrl} alt="Preview" className="h-16 w-16 object-cover rounded border" />
                      )}
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                        <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors">
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          {uploading ? "Enviando..." : "Upload"}
                        </span>
                      </label>
                    </div>
                    <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Ou cole a URL da imagem" className="text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade mínima</Label>
                    <Input type="number" min={1} value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Passos de Quantidade</Label>
                  <Input
                    value={form.quantitySteps}
                    onChange={(e) => setForm({ ...form, quantitySteps: e.target.value })}
                    placeholder="Ex: 100, 250, 500, 1000 — deixe vazio para quantidade livre"
                  />
                  <p className="text-xs text-muted-foreground">Separe por vírgula. Vazio = cliente digita a quantidade livremente.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SEO Title</Label>
                    <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>SEO Description</Label>
                    <Input value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                  <Label>Ativo</Label>
                </div>
                <Button type="submit" disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />{isNew ? "Criar Produto" : "Salvar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Variants Tab */}
        {!isNew && (
          <TabsContent value="variants">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Variantes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Papel</TableHead>
                      <TableHead>Acabamento</TableHead>
                      <TableHead>Dimensões</TableHead>
                      <TableHead>Cores</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(product?.variants || []).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{paperMap.get(v.paperTypeId) || v.paperTypeId}</TableCell>
                        <TableCell>{v.finishingId ? (finishingMap.get(v.finishingId) || "—") : "—"}</TableCell>
                        <TableCell>{v.widthMm}x{v.heightMm}mm</TableCell>
                        <TableCell>{v.colorsFront}/{v.colorsBack}</TableCell>
                        <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) deleteVariantMutation.mutate(v.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Add row */}
                    <TableRow>
                      <TableCell>
                        <Select value={newVariant.paperTypeId} onValueChange={(v) => setNewVariant({ ...newVariant, paperTypeId: v })}>
                          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Papel" /></SelectTrigger>
                          <SelectContent>
                            {(paperTypes || []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={newVariant.finishingId || "__none__"} onValueChange={(v) => setNewVariant({ ...newVariant, finishingId: v === "__none__" ? "" : v })}>
                          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Acabamento" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nenhum</SelectItem>
                            {(finishingsList || []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Input type="number" className="w-16" value={newVariant.widthMm} onChange={(e) => setNewVariant({ ...newVariant, widthMm: parseInt(e.target.value) || 0 })} />
                          <span className="self-center">x</span>
                          <Input type="number" className="w-16" value={newVariant.heightMm} onChange={(e) => setNewVariant({ ...newVariant, heightMm: parseInt(e.target.value) || 0 })} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Input type="number" className="w-12" value={newVariant.colorsFront} onChange={(e) => setNewVariant({ ...newVariant, colorsFront: parseInt(e.target.value) || 0 })} />
                          <span className="self-center">/</span>
                          <Input type="number" className="w-12" value={newVariant.colorsBack} onChange={(e) => setNewVariant({ ...newVariant, colorsBack: parseInt(e.target.value) || 0 })} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input className="w-24" value={newVariant.sku} onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })} placeholder="SKU" />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="outline" onClick={() => addVariantMutation.mutate()} disabled={!newVariant.paperTypeId || !newVariant.sku}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Price Rules Tab */}
        {!isNew && (
          <TabsContent value="pricing">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Regras de Preço</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Qtd Mín</TableHead>
                      <TableHead>Qtd Máx</TableHead>
                      <TableHead>Preço/Un</TableHead>
                      <TableHead>Setup Fee</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(product?.priceRules || []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.minQty}</TableCell>
                        <TableCell>{r.maxQty >= 999999 ? "Ilimitado" : r.maxQty}</TableCell>
                        <TableCell>R$ {parseFloat(r.pricePerUnit).toFixed(4)}</TableCell>
                        <TableCell>R$ {parseFloat(r.setupFee).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) deleteRuleMutation.mutate(r.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell><Input type="number" className="w-20" value={newRule.minQty} onChange={(e) => setNewRule({ ...newRule, minQty: parseInt(e.target.value) || 1 })} /></TableCell>
                      <TableCell><Input type="number" className="w-24" placeholder="Ilimitado" value={newRule.maxQty} onChange={(e) => setNewRule({ ...newRule, maxQty: e.target.value })} /></TableCell>
                      <TableCell><Input className="w-24" value={newRule.pricePerUnit} onChange={(e) => setNewRule({ ...newRule, pricePerUnit: e.target.value })} /></TableCell>
                      <TableCell><Input className="w-20" value={newRule.setupFee} onChange={(e) => setNewRule({ ...newRule, setupFee: e.target.value })} /></TableCell>
                      <TableCell>
                        <Button size="icon" variant="outline" onClick={() => addRuleMutation.mutate()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
        {/* Finalizações Tab */}
        {!isNew && (() => {
          const FINISHING_TYPE_LABELS: Record<string, string> = {
            laminacao: "Laminação", verniz: "Verniz", refile: "Refile",
            corte_especial: "Corte Especial", dobra: "Dobra",
          };
          const grouped = (finishingsList || []).reduce<Record<string, typeof finishingsList>>((acc, f) => {
            const key = f.type;
            if (!acc[key]) acc[key] = [];
            acc[key]!.push(f);
            return acc;
          }, {});
          const groupKeys = Object.keys(grouped).sort();
          return (
            <TabsContent value="finishings">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Finalizações disponíveis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground">Selecione as finalizações específicas que este produto permite, agrupadas por tipo.</p>
                  {groupKeys.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4">Nenhum acabamento cadastrado ainda.</p>
                  )}
                  {groupKeys.map((type) => {
                    const items = grouped[type]!;
                    const allSelected = items.every((f) => selectedFinishingIds.includes(f.id));
                    const someSelected = items.some((f) => selectedFinishingIds.includes(f.id));
                    return (
                      <div key={type} className="rounded-lg border border-border overflow-hidden">
                        {/* Group header with select-all */}
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border/50">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                            onChange={() => {
                              if (allSelected) {
                                setSelectedFinishingIds((prev) => prev.filter((id) => !items.some((f) => f.id === id)));
                              } else {
                                setSelectedFinishingIds((prev) => Array.from(new Set([...prev, ...items.map((f) => f.id)])));
                              }
                            }}
                          />
                          <span className="text-sm font-semibold">
                            {FINISHING_TYPE_LABELS[type] ?? type}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {items.filter((f) => selectedFinishingIds.includes(f.id)).length}/{items.length} selecionados
                          </span>
                        </div>
                        {/* Individual finishings */}
                        <div className="divide-y divide-border/40">
                          {items.map((f) => (
                            <label
                              key={f.id}
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedFinishingIds.includes(f.id)}
                                onChange={() => toggleFinishing(f.id)}
                                className="h-4 w-4 accent-primary"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium">{f.name}</span>
                              </div>
                              <span className="text-xs font-mono text-muted-foreground">
                                +R$ {parseFloat(f.priceModifier).toFixed(2)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <Button onClick={() => saveFinishingsMutation.mutate()} disabled={saveFinishingsMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />{saveFinishingsMutation.isPending ? "Salvando..." : "Salvar Finalizações"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })()}
        {/* Wire-o Tab */}
        {!isNew && (
          <TabsContent value="wireo">
            <Card>
              <CardHeader><CardTitle className="text-base">Opções de Wire-o</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Tam. (mm)</TableHead>
                      <TableHead>Preço +</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(wireoOptions || []).map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell>{w.colorHex ? <span className="inline-flex items-center gap-1"><span style={{ background: w.colorHex }} className="w-4 h-4 rounded-full border inline-block" />{w.colorHex}</span> : "—"}</TableCell>
                        <TableCell>{w.sizeMm ?? "—"}</TableCell>
                        <TableCell>R$ {parseFloat(w.priceModifier).toFixed(2)}</TableCell>
                        <TableCell>{w.stockQuantity}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) deleteWireoMutation.mutate(w.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell><Input className="w-28" placeholder="Nome" value={newWireo.name} onChange={(e) => setNewWireo({ ...newWireo, name: e.target.value })} /></TableCell>
                      <TableCell><Input className="w-24" placeholder="#hex" value={newWireo.colorHex} onChange={(e) => setNewWireo({ ...newWireo, colorHex: e.target.value })} /></TableCell>
                      <TableCell><Input type="number" className="w-16" placeholder="mm" value={newWireo.sizeMm} onChange={(e) => setNewWireo({ ...newWireo, sizeMm: e.target.value })} /></TableCell>
                      <TableCell><Input className="w-20" placeholder="0.00" value={newWireo.priceModifier} onChange={(e) => setNewWireo({ ...newWireo, priceModifier: e.target.value })} /></TableCell>
                      <TableCell><Input type="number" className="w-16" min="0" value={newWireo.stockQuantity} onChange={(e) => setNewWireo({ ...newWireo, stockQuantity: parseInt(e.target.value) || 0 })} /></TableCell>
                      <TableCell>
                        <Button size="icon" variant="outline" onClick={() => addWireoMutation.mutate()} disabled={!newWireo.name || addWireoMutation.isPending}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Adereços Tab */}
        {!isNew && (
          <TabsContent value="addons">
            <Card>
              <CardHeader><CardTitle className="text-base">Adereços disponíveis</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground">Selecione os adereços específicos que este produto permite, agrupados por categoria.</p>
                {(allAddonCategories || []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">Nenhuma categoria cadastrada. Acesse Personalizações para criar.</p>
                )}
                {(allAddonCategories || []).map((cat) => {
                  const items = cat.items || [];
                  if (items.length === 0) return null;
                  const allSelected = items.every((item) => selectedAddonItemIds.includes(item.id));
                  const someSelected = items.some((item) => selectedAddonItemIds.includes(item.id));
                  return (
                    <div key={cat.id} className="rounded-lg border border-border overflow-hidden">
                      {/* Group header with select-all */}
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border/50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                          onChange={() => {
                            if (allSelected) {
                              setSelectedAddonItemIds((prev) => prev.filter((id) => !items.some((item) => item.id === id)));
                            } else {
                              setSelectedAddonItemIds((prev) => Array.from(new Set([...prev, ...items.map((item) => item.id)])));
                            }
                          }}
                        />
                        <span className="text-sm font-semibold">{cat.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {items.filter((item) => selectedAddonItemIds.includes(item.id)).length}/{items.length} selecionados
                        </span>
                      </div>
                      {/* Individual addon items */}
                      <div className="divide-y divide-border/40">
                        {items.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAddonItemIds.includes(item.id)}
                              onChange={() => toggleAddonItem(item.id)}
                              className="h-4 w-4 accent-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{item.name}</span>
                            </div>
                            <span className="text-xs font-mono text-muted-foreground">
                              +R$ {parseFloat(item.priceModifier).toFixed(2)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <Button onClick={() => saveAddonItemsMutation.mutate()} disabled={saveAddonItemsMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />{saveAddonItemsMutation.isPending ? "Salvando..." : "Salvar Adereços"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
