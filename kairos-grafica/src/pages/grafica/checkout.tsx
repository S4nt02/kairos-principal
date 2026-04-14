import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  MapPin, Truck, CreditCard, Check, ChevronRight,
  Loader2, ArrowLeft, ExternalLink, AlertCircle, Tag, X,
  MessageCircle,
} from "lucide-react";
import { Link } from "wouter";
import { GraficaNavbar } from "@/components/grafica/grafica-navbar";
import { Footer } from "@/components/layout";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/grafica/price-engine";
import { apiRequest } from "@/lib/queryClient";
import type { ShippingQuote } from "@shared/types";
import type { Address } from "@shared/schema";
import { cn } from "@/lib/utils";
import { trackBeginCheckout } from "@/hooks/use-analytics";

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

type Step = "address" | "shipping" | "review";
const STEPS: { key: Step; label: string; icon: typeof MapPin }[] = [
  { key: "address", label: "Endereço", icon: MapPin },
  { key: "shipping", label: "Frete", icon: Truck },
  { key: "review", label: "Pagamento", icon: CreditCard },
];

interface AddressForm {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export default function GraficaCheckout() {
  const [, setLocation] = useLocation();
  const { cart, sessionId, isLoading: cartLoading } = useCart();
  const { isAuthenticated, customer } = useAuth();
  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState<AddressForm>({
    cep: "", street: "", number: "", complement: "",
    neighborhood: "", city: "", state: "",
  });
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/grafica/login?redirect=/grafica/checkout");
    }
  }, [isAuthenticated, setLocation]);

  // Pre-fill customer data from auth
  useEffect(() => {
    if (customer) {
      if (!customerName) setCustomerName(customer.name);
      if (!customerEmail) setCustomerEmail(customer.email);
      if (!customerPhone && customer.phone) setCustomerPhone(customer.phone);
    }
  }, [customer]);
  const [selectedShipping, setSelectedShipping] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [lookingUpCep, setLookingUpCep] = useState(false);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState("");

  const [useSavedAddress, setUseSavedAddress] = useState<string | null>(null);

  // Saved addresses
  const { data: savedAddresses } = useQuery<Address[]>({
    queryKey: ["/api/grafica/account/addresses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/grafica/account/addresses");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Payment mode config
  const { data: paymentConfig } = useQuery<{ mode: string }>({
    queryKey: ["/api/config/payment-mode"],
    queryFn: async () => {
      const res = await fetch("/api/config/payment-mode");
      return res.json();
    },
  });
  const isWhatsApp = paymentConfig?.mode === "whatsapp";

  const selectSavedAddress = useCallback((addr: Address) => {
    setUseSavedAddress(addr.id);
    setAddress({
      cep: addr.cep, street: addr.street, number: addr.number,
      complement: addr.complement || "", neighborhood: addr.neighborhood,
      city: addr.city, state: addr.state,
    });
  }, []);

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;

  // Shipping quotes
  const { data: shippingQuotes, isError: shippingError, isLoading: shippingLoading } = useQuery<ShippingQuote[]>({
    queryKey: ["/api/grafica/shipping/quote", address.cep, sessionId],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/grafica/shipping/quote", {
        cep: address.cep,
        sessionId,
      });
      return res.json();
    },
    enabled: step === "shipping" && address.cep.length >= 8,
  });

  const shippingCost = selectedShipping !== null && shippingQuotes
    ? shippingQuotes[selectedShipping]?.price ?? 0
    : 0;
  const total = subtotal - couponDiscount + shippingCost;

  // CEP lookup
  const lookupCep = useCallback(async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setLookingUpCep(true);
    try {
      const res = await fetch(`/api/grafica/address/${clean}`);
      if (res.ok) {
        const data = await res.json();
        setAddress((prev) => ({
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

  // Coupon apply
  const applyCoupon = useCallback(async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponValidating(true);
    setCouponError("");
    setCouponMessage("");
    try {
      const res = await apiRequest("POST", "/api/grafica/coupons/validate", { code, subtotal });
      const data = await res.json();
      if (data.valid) {
        setCouponCode(data.code);
        setCouponDiscount(data.discountAmount);
        setCouponMessage(data.message);
        setCouponError("");
      } else {
        setCouponError(data.message || "Cupom inválido");
      }
    } catch {
      setCouponError("Erro ao validar cupom");
    }
    setCouponValidating(false);
  }, [couponInput, subtotal]);

  const removeCoupon = useCallback(() => {
    setCouponCode(null);
    setCouponDiscount(0);
    setCouponMessage("");
    setCouponError("");
    setCouponInput("");
  }, []);

  // Checkout mutation — creates order + MP preference, then redirects to MercadoPago
  const checkout = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/grafica/checkout", {
        sessionId,
        customerName,
        customerEmail,
        customerPhone,
        address,
        shippingOption: shippingQuotes?.[selectedShipping ?? 0],
        notes,
        couponCode: couponCode || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.paymentMode === "whatsapp") {
        // Build WhatsApp message
        const lines: string[] = [];
        lines.push(`*NOVO PEDIDO #${data.orderId.slice(0, 8).toUpperCase()}*`);
        lines.push(`Cliente: ${data.customerName}`);
        lines.push("");
        lines.push("*Itens:*");
        for (const item of data.itemsSummary) {
          lines.push(`- ${item.name} (${item.quantity.toLocaleString("pt-BR")}x R$ ${item.unitPrice.toFixed(2)}) = R$ ${item.subtotal.toFixed(2)}`);
        }
        lines.push("");
        lines.push(`*Subtotal:* R$ ${data.subtotal.toFixed(2)}`);
        if (data.discountAmount > 0) {
          lines.push(`*Desconto${data.couponCode ? ` (${data.couponCode})` : ""}:* -R$ ${data.discountAmount.toFixed(2)}`);
        }
        if (data.shippingCost > 0) {
          lines.push(`*Frete:* R$ ${data.shippingCost.toFixed(2)}${data.shippingService ? ` (${data.shippingService})` : ""}`);
        }
        lines.push(`*TOTAL: R$ ${data.total.toFixed(2)}*`);

        if (data.address) {
          lines.push("");
          lines.push("*Endereço de entrega:*");
          lines.push(`${data.address.street}, ${data.address.number}${data.address.complement ? ` - ${data.address.complement}` : ""}`);
          lines.push(`${data.address.neighborhood} — ${data.address.city}/${data.address.state}`);
          lines.push(`CEP: ${data.address.cep}`);
        }

        lines.push("");
        lines.push("Aguardo confirmação do pagamento via Pix.");

        const text = encodeURIComponent(lines.join("\n"));
        const waUrl = `https://wa.me/${data.whatsappNumber}?text=${text}`;
        window.open(waUrl, "_blank");
        setLocation(`/grafica/pedido/${data.orderId}?source=whatsapp`);
      } else if (data.initPoint) {
        // Redirect to MercadoPago Checkout Pro
        window.location.href = data.initPoint;
      } else if (data.sandboxInitPoint) {
        // Fallback to sandbox URL
        window.location.href = data.sandboxInitPoint;
      } else if (data.orderId) {
        // If MP preference failed, go to order page
        setLocation(`/grafica/pedido/${data.orderId}?mp_status=error`);
      }
    },
  });

  const canProceed = () => {
    if (step === "address") {
      return customerName && customerEmail && address.cep && address.street && address.number && address.neighborhood && address.city && address.state;
    }
    if (step === "shipping") return selectedShipping !== null;
    if (step === "review") return true;
    return false;
  };

  const nextStep = () => {
    if (step === "address") setStep("shipping");
    else if (step === "shipping") {
      setStep("review");
      trackBeginCheckout(subtotal);
    }
    else if (step === "review") checkout.mutate();
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  if (cartLoading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <GraficaNavbar breadcrumbs={[{ label: "Checkout" }]} />
        <div className="container mx-auto px-6 pt-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <GraficaNavbar breadcrumbs={[{ label: "Checkout" }]} />
        <div className="container mx-auto px-6 pt-16 pb-24 text-center">
          <p className="text-muted-foreground text-lg">Seu carrinho está vazio.</p>
          <Link href="/grafica">
            <button className="mt-4 px-6 py-2 bg-foreground text-background rounded-full text-sm hover:bg-primary transition-colors">
              Ver catálogo
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <GraficaNavbar breadcrumbs={[{ label: "Checkout" }]} />

      <div className="container mx-auto px-6 pt-8 pb-24">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === currentStepIndex;
            const isDone = i < currentStepIndex;
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground/30" />}
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  isActive && "bg-primary/10 text-primary",
                  isDone && "text-green-500",
                  !isActive && !isDone && "text-muted-foreground",
                )}>
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form area */}
          <div className="lg:col-span-2">
            <motion.div
              key={step}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              {/* ADDRESS STEP */}
              {step === "address" && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-display font-bold">Dados de Entrega</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-foreground block mb-1.5">Nome completo</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors"
                        placeholder="Seu nome completo"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">E-mail</label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Telefone</label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors"
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  {/* Saved addresses selector */}
                  {savedAddresses && savedAddresses.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground block">Endereços salvos</label>
                      <div className="space-y-2">
                        {savedAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            onClick={() => selectSavedAddress(addr)}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-all",
                              useSavedAddress === addr.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50",
                            )}
                          >
                            <p className="text-sm font-medium">{addr.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""} — {addr.city}/{addr.state}
                            </p>
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setUseSavedAddress(null);
                            setAddress({ cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
                          }}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all text-sm",
                            useSavedAddress === null
                              ? "border-primary bg-primary/5 font-medium"
                              : "border-border hover:border-primary/50 text-muted-foreground",
                          )}
                        >
                          Usar outro endereço
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Manual address form (shown if no saved addresses or "usar outro" selected) */}
                  {(!savedAddresses || savedAddresses.length === 0 || useSavedAddress === null) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">CEP</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={address.cep}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                            setAddress((p) => ({ ...p, cep: v }));
                            if (v.length === 8) lookupCep(v);
                          }}
                          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors font-mono"
                          placeholder="00000-000"
                          maxLength={9}
                        />
                        {lookingUpCep && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                        )}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-foreground block mb-1.5">Rua</label>
                      <input
                        type="text"
                        value={address.street}
                        onChange={(e) => setAddress((p) => ({ ...p, street: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Número</label>
                      <input
                        type="text"
                        value={address.number}
                        onChange={(e) => setAddress((p) => ({ ...p, number: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Complemento</label>
                      <input
                        type="text"
                        value={address.complement}
                        onChange={(e) => setAddress((p) => ({ ...p, complement: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors"
                        placeholder="Apto, sala, bloco..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Bairro</label>
                      <input
                        type="text"
                        value={address.neighborhood}
                        onChange={(e) => setAddress((p) => ({ ...p, neighborhood: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Cidade</label>
                      <input
                        type="text"
                        value={address.city}
                        onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-1.5">Estado</label>
                      <input
                        type="text"
                        value={address.state}
                        onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors font-mono"
                        placeholder="SP"
                        maxLength={2}
                      />
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* SHIPPING STEP */}
              {step === "shipping" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setStep("address")} className="p-1 rounded hover:bg-muted transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h2 className="text-2xl font-display font-bold">Frete</h2>
                  </div>

                  <div className="rounded-lg border border-border/50 p-4 bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Entrega para: <span className="text-foreground font-medium">{address.street}, {address.number} - {address.city}/{address.state}</span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    {shippingQuotes ? shippingQuotes.map((quote, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedShipping(i)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-200 text-left",
                          selectedShipping === i
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Truck className={cn(
                            "w-5 h-5",
                            selectedShipping === i ? "text-primary" : "text-muted-foreground",
                          )} />
                          <div>
                            <p className="font-medium text-sm">
                              {quote.carrier} - {quote.service}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Entrega em até {quote.deliveryDays} dias úteis
                            </p>
                          </div>
                        </div>
                        <span className={cn(
                          "font-bold font-mono",
                          selectedShipping === i ? "text-primary" : "text-foreground",
                        )}>
                          {formatCurrency(quote.price)}
                        </span>
                      </button>
                    )) : shippingError ? (
                      <div className="text-center py-8">
                        <AlertCircle className="w-6 h-6 mx-auto text-red-500 mb-2" />
                        <p className="text-sm text-red-500">Erro ao calcular frete. Tente novamente.</p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                        <p className="text-sm text-muted-foreground">Calculando frete...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* REVIEW & PAY STEP */}
              {step === "review" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setStep("shipping")} className="p-1 rounded hover:bg-muted transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h2 className="text-2xl font-display font-bold">Revisar e Pagar</h2>
                  </div>

                  {/* Order review */}
                  <div className="rounded-lg border border-border/50 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Endereço de entrega</p>
                        <p className="text-xs text-muted-foreground">
                          {address.street}, {address.number}
                          {address.complement ? ` - ${address.complement}` : ""}
                          <br />
                          {address.neighborhood} - {address.city}/{address.state} - CEP {address.cep}
                        </p>
                      </div>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-start gap-3">
                      <Truck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Frete</p>
                        <p className="text-xs text-muted-foreground">
                          {shippingQuotes?.[selectedShipping ?? 0]?.carrier} - {shippingQuotes?.[selectedShipping ?? 0]?.service}
                          {" "}({shippingQuotes?.[selectedShipping ?? 0]?.deliveryDays} dias úteis)
                          {" — "}{formatCurrency(shippingCost)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">
                      Observações <span className="text-muted-foreground font-normal">(opcional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors resize-none"
                      placeholder="Instruções especiais para o pedido..."
                    />
                  </div>

                  {/* Coupon */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">
                      Cupom de desconto <span className="text-muted-foreground font-normal">(opcional)</span>
                    </label>
                    {couponCode ? (
                      <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-2.5">
                        <Tag className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-green-500 flex-1">
                          {couponCode} — {couponMessage}
                        </span>
                        <button onClick={removeCoupon} className="p-1 rounded hover:bg-muted transition-colors">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors font-mono uppercase"
                          placeholder="CODIGO"
                        />
                        <button
                          onClick={applyCoupon}
                          disabled={couponValidating || !couponInput.trim()}
                          className="px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50"
                        >
                          {couponValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                        </button>
                      </div>
                    )}
                    {couponError && (
                      <p className="text-xs text-red-500">{couponError}</p>
                    )}
                  </div>

                  {/* Payment info */}
                  {isWhatsApp ? (
                    <div className="rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-[#25D366]" />
                        <p className="font-medium text-sm">Pagamento via WhatsApp + Pix</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Ao clicar em "Finalizar no WhatsApp", seu pedido será criado e você será direcionado ao
                        nosso WhatsApp com os dados do pedido. Enviaremos a <strong>chave Pix</strong> para pagamento
                        e confirmaremos assim que identificarmos o depósito.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-500" />
                        <p className="font-medium text-sm">Pagamento via Mercado Pago</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Ao clicar em "Pagar com Mercado Pago", você será redirecionado para o ambiente seguro do
                        Mercado Pago onde poderá escolher entre <strong>Pix</strong>, <strong>Cartão de Crédito</strong>,
                        {" "}<strong>Boleto</strong> ou <strong>Saldo em conta</strong>.
                      </p>
                    </div>
                  )}

                  {/* Error display */}
                  {checkout.isError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-500">Erro ao processar pedido</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {checkout.error?.message || "Ocorreu um erro. Tente novamente."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between mt-8">
                {step !== "address" ? (
                  <button
                    onClick={() => {
                      if (step === "shipping") setStep("address");
                      if (step === "review") setStep("shipping");
                    }}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                  </button>
                ) : (
                  <div />
                )}

                <button
                  onClick={nextStep}
                  disabled={!canProceed() || checkout.isPending}
                  className={cn(
                    "px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2 transition-all",
                    canProceed()
                      ? step === "review"
                        ? isWhatsApp
                          ? "bg-[#25D366] text-white hover:bg-[#1da851]"
                          : "bg-[#009ee3] text-white hover:bg-[#0085c5]"
                        : "bg-foreground text-background hover:bg-primary"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                >
                  {checkout.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isWhatsApp ? "Criando pedido..." : "Redirecionando..."}
                    </>
                  ) : step === "review" ? (
                    isWhatsApp ? (
                      <>
                        Finalizar no WhatsApp
                        <MessageCircle className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Pagar com Mercado Pago
                        <ExternalLink className="w-4 h-4" />
                      </>
                    )
                  ) : (
                    <>
                      Continuar
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>

          {/* Order summary sidebar */}
          <div>
            <div className="lg:sticky lg:top-24 rounded-xl border border-border/50 p-5 space-y-4">
              <h3 className="font-display font-bold">Resumo</h3>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-2 text-sm">
                    <div className="w-10 h-10 rounded bg-muted/30 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary/20">
                        {item.product?.name?.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-xs">{item.product?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity.toLocaleString("pt-BR")} un.
                      </p>
                    </div>
                    <span className="font-mono text-xs shrink-0">
                      {formatCurrency(parseFloat(item.unitPrice) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-green-500">Desconto ({couponCode})</span>
                    <span className="font-mono text-green-500">-{formatCurrency(couponDiscount)}</span>
                  </div>
                )}
                {shippingCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frete</span>
                    <span className="font-mono">{formatCurrency(shippingCost)}</span>
                  </div>
                )}
              </div>

              <div className="h-px bg-border" />

              <div className="flex justify-between">
                <span className="font-display font-bold">Total</span>
                <span className="text-xl font-bold text-primary font-mono">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
