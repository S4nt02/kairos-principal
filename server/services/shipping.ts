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
import type { CartItem } from "../../shared/schema";

// ── Config ──

const MELHOR_ENVIO_TOKEN = process.env.MELHOR_ENVIO_TOKEN || "";
const WAREHOUSE_CEP = process.env.WAREHOUSE_CEP || "01001000";
const BASE_URL = MELHOR_ENVIO_TOKEN.startsWith("sandbox")
  ? "https://sandbox.melhorenvio.com.br"
  : "https://api.melhorenvio.com.br";

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
  if (!MELHOR_ENVIO_TOKEN) {
    console.log("[Shipping] No MELHOR_ENVIO_TOKEN set, returning mock quotes");
    return MOCK_QUOTES;
  }

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

    const response = await fetch(`${BASE_URL}/api/v2/me/shipment/calculate`, {
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
export async function addToMelhorEnvioCart(params: {
  melhorEnvioServiceId: number;
  fromCep: string;
  toCep: string;
  toName: string;
  toAddress: string;
  toNumber: string;
  toComplement?: string;
  toNeighborhood: string;
  toCity: string;
  toState: string;
  pkg: PackageDimensions;
  insuredValue: number;
  orderId: string;
}): Promise<{ cartItemId: string }> {
  if (!MELHOR_ENVIO_TOKEN) {
    throw new Error("MELHOR_ENVIO_TOKEN is required for label generation");
  }

  const body = {
    service: params.melhorEnvioServiceId,
    from: {
      name: "Kairos Gráfica",
      postal_code: params.fromCep || WAREHOUSE_CEP,
      address: "Endereço da gráfica",
      number: "S/N",
    },
    to: {
      name: params.toName,
      postal_code: params.toCep,
      address: params.toAddress,
      number: params.toNumber,
      complement: params.toComplement || "",
      district: params.toNeighborhood,
      city: params.toCity,
      state_abbr: params.toState,
    },
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
    throw new Error("MELHOR_ENVIO_TOKEN is required for label generation");
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
    throw new Error("MELHOR_ENVIO_TOKEN is required for label generation");
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
    throw new Error("MELHOR_ENVIO_TOKEN is required for label generation");
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
