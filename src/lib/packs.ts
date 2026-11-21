/**
 * Box packs (owner, 2026-11-21, ADR-047): an item sold from a box of N pieces
 * (e.g. boys' sandos, 10 or 12 a box). Stock, MRP, price and cost stay per piece;
 * the box only changes how it is entered, tagged, sold and billed.
 */
export const PACK_MIN = 2;
export const PACK_MAX = 1000;
export const PACK_CHOICES = [6, 10, 12] as const;

/** A real box size (2 … 1000), else null (= sold loose). */
export function packOf(size: number | null | undefined): number | null {
  return typeof size === 'number' && Number.isInteger(size) && size >= PACK_MIN && size <= PACK_MAX ? size : null;
}

/** One piece's share of a box price, to the nearest paisa (₹500 ÷ 12 = ₹41.67). */
export function perPiecePaise(boxPaise: number, pack: number): number {
  return Math.round(boxPaise / pack);
}

/** A whole box's price: the box price when given, else the piece price × pieces in the box. */
export function boxPaise(piecePaise: number, pack: number, packPaise?: number | null): number {
  return packPaise ?? piecePaise * pack;
}

/** Tags to print for some pieces: one per box (a part box gets its own tag), else one per piece. */
export function tagsFor(pieces: number, pack: number | null | undefined): number {
  const size = packOf(pack);
  if (pieces <= 0) return 0;
  return size ? Math.ceil(pieces / size) : pieces;
}

/**
 * What a sale of whole boxes records: pieces (stock goes down by these), the box
 * total, and a per-piece price that is the total ÷ pieces to the nearest paisa.
 */
export function boxSale(boxes: number, pack: number, boxPricePaise: number): { quantity: number; unitPricePaise: number; totalPaise: number } {
  const quantity = boxes * pack;
  const totalPaise = boxes * boxPricePaise;
  return { quantity, unitPricePaise: Math.round(totalPaise / quantity), totalPaise };
}
