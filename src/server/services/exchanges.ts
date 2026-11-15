import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Db } from '@/db/client';
import { exchanges, products, sales, staff, stockMovements, type Exchange } from '@/db/schema';
import { autoApproveOwnEntry, isOwner, saleRejected } from './approvals';
import { DomainError, isUniqueViolation } from './errors';
import { assertActiveStaff } from './sales';

/** Units of a sale already brought back through earlier exchanges. */
function returnedSoFar(saleId: AnyPgColumn) {
  return sql<number>`coalesce((select sum(${exchanges.returnedQuantity}) from ${exchanges} where ${exchanges.originalSaleId} = ${saleId}), 0)::int`;
}

export type ReturnableSale = {
  id: string;
  createdAt: Date;
  sku: string;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  unitPricePaise: number;
  returnable: number;
  soldById: string;
  soldByName: string;
};

/** Recent sales of a product that still have units that can come back (for step 1 of an exchange). */
export async function findReturnableSales(
  db: Db,
  storeId: string,
  productId: string,
  { days = 120 }: { days?: number } = {},
): Promise<ReturnableSale[]> {
  const seller = alias(staff, 'seller');
  const rows = await db
    .select({
      id: sales.id,
      createdAt: sales.createdAt,
      sku: sales.sku,
      productName: sales.productName,
      size: sales.size,
      color: sales.color,
      quantity: sales.quantity,
      unitPricePaise: sales.unitPricePaise,
      returned: returnedSoFar(sales.id),
      soldById: sales.soldBy,
      soldByName: seller.name,
    })
    .from(sales)
    .innerJoin(seller, eq(seller.id, sales.soldBy))
    .where(
      and(
        eq(sales.storeId, storeId),
        eq(sales.productId, productId),
        // A sale the owner rejected already put its pieces back; nothing can be returned against it.
        sql`not ${saleRejected}`,
        gte(sales.createdAt, sql`now() - make_interval(days => ${days})`),
      ),
    )
    .orderBy(desc(sales.createdAt))
    .limit(30);
  return rows
    .map(({ returned, ...row }) => ({ ...row, returnable: row.quantity - Number(returned) }))
    .filter((row) => row.returnable > 0);
}

export type RecordExchangeInput = {
  operationId: string;
  originalSaleId: string;
  returnedQuantity: number;
  issuedProductId: string;
  issuedQuantity: number;
  issuedUnitPricePaise: number;
  creditedTo: string;
  recordedBy: string;
};

export type RecordExchangeResult = { exchange: Exchange; duplicate: boolean };

/**
 * Customer brings back part of an earlier sale and takes another item. In one
 * transaction: returned units go back on the shelf, the new item's stock goes
 * down, and an exchange linked to the original (unchanged) sale is recorded.
 * The returned units are valued at the price the customer actually paid.
 */
export async function recordExchange(
  db: Db,
  storeId: string,
  input: RecordExchangeInput,
): Promise<RecordExchangeResult> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.');
  if (!Number.isInteger(input.returnedQuantity) || input.returnedQuantity < 1) {
    throw new DomainError('Returned quantity must be at least 1.', { key: 'error.returnQty' });
  }
  if (!Number.isInteger(input.issuedQuantity) || input.issuedQuantity < 1) {
    throw new DomainError('New item quantity must be at least 1.', { key: 'error.newQty' });
  }
  if (!Number.isSafeInteger(input.issuedUnitPricePaise) || input.issuedUnitPricePaise <= 0) {
    throw new DomainError('Enter a valid price for the new item.', { key: 'error.newPrice' });
  }

  const existing = await findExchangeByOperation(db, storeId, input.operationId);
  if (existing) return { exchange: existing, duplicate: true };
  await assertActiveStaff(db, storeId, input.creditedTo);

  try {
    return await db.transaction(async (tx) => {
      // Lock the original sale so two exchanges on it can't both pass the limit check.
      const [original] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.storeId, storeId), eq(sales.id, input.originalSaleId)))
        .for('update')
        .limit(1);
      if (!original) throw new DomainError('Original sale not found.', { key: 'error.saleNotFound' });
      if (!original.productId) throw new DomainError('That sale was entered by hand, so nothing can be returned against it.', { key: 'error.manualNoExchange' });
      const [rejected] = await tx.select({ id: sales.id }).from(sales).where(and(eq(sales.id, original.id), saleRejected)).limit(1);
      if (rejected) throw new DomainError('The owner rejected that sale, so nothing can be returned against it.', { key: 'error.saleRejected' });
      const [{ returned }] = await tx
        .select({ returned: sql<number>`coalesce(sum(${exchanges.returnedQuantity}), 0)::int` })
        .from(exchanges)
        .where(eq(exchanges.originalSaleId, original.id));
      const returnable = original.quantity - Number(returned);
      if (input.returnedQuantity > returnable) {
        throw returnable <= 0
          ? new DomainError('Everything from this sale has already been exchanged.', { key: 'error.allExchanged' })
          : new DomainError(`Only ${returnable} unit(s) from this sale can be returned.`, { key: 'error.onlyReturnable', vars: { n: returnable } });
      }

      const [issued] = await tx
        .select()
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.id, input.issuedProductId), eq(products.active, true)))
        .limit(1);
      if (!issued) throw new DomainError('New item not found.', { key: 'error.newNotFound' });
      if (input.issuedUnitPricePaise > issued.mrpPaise) throw new DomainError('New item price cannot be above MRP.', { key: 'error.newAboveMrp' });

      // Returned units back on the shelf first, so swapping for the same item works.
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${input.returnedQuantity}` })
        .where(eq(products.id, original.productId));
      const [afterIssue] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${input.issuedQuantity}` })
        .where(and(eq(products.id, issued.id), gte(products.stock, input.issuedQuantity)))
        .returning({ stock: products.stock });
      if (!afterIssue) {
        const [current] = await tx.select({ stock: products.stock }).from(products).where(eq(products.id, issued.id));
        throw (current?.stock ?? 0) <= 0
          ? new DomainError('The new item is out of stock.', { key: 'error.newOutOfStock' })
          : new DomainError(`Only ${current.stock} of the new item left.`, { key: 'error.newOnlyLeft', vars: { n: current.stock } });
      }

      const returnedValue = input.returnedQuantity * original.unitPricePaise;
      const issuedValue = input.issuedQuantity * input.issuedUnitPricePaise;
      const [exchange] = await tx
        .insert(exchanges)
        .values({
          storeId,
          operationId: input.operationId,
          originalSaleId: original.id,
          returnedProductId: original.productId,
          returnedQuantity: input.returnedQuantity,
          returnedUnitPricePaise: original.unitPricePaise,
          issuedProductId: issued.id,
          issuedSku: issued.sku,
          issuedProductName: issued.name,
          issuedSize: issued.size,
          issuedColor: issued.color,
          issuedQuantity: input.issuedQuantity,
          issuedUnitPricePaise: input.issuedUnitPricePaise,
          issuedMrpPaise: issued.mrpPaise,
          differencePaise: issuedValue - returnedValue,
          creditedTo: input.creditedTo,
          recordedBy: input.recordedBy,
        })
        .returning();
      await tx.insert(stockMovements).values([
        {
          storeId,
          productId: original.productId,
          quantityChange: input.returnedQuantity,
          reason: 'exchange_return' as const,
          refId: exchange.id,
          staffId: input.recordedBy,
        },
        {
          storeId,
          productId: issued.id,
          quantityChange: -input.issuedQuantity,
          reason: 'exchange_issue' as const,
          refId: exchange.id,
          staffId: input.recordedBy,
        },
      ]);
      if (await isOwner(tx, storeId, input.recordedBy)) await autoApproveOwnEntry(tx, { storeId, exchangeId: exchange.id, decidedBy: input.recordedBy });
      return { exchange, duplicate: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const again = await findExchangeByOperation(db, storeId, input.operationId);
      if (again) return { exchange: again, duplicate: true };
    }
    throw error;
  }
}

async function findExchangeByOperation(db: Db, storeId: string, operationId: string) {
  const [row] = await db
    .select()
    .from(exchanges)
    .where(and(eq(exchanges.storeId, storeId), eq(exchanges.operationId, operationId)))
    .limit(1);
  return row ?? null;
}
