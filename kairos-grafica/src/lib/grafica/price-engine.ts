import type { PriceRule, ProductVariant, Finishing } from "@shared/schema";

export interface PriceCalculationInput {
  quantity: number;
  variant: ProductVariant | null;
  finishings: Finishing[];
  priceRules: PriceRule[];
}

export interface PriceCalculationResult {
  unitPrice: number;
  totalPrice: number;
  setupFee: number;
  finishingCost: number;
  breakdown: {
    baseUnitPrice: number;
    finishingPerUnit: number;
    setupFee: number;
  };
}

export function calculatePrice(input: PriceCalculationInput): PriceCalculationResult {
  const { quantity, variant, finishings, priceRules } = input;

  // 1. Find the applicable price rule for this quantity
  let baseUnitPrice = 0;
  let setupFee = 0;

  // First check if variant has a price table entry for this quantity
  if (variant?.priceTable) {
    const table = variant.priceTable as Record<string, number>;
    const qtys = Object.keys(table)
      .map(Number)
      .sort((a, b) => a - b);

    // Find closest quantity tier (at or below requested)
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
      // Use the closest rule
      const sorted = [...priceRules].sort(
        (a, b) => Math.abs(a.minQty - quantity) - Math.abs(b.minQty - quantity),
      );
      baseUnitPrice = parseFloat(sorted[0].pricePerUnit);
      setupFee = parseFloat(sorted[0].setupFee);
    }
  }

  // 2. Calculate finishing costs per unit
  let finishingPerUnit = 0;
  for (const finishing of finishings) {
    finishingPerUnit += parseFloat(finishing.priceModifier);
  }

  const unitPrice = baseUnitPrice + finishingPerUnit;
  const totalPrice = unitPrice * quantity + setupFee;

  return {
    unitPrice,
    totalPrice,
    setupFee,
    finishingCost: finishingPerUnit * quantity,
    breakdown: {
      baseUnitPrice,
      finishingPerUnit,
      setupFee,
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
  if (product.quantitySteps && Array.isArray(product.quantitySteps)) {
    return product.quantitySteps;
  }
  return [product.minQuantity];
}
