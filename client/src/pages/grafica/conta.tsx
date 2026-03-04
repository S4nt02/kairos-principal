import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Package, User, LogOut,
  ChevronRight, ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { Footer } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/grafica/price-engine";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Order } from "@shared/schema";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

type Tab = "orders" | "profile";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Aguardando", color: "text-yellow-600", bg: "bg-yellow-500/10" },
  confirmed: { label: "Confirmado", color: "text-blue-600", bg: "bg-blue-500/10" },
  production: { label: "Em produção", color: "text-purple-600", bg: "bg-purple-500/10" },
  shipped: { label: "Enviado", color: "text-indigo-600", bg: "bg-indigo-500/10" },
  delivered: { label: "Entregue", color: "text-green-600", bg: "bg-green-500/10" },
  cancelled: { label: "Cancelado", color: "text-red-600", bg: "bg-red-500/10" },
};

export default function GraficaConta() {
  const [tab, setTab] = useState<Tab>("orders");
  const [, setLocation] = useLocation();
  const { isAuthenticated, customer, logout } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/grafica/login?redirect=/grafica/conta");
    }
  }, [isAuthenticated, setLocation]);

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/grafica/account/orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/grafica/account/orders");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const handleLogout = () => {
    logout();
    setLocation("/grafica");
  };

  if (!isAuthenticated) return null;

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
        <div className="flex gap-1 mb-8 border-b border-border">
          {([
            { key: "orders" as Tab, label: "Meus Pedidos", icon: Package },
            { key: "profile" as Tab, label: "Meus Dados", icon: User },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
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

        {/* Orders tab */}
        {tab === "orders" && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {isLoading ? (
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

                            <div className="flex items-center gap-4">
                              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", status.bg, status.color)}>
                                {status.label}
                              </span>
                              <span className="font-mono font-bold text-sm">
                                {formatCurrency(parseFloat(order.total))}
                              </span>
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

        {/* Profile tab */}
        {tab === "profile" && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="max-w-xl"
          >
            <div className="rounded-xl border border-border/50 p-6 space-y-6">
              <h2 className="font-display font-bold text-lg">Informações Pessoais</h2>

              {customer && (
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

              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <Footer />
    </div>
  );
}
