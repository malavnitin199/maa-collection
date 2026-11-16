import { and, asc, desc, eq, gt, gte, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { products, staff, stockMovements, stockReceipts, suppliers, type Product } from '@/db/schema';
import { STORE_TIMEZONE } from '@/lib/app-config';
import type { TagFilter, TagWhen } from '@/lib/tag-library';

/** One tag on the All tags page (plan v13): the item, its company, who made it and the delivery it came in. */
export type TagLibraryRow = Product & {
  supplierName: string | null;
  createdByName: string | null;
  /** The stock entry the item was created in (its `opening` movement), if any. */
  receiptId: string | null;
  receiptBill: string | null;
  receiptAt: Date | null;
};

/** Start of "today / last 7 / last 30 days" in the shop's time zone, like Reports. */
function madeSince(when: TagWhen, now: Date, timezone: string): SQL | undefined {
  if (when === 'all') return undefined;
  const at = sql`${now.toISOString()}::timestamptz`;
  const today = sql`(date_trunc('day', ${at} AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})`;
  if (when === 'today') return gte(products.createdAt, today);
  const days = when === '7d' ? 6 : 29; // today plus the previous 6 / 29 days
  return gte(products.createdAt, sql`(${today} - make_interval(days => ${days}))`);
}

/**
 * Every active item's tag with what the All tags page groups and filters by,
 * newest first. Filters run in SQL; grouping is done by `groupTags`.
 */
export async function listTagLibrary(
  db: Db,
  storeId: string,
  filter: Partial<TagFilter> = {},
  { now = new Date(), timezone = STORE_TIMEZONE }: { now?: Date; timezone?: string } = {},
): Promise<TagLibraryRow[]> {
  const term = filter.search?.trim();
  const text = term
    ? or(
        ilike(products.name, `%${term}%`),
        ilike(products.sku, `%${term}%`),
        ilike(products.brand, `%${term}%`),
        ilike(products.category, `%${term}%`),
        ilike(products.color, `%${term}%`),
        eq(products.barcode, term),
      )
    : undefined;
  const rows = await db
    .select({
      product: products,
      supplierName: suppliers.name,
      createdByName: staff.name,
      receiptId: stockReceipts.id,
      receiptBill: stockReceipts.billNumber,
      receiptAt: stockReceipts.createdAt,
    })
    .from(products)
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .leftJoin(staff, eq(staff.id, products.createdBy))
    .leftJoin(stockMovements, and(eq(stockMovements.productId, products.id), eq(stockMovements.reason, 'opening')))
    .leftJoin(stockReceipts, eq(stockReceipts.id, stockMovements.refId))
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.active, true),
        text,
        filter.supplierId === 'none' ? isNull(products.supplierId) : filter.supplierId ? eq(products.supplierId, filter.supplierId) : undefined,
        filter.categoryId ? eq(products.categoryId, filter.categoryId) : undefined,
        filter.createdBy ? eq(products.createdBy, filter.createdBy) : undefined,
        filter.inStockOnly ? gt(products.stock, 0) : undefined,
        madeSince(filter.when ?? 'all', now, timezone),
      ),
    )
    .orderBy(desc(products.createdAt), asc(products.name), asc(products.color), asc(products.size));

  // An item has one opening entry; keep the first row per item in case of old data with more.
  const seen = new Set<string>();
  const result: TagLibraryRow[] = [];
  for (const r of rows) {
    if (seen.has(r.product.id)) continue;
    seen.add(r.product.id);
    result.push({ ...r.product, supplierName: r.supplierName, createdByName: r.createdByName, receiptId: r.receiptId, receiptBill: r.receiptBill, receiptAt: r.receiptAt });
  }
  return result;
}
