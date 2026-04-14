/**
 * Melhor Envio Shipping Service
 *
 * Integrates with Melhor Envio API v2 for real-time shipping quotes.
 * Falls back to mock data when MELHOR_ENVIO_TOKEN is not set (dev mode).
 *
 * API docs: https://docs.melhorenvio.com.br
 *
 * Flow:
 * 1. calculatePackage(items) — computes package dimensions/weight from cart items
 * 2. calculateShipping(input) — calls Melhor Envio API for quotes
 * 3. addToMelhorEnvioCart / checkoutShipment / generateLabel / getLabelUrl — label generation (admin)
 */

import { storage } from "../storage";
import type { CartItem, Order, OrderItem } from "../../shared/schema";

// ── Config ──

// In dev: prefer MELHOR_ENVIO_SANDBOX_TOKEN; fallback to MELHOR_ENVIO_TOKEN
// In prod: always use MELHOR_ENVIO_TOKEN (sandbox token is ignored)
const IS_PROD = process.env.NODE_ENV === "production";
const SANDBOX_TOKEN = process.env.MELHOR_ENVIO_SANDBOX_TOKEN || "";
const PROD_TOKEN = process.env.MELHOR_ENVIO_TOKEN || "";
const MELHOR_ENVIO_TOKEN = IS_PROD ? PROD_TOKEN : (SANDBOX_TOKEN || PROD_TOKEN);
const IS_SANDBOX = !IS_PROD && !!SANDBOX_TOKEN;

const WAREHOUSE_CEP = process.env.WAREHOUSE_CEP || "01001000";
const BASE_URL = IS_SANDBOX
  ? "https://sandbox.melhorenvio.com.br"
  : "https://melhorenvio.com.br";

export function getMelhorEnvioStatus() {
  return {
    mode: IS_SANDBOX ? "sandbox" : IS_PROD ? "production" : "mock",
    hasToken: !!MELHOR_ENVIO_TOKEN,
    baseUrl: BASE_URL,
    sandboxToken: SANDBOX_TOKEN ? `${SANDBOX_TOKEN.substring(0, 8)}...` : null,
    prodToken: PROD_TOKEN ? `${PROD_TOKEN.substring(0, 8)}...` : null,
  };
}

// ── OAuth2 Token Refresh ──

/**
 * Refreshes the Melhor Envio OAuth2 access token using a refresh token.
 * Only used in sandbox mode for dev testing.
 */
export async function refreshMelhorEnvioToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID || "";
  const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "User-Agent": "Kairos Grafica (contato@kairos.com.br)",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }).toString(),
    });
    if (!response.ok) return null;
    return await response.json() as { access_token: string; refresh_token: string; expires_in: number };
  } catch {
    return null;
  }
}

// ── Types ──

interface PackageDimensions {
  weightKg: number;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
}

export interface ShippingQuoteResult {
  carrier: string;
  service: string;
  price: number;
  deliveryDays: number;
  melhorEnvioId?: number;
}

interface CalculateShippingInput {
  destinationCep: string;
  items: CartItem[];
  insuredValue?: number;
  overrideToken?: string;
  overrideBaseUrl?: string;
}

interface MelhorEnvioQuote {
  id: number;
  name: string;
  price: string;
  discount: string;
  currency: string;
  delivery_time: number;
  delivery_range: { min: number; max: number };
  company: { id: number; name: string; picture: string };
  error?: string;
}

// ── Mock Data ──

const MOCK_QUOTES: ShippingQuoteResult[] = [
  { carrier: "Correios", service: "PAC", price: 18.9, deliveryDays: 8 },
  { carrier: "Correios", service: "SEDEX", price: 32.5, deliveryDays: 3 },
  { carrier: "Jadlog", service: ".Package", price: 22.4, deliveryDays: 5 },
];

// ── Package Calculation ──

/**
 * Calculates package dimensions and weight from cart items.
 * Resolves variant dimensions and paper weight from DB.
 *
 * Weight formula: (weightGsm × area_m² × quantity) / 1000 = kg
 * Dimensions: largest width/height from items + packaging margin
 * Height: stacked sheet thickness + 2cm packaging
 */
export async function calculatePackage(
  items: CartItem[],
): Promise<PackageDimensions> {
  if (items.length === 0) {
    // Default package: ~1000 sheets of A4 90gsm
    return { weightKg: 5.0, widthCm: 23, heightCm: 12, lengthCm: 34 };
  }

  const allPaperTypes = await storage.getPaperTypes();
  const paperMap = new Map(allPaperTypes.map((p) => [p.id, p]));

  let totalWeightKg = 0;
  let maxWidthMm = 0;
  let maxHeightMm = 0;
  let totalThicknessMm = 0;

  for (const item of items) {
    let widthMm = 210; // A4 default
    let heightMm = 297;
    let weightGsm = 90; // default

    if (item.variantId) {
      const variants = await storage.getProductVariants(item.productId);
      const variant = variants.find((v) => v.id === item.variantId);
      if (variant) {
        widthMm = variant.widthMm;
        heightMm = variant.heightMm;

        const paper = paperMap.get(variant.paperTypeId);
        if (paper) {
          weightGsm = paper.weightGsm;
        }
      }
    }

    // Weight: gsm × area_m² × qty / 1000 = kg
    const areaSqM = (widthMm / 1000) * (heightMm / 1000);
    const itemWeightKg = (weightGsm * areaSqM * item.quantity) / 1000;
    totalWeightKg += itemWeightKg;

    // Track max dimensions
    if (widthMm > maxWidthMm) maxWidthMm = widthMm;
    if (heightMm > maxHeightMm) maxHeightMm = heightMm;

    // Approximate sheet thickness: ~0.1mm per sheet for 90gsm, scales with weight
    const sheetThicknessMm = (weightGsm / 900) * item.quantity;
    totalThicknessMm += sheetThicknessMm;
  }

  // Convert to cm and add packaging margin
  const widthCm = Math.ceil(maxWidthMm / 10) + 2; // +2cm packaging
  const lengthCm = Math.ceil(maxHeightMm / 10) + 2;
  const heightCm = Math.max(Math.ceil(totalThicknessMm / 10) + 2, 4); // min 4cm with packaging

  // Apply Melhor Envio minimums
  return {
    weightKg: Math.max(totalWeightKg, 0.3), // min 300g
    widthCm: Math.max(widthCm, 11),
    heightCm: Math.max(heightCm, 2),
    lengthCm: Math.max(lengthCm, 16),
  };
}

// ── Shipping Calculation ──

/**
 * Calculates shipping quotes via Melhor Envio API.
 * Falls back to mock data if token is not set or API fails.
 */
export async function calculateShipping(
  input: CalculateShippingInput,
): Promise<ShippingQuoteResult[]> {
  const activeToken = input.overrideToken || MELHOR_ENVIO_TOKEN;
  const activeUrl = input.overrideBaseUrl || BASE_URL;

  if (!activeToken) {
    console.log("[Shipping] No token set, returning mock quotes");
    return MOCK_QUOTES;
  }

  console.log(`[Shipping] Using ${activeUrl} (token: ${activeToken.substring(0, 8)}...)`);
  const pkg = await calculatePackage(input.items);

  // Calculate insured value from cart items if not provided
  const insuredValue =
    input.insuredValue ??
    input.items.reduce(
      (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
      0,
    );

  const body = {
    from: { postal_code: WAREHOUSE_CEP },
    to: { postal_code: input.destinationCep },
    package: {
      weight: pkg.weightKg,
      width: pkg.widthCm,
      height: pkg.heightCm,
      length: pkg.lengthCm,
    },
    options: {
      insurance_value: Math.max(insuredValue, 1),
      receipt: false,
      own_hand: false,
    },
  };

  try {
    console.log("[Shipping] Calling Melhor Envio API:", JSON.stringify(body));

    const response = await fetch(`${activeUrl}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeToken}`,
        "User-Agent": "Kairos Grafica (contato@kairos.com.br)",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Shipping] Melhor Envio API error ${response.status}:`, text);
      return MOCK_QUOTES;
    }

    const data = (await response.json()) as MelhorEnvioQuote[];

    // Filter valid quotes (no errors) and map to our format
    const quotes: ShippingQuoteResult[] = data
      .filter((q) => !q.error && q.price)
      .map((q) => ({
        carrier: q.company.name,
        service: q.name,
        price: parseFloat(q.price) - parseFloat(q.discount || "0"),
        deliveryDays: q.delivery_range?.max ?? q.delivery_time,
        melhorEnvioId: q.id,
      }))
      .sort((a, b) => a.price - b.price);

    if (quotes.length === 0) {
      console.warn("[Shipping] No valid quotes returned, using mock data");
      return MOCK_QUOTES;
    }

    console.log(`[Shipping] Got ${quotes.length} valid quotes`);
    return quotes;
  } catch (err: any) {
    console.error("[Shipping] API call failed:", err?.message || err);
    return MOCK_QUOTES;
  }
}

// ── Label Generation (Admin Flow) ──

/**
 * Adds a shipment to the Melhor Envio cart for label purchase.
 */
// Warehouse config (from) — used for label generation
// Set env vars for real data; defaults are sandbox-safe placeholders
const WAREHOUSE_FROM = {
  name: process.env.WAREHOUSE_NAME || "Kairos Gráfica",
  phone: process.env.WAREHOUSE_PHONE || "11999999999",
  email: process.env.WAREHOUSE_EMAIL || "contato@kairos.com.br",
  document: process.env.WAREHOUSE_DOCUMENT || "12345678909", // CPF — required by ME API
  address: process.env.WAREHOUSE_ADDRESS || "Praça da Sé",
  number: process.env.WAREHOUSE_NUMBER || "100",
  complement: process.env.WAREHOUSE_COMPLEMENT || "",
  district: process.env.WAREHOUSE_DISTRICT || "Sé",
  city: process.env.WAREHOUSE_CITY || "São Paulo",
  state_abbr: process.env.WAREHOUSE_STATE || "SP",
  country_id: "BR",
};

/** Generate a valid CPF for sandbox testing (to.document fallback) */
function generateValidCPF(): string {
  const rand = (n: number) => Math.floor(Math.random() * n);
  const mod = (d: number, n: number) => d % n < 2 ? 0 : n - (d % n);
  const d = Array.from({ length: 9 }, () => rand(9));
  d.push(mod(d.reduce((s, v, i) => s + v * (10 - i), 0), 11));
  d.push(mod(d.reduce((s, v, i) => s + v * (11 - i), 0), 11));
  return d.join("");
}

export async function addToMelhorEnvioCart(params: {
  melhorEnvioServiceId: number;
  fromCep: string;
  toCep: string;
  toName: string;
  toPhone?: string;
  toEmail?: string;
  toDocument?: string;
  toAddress: string;
  toNumber: string;
  toComplement?: string;
  toNeighborhood: string;
  toCity: string;
  toState: string;
  pkg: PackageDimensions;
  insuredValue: number;
  orderId: string;
  products: { name: string; quantity: number; unitary_value: number }[];
}): Promise<{ cartItemId: string }> {
  if (!MELHOR_ENVIO_TOKEN) {
    console.log("[Shipping][DEV] No token — returning fake cart item ID");
    return { cartItemId: `fake_cart_${Date.now()}` };
  }

  const body = {
    service: params.melhorEnvioServiceId,
    from: {
      ...WAREHOUSE_FROM,
      postal_code: params.fromCep || WAREHOUSE_CEP,
    },
    to: {
      name: params.toName,
      phone: params.toPhone || "11999999999",
      email: params.toEmail || "cliente@kairos.com.br",
      document: params.toDocument || generateValidCPF(),
      postal_code: params.toCep,
      address: params.toAddress,
      number: params.toNumber,
      complement: params.toComplement || "",
      district: params.toNeighborhood,
      city: params.toCity,
      state_abbr: params.toState,
      country_id: "BR",
    },
    products: params.products,
    package: {
      weight: params.pkg.weightKg,
      width: params.pkg.widthCm,
      height: params.pkg.heightCm,
      length: params.pkg.lengthCm,
    },
    options: {
      insurance_value: params.insuredValue,
    },
    volumes: [
      {
        weight: params.pkg.weightKg,
        width: params.pkg.widthCm,
        height: params.pkg.heightCm,
        length: params.pkg.lengthCm,
      },
    ],
  };

  const response = await fetch(`${BASE_URL}/api/v2/me/cart`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
      "User-Agent": "Kairos Grafica (contato@kairos.com.br)",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Melhor Envio cart error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { id: string };
  return { cartItemId: data.id };
}

/**
 * Checks out (purchases) shipment labels in the Melhor Envio cart.
 */
export async function checkoutShipment(cartItemIds: string[]): Promise<void> {
  if (!MELHOR_ENVIO_TOKEN) {
    console.log("[Shipping][DEV] No token — skipping shipment checkout");
    return;
  }

  const response = await fetch(`${BASE_URL}/api/v2/me/shipment/checkout`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
      "User-Agent": "Kairos Grafica (contato@kairos.com.br)",
    },
    body: JSON.stringify({ orders: cartItemIds }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Melhor Envio checkout error ${response.status}: ${text}`);
  }
}

/**
 * Generates labels for purchased shipments.
 */
export async function generateLabel(cartItemIds: string[]): Promise<void> {
  if (!MELHOR_ENVIO_TOKEN) {
    console.log("[Shipping][DEV] No token — skipping label generation");
    return;
  }

  const response = await fetch(`${BASE_URL}/api/v2/me/shipment/generate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
      "User-Agent": "Kairos Grafica (contato@kairos.com.br)",
    },
    body: JSON.stringify({ orders: cartItemIds }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Melhor Envio generate error ${response.status}: ${text}`);
  }
}

/**
 * Gets the printable label URL for a shipment.
 */
export async function getLabelUrl(
  cartItemIds: string[],
): Promise<{ url: string }> {
  if (!MELHOR_ENVIO_TOKEN) {
    console.log("[Shipping][DEV] No token — returning fake label URL");
    return { url: `https://dev.fake-label/${cartItemIds[0] ?? "fake"}.pdf` };
  }

  const response = await fetch(`${BASE_URL}/api/v2/me/shipment/print`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
      "User-Agent": "Kairos Grafica (contato@kairos.com.br)",
    },
    body: JSON.stringify({ orders: cartItemIds }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Melhor Envio print error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { url: string };
  return { url: data.url };
}

// ── Tracking Info ──

export interface TrackingEvent {
  status: string;
  date: string;
  location: string;
  description: string;
}

/**
 * Fetches tracking info from Melhor Envio API.
 * Returns an array of tracking events, or empty array on failure.
 */
export async function getTrackingInfo(trackingCode: string): Promise<TrackingEvent[]> {
  if (!MELHOR_ENVIO_TOKEN || !trackingCode) {
    return [];
  }

  try {
    const response = await fetch(`${BASE_URL}/api/v2/me/shipment/tracking`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
        "User-Agent": "Kairos Grafica (contato@kairos.com.br)",
      },
      body: JSON.stringify({ orders: [trackingCode] }),
    });

    if (!response.ok) {
      console.error(`[Tracking] API error ${response.status}`);
      return [];
    }

    const data = await response.json() as Record<string, any>;
    // ME returns { "trackingCode": { tracking: [...] } }
    const trackingData = data[trackingCode]?.tracking;
    if (!Array.isArray(trackingData)) return [];

    return trackingData.map((evt: any) => ({
      status: evt.status || "",
      date: evt.date || evt.datetime || "",
      location: evt.locale || evt.location || "",
      description: evt.description || evt.message || "",
    }));
  } catch (err: any) {
    console.error("[Tracking] Failed to fetch tracking info:", err?.message || err);
    return [];
  }
}

// ── Auto Label Generation (triggered after payment approval) ──

/**
 * Automatically generates a shipping label after payment is approved.
 * This is a fire-and-forget operation — errors are logged but don't block payment processing.
 *
 * Flow:
 * 1. Fetch order + items from DB
 * 2. Validate shipping data exists (address + serviceId)
 * 3. Calculate package dimensions from order items
 * 4. Add to Melhor Envio cart
 * 5. Checkout (purchase) the shipment
 * 6. Generate the label PDF
 * 7. Get the printable label URL
 * 8. Save label URL on order + move status to "production"
 */
export async function autoGenerateLabel(orderId: string): Promise<void> {
  try {
    console.log(`[AutoLabel] Starting label generation for order ${orderId}`);

    // 1. Fetch order and items
    const order = await storage.getOrder(orderId);
    if (!order) {
      console.error(`[AutoLabel] Order ${orderId} not found`);
      return;
    }

    // 2. Validate shipping data
    const addr = order.shippingAddress as { cep: string; street: string; number: string; complement?: string; neighborhood: string; city: string; state: string } | null;
    const serviceId = order.shippingServiceId;

    if (!addr || !serviceId) {
      console.warn(`[AutoLabel] Order ${orderId} missing shipping data (address=${!!addr}, serviceId=${serviceId}). Skipping auto-label.`);
      return;
    }

    if (!MELHOR_ENVIO_TOKEN) {
      console.warn(`[AutoLabel] MELHOR_ENVIO_TOKEN not set. Skipping auto-label for order ${orderId}.`);
      return;
    }

    // 3. Fetch order items and calculate package dimensions
    const items = await storage.getOrderItems(orderId);
    // Convert OrderItems to CartItem-like objects for calculatePackage
    const cartLikeItems: CartItem[] = items.map((item) => ({
      id: item.id,
      sessionId: "",
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      specifications: item.specifications,
      artFileUrl: item.artFileUrl,
      createdAt: new Date(),
    }));

    const pkg = await calculatePackage(cartLikeItems);
    const insuredValue = parseFloat(order.total);

    // Fetch customer for recipient name
    const customer = await storage.getCustomer(order.customerId);
    const recipientName = customer?.name || "Destinatário";

    console.log(`[AutoLabel] Order ${orderId}: pkg=${JSON.stringify(pkg)}, serviceId=${serviceId}, to=${addr.city}/${addr.state}`);

    // Build products array for Melhor Envio (required for "declaração de conteúdo")
    const meProducts = items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      unitary_value: item.quantity > 0
        ? parseFloat((parseFloat(item.subtotal) / item.quantity).toFixed(2))
        : parseFloat(item.unitPrice) || 1,
    }));

    // 4. Add to Melhor Envio cart
    const { cartItemId } = await addToMelhorEnvioCart({
      melhorEnvioServiceId: serviceId,
      fromCep: WAREHOUSE_CEP,
      toCep: addr.cep,
      toName: recipientName,
      toPhone: customer?.phone || undefined,
      toEmail: customer?.email || undefined,
      toAddress: addr.street,
      toNumber: addr.number,
      toComplement: addr.complement,
      toNeighborhood: addr.neighborhood,
      toCity: addr.city,
      toState: addr.state,
      pkg,
      insuredValue,
      orderId,
      products: meProducts,
    });
    console.log(`[AutoLabel] Order ${orderId}: added to cart, cartItemId=${cartItemId}`);

    // 5. Checkout (purchase) the shipment
    await checkoutShipment([cartItemId]);
    console.log(`[AutoLabel] Order ${orderId}: shipment checked out`);

    // 6. Generate the label PDF
    await generateLabel([cartItemId]);
    console.log(`[AutoLabel] Order ${orderId}: label generated`);

    // 7. Get the printable label URL
    const { url } = await getLabelUrl([cartItemId]);
    console.log(`[AutoLabel] Order ${orderId}: label URL=${url}`);

    // 8. Save label URL and update status to production
    await storage.updateShippingLabel(orderId, url);
    await storage.updateOrderStatus(orderId, "production");
    console.log(`[AutoLabel] Order ${orderId}: label saved, status → production`);
  } catch (err: any) {
    console.error(`[AutoLabel] Failed for order ${orderId}:`, err?.message || err);
    // Persist failure note on the order so admin can see it in the panel
    try {
      await storage.createOrderNote({ orderId, content: `[AutoLabel] Falha na geração da etiqueta: ${err?.message || err}`, authorName: "Sistema" });
    } catch { /* best-effort */ }
  }
}
