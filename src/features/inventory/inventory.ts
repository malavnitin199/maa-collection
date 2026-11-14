export const LOW_STOCK_THRESHOLD = 2;

export type StockMap = Record<string, number>;

export type SaleRecord = {
  id: string;
  /** ISO timestamp */
  at: string;
  salesperson: string;
  sku: string;
  design: string;
  size: string;
  color: string;
  quantity: number;
  /** Bargained per-unit price actually paid, in paise. */
  unitPricePaise: number;
  totalPaise: number;
  /** MRP snapshot at sale time, in paise. */
  mrpPaise: number;
};

/** Parse a user-typed rupee amount ("450", "1,299.50") into integer paise. */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function validateSaleDraft(
  draft: { quantity: number; unitPricePaise: number },
  limits: { stock: number; mrpPaise: number },
): string | null {
  if (!Number.isInteger(draft.quantity) || draft.quantity < 1) {
    return 'Quantity must be a whole number, minimum 1.';
  }
  if (limits.stock <= 0) return 'Out of stock.';
  if (draft.quantity > limits.stock) {
    return `Only ${limits.stock} left in stock.`;
  }
  if (!Number.isSafeInteger(draft.unitPricePaise) || draft.unitPricePaise <= 0) {
    return 'Enter a valid sale price.';
  }
  // Selling above MRP is not permitted in India. Below MRP is fine (bargaining).
  if (draft.unitPricePaise > limits.mrpPaise) {
    return 'Sale price cannot be above MRP.';
  }
  return null;
}

export function saleTotalPaise(quantity: number, unitPricePaise: number): number {
  return quantity * unitPricePaise;
}
