import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, ShoppingCart, User, Search, X } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { CartDrawer } from "./cart-drawer";
import { formatCurrency } from "@/lib/grafica/price-engine";
import type { Product } from "@shared/schema";
import type { PriceRange } from "@shared/types";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface GraficaNavbarProps {
  breadcrumbs?: BreadcrumbItem[];
}

type SearchResult = Product & { priceRange: PriceRange };

export function GraficaNavbar({ breadcrumbs = [] }: GraficaNavbarProps) {
  const [location, setLocation] = useLocation();
  const { itemCount } = useCart();
  const { isAuthenticated, customer } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    if (searchOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    if (searchOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [searchOpen]);

  const { data: searchResults } = useQuery<SearchResult[]>({
    queryKey: ["/api/grafica/search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/grafica/search?q=${encodeURIComponent(debouncedQuery)}`);
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const handleResultClick = useCallback((slug: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setLocation(`/grafica/produto/${slug}`);
  }, [setLocation]);

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
              <img src="/logos/logo-tipografia-preto.png" alt="Kairós" className="h-5 w-auto cursor-pointer" />
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

          {/* Right: search + auth + cart */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative" ref={dropdownRef}>
              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 240, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 overflow-hidden"
                  >
                    <div className="relative">
                      <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar produtos..."
                        className="w-full pl-3 pr-8 py-1.5 text-sm rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                      />
                      <button
                        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Search dropdown results */}
                    {debouncedQuery.length >= 2 && (
                      <div className="absolute top-full mt-1 right-0 w-[280px] max-h-80 overflow-y-auto bg-background border border-border rounded-lg shadow-lg z-50">
                        {searchResults && searchResults.length > 0 ? (
                          searchResults.map((product) => (
                            <button
                              key={product.id}
                              onClick={() => handleResultClick(product.slug)}
                              className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                            >
                              <p className="text-sm font-medium truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {formatCurrency(product.priceRange.min)}
                                {product.priceRange.min !== product.priceRange.max && ` — ${formatCurrency(product.priceRange.max)}`}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center">
                            <p className="text-sm text-muted-foreground">Nenhum resultado encontrado</p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {!searchOpen && (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Search className="w-4.5 h-4.5" />
                </button>
              )}
            </div>

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
