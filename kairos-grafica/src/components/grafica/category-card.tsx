import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { CategoryWithCount } from "@shared/types";

interface CategoryCardProps {
  category: CategoryWithCount;
  index: number;
}

export function CategoryCard({ category, index }: CategoryCardProps) {
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
      <Link href={`/grafica/${category.slug}`}>
        <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all duration-500 cursor-pointer">
          {/* Image area */}
          <div className="aspect-[4/3] bg-muted/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl font-display font-bold uppercase text-foreground/10 group-hover:text-foreground/20 transition-colors duration-500">
                {category.name.charAt(0)}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors duration-300">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {category.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-1">
                <span className="text-xs font-mono text-muted-foreground bg-muted/80 px-2 py-1 rounded-full">
                  {category.productCount} {category.productCount === 1 ? "produto" : "produtos"}
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
