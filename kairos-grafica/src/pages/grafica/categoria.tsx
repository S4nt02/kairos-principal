import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { ProductCard } from "@/components/grafica/product-card";
import { Footer } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryWithProducts } from "@shared/types";

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

interface GraficaCategoriaProps {
  slug: string;
}

function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
          <Skeleton className="aspect-[4/3]" />
          <div className="p-5 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <div className="flex justify-between items-center mt-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GraficaCategoria({ slug }: GraficaCategoriaProps) {
  const { data: category, isLoading, error } = useQuery<CategoryWithProducts>({
    queryKey: ["/api/grafica/categories", slug],
  });

  return (
    <div className="min-h-screen bg-background font-sans">
      {category && (
        <Helmet>
          <title>{category.name} | Kairós Gráfica</title>
          <meta name="description" content={category.description || `${category.name} — Impressos de alta qualidade na Gráfica Kairós`} />
          <meta property="og:title" content={`${category.name} | Kairós Gráfica`} />
          <meta property="og:description" content={category.description || `${category.name} — Gráfica Kairós`} />
        </Helmet>
      )}
      <GraficaNavbar
        breadcrumbs={
          category ? [{ label: category.name }] : []
        }
      />

      {/* Header */}
      <section className="pt-12 pb-10 md:pt-16 md:pb-14">
        <div className="container mx-auto px-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-5 w-96" />
            </div>
          ) : category ? (
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="max-w-3xl flex-1">
                <motion.span
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="text-primary font-mono text-xs uppercase tracking-[0.3em] block mb-4"
                >
                  Gráfica Kairós
                </motion.span>

                <motion.h1
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
                  className="text-3xl md:text-5xl font-display font-bold tracking-tight"
                >
                  {category.name}
                </motion.h1>

                {category.description && (
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
                    className="text-lg text-muted-foreground mt-4 font-display"
                  >
                    {category.description}
                  </motion.p>
                )}
              </div>
              {category.imageUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
                  className="w-full md:w-48 h-32 md:h-32 rounded-xl overflow-hidden border border-border/50 flex-shrink-0"
                >
                  <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover" />
                </motion.div>
              )}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Categoria não encontrada.</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Products Grid */}
      <section className="pb-24 md:pb-32">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
          >
            <div className="flex items-center gap-4 mb-10">
              <h2 className="text-xl font-display font-bold">
                Produtos
                {category && (
                  <span className="text-muted-foreground font-normal ml-2 text-base">
                    ({category.products.length})
                  </span>
                )}
              </h2>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {isLoading ? (
              <ProductsSkeleton />
            ) : category && category.products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.products.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} />
                ))}
              </div>
            ) : !error ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">
                  Nenhum produto disponível nesta categoria.
                </p>
              </div>
            ) : null}
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
