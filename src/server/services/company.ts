import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { billCollections, billCompanies, bills, categories, products, sections, staff, stockMovements, stockReceipts, supplierPayments, suppliers, type SupplierPayment } from '@/db/schema';
import { listBills } from './bills';
import { STORE_TIMEZONE } from '@/lib/app-config';
import { inRange, type DayRange } from '@/lib/company-period';
import { designKey } from '@/lib/design-groups';
import { DomainError, isUniqueViolation } from './errors';
import { cleanStockDate, shopToday } from './products';

/**
 * Company accounts (plan v19 V19-06, owner's feedback 2026-11-20 / 2026-11-21):
 * everything bought from one company — its collections, its bills, what was
 * paid, what is still due — month by month and by type (Men › Jeans …).
 *
 * A **collection** is one stock receipt (one New item save or one Receive
 * stock entry). Its value is purchase price × pieces, at the price **on the day
 * it arrived** (`stock_movements.unit_cost_paise`; older ones use today's price
 * and are marked *estimated*). Since 2026-11-21 a collection is **not a bill**.
 *
 * A **bill** is entered in the Bills section (`bills.ts`): it names one or more
 * companies with each one's part of the amount and the collections it covers.
 * A company's bill is **paid** when payments naming that bill cover its part;
 * **dues** are all its bill parts minus all its payments (owner's choice), never
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
/** One collection of this company. */
export type CompanyDelivery = {
  receiptId: string;
  /** The reference typed when the stock was entered (not a bill). */
  refNumber: string | null;
  /** The stock date the owner gave, else the day it was entered (shop time), YYYY-MM-DD. */
  date: string;
  /** Distinct items (SKUs). */
  items: number;
  pieces: number;
  amountPaise: number | null;
  /** Some line's purchase price was not recorded on arrival: amount uses today's price. */
  estimated: boolean;
  /** The bill it is on, if any. */
  billId: string | null;
  lines: CompanyBillLine[];
};
/** This company's part of one bill. */
export type CompanyBillPart = {
  id: string;
  billNumber: string | null;
  billDate: string;
  amountPaise: number | null;
  /** The whole bill, all companies. */
  totalPaise: number | null;
  paidPaise: number | null;
  duePaise: number | null;
  status: 'open' | 'paid';
  collections: number;
  /** Other companies on the same bill. */
  others: string[];
};
export type CompanyMonth = { month: string; collections: number; items: number; pieces: number; amountPaise: number | null };
export type CompanyTypeRow = { section: string | null; type: string; items: number; pieces: number; amountPaise: number | null };
export type CompanyPaymentRow = SupplierPayment & { staffName: string; status: 'bill' | 'account' };
export type CompanyReport = {
  /** The period shown. */
  totals: {
    bills: number;
    openBills: number;
    closedBills: number;
    /** This company's parts of the bills in the period. */
    billedPaise: number | null;
    collections: number;
    /** Distinct items (SKUs) bought. */
    items: number;
    /** Distinct designs (name + MRP) bought — the owner's "collections" of a kind. */
    designs: number;
    pieces: number;
    /** Value of the collections (purchase price × pieces). */
    amountPaise: number | null;
    paidPaise: number | null;
    estimated: boolean;
    types: number;
  };
  /** All time, whatever the period: the running account. */
  account: {
    billedPaise: number | null;
    paidPaise: number | null;
    duePaise: number | null;
    bills: number;
    openBills: number;
    lastBillDate: string | null;
    firstDate: string | null;
    lastDate: string | null;
  };
  bills: CompanyBillPart[];
  deliveries: CompanyDelivery[];
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
  /** All its bill parts. */
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
  contactName: string | null;
  phone: string | null;
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

export async function companyReport(
  db: Db,
  storeId: string,
  supplierId: string,
  { amounts, period = ALL }: { amounts: boolean; period?: DayRange },
): Promise<CompanyReport> {
  const [rows, paymentRows, billRows] = await Promise.all([
    db
      .select({
        receiptId: stockReceipts.id,
        refNumber: stockReceipts.billNumber,
        day: sql<string>`coalesce(${stockReceipts.stockDate}::text, to_char(${stockReceipts.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD'))`,
        createdAt: stockReceipts.createdAt,
        billId: billCollections.billId,
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
      .leftJoin(billCollections, eq(billCollections.receiptId, stockReceipts.id))
      .leftJoin(stockMovements, and(eq(stockMovements.refId, stockReceipts.id), inArray(stockMovements.reason, [...ARRIVALS])))
      .leftJoin(products, eq(products.id, stockMovements.productId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(sections, eq(sections.id, categories.sectionId))
      .where(and(eq(stockReceipts.storeId, storeId), eq(stockReceipts.supplierId, supplierId)))
      .orderBy(desc(stockReceipts.createdAt)),
    listPayments(db, storeId, supplierId),
    listBills(db, storeId, { supplierId }),
  ]);

  type Delivery = CompanyDelivery & { products: Set<string>; designs: Set<string>; at: number; value: number };
  const deliveries = new Map<string, Delivery>();
  for (const row of rows) {
    let d = deliveries.get(row.receiptId);
    if (!d) {
      d = {
        receiptId: row.receiptId, refNumber: row.refNumber?.trim() || null, date: row.day, items: 0, pieces: 0, amountPaise: 0, estimated: false,
        billId: row.billId, lines: [], products: new Set(), designs: new Set(), at: row.createdAt.getTime(), value: 0,
      };
      deliveries.set(row.receiptId, d);
    }
    if (!row.productId) continue;
    const pieces = row.pieces ?? 0;
    const cost = row.unitCostPaise === null ? null : Number(row.unitCostPaise);
    const amount = pieces * (cost ?? 0);
    if (row.snapshot === null && cost !== null) d.estimated = true;
    d.products.add(row.productId);
    d.designs.add(designKey({ name: row.name!, supplierId: row.productSupplierId, mrpPaise: row.mrpPaise! }));
    d.pieces += pieces;
    d.value += amount;
    d.lines.push({ productId: row.productId, name: row.name!, size: row.size!, color: row.color!, type: row.type, section: row.section, pieces, amountPaise: amount });
  }
  const every = [...deliveries.values()].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
  const shown = every.filter((d) => inRange(d.date, period));
  const shownPayments = paymentRows.filter((payment) => inRange(payment.paidOn, period));

  const months = new Map<string, { collections: number; products: Set<string>; pieces: number; amount: number }>();
  const types = new Map<string, { section: string | null; type: string; products: Set<string>; pieces: number; amount: number }>();
  const items = new Set<string>();
  const designs = new Set<string>();
  for (const d of shown) {
    const month = months.get(d.date.slice(0, 7)) ?? { collections: 0, products: new Set<string>(), pieces: 0, amount: 0 };
    month.collections += 1;
    for (const id of d.products) month.products.add(id);
    month.pieces += d.pieces;
    month.amount += d.value;
    months.set(d.date.slice(0, 7), month);
    for (const id of d.products) items.add(id);
    for (const key of d.designs) designs.add(key);
    for (const line of d.lines) {
      const typeKey = `${line.section ?? ''}\u0000${line.type}`;
      const row = types.get(typeKey) ?? { section: line.section, type: line.type, products: new Set<string>(), pieces: 0, amount: 0 };
      row.products.add(line.productId);
      row.pieces += line.pieces;
      row.amount += line.amountPaise ?? 0;
      types.set(typeKey, row);
    }
  }

  // This company's part of each bill.
  const parts = billRows.map((bill) => {
    const mine = bill.companies.find((c) => c.supplierId === supplierId)!;
    return {
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      amountPaise: mine.amountPaise,
      totalPaise: bill.totalPaise,
      paidPaise: mine.paidPaise,
      duePaise: mine.duePaise,
      status: (mine.duePaise > 0 ? 'open' : 'paid') as 'open' | 'paid',
      collections: bill.collections,
      others: bill.companies.filter((c) => c.supplierId !== supplierId).map((c) => c.name),
    };
  });
  const shownParts = parts.filter((b) => inRange(b.billDate, period));

  const hide = (value: number) => (amounts ? value : null);
  const billed = parts.reduce((n, b) => n + b.amountPaise, 0);
  const paid = paymentRows.reduce((n, p) => n + p.amountPaise, 0);
  return {
    totals: {
      bills: shownParts.length,
      openBills: shownParts.filter((b) => b.status === 'open').length,
      closedBills: shownParts.filter((b) => b.status === 'paid').length,
      billedPaise: hide(shownParts.reduce((n, b) => n + b.amountPaise, 0)),
      collections: shown.length,
      items: items.size,
      designs: designs.size,
      pieces: shown.reduce((n, d) => n + d.pieces, 0),
      amountPaise: hide(shown.reduce((n, d) => n + d.value, 0)),
      paidPaise: hide(shownPayments.reduce((n, p) => n + p.amountPaise, 0)),
      estimated: shown.some((d) => d.estimated),
      types: types.size,
    },
    account: {
      billedPaise: hide(billed),
      paidPaise: hide(paid),
      duePaise: hide(Math.max(0, billed - paid)),
      bills: parts.length,
      openBills: parts.filter((b) => b.status === 'open').length,
      lastBillDate: parts[0]?.billDate ?? null,
      firstDate: every.at(-1)?.date ?? null,
      lastDate: every[0]?.date ?? null,
    },
    bills: shownParts.map((b) => ({ ...b, amountPaise: hide(b.amountPaise), totalPaise: hide(b.totalPaise), paidPaise: hide(b.paidPaise), duePaise: hide(b.duePaise) })),
    deliveries: shown.map((d) => ({
      receiptId: d.receiptId,
      refNumber: d.refNumber,
      date: d.date,
      items: d.products.size,
      pieces: d.pieces,
      estimated: d.estimated,
      billId: d.billId,
      amountPaise: hide(d.value),
      lines: d.lines.map((line) => ({ ...line, amountPaise: hide(line.amountPaise ?? 0) })),
    })),
    months: [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, m]) => ({ month, collections: m.collections, items: m.products.size, pieces: m.pieces, amountPaise: hide(m.amount) })),
    types: [...types.values()]
      .sort((a, b) => b.pieces - a.pieces || a.type.localeCompare(b.type))
      .map((t) => ({ section: t.section, type: t.type, items: t.products.size, pieces: t.pieces, amountPaise: hide(t.amount) })),
    payments: shownPayments.map((payment) => ({ ...payment, status: payment.billId ? 'bill' : 'account' })),
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
      billId: supplierPayments.billId,
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

export type PaymentInput = {
  operationId: string;
  supplierId: string;
  amountPaise: number;
  paidOn?: string | null;
  /** The bill (from the Bills section) this payment is for; it must name this company. Null = running account. */
  billId?: string | null;
  note?: string | null;
  staffId: string;
};

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
  let billId: string | null = null;
  let billNumber: string | null = null;
  if (input.billId) {
    const [bill] = await db
      .select({ id: bills.id, billNumber: bills.billNumber })
      .from(bills)
      .innerJoin(billCompanies, and(eq(billCompanies.billId, bills.id), eq(billCompanies.supplierId, input.supplierId)))
      .where(and(eq(bills.storeId, storeId), eq(bills.id, input.billId)))
      .limit(1);
    if (!bill) throw new DomainError('That bill is not this company’s.', { key: 'bill.err.notThisCompany' });
    billId = bill.id;
    billNumber = bill.billNumber;
  }
  const note = input.note?.trim().slice(0, 200) || null;
  try {
    const [created] = await db
      .insert(supplierPayments)
      .values({ storeId, operationId: input.operationId, supplierId: input.supplierId, amountPaise: input.amountPaise, paidOn, billId, billNumber, note, staffId: input.staffId })
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
 * For the companies list and the Home overview: bills (from the Bills section;
 * open = its part is more than the payments naming that bill), pieces,
 * collections, billed amount, paid and dues (bill parts − payments) of every
 * company that has a delivery, a bill, a payment or a product.
 */
export async function companySummaries(db: Db, storeId: string, { amounts }: { amounts: boolean }): Promise<Map<string, CompanySummary>> {
  const dayExpr = sql`coalesce(${stockReceipts.stockDate}::text, to_char(${stockReceipts.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD'))`;
  const [deliveryRows, partRows, paidRows, designRows] = await Promise.all([
    db
      .select({
        supplierId: stockReceipts.supplierId,
        pieces: int(sql`coalesce(sum(${stockMovements.quantityChange}), 0)`),
        firstDate: sql<string>`min(${dayExpr})`,
        lastDate: sql<string>`max(${dayExpr})`,
      })
      .from(stockReceipts)
      .leftJoin(stockMovements, and(eq(stockMovements.refId, stockReceipts.id), inArray(stockMovements.reason, [...ARRIVALS])))
      .where(and(eq(stockReceipts.storeId, storeId), isNotNull(stockReceipts.supplierId)))
      .groupBy(stockReceipts.supplierId),
    db
      .select({ supplierId: billCompanies.supplierId, billId: billCompanies.billId, amount: billCompanies.amountPaise, billDate: bills.billDate })
      .from(billCompanies)
      .innerJoin(bills, eq(bills.id, billCompanies.billId))
      .where(eq(bills.storeId, storeId)),
    db
      .select({ supplierId: supplierPayments.supplierId, billId: supplierPayments.billId, paid: int(sql`coalesce(sum(${supplierPayments.amountPaise}), 0)`) })
      .from(supplierPayments)
      .where(eq(supplierPayments.storeId, storeId))
      .groupBy(supplierPayments.supplierId, supplierPayments.billId),
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
  const ids = new Set([...deliveryRows, ...partRows, ...paidRows, ...designRows].map((r) => r.supplierId!));
  for (const id of ids) {
    const delivery = deliveryRows.find((d) => d.supplierId === id);
    const parts = partRows.filter((b) => b.supplierId === id);
    const payments = paidRows.filter((p) => p.supplierId === id);
    const paidFor = (billId: string) => payments.find((p) => p.billId === billId)?.paid ?? 0;
    const billed = parts.reduce((n, b) => n + b.amount, 0);
    const paid = payments.reduce((n, p) => n + p.paid, 0);
    const dates = [delivery?.lastDate, ...parts.map((b) => b.billDate)].filter((d): d is string => Boolean(d)).sort();
    out.set(id, {
      bills: parts.length,
      openBills: parts.filter((b) => b.amount > paidFor(b.billId)).length,
      pieces: delivery?.pieces ?? 0,
      collections: designRows.find((d) => d.supplierId === id)?.designs ?? 0,
      firstDate: delivery?.firstDate ?? null,
      lastDate: dates.at(-1) ?? null,
      amountPaise: amounts ? billed : null,
      paidPaise: amounts ? paid : null,
      duePaise: amounts ? Math.max(0, billed - paid) : null,
    });
  }
  return out;
}

const EMPTY_SUMMARY: CompanySummary = { bills: 0, openBills: 0, pieces: 0, collections: 0, amountPaise: 0, paidPaise: 0, duePaise: 0, firstDate: null, lastDate: null };

/**
 * The companies overview on Home (owner's feedback 2026-11-20): every company
 * with its location, working-since and added-on days, bills, collections,
 * pieces, spend and dues, plus the totals. Latest activity first (newest bill
 * or the day it was added; same day: newest added first); hidden ones last.
 */
export async function companiesOverview(db: Db, storeId: string, { amounts }: { amounts: boolean }): Promise<CompaniesOverview> {
  const [companies, summaries] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        location: suppliers.location,
        contactName: suppliers.contactName,
        phone: suppliers.phone,
        active: suppliers.active,
        workingSince: suppliers.workingSince,
        addedOn: sql<string>`to_char(${suppliers.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
        createdAt: suppliers.createdAt,
      })
      .from(suppliers)
      .where(and(eq(suppliers.storeId, storeId), isNull(suppliers.deletedAt))),
    companySummaries(db, storeId, { amounts }),
  ]);
  const hide = (value: number) => (amounts ? value : null);
  const blank = { ...EMPTY_SUMMARY, amountPaise: hide(0), paidPaise: hide(0), duePaise: hide(0) };
  // Latest activity first — the newest bill, or the day the company was added — so a company just added is on top.
  const activity = (row: { lastDate: string | null; addedOn: string }) => (row.lastDate && row.lastDate > row.addedOn ? row.lastDate : row.addedOn);
  const rows: CompanyOverviewRow[] = companies
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(({ id, name, location, contactName, phone, active, workingSince, addedOn }) => ({ id, name, location, contactName, phone, active, workingSince, addedOn, ...(summaries.get(id) ?? blank) }))
    .sort((a, b) => Number(b.active) - Number(a.active) || activity(b).localeCompare(activity(a)));
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
