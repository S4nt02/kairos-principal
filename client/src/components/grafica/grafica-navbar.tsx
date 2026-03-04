import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { CartDrawer } from "./cart-drawer";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface GraficaNavbarProps {
  breadcrumbs?: BreadcrumbItem[];
}

export function GraficaNavbar({ breadcrumbs = [] }: GraficaNavbarProps) {
  const [location] = useLocation();
  const { itemCount } = useCart();
  const { isAuthenticated, customer } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);

  const allCrumbs: BreadcrumbItem[] = [
    { label: "Gráfica", href: "/grafica" },
    ...breadcrumbs,
  ];

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between h-16"
        >
          {/* Left: back + logo */}
          <div className="flex items-center gap-4">
            <Link href="/">
              <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Voltar</span>
              </div>
            </Link>

            <div className="w-px h-5 bg-border" />

            <Link href="/grafica">
              <span className="font-display font-bold italic text-lg text-foreground cursor-pointer">
                Kairós
              </span>
            </Link>
          </div>

          {/* Center: breadcrumbs */}
          <div className="hidden md:flex items-center gap-1.5 text-sm">
            {allCrumbs.map((crumb, i) => {
              const isLast = i === allCrumbs.length - 1;
              return (
                <span key={crumb.label} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />}
                  {isLast || !crumb.href ? (
                    <span className={isLast ? "text-foreground font-medium" : "text-muted-foreground"}>
                      {crumb.label}
                    </span>
                  ) : (
                    <Link href={crumb.href}>
                      <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                        {crumb.label}
                      </span>
                    </Link>
                  )}
                </span>
              );
            })}
          </div>

          {/* Right: auth + cart */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/grafica/conta">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{customer?.name?.split(" ")[0]}</span>
                </span>
              </Link>
            ) : (
              <Link href="/grafica/login">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer hidden sm:inline">
                  Entrar
                </span>
              </Link>
            )}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </nav>
  );
}
