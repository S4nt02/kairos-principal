/**
 * Server-Side Price Engine
 *
 * Mirrors exactly the logic in client/src/lib/grafica/price-engine.ts.
 * Called at POST /api/grafica/cart and POST /api/grafica/checkout to detect
 * client-side price manipulation (PRICE_MISMATCH).
 */

import { db } from "../db";
import {
  products, priceRules, finishings, wireoOptions,
  addonItems, productDiscounts,
} from "../../shared/schema";
import { eq, and, lte, gte, inArray } from "drizzle-orm";

export interface PriceConfig {
  variantId?: string | null;
  finishingIds?: string[];
  wireoOptionId?: string | null;
  addonItemIds?: string[];
}

export interface ServerPriceResult {
  unitPrice: number;
  totalPrice: number;
  setupFee: number;
  activeDiscount: number;
  breakdown: {
    baseUnitPrice: number;
    finishingPerUnit: number;
    wireoPerUnit: number;
    addonPerUnit: number;
    setupFee: number;
    discountAmount: number;
  };
}

export async function calculateServerPrice(
  productId: string,
  config: PriceConfig,
  quantity: number,
): Promise<ServerPriceResult> {
  // 1. Fetch price rules
  const rules = await db
    .select()
    .from(priceRules)
    .where(eq(priceRules.productId, productId));

  let baseUnitPrice = 0;
  let setupFee = 0;

  if (rules.length > 0) {
    const applicable = rules.find(
      (r) => quantity >= r.minQty && quantity <= r.maxQty,
    );
    if (applicable) {
      baseUnitPrice = parseFloat(applicable.pricePerUnit);
      setupFee = parseFloat(applicable.setupFee);
    } else {
      // Closest rule
      const sorted = [...rules].sort(
        (a, b) => Math.abs(a.minQty - quantity) - Math.abs(b.minQty - quantity),
      );
      baseUnitPrice = parseFloat(sorted[0].pricePerUnit);
      setupFee = parseFloat(sorted[0].setupFee);
    }
  } else {
    // Fallback: product base_price
    const [product] = await db
      .select({ basePrice: products.basePrice })
      .from(products)
      .where(eq(products.id, productId));
    if (product) baseUnitPrice = parseFloat(product.basePrice);
  }

  // 2. Finishing costs per unit
  let finishingPerUnit = 0;
  if (config.finishingIds && config.finishingIds.length > 0) {
    const fins = await db
      .select({ priceModifier: finishings.priceModifier })
      .from(finishings)
      .where(inArray(finishings.id, config.finishingIds));
    finishingPerUnit = fins.reduce((s, f) => s + parseFloat(f.priceModifier), 0);
  }

  // 3. Wire-o cost
  let wireoPerUnit = 0;
  if (config.wireoOptionId) {
    const [wireo] = await db
      .select({ priceModifier: wireoOptions.priceModifier })
      .from(wireoOptions)
      .where(
        and(
          eq(wireoOptions.id, config.wireoOptionId),
          eq(wireoOptions.active, true),
        ),
      );
    if (wireo) wireoPerUnit = parseFloat(wireo.priceModifier);
  }

  // 5. Addon items cost (sum of price modifiers)
  let addonPerUnit = 0;
  if (config.addonItemIds && config.addonItemIds.length > 0) {
    const addons = await db
      .select({ priceModifier: addonItems.priceModifier })
      .from(addonItems)
      .where(
        and(
          inArray(addonItems.id, config.addonItemIds),
          eq(addonItems.active, true),
        ),
      );
    addonPerUnit = addons.reduce((s, a) => s + parseFloat(a.priceModifier), 0);
  }

  // 6. Active product discount (server-authoritative — never trust client)
  let discountAmount = 0;
  const now = new Date();
  const [discount] = await db
    .select()
    .from(productDiscounts)
    .where(
      and(
        eq(productDiscounts.productId, productId),
        eq(productDiscounts.active, true),
        lte(productDiscounts.validFrom, now),
        gte(productDiscounts.validTo, now),
      ),
    )
    .limit(1);

  const unitPrice =
    baseUnitPrice + finishingPerUnit + wireoPerUnit + addonPerUnit;
  const rawTotal = unitPrice * quantity + setupFee;

  if (discount) {
    if (discount.discountType === "percentage") {
      discountAmount = rawTotal * (parseFloat(discount.discountValue) / 100);
    } else {
      discountAmount = parseFloat(discount.discountValue);
    }
    discountAmount = Math.min(discountAmount, rawTotal);
  }

  const totalPrice = rawTotal - discountAmount;

  return {
    unitPrice,
    totalPrice,
    setupFee,
    activeDiscount: discountAmount,
    breakdown: {
      baseUnitPrice,
      finishingPerUnit,
      wireoPerUnit,
      addonPerUnit,
      setupFee,
      discountAmount,
    },
  };
}

/**
 * Compare client-reported price against server-calculated price.
 * Tolerates R$0.01 for floating-point rounding.
 */
export function isPriceMismatch(clientPrice: number, serverPrice: number): boolean {
  return Math.abs(clientPrice - serverPrice) > 0.01;
}
