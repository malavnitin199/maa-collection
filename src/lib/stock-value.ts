/**
 * What the pieces in stock are worth at their purchase price (ADR-057): Products shows
 * "pieces × per piece = total" on every card and row. Pure; money in integer paise.
 */
export type StockValue = {
  /** Pieces in stock (an item below zero counts as none, like the design card's sizes). */
  pieces: number;
  /**
   * Purchase price per piece: one price (min = max) or the lowest and highest when sizes
   * differ — of the items with pieces, or of all items when none has any. Null when no
   * item has a purchase price.
   */
  perPiece: { minPaise: number; maxPaise: number } | null;
  /** Pieces × purchase price, added up over the items that have one. */
  totalPaise: number;
  /** Pieces whose item has no purchase price (left out of the total). */
  piecesWithoutPrice: number;
};

export function stockValue(items: readonly { stock: number; costPaise: number | null }[]): StockValue {
  let pieces = 0;
  let totalPaise = 0;
  let piecesWithoutPrice = 0;
  const inStock = { min: Infinity, max: -Infinity };
  const any = { min: Infinity, max: -Infinity };
  for (const item of items) {
    const n = Math.max(item.stock, 0);
    pieces += n;
    if (item.costPaise === null) {
      piecesWithoutPrice += n;
      continue;
    }
    totalPaise += n * item.costPaise;
    any.min = Math.min(any.min, item.costPaise);
    any.max = Math.max(any.max, item.costPaise);
    if (n > 0) {
      inStock.min = Math.min(inStock.min, item.costPaise);
      inStock.max = Math.max(inStock.max, item.costPaise);
    }
  }
  const range = inStock.min <= inStock.max ? inStock : any;
  return {
    pieces,
    perPiece: range.min <= range.max ? { minPaise: range.min, maxPaise: range.max } : null,
    totalPaise,
    piecesWithoutPrice,
  };
}
