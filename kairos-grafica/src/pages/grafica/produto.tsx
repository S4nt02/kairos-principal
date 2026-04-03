import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ShoppingCart, Check, ArrowLeft } from "lucide-react";
import { trackAddToCart } from "@/hooks/use-analytics";
import { Link } from "wouter";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { QuantitySelector } from "@/components/grafica/quantity-selector";
import { PaperSelector } from "@/components/grafica/paper-selector";
import { FinishingSelector } from "@/components/grafica/finishing-selector";
import { ColorSelector } from "@/components/grafica/color-selector";
import { FileUploader } from "@/components/grafica/file-uploader";
import { PriceDisplay } from "@/components/grafica/price-display";
import { CartDrawer } from "@/components/grafica/cart-drawer";
import { Footer } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/use-cart";
import { calculatePrice, getQuantitySteps, formatCurrency } from "@/lib/grafica/price-engine";
import type { ProductWithDetails } from "@shared/types";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

interface GraficaProdutoProps {
  slug: string;
}

export default function GraficaProduto({ slug }: GraficaProdutoProps) {
  const { data: product, isLoading, error } = useQuery<ProductWithDetails>({
    queryKey: ["/api/grafica/products", slug],
  });

  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [selectedFinishings, setSelectedFinishings] = useState<string[]>([]);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(0);
  const [selectedColors, setSelectedColors] = useState<"4x0" | "4x1" | "4x4">("4x0");
  const [artFile, setArtFile] = useState<File | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const { addItem, itemCount } = useCart();

  // Auto-select defaults when product loads
  const initialized = useMemo(() => {
    if (!product) return false;
    if (selectedQuantity === 0) {
      const steps = getQuantitySteps(product);
      setSelectedQuantity(steps[0]);
    }
    if (!selectedPaper && product.availablePapers.length > 0) {
      setSelectedPaper(product.availablePapers[0].id);
    }
    return true;
  }, [product, selectedQuantity, selectedPaper]);

  const selectedVariant = useMemo(() => {
    if (!product || !selectedPaper) return null;
    return (
      product.variants.find(
        (v) =>
          v.paperTypeId === selectedPaper &&
          (selectedFinishings.length === 0 || selectedFinishings.includes(v.finishingId ?? "")),
      ) ?? product.variants.find((v) => v.paperTypeId === selectedPaper) ?? product.variants[0] ?? null
    );
  }, [product, selectedPaper, selectedFinishings]);

  const selectedFinishingObjects = useMemo(() => {
    if (!product) return [];
    return product.availableFinishings.filter((f) => selectedFinishings.includes(f.id));
  }, [product, selectedFinishings]);

  const price = useMemo(() => {
    if (!product) return null;
    return calculatePrice({
      quantity: selectedQuantity || product.minQuantity,
      variant: selectedVariant,
      finishings: selectedFinishingObjects,
      priceRules: product.priceRules,
    });
  }, [product, selectedQuantity, selectedVariant, selectedFinishingObjects]);

  const handleAddToCart = useCallback(() => {
    if (!product || !price) return;

    const specs: Record<string, string> = {};
    const paper = product.availablePapers.find((p) => p.id === selectedPaper);
    if (paper) specs["Papel"] = paper.name;
    if (selectedFinishingObjects.length > 0) {
      specs["Acabamento"] = selectedFinishingObjects.map((f) => f.name).join(", ");
    }
    specs["Cores"] = selectedColors;

    addItem.mutate(
      {
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity: selectedQuantity,
        unitPrice: price.unitPrice.toFixed(4),
        specifications: specs,
      },
      {
        onSuccess: () => {
          setAddedToCart(true);
          setTimeout(() => setAddedToCart(false), 2000);
          trackAddToCart(product!.id, price!.unitPrice * selectedQuantity);
        },
      },
    );
  }, [product, price, selectedPaper, selectedVariant, selectedQuantity, selectedColors, selectedFinishingObjects, addItem]);

  const seoTitle = product?.seoTitle || product?.name;
  const seoDescription = product?.seoDescription || product?.description || `${product?.name} — Gráfica Kairós`;

  const jsonLd = product ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.name,
    image: product.imageUrl || undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BRL",
      lowPrice: product.priceRange.min,
      highPrice: product.priceRange.max,
      availability: "https://schema.org/InStock",
    },
  } : null;

  return (
    <div className="min-h-screen bg-background font-sans">
      {product && (
        <Helmet>
          <title>{seoTitle} | Kairós Gráfica</title>
          <meta name="description" content={seoDescription!} />
          <meta property="og:title" content={`${seoTitle} | Kairós Gráfica`} />
          <meta property="og:description" content={seoDescription!} />
          {product.imageUrl && <meta property="og:image" content={product.imageUrl} />}
          <meta property="og:type" content="product" />
          {jsonLd && (
            <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
          )}
        </Helmet>
      )}
      <GraficaNavbar
        breadcrumbs={
          product
            ? [
                { label: product.category.name, href: `/grafica/${product.category.slug}` },
                { label: product.name },
              ]
            : []
        }
      />

      {isLoading ? (
        <div className="container mx-auto px-6 pt-12 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            <div className="lg:col-span-3 space-y-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-96" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <div className="lg:col-span-2">
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        </div>
      ) : error || !product ? (
        <div className="container mx-auto px-6 pt-16 pb-24 text-center">
          <p className="text-muted-foreground text-lg">Produto não encontrado.</p>
          <Link href="/grafica">
            <button className="mt-4 px-6 py-2 bg-foreground text-background rounded-full text-sm hover:bg-primary transition-colors">
              Voltar ao catálogo
            </button>
          </Link>
        </div>
      ) : (
        <div className="container mx-auto px-6 pt-8 pb-24">
          {/* Back link */}
          <Link href={`/grafica/${product.category.slug}`}>
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              {product.category.name}
            </div>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            {/* Left: Product info + configurator */}
            <div className="lg:col-span-3 space-y-8">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                <span className="text-primary font-mono text-xs uppercase tracking-[0.3em] block mb-3">
                  Configurar Pedido
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
                  {product.name}
                </h1>
                {product.description && (
                  <p className="text-muted-foreground mt-3 max-w-xl">{product.description}</p>
                )}
              </motion.div>

              {/* Product image area */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
                className="aspect-[16/9] bg-muted/30 rounded-xl relative overflow-hidden border border-border/50"
              >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-8xl font-display font-bold uppercase text-foreground/10">
                        {product.name.charAt(0)}
                      </span>
                    </div>
                  </>
                )}
                {selectedVariant && (
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    <span className="text-xs font-mono bg-background/90 backdrop-blur px-2 py-1 rounded">
                      {selectedVariant.widthMm}x{selectedVariant.heightMm}mm
                    </span>
                    <span className="text-xs font-mono bg-background/90 backdrop-blur px-2 py-1 rounded">
                      SKU: {selectedVariant.sku}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Configuration options */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
                className="space-y-6"
              >
                <QuantitySelector
                  steps={getQuantitySteps(product)}
                  value={selectedQuantity}
                  onChange={setSelectedQuantity}
                />

                <PaperSelector
                  papers={product.availablePapers}
                  value={selectedPaper}
                  onChange={setSelectedPaper}
                />

                <ColorSelector value={selectedColors} onChange={setSelectedColors} />

                {product.availableFinishings.length > 0 && (
                  <FinishingSelector
                    finishings={product.availableFinishings}
                    selected={selectedFinishings}
                    onChange={setSelectedFinishings}
                  />
                )}

                <FileUploader file={artFile} onFileSelect={setArtFile} />
              </motion.div>
            </div>

            {/* Right: Price summary + add to cart (sticky) */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
                className="lg:sticky lg:top-24 space-y-4"
              >
                {price && (
                  <PriceDisplay
                    unitPrice={price.unitPrice}
                    totalPrice={price.totalPrice}
                    quantity={selectedQuantity}
                    setupFee={price.setupFee}
                  />
                )}

                {/* Specifications summary */}
                <div className="rounded-xl border border-border/50 p-4 space-y-2">
                  <h3 className="text-sm font-medium text-foreground">Resumo</h3>
                  <div className="space-y-1.5 text-sm">
                    {selectedPaper && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Papel</span>
                        <span className="font-medium">
                          {product.availablePapers.find((p) => p.id === selectedPaper)?.name}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cores</span>
                      <span className="font-medium font-mono">{selectedColors}</span>
                    </div>
                    {selectedFinishingObjects.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Acabamento</span>
                        <span className="font-medium text-right">
                          {selectedFinishingObjects.map((f) => f.name).join(", ")}
                        </span>
                      </div>
                    )}
                    {selectedVariant && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Formato</span>
                        <span className="font-medium font-mono">
                          {selectedVariant.widthMm}x{selectedVariant.heightMm}mm
                        </span>
                      </div>
                    )}
                    {artFile && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Arte</span>
                        <span className="font-medium text-green-500 truncate ml-4">{artFile.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add to cart button */}
                <button
                  onClick={handleAddToCart}
                  disabled={addItem.isPending || addedToCart}
                  className={cn(
                    "w-full py-3.5 rounded-full font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300",
                    addedToCart
                      ? "bg-green-500 text-white"
                      : "bg-foreground text-background hover:bg-primary",
                  )}
                >
                  {addedToCart ? (
                    <>
                      <Check className="w-4 h-4" />
                      Adicionado!
                    </>
                  ) : addItem.isPending ? (
                    "Adicionando..."
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Adicionar ao Carrinho
                    </>
                  )}
                </button>

                {/* Cart preview */}
                {itemCount > 0 && (
                  <button
                    onClick={() => setCartOpen(true)}
                    className="w-full py-2.5 rounded-full text-sm border border-border hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Ver carrinho ({itemCount})
                  </button>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
