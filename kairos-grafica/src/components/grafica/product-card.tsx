import { Link } from "wouter";
import { motion } from "framer-motion";
import type { Product } from "@shared/schema";
import type { PriceRange } from "@shared/types";

interface ProductCardProps {
  product: Product & { priceRange: PriceRange };
  index: number;
}

function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ProductCard({ product, index }: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.6,
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all duration-500">
        {/* Image area */}
        <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl font-display font-bold uppercase text-foreground/10 group-hover:text-foreground/20 transition-colors duration-500">
                  {product.name.charAt(0)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="font-display font-bold text-foreground group-hover:text-primary transition-colors duration-300">
            {product.name}
          </h3>

          {product.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground">A partir de</span>
              <p className="text-lg font-bold text-primary">
                {formatPrice(product.priceRange.min)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ un.</span>
              </p>
            </div>

            <Link href={`/grafica/produto/${product.slug}`}>
              <button className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-full hover:bg-primary transition-colors duration-300">
                Configurar
              </button>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
