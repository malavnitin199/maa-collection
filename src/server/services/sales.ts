import { and, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { products, sales, staff, stockMovements, type Sale } from '@/db/schema';
import { autoApproveOwnEntry, isOwner } from './approvals';
import { DomainError, isUniqueViolation } from './errors';

/** A sale entered without scanning (plan v12): the tag would not scan, so the salesman typed what it was. */
export type ManualItem = { name: string; size?: string; note?: string };

export type RecordSaleInput = {
  operationId: string;
  /** The scanned item. Omitted only for a hand-entered sale. */
  productId?: string;
  /** Hand-entered sale: no item, no stock movement, no MRP cap. */
  manual?: ManualItem;
  quantity: number;
  unitPricePaise: number;
  /** Salesperson credited with the sale (may be someone else: "on behalf of"). */
  soldBy: string;
  /** Logged-in staff member entering it. */
  recordedBy: string;
  /**
   * Plan v18: the sale was made on a phone without internet and is being sent now.
   * It is always recorded (owner's decision, D-07): the stock may go below zero,
   * an item hidden since still sells, an MRP lowered since does not refuse it,
   * and a salesperson removed since keeps the credit.
   */
  offline?: OfflineMade;
};

/** When the phone made it, and the MRP the phone showed then (the tag's). */
export type OfflineMade = { at: Date; mrpPaise?: number };

export type RecordSaleResult = { sale: Sale; stockLeft: number; duplicate: boolean };

export const MANUAL_NAME_MAX = 80;
export const MANUAL_SIZE_MAX = 20;

export async function assertActiveStaff(db: Db, storeId: string, staffId: string, { evenRemoved = false } = {}) {
  const [person] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.storeId, storeId), eq(staff.id, staffId), evenRemoved ? undefined : eq(staff.active, true)))
    .limit(1);
  if (!person) throw new DomainError('That salesperson is not active.', { key: 'error.sellerInactive' });
}

/**
 * One counter sale, atomically: price ≤ MRP, stock ≥ quantity, stock deducted,
 * movement appended, sale recorded. Retrying the same operationId returns the
 * original sale instead of selling twice.
 *
 * A hand-entered sale (`manual`) has no item: nothing is deducted, no MRP is
 * known, and the owner checks it in Approvals. The owner's own entries are
 * approved as they are recorded; everyone else's wait for the owner.
 *
 * A sale made offline (`offlineAt`, plan v18) skips the stock, hidden-item and
 * MRP refusals — it already happened at the counter — and keeps the phone's time.
 */
export async function recordSale(db: Db, storeId: string, input: RecordSaleInput): Promise<RecordSaleResult> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.');
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new DomainError('Quantity must be a whole number, minimum 1.', { key: 'error.quantity' });
  }
  if (!Number.isSafeInteger(input.unitPricePaise) || input.unitPricePaise <= 0) {
    throw new DomainError('Enter a valid sale price.', { key: 'error.salePrice' });
  }
  const manual = input.manual ? normaliseManual(input.manual) : null;
  if (!manual && !input.productId) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
  const offlineAt = input.offline ? offlineTime(input.offline.at) : null;

  const existing = await findSaleByOperation(db, storeId, input.operationId);
  if (existing) return existing;
  await assertActiveStaff(db, storeId, input.soldBy, { evenRemoved: offlineAt !== null });

  try {
    return await db.transaction(async (tx) => {
      const owner = await isOwner(tx, storeId, input.recordedBy);
      if (manual) {
        const [sale] = await tx
          .insert(sales)
          .values({
            storeId,
            operationId: input.operationId,
            productId: null,
            sku: '',
            productName: manual.name,
            size: manual.size,
            color: '',
            mrpPaise: null,
            manual: true,
            manualNote: manual.note,
            quantity: input.quantity,
            unitPricePaise: input.unitPricePaise,
            totalPaise: input.quantity * input.unitPricePaise,
            costPaise: null,
            soldBy: input.soldBy,
            recordedBy: input.recordedBy,
            offlineAt,
          })
          .returning();
        if (owner) await autoApproveOwnEntry(tx, { storeId, saleId: sale.id, decidedBy: input.recordedBy });
        return { sale, stockLeft: 0, duplicate: false };
      }

      const [product] = await tx
        .select()
        .from(products)
        // Offline: the item may have been hidden since the sale; it still sold.
        .where(and(eq(products.storeId, storeId), eq(products.id, input.productId!), offlineAt ? undefined : eq(products.active, true)))
        .limit(1);
      if (!product) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
      if (!offlineAt && input.unitPricePaise > product.mrpPaise) {
        throw new DomainError('Sale price cannot be above MRP.', { key: 'error.aboveMrp' });
      }

      // Online: never below zero. Offline: the pieces already left the shop, so the
      // count follows them, even below zero (the owner recounts).
      const [updated] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${input.quantity}` })
        .where(and(eq(products.id, product.id), offlineAt ? undefined : gte(products.stock, input.quantity)))
        .returning({ stock: products.stock });
      if (!updated) {
        throw product.stock <= 0
          ? new DomainError('Out of stock.', { key: 'error.outOfStock' })
          : new DomainError(`Only ${product.stock} left in stock.`, { key: 'error.onlyLeft', vars: { n: product.stock } });
      }

      const [sale] = await tx
        .insert(sales)
        .values({
          storeId,
          operationId: input.operationId,
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          size: product.size,
          color: product.color,
          // Offline: the MRP the phone showed when it sold (the owner may have changed it since).
          mrpPaise: offlineAt ? offlineMrp(product.mrpPaise, input.unitPricePaise, input.offline?.mrpPaise) : product.mrpPaise,
          quantity: input.quantity,
          unitPricePaise: input.unitPricePaise,
          totalPaise: input.quantity * input.unitPricePaise,
          costPaise: product.costPaise,
          soldBy: input.soldBy,
          recordedBy: input.recordedBy,
          offlineAt,
        })
        .returning();
      await tx.insert(stockMovements).values({
        storeId,
        productId: product.id,
        quantityChange: -input.quantity,
        reason: 'sale',
        refId: sale.id,
        staffId: input.recordedBy,
      });
      if (owner) await autoApproveOwnEntry(tx, { storeId, saleId: sale.id, decidedBy: input.recordedBy });
      return { sale, stockLeft: updated.stock, duplicate: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const again = await findSaleByOperation(db, storeId, input.operationId);
      if (again) return again;
    }
    throw error;
  }
}

/** The phone's clock: a real time, never later than now (a phone set ahead is pulled back). */
function offlineTime(at: Date): Date {
  if (Number.isNaN(at.getTime())) throw new DomainError('Invalid sale time.', { key: 'error.invalid' });
  return at.getTime() > Date.now() ? new Date() : at;
}

/** The MRP kept with an offline sale: the one the phone showed, never below the price agreed. */
function offlineMrp(current: number, price: number, shown?: number): number {
  if (shown !== undefined && Number.isSafeInteger(shown) && shown >= price) return shown;
  return Math.max(current, price);
}

/** Trims and bounds what the salesman typed; a name is required. */
function normaliseManual(item: ManualItem): { name: string; size: string; note: string | null } {
  const name = item.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new DomainError('Type what the item is.', { key: 'error.manualName' });
  if (name.length > MANUAL_NAME_MAX) throw new DomainError('Item name is too long.', { key: 'error.manualNameLong' });
  const size = (item.size ?? '').trim().slice(0, MANUAL_SIZE_MAX);
  const note = (item.note ?? '').trim().slice(0, 200) || null;
  return { name, size, note };
}

async function findSaleByOperation(db: Db, storeId: string, operationId: string): Promise<RecordSaleResult | null> {
  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.storeId, storeId), eq(sales.operationId, operationId)))
    .limit(1);
  if (!sale) return null;
  if (!sale.productId) return { sale, stockLeft: 0, duplicate: true };
  const [product] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, sale.productId));
  return { sale, stockLeft: product?.stock ?? 0, duplicate: true };
}
