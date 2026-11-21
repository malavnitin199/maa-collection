import { and, eq, inArray, or } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { billCollections, exchanges, products, sales, stockMovements, stockReceipts } from '@/db/schema';
import { recompute } from './bills';
import { dropImagesOf } from './images';

export type DeleteProductsResult = {
  deleted: { id: string; name: string; size: string }[];
  /** Kept: an exchange names them (the exchange record needs its items). */
  kept: { id: string; name: string; size: string }[];
};

/**
 * Deletes items for good (owner, 2026-11-22, ADR-050: "any item, even sold ones"),
 * in one transaction:
 * - past sales keep their name, size, MRP, price, cost and amount; their item link
 *   is emptied and they are marked `item_deleted` (totals and profit stay right);
 * - the item's stock entries and photos go (a shared photo is handed to the items
 *   still using it);
 * - a delivery (collection) left with nothing is removed, and taken off its bill;
 *   every bill that had the items' collections is worked out again;
 * - an item named in an exchange is kept (and reported) — the exchange needs it.
 */
export async function deleteProducts(db: Db, storeId: string, ids: string[]): Promise<DeleteProductsResult> {
  const wanted = [...new Set(ids)].slice(0, 500);
  if (wanted.length === 0) return { deleted: [], kept: [] };
  return db.transaction(async (raw) => {
    const tx = raw as unknown as Db;
    const rows = await tx
      .select({ id: products.id, name: products.name, size: products.size })
      .from(products)
      .where(and(eq(products.storeId, storeId), inArray(products.id, wanted)));
    if (rows.length === 0) return { deleted: [], kept: [] };
    const found = rows.map((r) => r.id);
    const exchanged = await tx
      .select({ returned: exchanges.returnedProductId, issued: exchanges.issuedProductId })
      .from(exchanges)
      .where(and(eq(exchanges.storeId, storeId), or(inArray(exchanges.returnedProductId, found), inArray(exchanges.issuedProductId, found))));
    const keep = new Set(exchanged.flatMap((e) => [e.returned, e.issued]));
    const gone = rows.filter((r) => !keep.has(r.id));
    const goneIds = gone.map((r) => r.id);
    if (goneIds.length === 0) return { deleted: [], kept: rows };

    // The deliveries (collections) these items came in, and the bills those are on.
    const refs = await tx
      .selectDistinct({ id: stockMovements.refId })
      .from(stockMovements)
      .where(and(eq(stockMovements.storeId, storeId), inArray(stockMovements.productId, goneIds)));
    const refIds = refs.map((r) => r.id).filter((id): id is string => Boolean(id));
    const receipts = refIds.length
      ? (await tx.select({ id: stockReceipts.id }).from(stockReceipts).where(and(eq(stockReceipts.storeId, storeId), inArray(stockReceipts.id, refIds)))).map((r) => r.id)
      : [];
    const billIds = receipts.length
      ? [...new Set((await tx.select({ billId: billCollections.billId }).from(billCollections).where(inArray(billCollections.receiptId, receipts))).map((b) => b.billId))]
      : [];

    await tx.update(sales).set({ productId: null, itemDeleted: true }).where(and(eq(sales.storeId, storeId), inArray(sales.productId, goneIds)));
    await tx.delete(stockMovements).where(and(eq(stockMovements.storeId, storeId), inArray(stockMovements.productId, goneIds)));
    await dropImagesOf(tx, storeId, goneIds);
    await tx.delete(products).where(and(eq(products.storeId, storeId), inArray(products.id, goneIds)));

    // A delivery with nothing left in it goes, and leaves its bill.
    if (receipts.length) {
      const stillUsed = new Set(
        (await tx.selectDistinct({ id: stockMovements.refId }).from(stockMovements).where(inArray(stockMovements.refId, receipts))).map((r) => r.id),
      );
      const empty = receipts.filter((id) => !stillUsed.has(id));
      if (empty.length) {
        await tx.delete(billCollections).where(inArray(billCollections.receiptId, empty));
        await tx.delete(stockReceipts).where(and(eq(stockReceipts.storeId, storeId), inArray(stockReceipts.id, empty)));
      }
    }
    for (const billId of billIds) await recompute(tx, storeId, billId);
    return { deleted: gone, kept: rows.filter((r) => keep.has(r.id)) };
  });
}
