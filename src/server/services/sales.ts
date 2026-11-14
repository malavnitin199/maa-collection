import { and, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { products, sales, staff, stockMovements, type Sale } from '@/db/schema';
import { DomainError, isUniqueViolation } from './errors';

export type RecordSaleInput = {
  operationId: string;
  productId: string;
  quantity: number;
  unitPricePaise: number;
  /** Salesperson credited with the sale (may be someone else: "on behalf of"). */
  soldBy: string;
  /** Logged-in staff member entering it. */
  recordedBy: string;
};

export type RecordSaleResult = { sale: Sale; stockLeft: number; duplicate: boolean };

export async function assertActiveStaff(db: Db, storeId: string, staffId: string) {
  const [person] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.storeId, storeId), eq(staff.id, staffId), eq(staff.active, true)))
    .limit(1);
  if (!person) throw new DomainError('That salesperson is not active.');
}

/**
 * One counter sale, atomically: price ≤ MRP, stock ≥ quantity, stock deducted,
 * movement appended, sale recorded. Retrying the same operationId returns the
 * original sale instead of selling twice.
 */
export async function recordSale(db: Db, storeId: string, input: RecordSaleInput): Promise<RecordSaleResult> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.');
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new DomainError('Quantity must be a whole number, minimum 1.');
  }
  if (!Number.isSafeInteger(input.unitPricePaise) || input.unitPricePaise <= 0) {
    throw new DomainError('Enter a valid sale price.');
  }

  const existing = await findSaleByOperation(db, storeId, input.operationId);
  if (existing) return existing;
  await assertActiveStaff(db, storeId, input.soldBy);

  try {
    return await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.id, input.productId), eq(products.active, true)))
        .limit(1);
      if (!product) throw new DomainError('Product not found.');
      if (input.unitPricePaise > product.mrpPaise) throw new DomainError('Sale price cannot be above MRP.');

      const [updated] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${input.quantity}` })
        .where(and(eq(products.id, product.id), gte(products.stock, input.quantity)))
        .returning({ stock: products.stock });
      if (!updated) {
        throw new DomainError(product.stock <= 0 ? 'Out of stock.' : `Only ${product.stock} left in stock.`);
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
          mrpPaise: product.mrpPaise,
          quantity: input.quantity,
          unitPricePaise: input.unitPricePaise,
          totalPaise: input.quantity * input.unitPricePaise,
          costPaise: product.costPaise,
          soldBy: input.soldBy,
          recordedBy: input.recordedBy,
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

async function findSaleByOperation(db: Db, storeId: string, operationId: string): Promise<RecordSaleResult | null> {
  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.storeId, storeId), eq(sales.operationId, operationId)))
    .limit(1);
  if (!sale) return null;
  const [product] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, sale.productId));
  return { sale, stockLeft: product?.stock ?? 0, duplicate: true };
}
