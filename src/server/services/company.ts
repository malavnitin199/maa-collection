import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { categories, products, sections, staff, stockMovements, stockReceipts, supplierPayments, suppliers, type SupplierPayment } from '@/db/schema';
import { STORE_TIMEZONE } from '@/lib/app-config';
import { inRange, type DayRange } from '@/lib/company-period';
import { designKey } from '@/lib/design-groups';
import { DomainError, isUniqueViolation } from './errors';
import { cleanStockDate, shopToday } from './products';

/**
 * Company accounts (plan v19 V19-06, owner's feedback 2026-11-20): everything
 * bought from one company — its bills, what was paid, what is still due —
 * month by month and by type (Men › Jeans …).
 *
 * A **bill** is every delivery entered with the same bill number (any letter
 * case); a delivery without a number is a bill of its own. A bill's amount is
 * purchase price × pieces of each line, taken from the price **on the day it
 * arrived** (`stock_movements.unit_cost_paise`); deliveries from before that
 * snapshot existed use today's purchase price and are marked *estimated*.
 *
 * A **payment** names a bill number or goes to the running account. A bill is
 * **closed** when the payments naming it cover its amount; **dues** are all
 * purchases minus all payments (the running account, like a khata), never
 * limited by the period shown.
 *
 * Amounts are null for people without the purchase-price right.
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
export type BillStatus = 'open' | 'closed' | 'noPrice';
export type CompanyBill = {
  key: string;
  billNumber: string | null;
  /** The stock date the owner gave, else the day it was entered (shop time), YYYY-MM-DD. */
  date: string;
  receiptIds: string[];
  /** Distinct items (SKUs) on the bill. */
  items: number;
  pieces: number;
  amountPaise: number | null;
  /** Some line's purchase price was not recorded on arrival: amount uses today's price. */
  estimated: boolean;
  paidPaise: number | null;
  duePaise: number | null;
  status: BillStatus;
  lines: CompanyBillLine[];
};
export type CompanyMonth = { month: string; bills: number; items: number; pieces: number; amountPaise: number | null };
export type CompanyTypeRow = { section: string | null; type: string; items: number; pieces: number; amountPaise: number | null };
export type CompanyPaymentRow = SupplierPayment & { staffName: string; status: 'bill' | 'account' };
export type CompanyReport = {
  /** The period shown. */
  totals: {
    bills: number;
    openBills: number;
    closedBills: number;
    /** Distinct items (SKUs) bought. */
    items: number;
    /** Distinct designs (name + MRP) bought — the owner's "collections". */
    designs: number;
    pieces: number;
    amountPaise: number | null;
    paidPaise: number | null;
    estimated: boolean;
    types: number;
  };
  /** All time, whatever the period: the running account. */
  account: { purchasesPaise: number | null; paidPaise: number | null; duePaise: number | null; bills: number; openBills: number; firstDate: string | null; lastDate: string | null };
  bills: CompanyBill[];
  months: CompanyMonth[];
  types: CompanyTypeRow[];
  payments: CompanyPaymentRow[];
};
export type CompanySummary = {
  bills: number;
  openBills: number;
  pieces: number;
  /** Distinct designs (name + MRP) the company has here — the owner's "collections". */
  collections: number;
  amountPaise: number | null;
  paidPaise: number | null;
  duePaise: number | null;
  firstDate: string | null;
  lastDate: string | null;
};
/** One line of the companies overview on Home (2026-11-20). */
export type CompanyOverviewRow = CompanySummary & {
  id: string;
  name: string;
  location: string | null;
  active: boolean;
  /** The day the shop started with this company, as the owner gave it (may be before the app). */
  workingSince: string | null;
  /** The day it was added here (shop time, YYYY-MM-DD). */
  addedOn: string;
};
export type CompaniesOverview = {
  totals: { companies: number; bills: number; openBills: number; collections: number; pieces: number; purchasesPaise: number | null; duePaise: number | null };
  rows: CompanyOverviewRow[];
};

const tz = sql.raw(`'${STORE_TIMEZONE.replace(/'/g, "''")}'`);
const int = (expression: ReturnType<typeof sql>) => sql<number>`${expression}`.mapWith(Number);
const ARRIVALS = ['opening', 'stock_in'] as const;
const ALL: DayRange = { key: 'all', from: null, to: null };

/** Which bill a delivery or a payment belongs to: its bill number (any letter case), else the delivery itself. */
export function billKey(receiptId: string, billNumber: string | null): string {
  const number = billNumber?.trim();
  return number ? `no:${number.toLowerCase()}` : `r:${receiptId}`;
}

export async function companyReport(
  db: Db,
  storeId: string,
  supplierId: string,
  { amounts, period = ALL }: { amounts: boolean; period?: DayRange },
): Promise<CompanyReport> {
  const [rows, paymentRows] = await Promise.all([
    db
      .select({
        receiptId: stockReceipts.id,
        billNumber: stockReceipts.billNumber,
        day: sql<string>`coalesce(${stockReceipts.stockDate}::text, to_char(${stockReceipts.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD'))`,
        createdAt: stockReceipts.createdAt,
        productId: products.id,
        name: products.name,
        size: products.size,
        color: products.color,
        mrpPaise: products.mrpPaise,
        productSupplierId: products.supplierId,
        unitCostPaise: sql<number | null>`coalesce(${stockMovements.unitCostPaise}, ${products.costPaise})`,
        snapshot: stockMovements.unitCostPaise,
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
      .orderBy(desc(stockReceipts.createdAt)),
    listPayments(db, storeId, supplierId),
  ]);

  type Bill = CompanyBill & { products: Set<string>; designs: Set<string>; firstAt: number };
  const bills = new Map<string, Bill>();
  for (const row of rows) {
    const key = billKey(row.receiptId, row.billNumber);
    let bill = bills.get(key);
    if (!bill) {
      bill = {
        key, billNumber: row.billNumber?.trim() || null, date: row.day, receiptIds: [], items: 0, pieces: 0, amountPaise: 0, estimated: false,
        paidPaise: 0, duePaise: 0, status: 'noPrice', lines: [], products: new Set(), designs: new Set(), firstAt: row.createdAt.getTime(),
      };
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
    const cost = row.unitCostPaise === null ? null : Number(row.unitCostPaise);
    const amount = pieces * (cost ?? 0);
    if (row.snapshot === null && cost !== null) bill.estimated = true;
    bill.products.add(row.productId);
    bill.designs.add(designKey({ name: row.name!, supplierId: row.productSupplierId, mrpPaise: row.mrpPaise! }));
    bill.pieces += pieces;
    bill.amountPaise! += amount;
    bill.lines.push({ productId: row.productId, name: row.name!, size: row.size!, color: row.color!, type: row.type, section: row.section, pieces, amountPaise: amount });
  }

  // Payments naming a bill close it; the rest sit on the running account.
  const paidByBill = new Map<string, number>();
  for (const payment of paymentRows) {
    if (!payment.billNumber) continue;
    const key = billKey('', payment.billNumber);
    paidByBill.set(key, (paidByBill.get(key) ?? 0) + payment.amountPaise);
  }
  const everyBill = [...bills.values()].sort((a, b) => b.date.localeCompare(a.date) || b.firstAt - a.firstAt);
  for (const bill of everyBill) {
    bill.items = bill.products.size;
    bill.paidPaise = paidByBill.get(bill.key) ?? 0;
    bill.duePaise = Math.max(0, (bill.amountPaise ?? 0) - bill.paidPaise);
    bill.status = bill.amountPaise === 0 ? 'noPrice' : bill.duePaise === 0 ? 'closed' : 'open';
  }

  const shown = everyBill.filter((bill) => inRange(bill.date, period));
  const shownPayments = paymentRows.filter((payment) => inRange(payment.paidOn, period));
  const months = new Map<string, { bills: number; products: Set<string>; pieces: number; amount: number }>();
  const types = new Map<string, { section: string | null; type: string; products: Set<string>; pieces: number; amount: number }>();
  const items = new Set<string>();
  const designs = new Set<string>();
  for (const bill of shown) {
    const month = months.get(bill.date.slice(0, 7)) ?? { bills: 0, products: new Set<string>(), pieces: 0, amount: 0 };
    month.bills += 1;
    for (const id of bill.products) month.products.add(id);
    month.pieces += bill.pieces;
    month.amount += bill.amountPaise ?? 0;
    months.set(bill.date.slice(0, 7), month);
    for (const id of bill.products) items.add(id);
    for (const key of bill.designs) designs.add(key);
    for (const line of bill.lines) {
      const typeKey = `${line.section ?? ''}\u0000${line.type}`;
      const row = types.get(typeKey) ?? { section: line.section, type: line.type, products: new Set<string>(), pieces: 0, amount: 0 };
      row.products.add(line.productId);
      row.pieces += line.pieces;
      row.amount += line.amountPaise ?? 0;
      types.set(typeKey, row);
    }
  }

  const hide = (value: number) => (amounts ? value : null);
  const purchases = everyBill.reduce((n, b) => n + (b.amountPaise ?? 0), 0);
  const paid = paymentRows.reduce((n, p) => n + p.amountPaise, 0);
  const billKeys = new Set(everyBill.map((b) => b.key));
  return {
    totals: {
      bills: shown.length,
      openBills: shown.filter((b) => b.status === 'open').length,
      closedBills: shown.filter((b) => b.status === 'closed').length,
      items: items.size,
      designs: designs.size,
      pieces: shown.reduce((n, b) => n + b.pieces, 0),
      amountPaise: hide(shown.reduce((n, b) => n + (b.amountPaise ?? 0), 0)),
      paidPaise: hide(shownPayments.reduce((n, p) => n + p.amountPaise, 0)),
      estimated: shown.some((b) => b.estimated),
      types: types.size,
    },
    account: {
      purchasesPaise: hide(purchases),
      paidPaise: hide(paid),
      duePaise: hide(Math.max(0, purchases - paid)),
      bills: everyBill.length,
      openBills: everyBill.filter((b) => b.status === 'open').length,
      firstDate: everyBill.at(-1)?.date ?? null,
      lastDate: everyBill[0]?.date ?? null,
    },
    bills: shown.map((bill) => ({
      key: bill.key,
      billNumber: bill.billNumber,
      date: bill.date,
      receiptIds: bill.receiptIds,
      items: bill.items,
      pieces: bill.pieces,
      estimated: bill.estimated,
      status: bill.status,
      amountPaise: hide(bill.amountPaise ?? 0),
      paidPaise: hide(bill.paidPaise ?? 0),
      duePaise: hide(bill.duePaise ?? 0),
      lines: bill.lines.map((line) => ({ ...line, amountPaise: hide(line.amountPaise ?? 0) })),
    })),
    months: [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, m]) => ({ month, bills: m.bills, items: m.products.size, pieces: m.pieces, amountPaise: hide(m.amount) })),
    types: [...types.values()]
      .sort((a, b) => b.pieces - a.pieces || a.type.localeCompare(b.type))
      .map((t) => ({ section: t.section, type: t.type, items: t.products.size, pieces: t.pieces, amountPaise: hide(t.amount) })),
    payments: shownPayments.map((payment) => ({
      ...payment,
      status: payment.billNumber && billKeys.has(billKey('', payment.billNumber)) ? 'bill' : 'account',
    })),
  };
}

export async function listPayments(db: Db, storeId: string, supplierId: string): Promise<(SupplierPayment & { staffName: string })[]> {
  return db
    .select({
      id: supplierPayments.id,
      storeId: supplierPayments.storeId,
      operationId: supplierPayments.operationId,
      supplierId: supplierPayments.supplierId,
      billNumber: supplierPayments.billNumber,
      amountPaise: supplierPayments.amountPaise,
      paidOn: supplierPayments.paidOn,
      note: supplierPayments.note,
      staffId: supplierPayments.staffId,
      createdAt: supplierPayments.createdAt,
      staffName: staff.name,
    })
    .from(supplierPayments)
    .innerJoin(staff, eq(staff.id, supplierPayments.staffId))
    .where(and(eq(supplierPayments.storeId, storeId), eq(supplierPayments.supplierId, supplierId)))
    .orderBy(desc(supplierPayments.paidOn), desc(supplierPayments.createdAt));
}

export type PaymentInput = { operationId: string; supplierId: string; amountPaise: number; paidOn?: string | null; billNumber?: string | null; note?: string | null; staffId: string };

/**
 * Records money paid to a company. The day defaults to today (shop time); up to
 * ₹1 crore at a time. The same operation id again returns the first payment.
 */
export async function addPayment(db: Db, storeId: string, input: PaymentInput): Promise<SupplierPayment & { duplicate: boolean }> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.', { key: 'stk.err.operationId' });
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0 || input.amountPaise > 1_000_000_000) {
    throw new DomainError('Enter the amount paid (₹1 to ₹1 crore).', { key: 'cat.err.paymentAmount' });
  }
  let paidOn: string;
  try {
    paidOn = cleanStockDate(input.paidOn) ?? shopToday();
  } catch {
    throw new DomainError('Enter a valid payment date (not after today).', { key: 'cat.err.paymentDate' });
  }
  const billNumber = input.billNumber?.trim().slice(0, 40) || null;
  const note = input.note?.trim().slice(0, 200) || null;
  try {
    const [created] = await db
      .insert(supplierPayments)
      .values({ storeId, operationId: input.operationId, supplierId: input.supplierId, amountPaise: input.amountPaise, paidOn, billNumber, note, staffId: input.staffId })
      .returning();
    return { ...created, duplicate: false };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [existing] = await db
      .select()
      .from(supplierPayments)
      .where(and(eq(supplierPayments.storeId, storeId), eq(supplierPayments.operationId, input.operationId)))
      .limit(1);
    if (!existing) throw error;
    return { ...existing, duplicate: true };
  }
}

/**
 * For the companies list and the Home overview: bills (open = its amount is
 * more than the payments naming its number), pieces, collections, purchases,
 * paid and dues of every company that has a bill, a payment or a product.
 */
export async function companySummaries(db: Db, storeId: string, { amounts }: { amounts: boolean }): Promise<Map<string, CompanySummary>> {
  const dayExpr = sql`coalesce(${stockReceipts.stockDate}::text, to_char(${stockReceipts.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD'))`;
  const keyExpr = sql`coalesce('no:' || lower(nullif(trim(${stockReceipts.billNumber}), '')), 'r:' || ${stockReceipts.id}::text)`;
  const [billRows, paidRows, designRows] = await Promise.all([
    // One row per bill (number, any letter case; a delivery without one is its own bill).
    db
      .select({
        supplierId: stockReceipts.supplierId,
        key: sql<string>`${keyExpr}`,
        pieces: int(sql`coalesce(sum(${stockMovements.quantityChange}), 0)`),
        amount: int(sql`coalesce(sum(${stockMovements.quantityChange} * coalesce(${stockMovements.unitCostPaise}, ${products.costPaise}, 0)), 0)`),
        firstDate: sql<string>`min(${dayExpr})`,
        lastDate: sql<string>`max(${dayExpr})`,
      })
      .from(stockReceipts)
      .leftJoin(stockMovements, and(eq(stockMovements.refId, stockReceipts.id), inArray(stockMovements.reason, [...ARRIVALS])))
      .leftJoin(products, eq(products.id, stockMovements.productId))
      .where(and(eq(stockReceipts.storeId, storeId), isNotNull(stockReceipts.supplierId)))
      .groupBy(stockReceipts.supplierId, keyExpr),
    db
      .select({
        supplierId: supplierPayments.supplierId,
        billNumber: sql<string | null>`lower(nullif(trim(${supplierPayments.billNumber}), ''))`,
        paid: int(sql`coalesce(sum(${supplierPayments.amountPaise}), 0)`),
      })
      .from(supplierPayments)
      .where(eq(supplierPayments.storeId, storeId))
      .groupBy(supplierPayments.supplierId, sql`lower(nullif(trim(${supplierPayments.billNumber}), ''))`),
    // Collections = distinct name + MRP per company, the same key as `designKey` (spaces squeezed, any letter case).
    db
      .select({
        supplierId: products.supplierId,
        designs: int(sql`count(distinct regexp_replace(lower(trim(${products.name})), '\\s+', ' ', 'g') || '~' || ${products.mrpPaise}::text)`),
      })
      .from(products)
      .where(and(eq(products.storeId, storeId), isNotNull(products.supplierId)))
      .groupBy(products.supplierId),
  ]);
  const out = new Map<string, CompanySummary>();
  const ids = new Set([...billRows, ...paidRows, ...designRows].map((r) => r.supplierId!));
  for (const id of ids) {
    const bills = billRows.filter((b) => b.supplierId === id);
    const payments = paidRows.filter((p) => p.supplierId === id);
    const paidFor = (key: string) => payments.find((p) => p.billNumber !== null && `no:${p.billNumber}` === key)?.paid ?? 0;
    const amount = bills.reduce((n, b) => n + b.amount, 0);
    const paid = payments.reduce((n, p) => n + p.paid, 0);
    out.set(id, {
      bills: bills.length,
      openBills: bills.filter((b) => b.amount > 0 && b.amount > paidFor(b.key)).length,
      pieces: bills.reduce((n, b) => n + b.pieces, 0),
      collections: designRows.find((d) => d.supplierId === id)?.designs ?? 0,
      firstDate: bills.length ? bills.map((b) => b.firstDate).sort()[0] : null,
      lastDate: bills.length ? bills.map((b) => b.lastDate).sort().at(-1)! : null,
      amountPaise: amounts ? amount : null,
      paidPaise: amounts ? paid : null,
      duePaise: amounts ? Math.max(0, amount - paid) : null,
    });
  }
  return out;
}

const EMPTY_SUMMARY: CompanySummary = { bills: 0, openBills: 0, pieces: 0, collections: 0, amountPaise: 0, paidPaise: 0, duePaise: 0, firstDate: null, lastDate: null };

/**
 * The companies overview on Home (owner's feedback 2026-11-20): every company
 * with its location, working-since and added-on days, bills, collections,
 * pieces, spend and dues, plus the totals. Companies with a recent bill come
 * first, then the rest by name; hidden companies last.
 */
export async function companiesOverview(db: Db, storeId: string, { amounts }: { amounts: boolean }): Promise<CompaniesOverview> {
  const [companies, summaries] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        location: suppliers.location,
        active: suppliers.active,
        workingSince: suppliers.workingSince,
        addedOn: sql<string>`to_char(${suppliers.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
      })
      .from(suppliers)
      .where(eq(suppliers.storeId, storeId)),
    companySummaries(db, storeId, { amounts }),
  ]);
  const hide = (value: number) => (amounts ? value : null);
  const blank = { ...EMPTY_SUMMARY, amountPaise: hide(0), paidPaise: hide(0), duePaise: hide(0) };
  const rows: CompanyOverviewRow[] = companies
    .map((company) => ({ ...company, ...(summaries.get(company.id) ?? blank) }))
    .sort((a, b) => Number(b.active) - Number(a.active) || (b.lastDate ?? '').localeCompare(a.lastDate ?? '') || a.name.localeCompare(b.name));
  const sum = (pick: (row: CompanyOverviewRow) => number | null) => rows.reduce((n, row) => n + (pick(row) ?? 0), 0);
  return {
    totals: {
      companies: rows.length,
      bills: sum((r) => r.bills),
      openBills: sum((r) => r.openBills),
      collections: sum((r) => r.collections),
      pieces: sum((r) => r.pieces),
      purchasesPaise: hide(sum((r) => r.amountPaise)),
      duePaise: hide(sum((r) => r.duePaise)),
    },
    rows,
  };
}
