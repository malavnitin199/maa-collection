import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { products, suppliers } from '@/db/schema';

export type CompanyDeleteResult = {
  deleted: string[];
  /** Items left with no company. */
  unlinked: { items: number };
};

/**
 * Companies → Delete (owner's feedback 2026-11-22, ADR-051), after a confirmation,
 * any company. It leaves every list, company box and Home; its items stay with
 * no company. Bills, payments and stock entries are **not** touched — a bill once
 * made stays as it is and keeps showing the company's name (the row is kept,
 * marked `deleted_at`); the owner can still edit the bill.
 */
export async function deleteCompanies(db: Db, storeId: string, ids: readonly string[]): Promise<CompanyDeleteResult> {
  const unique = [...new Set(ids)].slice(0, 500);
  if (unique.length === 0) return { deleted: [], unlinked: { items: 0 } };
  return db.transaction(async (raw) => {
    const tx = raw as unknown as Db;
    const gone = await tx
      .update(suppliers)
      .set({ deletedAt: new Date(), active: false })
      .where(and(eq(suppliers.storeId, storeId), inArray(suppliers.id, unique), isNull(suppliers.deletedAt)))
      .returning({ id: suppliers.id });
    const found = gone.map((r) => r.id);
    if (found.length === 0) return { deleted: [], unlinked: { items: 0 } };
    const items = await tx.update(products).set({ supplierId: null }).where(and(eq(products.storeId, storeId), inArray(products.supplierId, found))).returning({ id: products.id });
    return { deleted: found, unlinked: { items: items.length } };
  });
}
