import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Package, User, MapPin, LogOut, ShoppingCart,
  ChevronRight, ArrowLeft, Plus, Pencil, Trash2,
  Loader2, Check, Star,
} from "lucide-react";
import { Link } from "wouter";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { Footer } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/grafica/price-engine";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Order, Address } from "@shared/schema";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

type Tab = "orders" | "addresses" | "profile";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Aguardando", color: "text-yellow-600", bg: "bg-yellow-500/10" },
  confirmed: { label: "Confirmado", color: "text-blue-600", bg: "bg-blue-500/10" },
  production: { label: "Em produção", color: "text-purple-600", bg: "bg-purple-500/10" },
  shipped: { label: "Enviado", color: "text-indigo-600", bg: "bg-indigo-500/10" },
  delivered: { label: "Entregue", color: "text-green-600", bg: "bg-green-500/10" },
  cancelled: { label: "Cancelado", color: "text-red-600", bg: "bg-red-500/10" },
};

interface AddressForm {
  label: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
}

const emptyAddress: AddressForm = {
  label: "Principal", cep: "", street: "", number: "", complement: "",
  neighborhood: "", city: "", state: "", isDefault: false,
};

export default function GraficaConta() {
  const [tab, setTab] = useState<Tab>("orders");
  const [, setLocation] = useLocation();
  const { isAuthenticated, customer, logout, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/grafica/login?redirect=/grafica/conta");
    }
  }, [isAuthenticated, setLocation]);

  // ── Orders ──
  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/grafica/account/orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/grafica/account/orders");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // ── Addresses ──
  const { data: addresses, isLoading: addressesLoading } = useQuery<Address[]>({
    queryKey: ["/api/grafica/account/addresses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/grafica/account/addresses");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const [addressForm, setAddressForm] = useState<AddressForm>(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);

  const lookupCep = useCallback(async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setLookingUpCep(true);
    try {
      const res = await fetch(`/api/grafica/address/${clean}`);
      if (res.ok) {
        const data = await res.json();
        setAddressForm((prev) => ({
          ...prev,
          street: data.street || prev.street,
          neighborhood: data.neighborhood || prev.neighborhood,
          city: data.city || prev.city,
          state: data.state || prev.state,
        }));
      }
    } catch {}
    setLookingUpCep(false);
  }, []);

  const saveAddress = useMutation({
    mutationFn: async () => {
      if (editingAddressId) {
        const res = await apiRequest("PATCH", `/api/grafica/account/addresses/${editingAddressId}`, addressForm);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/grafica/account/addresses", addressForm);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grafica/account/addresses"] });
      setShowAddressForm(false);
      setEditingAddressId(null);
      setAddressForm(emptyAddress);
    },
  });

  const deleteAddress = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/grafica/account/addresses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grafica/account/addresses"] });
    },
  });

  const startEditAddress = (addr: Address) => {
    setAddressForm({
      label: addr.label, cep: addr.cep, street: addr.street, number: addr.number,
      complement: addr.complement || "", neighborhood: addr.neighborhood,
      city: addr.city, state: addr.state, isDefault: addr.isDefault,
    });
    setEditingAddressId(addr.id);
    setShowAddressForm(true);
  };

  // ── Profile ──
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");

  useEffect(() => {
    if (customer) {
      setProfileName(customer.name);
      setProfilePhone(customer.phone || "");
    }
  }, [customer]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/grafica/account/profile", {
        name: profileName, phone: profilePhone || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setEditingProfile(false);
      refreshUser();
    },
  });

  // ── Password ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordErr, setPasswordErr] = useState("");

  const changePassword = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/grafica/account/change-password", {
        currentPassword, newPassword,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setPasswordMsg(data.message || "Senha alterada com sucesso");
      setPasswordErr("");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (err: any) => {
      setPasswordErr(err?.message || "Erro ao alterar senha");
      setPasswordMsg("");
    },
  });

  const { toast } = useToast();

  const handleReorderFromList = async (orderId: string) => {
    try {
      const res = await apiRequest("GET", `/api/grafica/orders/${orderId}`);
      const orderData = await res.json();
      const items = orderData.items || [];
      if (items.length === 0) return;

      const sessionId = localStorage.getItem("kairos_cart_session") || crypto.randomUUID();
      localStorage.setItem("kairos_cart_session", sessionId);

      for (const item of items) {
        await fetch("/api/grafica/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            productId: item.productId,
            variantId: item.variantId || undefined,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            specifications: item.specifications || {},
          }),
        });
      }

      toast({ title: "Itens adicionados ao carrinho" });
      queryClient.invalidateQueries({ queryKey: ["/api/grafica/cart"] });
      setLocation("/grafica/carrinho");
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Erro ao adicionar itens ao carrinho." });
    }
  };

  const handleLogout = () => {
    logout();
    setLocation("/grafica");
  };

  if (!isAuthenticated) return null;

  const inputCls = "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors";

  return (
    <div className="min-h-screen bg-background font-sans">
      <GraficaNavbar breadcrumbs={[{ label: "Minha Conta" }]} />

      <div className="container mx-auto px-6 pt-8 pb-24">
        <Link href="/grafica">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao catálogo
          </div>
        </Link>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mb-8"
        >
          <h1 className="text-3xl font-display font-bold tracking-tight">Minha Conta</h1>
          {customer && (
            <p className="text-muted-foreground mt-1">Olá, {customer.name.split(" ")[0]}</p>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto">
          {([
            { key: "orders" as Tab, label: "Meus Pedidos", icon: Package },
            { key: "addresses" as Tab, label: "Endereços", icon: MapPin },
            { key: "profile" as Tab, label: "Meus Dados", icon: User },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Orders tab ── */}
        {tab === "orders" && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {ordersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : !orders || orders.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum pedido encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Seus pedidos aparecerão aqui após a primeira compra
                </p>
                <Link href="/grafica">
                  <button className="mt-4 px-5 py-2 bg-foreground text-background rounded-full text-sm hover:bg-primary transition-colors">
                    Ver catálogo
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order, i) => {
                  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.4, delay: i * 0.05, ease: EASE }}
                    >
                      <Link href={`/grafica/pedido/${order.id}`}>
                        <div className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all cursor-pointer group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center">
                                <Package className="w-5 h-5 text-primary/40" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  Pedido <span className="font-mono">#{order.id.slice(0, 8)}</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", status.bg, status.color)}>
                                {status.label}
                              </span>
                              <span className="font-mono font-bold text-sm">
                                {formatCurrency(parseFloat(order.total))}
                              </span>
                              {order.status !== "pending" && (
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleReorderFromList(order.id); }}
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="Comprar novamente"
                                >
                                  <ShoppingCart className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Addresses tab ── */}
        {tab === "addresses" && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="max-w-2xl"
          >
            {/* Address list */}
            {addressesLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
              </div>
            ) : (
              <>
                {addresses && addresses.length > 0 && (
                  <div className="space-y-3 mb-6">
                    {addresses.map((addr) => (
                      <div key={addr.id} className="p-4 rounded-xl border border-border/50 bg-card">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm">{addr.label}</p>
                              {addr.isDefault && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5" /> Padrão
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {addr.neighborhood} - {addr.city}/{addr.state} - CEP {addr.cep}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditAddress(addr)}
                              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteAddress.mutate(addr.id)}
                              disabled={deleteAddress.isPending}
                              className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add button */}
                {!showAddressForm && (
                  <button
                    onClick={() => { setShowAddressForm(true); setEditingAddressId(null); setAddressForm(emptyAddress); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Adicionar endereço
                  </button>
                )}

                {/* Address form */}
                {showAddressForm && (
                  <div className="rounded-xl border border-border/50 p-5 space-y-4 mt-4">
                    <h3 className="font-medium text-sm">{editingAddressId ? "Editar endereço" : "Novo endereço"}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs text-muted-foreground block mb-1">Nome do endereço</label>
                        <input value={addressForm.label} onChange={(e) => setAddressForm((p) => ({ ...p, label: e.target.value }))} className={inputCls} placeholder="Ex: Casa, Trabalho" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">CEP</label>
                        <div className="relative">
                          <input
                            value={addressForm.cep}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                              setAddressForm((p) => ({ ...p, cep: v }));
                              if (v.length === 8) lookupCep(v);
                            }}
                            className={cn(inputCls, "font-mono")}
                            placeholder="00000000"
                            maxLength={8}
                          />
                          {lookingUpCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Rua</label>
                        <input value={addressForm.street} onChange={(e) => setAddressForm((p) => ({ ...p, street: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Número</label>
                        <input value={addressForm.number} onChange={(e) => setAddressForm((p) => ({ ...p, number: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Complemento</label>
                        <input value={addressForm.complement} onChange={(e) => setAddressForm((p) => ({ ...p, complement: e.target.value }))} className={inputCls} placeholder="Apto, sala..." />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Bairro</label>
                        <input value={addressForm.neighborhood} onChange={(e) => setAddressForm((p) => ({ ...p, neighborhood: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Cidade</label>
                        <input value={addressForm.city} onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Estado</label>
                        <input value={addressForm.state} onChange={(e) => setAddressForm((p) => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))} className={cn(inputCls, "font-mono")} placeholder="SP" maxLength={2} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={addressForm.isDefault} onChange={(e) => setAddressForm((p) => ({ ...p, isDefault: e.target.checked }))} className="rounded border-border" />
                          Definir como endereço padrão
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => saveAddress.mutate()}
                        disabled={saveAddress.isPending || !addressForm.cep || !addressForm.street || !addressForm.number || !addressForm.city || !addressForm.state}
                        className="px-5 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {saveAddress.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {editingAddressId ? "Salvar" : "Adicionar"}
                      </button>
                      <button
                        onClick={() => { setShowAddressForm(false); setEditingAddressId(null); setAddressForm(emptyAddress); }}
                        className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── Profile tab ── */}
        {tab === "profile" && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="max-w-xl space-y-6"
          >
            {/* Personal info */}
            <div className="rounded-xl border border-border/50 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-lg">Informações Pessoais</h2>
                {!editingProfile && (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                )}
              </div>

              {customer && !editingProfile && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <p className="text-sm font-medium">{customer.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">E-mail</label>
                    <p className="text-sm font-medium">{customer.email}</p>
                  </div>
                  {customer.phone && (
                    <div>
                      <label className="text-xs text-muted-foreground">Telefone</label>
                      <p className="text-sm font-medium">{customer.phone}</p>
                    </div>
                  )}
                </div>
              )}

              {editingProfile && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Nome</label>
                    <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">E-mail</label>
                    <input value={customer?.email || ""} disabled className={cn(inputCls, "opacity-50 cursor-not-allowed")} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Telefone</label>
                    <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className={inputCls} placeholder="(11) 99999-9999" />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => updateProfile.mutate()}
                      disabled={updateProfile.isPending}
                      className="px-5 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Salvar
                    </button>
                    <button onClick={() => setEditingProfile(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Change password */}
            <div className="rounded-xl border border-border/50 p-6 space-y-4">
              <h2 className="font-display font-bold text-lg">Alterar Senha</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Senha atual</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Nova senha</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder="Mínimo 6 caracteres" />
                </div>
              </div>
              {passwordMsg && <p className="text-sm text-green-500">{passwordMsg}</p>}
              {passwordErr && <p className="text-sm text-red-500">{passwordErr}</p>}
              <button
                onClick={() => changePassword.mutate()}
                disabled={changePassword.isPending || !currentPassword || newPassword.length < 6}
                className="px-5 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50"
              >
                {changePassword.isPending ? "Alterando..." : "Alterar senha"}
              </button>
            </div>

            {/* Logout */}
            <div className="pt-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair da conta
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <Footer />
    </div>
  );
}
