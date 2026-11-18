/**
 * Was a sale a profit or a loss? (plan v17, owner only.) Compares what the
 * customer paid with the purchase price saved on the sale when it was made
 * (`sales.cost_paise`, a snapshot — later price changes don't move it).
 * Never use this on salesman screens: purchase prices are owner-only.
 */
export type Deal = { kind: 'profit' | 'loss' | 'even'; amountPaise: number } | { kind: 'unknown' };

export function saleDeal(totalPaise: number, costPaise: number | null, quantity: number): Deal {
  if (costPaise === null || !Number.isFinite(costPaise)) return { kind: 'unknown' };
  const diff = totalPaise - costPaise * quantity;
  if (diff > 0) return { kind: 'profit', amountPaise: diff };
  if (diff < 0) return { kind: 'loss', amountPaise: -diff };
  return { kind: 'even', amountPaise: 0 };
}
