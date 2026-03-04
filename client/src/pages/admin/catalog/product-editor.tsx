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
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import type { Category, Product, ProductVariant, PaperType, Finishing, PriceRule } from "../../../../../shared/schema";

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
    minQuantity: 100, imageUrl: "", active: true, seoTitle: "", seoDescription: "",
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
      });
    }
  }, [product]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        const res = await adminApiRequest("POST", "/api/admin/products", form);
        return res.json();
      } else {
        await adminApiRequest("PATCH", `/api/admin/products/${id}`, form);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
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
  const [newRule, setNewRule] = useState({ minQty: 100, maxQty: 500, pricePerUnit: "0.10", setupFee: "0" });

  const addRuleMutation = useMutation({
    mutationFn: async () => { await adminApiRequest("POST", `/api/admin/products/${id}/price-rules`, newRule); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${id}`] });
      setNewRule({ minQty: 100, maxQty: 500, pricePerUnit: "0.10", setupFee: "0" });
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
                    <Label>URL da imagem</Label>
                    <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade mínima</Label>
                    <Input type="number" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: parseInt(e.target.value) || 100 })} />
                  </div>
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
                        <Select value={newVariant.finishingId} onValueChange={(v) => setNewVariant({ ...newVariant, finishingId: v })}>
                          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Acabamento" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nenhum</SelectItem>
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
                        <TableCell>{r.maxQty}</TableCell>
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
                      <TableCell><Input type="number" className="w-20" value={newRule.minQty} onChange={(e) => setNewRule({ ...newRule, minQty: parseInt(e.target.value) || 0 })} /></TableCell>
                      <TableCell><Input type="number" className="w-20" value={newRule.maxQty} onChange={(e) => setNewRule({ ...newRule, maxQty: parseInt(e.target.value) || 0 })} /></TableCell>
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
      </Tabs>
    </div>
  );
}
