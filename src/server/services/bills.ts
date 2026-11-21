import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { billCollections, billCompanies, bills, products, stockMovements, stockReceipts, supplierPayments, suppliers } from '@/db/schema';
import { STORE_TIMEZONE } from '@/lib/app-config';
import { packOf } from '@/lib/packs';
import { sortSizes } from '@/lib/size-prices';
import { DomainError, isUniqueViolation } from './errors';
import { cleanStockDate, shopToday } from './products';

/**
 * Bills section (owner's feedback 2026-11-21). A **bill** is the company's paper
 * bill, entered by the owner: a number, the day printed on it, one or more
 * companies, and the **collections** it covers. Nothing is typed as an amount:
 * each company's part is worked out from its collections on the bill (the
 * bill's total is their sum). A collection is one stock receipt — one
 * New item save (a design in its sizes) or one Receive stock entry — and is on
 * at most one bill. Dues come from bill amounts minus payments; a payment may
 * name a bill (that company's part of it).
 */

const ARRIVALS = ['opening', 'stock_in'] as const;
const tz = sql.raw(`'${STORE_TIMEZONE.replace(/'/g, "''")}'`);
/** Fits the integer column (₹2 crore); a bill is never near this. */
const MAX_PART = 2_000_000_000;

export type Collection = {
  receiptId: string;
  supplierId: string | null;
  supplierName: string | null;
  /** The stock date the owner gave, else the day it was entered (shop time), YYYY-MM-DD. */
  date: string;
  /** The reference number typed when the stock was entered (not a bill any more). */
  refNumber: string | null;
  names: string[];
  sizes: string[];
  items: number;
  pieces: number;
  /** Purchase price × pieces (the price on the day it arrived; today's price when not recorded). */
  valuePaise: number;
  estimated: boolean;
  billId: string | null;
  /** The lines as a paper bill has them: one per item name and purchase rate. */
  lines: BillLine[];
};

/**
 * One line of a bill: description, sizes, pieces, the quantity as the paper writes it
 * (pieces; boxes for box packs), the rate for that quantity (per piece; per box for
 * box packs, ADR-047) and the amount.
 */
export type BillLine = { name: string; sizes: string[]; pieces: number; qty: number; pack: number | null; ratePaise: number; amountPaise: number };

/** `deleted`: the company was deleted (ADR-051); the bill keeps its name and amounts. */
export type BillCompany = { supplierId: string; name: string; deleted: boolean; amountPaise: number; paidPaise: number; duePaise: number };
export type BillRow = {
  id: string;
  billNumber: string | null;
  billDate: string;
  /** The day it was entered here (shop time). */
  createdOn: string;
  note: string | null;
  companies: BillCompany[];
  totalPaise: number;
  paidPaise: number;
  duePaise: number;
  status: 'open' | 'paid';
  collections: number;
  pieces: number;
  valuePaise: number;
};
export type BillDetail = BillRow & { list: Collection[]; hasPayments: boolean };

/** Collections with their figures: by id, or the ones on no bill yet (newest first). */
export async function listCollections(
  db: Db,
  storeId: string,
  { receiptIds, unbilled = false, limit = 200 }: { receiptIds?: string[]; unbilled?: boolean; limit?: number } = {},
): Promise<Collection[]> {
  if (receiptIds && receiptIds.length === 0) return [];
  const rows = await db
    .select({
      receiptId: stockReceipts.id,
      supplierId: stockReceipts.supplierId,
      supplierName: suppliers.name,
      day: sql<string>`coalesce(${stockReceipts.stockDate}::text, to_char(${stockReceipts.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD'))`,
      createdAt: stockReceipts.createdAt,
      refNumber: stockReceipts.billNumber,
      billId: billCollections.billId,
      productId: products.id,
      name: products.name,
      size: products.size,
      pieces: stockMovements.quantityChange,
      unitCost: sql<number | null>`coalesce(${stockMovements.unitCostPaise}, ${products.costPaise})`,
      snapshot: stockMovements.unitCostPaise,
      packSize: products.packSize,
      packCost: products.packCostPaise,
    })
    .from(stockReceipts)
    .leftJoin(suppliers, eq(suppliers.id, stockReceipts.supplierId))
    .leftJoin(billCollections, eq(billCollections.receiptId, stockReceipts.id))
    .innerJoin(stockMovements, and(eq(stockMovements.refId, stockReceipts.id), inArray(stockMovements.reason, [...ARRIVALS])))
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(
      and(
        eq(stockReceipts.storeId, storeId),
        receiptIds ? inArray(stockReceipts.id, receiptIds) : undefined,
        unbilled ? isNull(billCollections.billId) : undefined,
      ),
    )
    .orderBy(desc(stockReceipts.createdAt), stockMovements.createdAt, products.sku);
  const byId = new Map<string, Collection & { products: Set<string>; at: number }>();
  for (const row of rows) {
    let c = byId.get(row.receiptId);
    if (!c) {
      if (byId.size >= limit) continue;
      c = {
        receiptId: row.receiptId,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        date: row.day,
        refNumber: row.refNumber?.trim() || null,
        names: [],
        sizes: [],
        items: 0,
        pieces: 0,
        valuePaise: 0,
        estimated: false,
        billId: row.billId,
        lines: [],
        products: new Set(),
        at: row.createdAt.getTime(),
      };
      byId.set(row.receiptId, c);
    }
    const pieces = row.pieces ?? 0;
    c.products.add(row.productId);
    if (!c.names.includes(row.name)) c.names.push(row.name);
    if (!c.sizes.includes(row.size)) c.sizes.push(row.size);
    c.pieces += pieces;
    // Box packs (ADR-047): the paper bill writes boxes at a box rate; the box price typed at New item is exact.
    const pack = packOf(row.packSize);
    const rate = pack ? (row.packCost ?? Number(row.unitCost ?? 0) * pack) : Number(row.unitCost ?? 0);
    const amount = pack ? Math.round((pieces * rate) / pack) : pieces * rate;
    c.valuePaise += amount;
    let line = c.lines.find((l) => l.name === row.name && l.ratePaise === rate && l.pack === pack);
    if (!line) c.lines.push((line = { name: row.name, sizes: [], pieces: 0, qty: 0, pack, ratePaise: rate, amountPaise: 0 }));
    if (!line.sizes.includes(row.size)) line.sizes.push(row.size);
    line.pieces += pieces;
    line.qty = pack ? line.pieces / pack : line.pieces;
    line.amountPaise += amount;
    if (row.snapshot === null && row.unitCost !== null) c.estimated = true;
  }
  return [...byId.values()]
    .sort((a, b) => b.at - a.at)
    .map((c) => ({
      receiptId: c.receiptId, supplierId: c.supplierId, supplierName: c.supplierName, date: c.date, refNumber: c.refNumber, names: c.names,
      sizes: sortSizes(c.sizes), items: c.products.size, pieces: c.pieces, valuePaise: c.valuePaise, estimated: c.estimated, billId: c.billId,
      lines: c.lines.map((l) => ({ ...l, sizes: sortSizes(l.sizes) })),
    }));
}

export type BillInput = {
  operationId: string;
  billNumber?: string | null;
  billDate?: string | null;
  note?: string | null;
  /** The companies on the bill, in the order chosen. */
  companies: string[];
  /** The collections on it; each must be one of the chosen companies' and on no other bill. */
  receiptIds: string[];
  staffId: string;
};

function cleanCompanyIds(companies: string[]): string[] {
  const out = [...new Set((companies ?? []).filter(Boolean))];
  if (out.length === 0) throw new DomainError('Choose at least one company.', { key: 'bill.err.company' });
  return out;
}

function cleanBillDate(raw: string | null | undefined): string {
  try {
    return cleanStockDate(raw) ?? shopToday();
  } catch {
    throw new DomainError('Enter a valid bill date (not after today).', { key: 'bill.err.date' });
  }
}

async function checkCompanies(db: Db, storeId: string, ids: string[]) {
  const found = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.storeId, storeId), inArray(suppliers.id, ids)));
  if (found.length !== ids.length) throw new DomainError('Choose at least one company.', { key: 'bill.err.company' });
}

/** Adds collections to a bill: each must be this shop's, one of the bill's companies', and on no other bill. */
async function attach(db: Db, storeId: string, billId: string, receiptIds: string[], companies: string[]) {
  const unique = [...new Set(receiptIds)];
  if (unique.length === 0) return;
  const found = await db
    .select({ id: stockReceipts.id, supplierId: stockReceipts.supplierId })
    .from(stockReceipts)
    .where(and(eq(stockReceipts.storeId, storeId), inArray(stockReceipts.id, unique)));
  if (found.length !== unique.length) throw new DomainError('A collection was not found.', { key: 'bill.err.collection' });
  if (found.some((r) => !r.supplierId || !companies.includes(r.supplierId))) {
    throw new DomainError('A collection is from a company that is not on this bill.', { key: 'bill.err.otherCompany' });
  }
  try {
    await db.insert(billCollections).values(unique.map((receiptId) => ({ billId, receiptId })));
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('A collection is already on another bill.', { key: 'bill.err.taken' });
    throw error;
  }
}

/**
 * The bill's amounts (owner's feedback 2026-11-21: never typed): each company's
 * part is the value of its collections on the bill — purchase price × pieces,
 * at the price on the day they arrived. Stored, so later price changes do not
 * move a bill.
 */
export async function recompute(db: Db, storeId: string, billId: string) {
  const links = await db.select({ receiptId: billCollections.receiptId }).from(billCollections).where(eq(billCollections.billId, billId));
  const list = await listCollections(db, storeId, { receiptIds: links.map((l) => l.receiptId), limit: 10_000 });
  const parts = await db.select({ id: billCompanies.id, supplierId: billCompanies.supplierId }).from(billCompanies).where(eq(billCompanies.billId, billId));
  for (const part of parts) {
    const amount = list.filter((c) => c.supplierId === part.supplierId).reduce((n, c) => n + c.valuePaise, 0);
    await db.update(billCompanies).set({ amountPaise: Math.min(amount, MAX_PART) }).where(eq(billCompanies.id, part.id));
  }
}

/** A new bill from the chosen companies and collections; its amount is worked out. The same operation id again returns the first bill. */
export async function createBill(db: Db, storeId: string, input: BillInput): Promise<{ id: string; duplicate: boolean }> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.', { key: 'stk.err.operationId' });
  const [existing] = await db.select({ id: bills.id }).from(bills).where(and(eq(bills.storeId, storeId), eq(bills.operationId, input.operationId))).limit(1);
  if (existing) return { id: existing.id, duplicate: true };
  const companies = cleanCompanyIds(input.companies);
  if (!input.receiptIds?.length) throw new DomainError('Tick at least one collection.', { key: 'bill.err.noCollection' });
  const billDate = cleanBillDate(input.billDate);
  await checkCompanies(db, storeId, companies);
  return db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    const [bill] = await tx
      .insert(bills)
      .values({
        storeId,
        operationId: input.operationId,
        billNumber: input.billNumber?.trim().slice(0, 40) || null,
        billDate,
        note: input.note?.trim().slice(0, 200) || null,
        staffId: input.staffId,
      })
      .returning({ id: bills.id });
    await tx.insert(billCompanies).values(companies.map((supplierId) => ({ billId: bill.id, supplierId, amountPaise: 0 })));
    await attach(t, storeId, bill.id, input.receiptIds, companies);
    await recompute(t, storeId, bill.id);
    return { id: bill.id, duplicate: false };
  });
}

async function ownBill(db: Db, storeId: string, id: string) {
  const [bill] = await db.select().from(bills).where(and(eq(bills.storeId, storeId), eq(bills.id, id))).limit(1);
  if (!bill) throw new DomainError('Bill not found.', { key: 'bill.err.notFound' });
  return bill;
}

async function billCompanyIds(db: Db, billId: string): Promise<string[]> {
  return (await db.select({ id: billCompanies.supplierId }).from(billCompanies).where(eq(billCompanies.billId, billId))).map((r) => r.id);
}

/**
 * Changes the number, date, note and companies. A company taken off takes its
 * collections with it; a company with payments on this bill stays.
 */
export async function updateBill(
  db: Db,
  storeId: string,
  id: string,
  input: { billNumber?: string | null; billDate?: string | null; note?: string | null; companies: string[] },
): Promise<void> {
  await ownBill(db, storeId, id);
  const companies = cleanCompanyIds(input.companies);
  const billDate = cleanBillDate(input.billDate);
  await checkCompanies(db, storeId, companies);
  const paidCompanies = await db.selectDistinct({ id: supplierPayments.supplierId }).from(supplierPayments).where(eq(supplierPayments.billId, id));
  if (paidCompanies.some((p) => !companies.includes(p.id))) {
    throw new DomainError('A company with payments on this bill cannot be taken off it.', { key: 'bill.err.paidCompany' });
  }
  const before = await billCompanyIds(db, id);
  const gone = before.filter((c) => !companies.includes(c));
  const added = companies.filter((c) => !before.includes(c));
  await db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    await tx
      .update(bills)
      .set({ billNumber: input.billNumber?.trim().slice(0, 40) || null, billDate, note: input.note?.trim().slice(0, 200) || null })
      .where(eq(bills.id, id));
    if (gone.length) {
      const theirs = await tx
        .select({ id: stockReceipts.id })
        .from(stockReceipts)
        .innerJoin(billCollections, eq(billCollections.receiptId, stockReceipts.id))
        .where(and(eq(billCollections.billId, id), inArray(stockReceipts.supplierId, gone)));
      if (theirs.length) await tx.delete(billCollections).where(and(eq(billCollections.billId, id), inArray(billCollections.receiptId, theirs.map((r) => r.id))));
      await tx.delete(billCompanies).where(and(eq(billCompanies.billId, id), inArray(billCompanies.supplierId, gone)));
    }
    if (added.length) await tx.insert(billCompanies).values(added.map((supplierId) => ({ billId: id, supplierId, amountPaise: 0 })));
    await recompute(t, storeId, id);
  });
}

/** Adds and takes off collections; the amounts follow. */
export async function setBillCollections(db: Db, storeId: string, id: string, { add = [], remove = [] }: { add?: string[]; remove?: string[] }): Promise<void> {
  await ownBill(db, storeId, id);
  const companies = await billCompanyIds(db, id);
  await db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    if (remove.length) await tx.delete(billCollections).where(and(eq(billCollections.billId, id), inArray(billCollections.receiptId, remove)));
    await attach(t, storeId, id, add, companies);
    await recompute(t, storeId, id);
  });
}

/** Deletes a bill (its collections go back to "not on a bill"). Not when payments name it. */
export async function deleteBill(db: Db, storeId: string, id: string): Promise<void> {
  await ownBill(db, storeId, id);
  const [paid] = await db.select({ id: supplierPayments.id }).from(supplierPayments).where(eq(supplierPayments.billId, id)).limit(1);
  if (paid) throw new DomainError('This bill has payments; it cannot be deleted.', { key: 'bill.err.hasPayments' });
  await db.delete(bills).where(eq(bills.id, id));
}

/** Every bill (newest bill date first), or one company's, or some by id, with companies, paid, due and collection figures. */
export async function listBills(db: Db, storeId: string, { supplierId, ids }: { supplierId?: string; ids?: string[] } = {}): Promise<BillRow[]> {
  if (ids && ids.length === 0) return [];
  const billRows = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      billDate: bills.billDate,
      createdOn: sql<string>`to_char(${bills.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
      note: bills.note,
      createdAt: bills.createdAt,
    })
    .from(bills)
    .where(
      and(
        eq(bills.storeId, storeId),
        ids ? inArray(bills.id, ids) : undefined,
        supplierId ? sql`exists (select 1 from ${billCompanies} where ${billCompanies.billId} = ${bills.id} and ${billCompanies.supplierId} = ${supplierId})` : undefined,
      ),
    )
    .orderBy(desc(bills.billDate), desc(bills.createdAt));
  if (billRows.length === 0) return [];
  const billIds = billRows.map((b) => b.id);
  const [parts, paid, links] = await Promise.all([
    db
      .select({ billId: billCompanies.billId, supplierId: billCompanies.supplierId, name: suppliers.name, deletedAt: suppliers.deletedAt, amountPaise: billCompanies.amountPaise })
      .from(billCompanies)
      .innerJoin(suppliers, eq(suppliers.id, billCompanies.supplierId))
      .where(inArray(billCompanies.billId, billIds)),
    db
      .select({ billId: supplierPayments.billId, supplierId: supplierPayments.supplierId, paid: sql<number>`sum(${supplierPayments.amountPaise})`.mapWith(Number) })
      .from(supplierPayments)
      .where(inArray(supplierPayments.billId, billIds))
      .groupBy(supplierPayments.billId, supplierPayments.supplierId),
    db.select({ billId: billCollections.billId, receiptId: billCollections.receiptId }).from(billCollections).where(inArray(billCollections.billId, billIds)),
  ]);
  const collections = await listCollections(db, storeId, { receiptIds: links.map((l) => l.receiptId), limit: 10_000 });
  return billRows.map((b) => {
    const companies = parts
      .filter((p) => p.billId === b.id)
      .map((p) => {
        const paidPaise = paid.find((x) => x.billId === b.id && x.supplierId === p.supplierId)?.paid ?? 0;
        return { supplierId: p.supplierId, name: p.name, deleted: p.deletedAt !== null, amountPaise: p.amountPaise, paidPaise, duePaise: Math.max(0, p.amountPaise - paidPaise) };
      })
      .sort((a, c) => a.name.localeCompare(c.name));
    const mine = collections.filter((c) => links.some((l) => l.billId === b.id && l.receiptId === c.receiptId));
    const totalPaise = companies.reduce((n, c) => n + c.amountPaise, 0);
    const paidPaise = companies.reduce((n, c) => n + c.paidPaise, 0);
    const duePaise = companies.reduce((n, c) => n + c.duePaise, 0);
    return {
      id: b.id,
      billNumber: b.billNumber,
      billDate: b.billDate,
      createdOn: b.createdOn,
      note: b.note,
      companies,
      totalPaise,
      paidPaise,
      duePaise,
      status: duePaise > 0 ? 'open' : 'paid',
      collections: mine.length,
      pieces: mine.reduce((n, c) => n + c.pieces, 0),
      valuePaise: mine.reduce((n, c) => n + c.valuePaise, 0),
    };
  });
}

export async function getBill(db: Db, storeId: string, id: string): Promise<BillDetail | null> {
  const [row] = await listBills(db, storeId, { ids: [id] });
  if (!row) return null;
  const links = await db.select({ receiptId: billCollections.receiptId }).from(billCollections).where(eq(billCollections.billId, id));
  const [payment] = await db.select({ id: supplierPayments.id }).from(supplierPayments).where(eq(supplierPayments.billId, id)).limit(1);
  return { ...row, list: await listCollections(db, storeId, { receiptIds: links.map((l) => l.receiptId), limit: 10_000 }), hasPayments: Boolean(payment) };
}

/** Home's Bills line: how many bills, how many still open, and the dues on them. */
export async function billsSummary(db: Db, storeId: string): Promise<{ bills: number; open: number; duePaise: number }> {
  const rows = await listBills(db, storeId);
  return { bills: rows.length, open: rows.filter((b) => b.status === 'open').length, duePaise: rows.reduce((n, b) => n + b.duePaise, 0) };
}
