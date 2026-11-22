import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { billCollections, billCompanies, billItems, bills, products, stockMovements, stockReceipts, supplierPayments, suppliers } from '@/db/schema';
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
 *
 * A bill stands on its own (owner's feedback 2026-11-22, ADR-060): with no company it
 * is made from items of the shop's stock, added one by one — each line the bill's own
 * copy (name, size, quantity, the purchase price then, amount). Such a bill is a record:
 * its total, no dues. With a company it works as above, and the company's page lists it.
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
export type BillLine = { name: string; sizes: string[]; pieces: number; qty: number; pack: number | null; ratePaise: number; amountPaise: number; noRate?: boolean };

/** A line of a bill made from items (ADR-060), as the bill keeps it. `ratePaise` null = no purchase price (N/A). */
/** `pack`: a box item (ADR-047) — `qty` is boxes and `ratePaise` is per box. */
export type BillItemLine = { id: string; productId: string | null; name: string; size: string; color: string; sku: string; pack: number | null; qty: number; ratePaise: number | null; amountPaise: number };

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
  /** 'record': a bill with no company (ADR-060) — its total, nothing owed. */
  status: 'open' | 'paid' | 'record';
  collections: number;
  /** Lines added from the shop's items (a bill with no company). */
  items: number;
  pieces: number;
  valuePaise: number;
};
export type BillDetail = BillRow & { list: Collection[]; itemLines: BillItemLine[]; hasPayments: boolean };

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
  /**
   * The shop's items on the bill, in order (ADR-060/061): how many and the rate — left out
   * (undefined) = the item's purchase price now; null = none (N/A, amount 0).
   */
  items?: BillLineInput[];
  staffId: string;
};

/** A line as the bill editor sends it: a new item (`productId`) or a line already on the bill (`lineId`). */
export type BillLineInput = { lineId?: string; productId?: string; quantity: number; ratePaise?: number | null };

export const BILL_ITEMS_MAX = 200;

/** The lines as asked: whole quantities from 1, rates in whole paise; a new item twice at one rate = one line. */
function cleanLines(lines: BillLineInput[] | undefined): BillLineInput[] {
  const out: BillLineInput[] = [];
  for (const line of lines ?? []) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100_000) {
      throw new DomainError('Quantity must be a whole number, at least 1.', { key: 'stk.err.quantity' });
    }
    if (line.ratePaise != null && (!Number.isSafeInteger(line.ratePaise) || line.ratePaise < 0 || line.ratePaise > MAX_PART)) {
      throw new DomainError('Enter a valid rate in rupees.', { key: 'bill.err.rate' });
    }
    if (!line.lineId && !line.productId) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
    const same = !line.lineId && out.find((o) => !o.lineId && o.productId === line.productId && o.ratePaise === line.ratePaise);
    if (same) same.quantity += line.quantity;
    else out.push({ ...line });
  }
  if (out.length > BILL_ITEMS_MAX) throw new DomainError(`Up to ${BILL_ITEMS_MAX} items on one bill.`, { key: 'bill.err.tooManyItems', vars: { n: BILL_ITEMS_MAX } });
  return out;
}

type KeptLine = { productId: string | null; ratePaise: number | null; snapshot: Record<string, unknown> };

/**
 * Writes the bill's lines in order as its own copy (ADR-054/060): a new item is copied as
 * it is today (name, size, colour, code, company); a line already on the bill keeps its copy.
 */
async function writeLines(db: Db, storeId: string, billId: string, lines: BillLineInput[], kept: Map<string, KeptLine> = new Map()) {
  const ids = [...new Set(lines.filter((l) => !l.lineId).map((l) => l.productId as string))];
  const rows = ids.length
    ? await db
        .select({
          id: products.id,
          name: products.name,
          size: products.size,
          color: products.color,
          sku: products.sku,
          costPaise: products.costPaise,
          packSize: products.packSize,
          packCostPaise: products.packCostPaise,
          company: suppliers.name,
        })
        .from(products)
        .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
        .where(and(eq(products.storeId, storeId), inArray(products.id, ids)))
    : [];
  if (rows.length !== ids.length) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
  const values = lines.map((line, i) => {
    let productId: string | null;
    let snapshot: Record<string, unknown>;
    let ratePaise: number | null;
    if (line.lineId) {
      const old = kept.get(line.lineId);
      if (!old) throw new DomainError('Bill not found.', { key: 'bill.err.notFound' });
      ({ productId, snapshot } = old);
      ratePaise = line.ratePaise === undefined ? old.ratePaise : line.ratePaise;
    } else {
      const p = rows.find((r) => r.id === line.productId)!;
      productId = p.id;
      // A box item (ADR-047) is billed by the box: quantity in boxes, the box's purchase price.
      snapshot = { name: p.name, size: p.size, color: p.color, sku: p.sku, companyName: p.company ?? null, pack: p.packSize ?? null };
      const boxRate = p.packSize ? (p.packCostPaise ?? (p.costPaise === null ? null : p.costPaise * p.packSize)) : p.costPaise;
      ratePaise = line.ratePaise === undefined ? boxRate : line.ratePaise;
    }
    const amountPaise = ratePaise === null ? 0 : ratePaise * line.quantity;
    if (amountPaise > MAX_PART) throw new DomainError('The bill amount is too large.', { key: 'bill.err.amount' });
    return { billId, productId, position: i + 1, quantity: line.quantity, ratePaise, amountPaise, snapshot };
  });
  if (values.length) await db.insert(billItems).values(values);
}

/** A bill's item lines as it keeps them, in order. */
async function itemLinesOf(db: Db, billIds: string[]): Promise<(BillItemLine & { billId: string })[]> {
  if (billIds.length === 0) return [];
  const rows = await db.select().from(billItems).where(inArray(billItems.billId, billIds)).orderBy(billItems.billId, billItems.position);
  return rows.map((r) => {
    const copy = r.snapshot as { name?: string; size?: string; color?: string; sku?: string; pack?: number | null };
    return {
      id: r.id,
      billId: r.billId,
      productId: r.productId,
      name: copy.name ?? '',
      size: copy.size ?? '',
      color: copy.color ?? '',
      sku: copy.sku ?? '',
      pack: copy.pack ?? null,
      qty: r.quantity,
      ratePaise: r.ratePaise,
      amountPaise: r.amountPaise,
    };
  });
}

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
  // The bill's own copy of each entry as it is now (ADR-054): later changes to items or companies never reach it.
  const live = await listCollections(db, storeId, { receiptIds: unique, limit: 10_000 });
  const copyOf = (receiptId: string): Collection => {
    const entry = live.find((c) => c.receiptId === receiptId);
    if (entry) return { ...entry, billId };
    const supplierId = found.find((r) => r.id === receiptId)?.supplierId ?? null;
    return { receiptId, supplierId, supplierName: null, date: '', refNumber: null, names: [], sizes: [], items: 0, pieces: 0, valuePaise: 0, estimated: false, billId, lines: [] };
  };
  try {
    await db.insert(billCollections).values(unique.map((receiptId) => ({ billId, receiptId, snapshot: copyOf(receiptId) as unknown as Record<string, unknown> })));
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('A collection is already on another bill.', { key: 'bill.err.taken' });
    throw error;
  }
}

/** Each company's part of a new bill, with the company's name copied onto the bill (ADR-054). */
async function companyParts(db: Db, billId: string, ids: string[]) {
  const names = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(inArray(suppliers.id, ids));
  return ids.map((supplierId) => ({ billId, supplierId, companyName: names.find((n) => n.id === supplierId)?.name ?? '', amountPaise: 0 }));
}

/**
 * The bill's copies of its stock entries (ADR-054), by bill. An entry put on a bill
 * before copies were kept (no copy yet) is read as it is now.
 */
async function billCopies(db: Db, storeId: string, billIds: string[]): Promise<{ billId: string; entry: Collection }[]> {
  if (billIds.length === 0) return [];
  const rows = await db
    .select({ billId: billCollections.billId, receiptId: billCollections.receiptId, snapshot: billCollections.snapshot })
    .from(billCollections)
    .where(inArray(billCollections.billId, billIds));
  const missing = rows.filter((r) => !r.snapshot).map((r) => r.receiptId);
  const live = missing.length ? await listCollections(db, storeId, { receiptIds: missing, limit: 10_000 }) : [];
  return rows
    .map((r) => ({ billId: r.billId, entry: (r.snapshot as unknown as Collection | null) ?? live.find((c) => c.receiptId === r.receiptId) ?? null }))
    .filter((r): r is { billId: string; entry: Collection } => r.entry !== null)
    .sort((a, b) => (b.entry.date ?? '').localeCompare(a.entry.date ?? ''));
}

/**
 * The bill's amounts (owner's feedback 2026-11-21: never typed): each company's
 * part is the value of its stock entries on the bill — purchase price × pieces,
 * at the price on the day they arrived — taken from the bill's own copy of
 * those entries (ADR-054), so later changes to items or companies never move it.
 * Run only when the bill itself is edited.
 */
export async function recompute(db: Db, storeId: string, billId: string) {
  const list = (await billCopies(db, storeId, [billId])).map((r) => r.entry);
  const parts = await db.select({ id: billCompanies.id, supplierId: billCompanies.supplierId }).from(billCompanies).where(eq(billCompanies.billId, billId));
  // Item lines (ADR-061) belong to the bill's one company.
  const items = await db.select({ amount: billItems.amountPaise }).from(billItems).where(eq(billItems.billId, billId));
  const itemsPaise = parts.length === 1 ? items.reduce((n, i) => n + i.amount, 0) : 0;
  for (const part of parts) {
    const amount = list.filter((c) => c.supplierId === part.supplierId).reduce((n, c) => n + c.valuePaise, 0) + itemsPaise;
    await db.update(billCompanies).set({ amountPaise: Math.min(amount, MAX_PART) }).where(eq(billCompanies.id, part.id));
  }
}

/** A new bill from the chosen companies and collections; its amount is worked out. The same operation id again returns the first bill. */
export async function createBill(db: Db, storeId: string, input: BillInput): Promise<{ id: string; duplicate: boolean }> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.', { key: 'stk.err.operationId' });
  const [existing] = await db.select({ id: bills.id }).from(bills).where(and(eq(bills.storeId, storeId), eq(bills.operationId, input.operationId))).limit(1);
  if (existing) return { id: existing.id, duplicate: true };
  // New lines only: a new bill has no lines to keep.
  const items = cleanLines((input.items ?? []).map((line) => ({ productId: line.productId, quantity: line.quantity, ratePaise: line.ratePaise })));
  const companies = [...new Set((input.companies ?? []).filter(Boolean))];
  const receiptIds = input.receiptIds ?? [];
  if (items.length > 0 && receiptIds.length > 0) throw new DomainError('A bill has items or stock entries, not both.', { key: 'bill.err.mixed' });
  if (items.length > 0 && companies.length > 1) throw new DomainError('A bill made from items has one company, or none.', { key: 'bill.err.oneCompany' });
  if (items.length === 0 && receiptIds.length === 0) {
    if (companies.length === 0) throw new DomainError('Choose a company, or add items.', { key: 'bill.err.nothing' });
    throw new DomainError('Add at least one item.', { key: 'bill.err.noItems' });
  }
  // Stock entries (the earlier way, ADR-044) always come with their company.
  if (receiptIds.length > 0 && companies.length === 0) throw new DomainError('Choose at least one company.', { key: 'bill.err.company' });
  const billDate = cleanBillDate(input.billDate);
  if (companies.length > 0) await checkCompanies(db, storeId, companies);
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
    if (companies.length > 0) await tx.insert(billCompanies).values(await companyParts(t, bill.id, companies));
    if (items.length > 0) await writeLines(t, storeId, bill.id, items);
    else await attach(t, storeId, bill.id, receiptIds, companies);
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
  const billDate = cleanBillDate(input.billDate);
  // A bill made from items (ADR-060) keeps no company: only its number, date and note change.
  const [anItem] = await db.select({ id: billItems.id }).from(billItems).where(eq(billItems.billId, id)).limit(1);
  if (anItem) {
    await db
      .update(bills)
      .set({ billNumber: input.billNumber?.trim().slice(0, 40) || null, billDate, note: input.note?.trim().slice(0, 200) || null })
      .where(eq(bills.id, id));
    return;
  }
  const companies = cleanCompanyIds(input.companies);
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
    if (added.length) await tx.insert(billCompanies).values(await companyParts(t, id, added));
    await recompute(t, storeId, id);
  });
}

/**
 * Edit bill for a bill made from items (owner's feedback 2026-11-22, ADR-061): number, date,
 * note, its one company (or none) and its lines — quantities and rates changed, lines taken
 * off or added. A line already on the bill keeps its own copy of the item; a company with
 * payments on this bill stays. A bill of stock entries is changed through those instead.
 */
export async function updateItemBill(
  db: Db,
  storeId: string,
  id: string,
  input: { billNumber?: string | null; billDate?: string | null; note?: string | null; supplierId: string | null; lines: BillLineInput[] },
): Promise<void> {
  await ownBill(db, storeId, id);
  const [entry] = await db.select({ id: billCollections.receiptId }).from(billCollections).where(eq(billCollections.billId, id)).limit(1);
  if (entry) throw new DomainError('This bill is made of stock entries; change those instead.', { key: 'bill.err.stockEntryBill' });
  const lines = cleanLines(input.lines);
  if (lines.length === 0) throw new DomainError('Add at least one item.', { key: 'bill.err.noItems' });
  const billDate = cleanBillDate(input.billDate);
  const supplierId = input.supplierId || null;
  if (supplierId) await checkCompanies(db, storeId, [supplierId]);
  const paid = await db.selectDistinct({ id: supplierPayments.supplierId }).from(supplierPayments).where(eq(supplierPayments.billId, id));
  if (paid.some((p) => p.id !== supplierId)) throw new DomainError('A company with payments on this bill cannot be taken off it.', { key: 'bill.err.paidCompany' });
  const before = await db.select().from(billItems).where(eq(billItems.billId, id));
  const kept = new Map(before.map((r) => [r.id, { productId: r.productId, ratePaise: r.ratePaise, snapshot: r.snapshot as Record<string, unknown> }]));
  const companies = await billCompanyIds(db, id);
  await db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    await tx
      .update(bills)
      .set({ billNumber: input.billNumber?.trim().slice(0, 40) || null, billDate, note: input.note?.trim().slice(0, 200) || null })
      .where(eq(bills.id, id));
    const gone = companies.filter((c) => c !== supplierId);
    if (gone.length) await tx.delete(billCompanies).where(and(eq(billCompanies.billId, id), inArray(billCompanies.supplierId, gone)));
    if (supplierId && !companies.includes(supplierId)) await tx.insert(billCompanies).values(await companyParts(t, id, [supplierId]));
    await tx.delete(billItems).where(eq(billItems.billId, id));
    await writeLines(t, storeId, id, lines, kept);
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
  const [parts, paid, links, lines] = await Promise.all([
    db
      .select({
        billId: billCompanies.billId,
        supplierId: billCompanies.supplierId,
        // The bill's own copy of the name (ADR-054); the company's current name only if no copy.
        name: sql<string>`coalesce(nullif(${billCompanies.companyName}, ''), ${suppliers.name}, '')`,
        deletedAt: suppliers.deletedAt,
        amountPaise: billCompanies.amountPaise,
      })
      .from(billCompanies)
      .leftJoin(suppliers, eq(suppliers.id, billCompanies.supplierId))
      .where(inArray(billCompanies.billId, billIds)),
    db
      .select({ billId: supplierPayments.billId, supplierId: supplierPayments.supplierId, paid: sql<number>`sum(${supplierPayments.amountPaise})`.mapWith(Number) })
      .from(supplierPayments)
      .where(inArray(supplierPayments.billId, billIds))
      .groupBy(supplierPayments.billId, supplierPayments.supplierId),
    billCopies(db, storeId, billIds),
    itemLinesOf(db, billIds),
  ]);
  return billRows.map((b) => {
    const companies = parts
      .filter((p) => p.billId === b.id)
      .map((p) => {
        const paidPaise = paid.find((x) => x.billId === b.id && x.supplierId === p.supplierId)?.paid ?? 0;
        return { supplierId: p.supplierId, name: p.name, deleted: p.deletedAt !== null, amountPaise: p.amountPaise, paidPaise, duePaise: Math.max(0, p.amountPaise - paidPaise) };
      })
      .sort((a, c) => a.name.localeCompare(c.name));
    const mine = links.filter((l) => l.billId === b.id).map((l) => l.entry);
    const itemsOf = lines.filter((l) => l.billId === b.id);
    const itemsPaise = itemsOf.reduce((n, l) => n + l.amountPaise, 0);
    // A company's part already holds its items (recompute); with no company the items are the total.
    const totalPaise = companies.length > 0 ? companies.reduce((n, c) => n + c.amountPaise, 0) : itemsPaise;
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
      status: companies.length === 0 ? 'record' : duePaise > 0 ? 'open' : 'paid',
      collections: mine.length,
      items: itemsOf.length,
      pieces: mine.reduce((n, c) => n + c.pieces, 0) + itemsOf.reduce((n, l) => n + l.qty * (l.pack ?? 1), 0),
      valuePaise: mine.reduce((n, c) => n + c.valuePaise, 0) + itemsPaise,
    };
  });
}

export async function getBill(db: Db, storeId: string, id: string): Promise<BillDetail | null> {
  const [row] = await listBills(db, storeId, { ids: [id] });
  if (!row) return null;
  const [payment] = await db.select({ id: supplierPayments.id }).from(supplierPayments).where(eq(supplierPayments.billId, id)).limit(1);
  // The bill's own copy of its entries (ADR-054), never today's items.
  return {
    ...row,
    list: (await billCopies(db, storeId, [id])).map((r) => r.entry),
    itemLines: await itemLinesOf(db, [id]),
    hasPayments: Boolean(payment),
  };
}

/** Home's Bills line: how many bills, how many still open, and the dues on them. */
export async function billsSummary(db: Db, storeId: string): Promise<{ bills: number; open: number; duePaise: number }> {
  const rows = await listBills(db, storeId);
  return { bills: rows.length, open: rows.filter((b) => b.status === 'open').length, duePaise: rows.reduce((n, b) => n + b.duePaise, 0) };
}

/**
 * One-time (ADR-054, scripts/backfill-bill-copies.ts): bills made before copies were
 * kept get one now, from the stock entries as they are today. Returns how many.
 */
export async function backfillBillCopies(db: Db, storeId: string): Promise<number> {
  const rows = await db
    .select({ billId: billCollections.billId, receiptId: billCollections.receiptId, supplierId: stockReceipts.supplierId })
    .from(billCollections)
    .innerJoin(bills, eq(bills.id, billCollections.billId))
    .leftJoin(stockReceipts, eq(stockReceipts.id, billCollections.receiptId))
    .where(and(eq(bills.storeId, storeId), isNull(billCollections.snapshot)));
  if (rows.length === 0) return 0;
  const live = await listCollections(db, storeId, { receiptIds: rows.map((r) => r.receiptId), limit: 10_000 });
  for (const row of rows) {
    const entry: Collection = live.find((c) => c.receiptId === row.receiptId) ?? {
      receiptId: row.receiptId, supplierId: row.supplierId, supplierName: null, date: '', refNumber: null, names: [], sizes: [], items: 0, pieces: 0, valuePaise: 0, estimated: false, billId: row.billId, lines: [],
    };
    await db
      .update(billCollections)
      .set({ snapshot: { ...entry, billId: row.billId } as unknown as Record<string, unknown> })
      .where(and(eq(billCollections.billId, row.billId), eq(billCollections.receiptId, row.receiptId)));
  }
  return rows.length;
}
