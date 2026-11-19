import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { categories, products, sections, stockMovements, stockReceipts } from '@/db/schema';
import { STORE_TIMEZONE } from '@/lib/app-config';

/**
 * Plan v19 — everything bought from one company: its bills, month by month,
 * and by type (Man › Jeans …). A bill is every delivery entered with the same
 * bill number (a delivery without a number is its own bill). A bill's amount
 * is worked out: purchase price × pieces of each item on it (owner's choice).
 * Amounts are left out (null) for people without the purchase-price right.
 */
export type CompanyBillLine = {
  productId: string;
  name: string;
  size: string;
  color: string;
  type: string;
  section: string | null;
  pieces: number;
  amountPaise: number | null;
};
export type CompanyBill = {
  key: string;
  billNumber: string | null;
  /** The stock date the owner gave, else the day it was entered (shop time), YYYY-MM-DD. */
  date: string;
  receiptIds: string[];
  items: number;
  pieces: number;
  amountPaise: number | null;
  lines: CompanyBillLine[];
};
export type CompanyMonth = { month: string; bills: number; items: number; pieces: number; amountPaise: number | null };
export type CompanyTypeRow = { section: string | null; type: string; items: number; pieces: number; amountPaise: number | null };
export type CompanyReport = {
  totals: { bills: number; items: number; pieces: number; amountPaise: number | null; types: number };
  bills: CompanyBill[];
  months: CompanyMonth[];
  types: CompanyTypeRow[];
};
export type CompanySummary = { bills: number; pieces: number; amountPaise: number | null; lastDate: string | null };

const tz = sql.raw(`'${STORE_TIMEZONE.replace(/'/g, "''")}'`);
const int = (expression: ReturnType<typeof sql>) => sql<number>`${expression}`.mapWith(Number);
const ARRIVALS = ['opening', 'stock_in'] as const;

/** Which bill a delivery belongs to: its bill number (any letter case), else itself. */
export function billKey(receiptId: string, billNumber: string | null): string {
  const number = billNumber?.trim();
  return number ? `no:${number.toLowerCase()}` : `r:${receiptId}`;
}

export async function companyReport(db: Db, storeId: string, supplierId: string, { amounts }: { amounts: boolean }): Promise<CompanyReport> {
  const rows = await db
    .select({
      receiptId: stockReceipts.id,
      billNumber: stockReceipts.billNumber,
      day: sql<string>`coalesce(${stockReceipts.stockDate}::text, to_char(${stockReceipts.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD'))`,
      createdAt: stockReceipts.createdAt,
      productId: products.id,
      name: products.name,
      size: products.size,
      color: products.color,
      costPaise: products.costPaise,
      pieces: stockMovements.quantityChange,
      type: sql<string>`coalesce(${categories.name}, ${products.category})`,
      section: sections.name,
    })
    .from(stockReceipts)
    .leftJoin(stockMovements, and(eq(stockMovements.refId, stockReceipts.id), inArray(stockMovements.reason, [...ARRIVALS])))
    .leftJoin(products, eq(products.id, stockMovements.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(sections, eq(sections.id, categories.sectionId))
    .where(and(eq(stockReceipts.storeId, storeId), eq(stockReceipts.supplierId, supplierId)))
    .orderBy(desc(stockReceipts.createdAt));

  const money = (pieces: number, cost: number | null) => pieces * (cost ?? 0);
  const bills = new Map<string, CompanyBill & { products: Set<string>; firstAt: number }>();
  const months = new Map<string, { bills: Set<string>; products: Set<string>; pieces: number; amount: number }>();
  const types = new Map<string, { section: string | null; type: string; products: Set<string>; pieces: number; amount: number }>();
  const everything = new Set<string>();

  for (const row of rows) {
    const key = billKey(row.receiptId, row.billNumber);
    let bill = bills.get(key);
    if (!bill) {
      bill = { key, billNumber: row.billNumber?.trim() || null, date: row.day, receiptIds: [], items: 0, pieces: 0, amountPaise: 0, lines: [], products: new Set(), firstAt: row.createdAt.getTime() };
      bills.set(key, bill);
    }
    if (!bill.receiptIds.includes(row.receiptId)) bill.receiptIds.push(row.receiptId);
    if (row.day < bill.date) bill.date = row.day;
    // The bill number as it was typed on the first delivery of the bill.
    if (row.createdAt.getTime() < bill.firstAt) {
      bill.firstAt = row.createdAt.getTime();
      bill.billNumber = row.billNumber?.trim() || null;
    }
    if (!row.productId) continue;

    const pieces = row.pieces ?? 0;
    const amount = money(pieces, row.costPaise);
    bill.products.add(row.productId);
    bill.pieces += pieces;
    bill.amountPaise! += amount;
    bill.lines.push({ productId: row.productId, name: row.name!, size: row.size!, color: row.color!, type: row.type, section: row.section, pieces, amountPaise: amount });
    everything.add(row.productId);

    const typeKey = `${row.section ?? ''}\u0000${row.type}`;
    const typeRow = types.get(typeKey) ?? { section: row.section, type: row.type, products: new Set<string>(), pieces: 0, amount: 0 };
    typeRow.products.add(row.productId);
    typeRow.pieces += pieces;
    typeRow.amount += amount;
    types.set(typeKey, typeRow);
  }

  const billList = [...bills.values()].sort((a, b) => b.date.localeCompare(a.date) || b.firstAt - a.firstAt);
  for (const bill of billList) {
    const month = months.get(bill.date.slice(0, 7)) ?? { bills: new Set<string>(), products: new Set<string>(), pieces: 0, amount: 0 };
    month.bills.add(bill.key);
    for (const id of bill.products) month.products.add(id);
    month.pieces += bill.pieces;
    month.amount += bill.amountPaise ?? 0;
    months.set(bill.date.slice(0, 7), month);
  }

  const hide = (value: number) => (amounts ? value : null);
  return {
    totals: {
      bills: billList.length,
      items: everything.size,
      pieces: billList.reduce((n, b) => n + b.pieces, 0),
      amountPaise: hide(billList.reduce((n, b) => n + (b.amountPaise ?? 0), 0)),
      types: types.size,
    },
    bills: billList.map((bill) => ({
      key: bill.key,
      billNumber: bill.billNumber,
      date: bill.date,
      receiptIds: bill.receiptIds,
      pieces: bill.pieces,
      items: bill.products.size,
      amountPaise: hide(bill.amountPaise ?? 0),
      lines: bill.lines.map((line) => ({ ...line, amountPaise: hide(line.amountPaise ?? 0) })),
    })),
    months: [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, m]) => ({ month, bills: m.bills.size, items: m.products.size, pieces: m.pieces, amountPaise: hide(m.amount) })),
    types: [...types.values()]
      .sort((a, b) => b.pieces - a.pieces || a.type.localeCompare(b.type))
      .map((t) => ({ section: t.section, type: t.type, items: t.products.size, pieces: t.pieces, amountPaise: hide(t.amount) })),
  };
}

/** For the companies list: bills, pieces, amount and the last bill's date of every company. */
export async function companySummaries(db: Db, storeId: string, { amounts }: { amounts: boolean }): Promise<Map<string, CompanySummary>> {
  const [billRows, pieceRows] = await Promise.all([
    db
      .select({
        supplierId: stockReceipts.supplierId,
        bills: int(sql`count(distinct coalesce('no:' || lower(nullif(trim(${stockReceipts.billNumber}), '')), 'r:' || ${stockReceipts.id}::text))`),
        lastDate: sql<string | null>`max(coalesce(${stockReceipts.stockDate}::text, to_char(${stockReceipts.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')))`,
      })
      .from(stockReceipts)
      .where(and(eq(stockReceipts.storeId, storeId), isNotNull(stockReceipts.supplierId)))
      .groupBy(stockReceipts.supplierId),
    db
      .select({
        supplierId: stockReceipts.supplierId,
        pieces: int(sql`coalesce(sum(${stockMovements.quantityChange}), 0)`),
        amount: int(sql`coalesce(sum(${stockMovements.quantityChange} * coalesce(${products.costPaise}, 0)), 0)`),
      })
      .from(stockReceipts)
      .innerJoin(stockMovements, and(eq(stockMovements.refId, stockReceipts.id), inArray(stockMovements.reason, [...ARRIVALS])))
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .where(and(eq(stockReceipts.storeId, storeId), isNotNull(stockReceipts.supplierId)))
      .groupBy(stockReceipts.supplierId),
  ]);
  const out = new Map<string, CompanySummary>();
  for (const row of billRows) {
    const piece = pieceRows.find((p) => p.supplierId === row.supplierId);
    out.set(row.supplierId!, { bills: row.bills, lastDate: row.lastDate, pieces: piece?.pieces ?? 0, amountPaise: amounts ? (piece?.amount ?? 0) : null });
  }
  return out;
}
