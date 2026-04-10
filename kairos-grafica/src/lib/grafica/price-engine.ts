import type { PriceRule, ProductVariant, Finishing, WireoOption, ProductDiscount } from "@shared/schema";

export interface PriceCalculationInput {
  quantity: number;
  variant: ProductVariant | null;
  finishings: Finishing[];
  priceRules: PriceRule[];
  basePrice?: number;
  wireoOption?: WireoOption | null;
  selectedAddonItems?: { priceModifier: string }[];
  activeDiscount?: ProductDiscount | null;
}

export interface PriceCalculationResult {
  unitPrice: number;
  totalPrice: number;
  setupFee: number;
  finishingCost: number;
  wireoCost: number;
  addonCost: number;
  discountAmount: number;
  breakdown: {
    baseUnitPrice: number;
    finishingPerUnit: number;
    wireoPerUnit: number;
    addonPerUnit: number;
    setupFee: number;
    discountAmount: number;
  };
}

export function calculatePrice(input: PriceCalculationInput): PriceCalculationResult {
  const { quantity, variant, finishings, priceRules, basePrice, wireoOption, selectedAddonItems, activeDiscount } = input;

  // 1. Find the applicable price rule for this quantity
  let baseUnitPrice = 0;
  let setupFee = 0;

  // First check if variant has a price table entry for this quantity
  if (variant?.priceTable) {
    const table = variant.priceTable as Record<string, number>;
    const qtys = Object.keys(table)
      .map(Number)
      .sort((a, b) => a - b);

    let matchedQty = qtys[0];
    for (const q of qtys) {
      if (q <= quantity) matchedQty = q;
    }
    if (matchedQty) {
      baseUnitPrice = table[String(matchedQty)];
    }
  }

  // Fallback to price rules
  if (baseUnitPrice === 0 && priceRules.length > 0) {
    const applicableRule = priceRules.find(
      (r) => quantity >= r.minQty && quantity <= r.maxQty,
    );
    if (applicableRule) {
      baseUnitPrice = parseFloat(applicableRule.pricePerUnit);
      setupFee = parseFloat(applicableRule.setupFee);
    } else {
      const sorted = [...priceRules].sort(
        (a, b) => Math.abs(a.minQty - quantity) - Math.abs(b.minQty - quantity),
      );
      baseUnitPrice = parseFloat(sorted[0].pricePerUnit);
      setupFee = parseFloat(sorted[0].setupFee);
    }
  }

  // Final fallback: product basePrice (when no variant priceTable and no priceRules)
  if (baseUnitPrice === 0 && basePrice !== undefined) {
    baseUnitPrice = basePrice;
  }

  // 2. Calculate finishing costs per unit
  let finishingPerUnit = 0;
  for (const finishing of finishings) {
    finishingPerUnit += parseFloat(finishing.priceModifier);
  }

  // 3. Wire-o cost per unit
  const wireoPerUnit = wireoOption ? parseFloat(wireoOption.priceModifier) : 0;

  // 4. Addon items cost per unit
  let addonPerUnit = 0;
  for (const addon of (selectedAddonItems ?? [])) {
    addonPerUnit += parseFloat(addon.priceModifier);
  }

  const unitPrice = baseUnitPrice + finishingPerUnit + wireoPerUnit + addonPerUnit;
  const rawTotal = unitPrice * quantity + setupFee;

  // 5. Active discount
  let discountAmount = 0;
  if (activeDiscount) {
    if (activeDiscount.discountType === "percentage") {
      discountAmount = rawTotal * (parseFloat(activeDiscount.discountValue) / 100);
    } else {
      discountAmount = parseFloat(activeDiscount.discountValue);
    }
    discountAmount = Math.min(discountAmount, rawTotal);
  }

  const totalPrice = rawTotal - discountAmount;

  return {
    unitPrice,
    totalPrice,
    setupFee,
    finishingCost: finishingPerUnit * quantity,
    wireoCost: wireoPerUnit * quantity,
    addonCost: addonPerUnit * quantity,
    discountAmount,
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

export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function getQuantitySteps(product: { minQuantity: number; quantitySteps: number[] | null }): number[] {
  if (product.quantitySteps && Array.isArray(product.quantitySteps) && product.quantitySteps.length > 0) {
    return product.quantitySteps;
  }
  return []; // empty = free quantity mode
}
