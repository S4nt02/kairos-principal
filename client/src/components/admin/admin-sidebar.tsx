import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import {
  LayoutDashboard, ShoppingCart, Package, Users, BarChart3,
  Settings, FolderTree, FileText, Palette, Layers, Ticket, Megaphone,
  Sparkles, Warehouse, FlaskConical, CreditCard, Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

// Paths are relative to /admin (wouter nested routing)
const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Pedidos", href: "/orders", icon: ShoppingCart, roles: ["admin", "operador", "financeiro"] },
  { label: "Categorias", href: "/catalog/categories", icon: FolderTree, roles: ["admin"] },
  { label: "Produtos", href: "/catalog/products", icon: Package, roles: ["admin"] },
  { label: "Papéis", href: "/catalog/paper-types", icon: FileText, roles: ["admin"] },
  { label: "Acabamentos", href: "/catalog/finishings", icon: Palette, roles: ["admin"] },
  { label: "Personalizações", href: "/personalizacoes", icon: Sparkles, roles: ["admin"] },
  { label: "Estoque", href: "/estoque", icon: Warehouse, roles: ["admin", "operador"] },
  { label: "Cupons", href: "/coupons", icon: Ticket, roles: ["admin"] },
  { label: "Estratégia", href: "/estrategia", icon: Megaphone, roles: ["admin"] },
  { label: "Clientes", href: "/customers", icon: Users, roles: ["admin", "operador", "financeiro"] },
  { label: "Relatórios", href: "/reports", icon: BarChart3, roles: ["admin", "financeiro"] },
  { label: "Configurações", href: "/settings", icon: Settings, roles: ["admin"] },
];

const devItems: NavItem[] = [
  { label: "Simulador Pagamento", href: "/dev/fake-payment", icon: CreditCard, roles: ["admin"] },
  { label: "Sandbox Envio", href: "/dev/shipping-sandbox", icon: Truck, roles: ["admin"] },
];

export default function AdminSidebar() {
  const [location, navigate] = useLocation();
  const { hasRole } = useAdminAuth();

  const filteredItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((r) => hasRole(r as any));
  });

  const isActive = (href: string) => {
    if (href === "/") return location === "/" || location === "";
    return location.startsWith(href);
  };

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r bg-card min-h-screen">
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <Layers className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">Kairós Admin</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredItems.map((item) => (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className={cn(
              "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
              isActive(item.href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}

        {process.env.NODE_ENV !== "production" && (
          <div className="pt-3 mt-3 border-t">
            <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1">
              <FlaskConical className="h-3 w-3" /> Dev
            </p>
            {devItems
              .filter((item) => !item.roles || item.roles.some((r) => hasRole(r as any)))
              .map((item) => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
          </div>
        )}
      </nav>
    </aside>
  );
}
