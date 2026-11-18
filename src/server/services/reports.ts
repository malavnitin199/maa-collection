import { and, asc, desc, eq, gte, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '@/db/client';
import { exchanges, products, sales, staff, suppliers } from '@/db/schema';
import { LOW_STOCK_THRESHOLD, STORE_TIMEZONE } from '@/lib/app-config';
import { exchangeApproved, exchangeStatus, exchangeWaiting, saleApproved, saleStatus, saleWaiting, type ApprovalStatus } from './approvals';

export type Totals = { count: number; units: number; totalPaise: number };
export type PeriodTotals = { today: Totals; month: Totals };

/** Start of today / this month in the shop's time zone, as timestamptz SQL. */
function periodStarts(now: Date, timezone: string) {
  const at = sql`${now.toISOString()}::timestamptz`;
  return {
    day: sql`(date_trunc('day', ${at} AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})`,
    month: sql`(date_trunc('month', ${at} AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})`,
    now: at,
  };
}

const int = (expression: SQL) => sql<number>`${expression}`.mapWith(Number);

async function saleTotals(db: Db, storeId: string, now: Date, filter?: SQL, status: SQL = saleApproved): Promise<PeriodTotals> {
  const p = periodStarts(now, STORE_TIMEZONE);
  const isToday = sql`${sales.createdAt} >= ${p.day}`;
  const [row] = await db
    .select({
      todayCount: int(sql`count(*) filter (where ${isToday})`),
      todayUnits: int(sql`coalesce(sum(${sales.quantity}) filter (where ${isToday}), 0)`),
      todayTotal: int(sql`coalesce(sum(${sales.totalPaise}) filter (where ${isToday}), 0)`),
      monthCount: int(sql`count(*)`),
      monthUnits: int(sql`coalesce(sum(${sales.quantity}), 0)`),
      monthTotal: int(sql`coalesce(sum(${sales.totalPaise}), 0)`),
    })
    .from(sales)
    .where(and(eq(sales.storeId, storeId), gte(sales.createdAt, p.month), lte(sales.createdAt, p.now), filter, status));
  return {
    today: { count: row.todayCount, units: row.todayUnits, totalPaise: row.todayTotal },
    month: { count: row.monthCount, units: row.monthUnits, totalPaise: row.monthTotal },
  };
}

export type ExchangeTotals = { today: { count: number; differencePaise: number }; month: { count: number; differencePaise: number } };

async function exchangeTotals(db: Db, storeId: string, now: Date, filter?: SQL, status: SQL = exchangeApproved): Promise<ExchangeTotals> {
  const p = periodStarts(now, STORE_TIMEZONE);
  const isToday = sql`${exchanges.createdAt} >= ${p.day}`;
  const [row] = await db
    .select({
      todayCount: int(sql`count(*) filter (where ${isToday})`),
      todayDiff: int(sql`coalesce(sum(${exchanges.differencePaise}) filter (where ${isToday}), 0)`),
      monthCount: int(sql`count(*)`),
      monthDiff: int(sql`coalesce(sum(${exchanges.differencePaise}), 0)`),
    })
    .from(exchanges)
    .where(
      and(eq(exchanges.storeId, storeId), gte(exchanges.createdAt, p.month), lte(exchanges.createdAt, p.now), filter, status),
    );
  return {
    today: { count: row.todayCount, differencePaise: row.todayDiff },
    month: { count: row.monthCount, differencePaise: row.monthDiff },
  };
}

export type ActivityEntry = {
  kind: 'sale' | 'exchange';
  id: string;
  at: Date;
  description: string;
  /** Exchange only: what came back and what went out, for wording in another language. */
  swap?: { returned: string; issued: string };
  amountPaise: number;
  creditedTo: string;
  recordedBy: string;
  /** Waiting for the owner, approved, or rejected (plan v12). */
  status: ApprovalStatus;
  /** Sale entered without scanning. */
  manual: boolean;
};

async function recentActivity(
  db: Db,
  storeId: string,
  { staffId, limit = 30 }: { staffId?: string; limit?: number } = {},
): Promise<ActivityEntry[]> {
  const credited = alias(staff, 'credited');
  const recorder = alias(staff, 'recorder');
  const saleRows = await db
    .select({
      id: sales.id,
      at: sales.createdAt,
      quantity: sales.quantity,
      name: sales.productName,
      size: sales.size,
      color: sales.color,
      unitPricePaise: sales.unitPricePaise,
      totalPaise: sales.totalPaise,
      creditedTo: credited.name,
      recordedBy: recorder.name,
      status: saleStatus,
      manual: sales.manual,
    })
    .from(sales)
    .innerJoin(credited, eq(credited.id, sales.soldBy))
    .innerJoin(recorder, eq(recorder.id, sales.recordedBy))
    .where(
      and(eq(sales.storeId, storeId), staffId ? or(eq(sales.soldBy, staffId), eq(sales.recordedBy, staffId)) : undefined),
    )
    .orderBy(desc(sales.createdAt))
    .limit(limit);
  const returned = alias(products, 'returned');
  const exchangeRows = await db
    .select({
      id: exchanges.id,
      at: exchanges.createdAt,
      returnedQuantity: exchanges.returnedQuantity,
      returnedName: returned.name,
      returnedSize: returned.size,
      issuedQuantity: exchanges.issuedQuantity,
      issuedName: exchanges.issuedProductName,
      issuedSize: exchanges.issuedSize,
      differencePaise: exchanges.differencePaise,
      creditedTo: credited.name,
      recordedBy: recorder.name,
      status: exchangeStatus,
    })
    .from(exchanges)
    .innerJoin(returned, eq(returned.id, exchanges.returnedProductId))
    .innerJoin(credited, eq(credited.id, exchanges.creditedTo))
    .innerJoin(recorder, eq(recorder.id, exchanges.recordedBy))
    .where(
      and(
        eq(exchanges.storeId, storeId),
        staffId ? or(eq(exchanges.creditedTo, staffId), eq(exchanges.recordedBy, staffId)) : undefined,
      ),
    )
    .orderBy(desc(exchanges.createdAt))
    .limit(limit);

  const entries: ActivityEntry[] = [
    ...saleRows.map((r) => ({
      kind: 'sale' as const,
      id: r.id,
      at: r.at,
      description: r.manual ? `${r.quantity} × ${r.name}${r.size ? ` (${r.size})` : ''}` : `${r.quantity} × ${r.name} (${r.size}, ${r.color})`,
      amountPaise: r.totalPaise,
      creditedTo: r.creditedTo,
      recordedBy: r.recordedBy,
      status: r.status,
      manual: r.manual,
    })),
    ...exchangeRows.map((r) => ({
      kind: 'exchange' as const,
      id: r.id,
      at: r.at,
      description: `Returned ${r.returnedQuantity} × ${r.returnedName} (${r.returnedSize}) → ${r.issuedQuantity} × ${r.issuedName} (${r.issuedSize})`,
      swap: { returned: `${r.returnedQuantity} × ${r.returnedName} (${r.returnedSize})`, issued: `${r.issuedQuantity} × ${r.issuedName} (${r.issuedSize})` },
      amountPaise: r.differencePaise,
      creditedTo: r.creditedTo,
      recordedBy: r.recordedBy,
      status: r.status,
      manual: false,
    })),
  ];
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** Salesman's own dashboard: what is credited to them, and what they entered for others. */
export async function staffDashboard(db: Db, storeId: string, staffId: string, now = new Date()) {
  const [mine, forOthers, myExchanges, waiting, waitingExchanges, activity] = await Promise.all([
    saleTotals(db, storeId, now, eq(sales.soldBy, staffId)),
    saleTotals(db, storeId, now, and(eq(sales.recordedBy, staffId), ne(sales.soldBy, staffId))),
    exchangeTotals(db, storeId, now, eq(exchanges.creditedTo, staffId)),
    // Still waiting for the owner (plan v12): shown apart, never in the totals.
    saleTotals(db, storeId, now, eq(sales.soldBy, staffId), saleWaiting),
    exchangeTotals(db, storeId, now, eq(exchanges.creditedTo, staffId), exchangeWaiting),
    recentActivity(db, storeId, { staffId, limit: 25 }),
  ]);
  return { mine, forOthers, exchanges: myExchanges, waiting, waitingExchanges, activity };
}

export type SalespersonRow = {
  id: string;
  name: string;
  active: boolean;
  today: { units: number; netPaise: number };
  month: { units: number; netPaise: number };
};

/**
 * Owner's Home (plan v17): only today's approved sales — money in (sales plus
 * exchange differences), pieces and number of sales. Two queries instead of the
 * whole `shopDashboard`.
 */
export async function shopToday(db: Db, storeId: string, now = new Date()) {
  const [totals, exchangeSums] = await Promise.all([saleTotals(db, storeId, now), exchangeTotals(db, storeId, now)]);
  return { sales: totals.today, netRevenuePaise: totals.today.totalPaise + exchangeSums.today.differencePaise };
}

/** Whole shop, today and this month, with profit, people and stock (admin only; Home uses `shopToday`). */
export async function shopDashboard(db: Db, storeId: string, now = new Date()) {
  const p = periodStarts(now, STORE_TIMEZONE);
  const [totals, exchangeSums, profitRow, people, salesByPerson, exchangesByPerson, lowStock, stockRow, activity] =
    await Promise.all([
      saleTotals(db, storeId, now),
      exchangeTotals(db, storeId, now),
      db
        .select({
          today: int(
            sql`coalesce(sum(${sales.quantity} * (${sales.unitPricePaise} - ${sales.costPaise})) filter (where ${sales.createdAt} >= ${p.day}), 0)`,
          ),
          month: int(sql`coalesce(sum(${sales.quantity} * (${sales.unitPricePaise} - ${sales.costPaise})), 0)`),
        })
        .from(sales)
        .where(and(eq(sales.storeId, storeId), gte(sales.createdAt, p.month), saleApproved, sql`${sales.costPaise} is not null`)),
      db.select({ id: staff.id, name: staff.name, active: staff.active, role: staff.role }).from(staff).where(eq(staff.storeId, storeId)).orderBy(asc(staff.name)),
      db
        .select({
          staffId: sales.soldBy,
          todayUnits: int(sql`coalesce(sum(${sales.quantity}) filter (where ${sales.createdAt} >= ${p.day}), 0)`),
          todayTotal: int(sql`coalesce(sum(${sales.totalPaise}) filter (where ${sales.createdAt} >= ${p.day}), 0)`),
          monthUnits: int(sql`coalesce(sum(${sales.quantity}), 0)`),
          monthTotal: int(sql`coalesce(sum(${sales.totalPaise}), 0)`),
        })
        .from(sales)
        .where(and(eq(sales.storeId, storeId), gte(sales.createdAt, p.month), saleApproved))
        .groupBy(sales.soldBy),
      db
        .select({
          staffId: exchanges.creditedTo,
          todayDiff: int(sql`coalesce(sum(${exchanges.differencePaise}) filter (where ${exchanges.createdAt} >= ${p.day}), 0)`),
          monthDiff: int(sql`coalesce(sum(${exchanges.differencePaise}), 0)`),
        })
        .from(exchanges)
        .where(and(eq(exchanges.storeId, storeId), gte(exchanges.createdAt, p.month), exchangeApproved))
        .groupBy(exchanges.creditedTo),
      db
        .select({ id: products.id, sku: products.sku, name: products.name, size: products.size, color: products.color, stock: products.stock })
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.active, true), lte(products.stock, LOW_STOCK_THRESHOLD)))
        .orderBy(asc(products.stock), asc(products.sku)),
      db
        .select({
          units: int(sql`coalesce(sum(${products.stock}), 0)`),
          mrpValue: int(sql`coalesce(sum(${products.stock} * ${products.mrpPaise}), 0)`),
          costValue: int(sql`coalesce(sum(${products.stock} * ${products.costPaise}), 0)`),
          productCount: int(sql`count(*)`),
        })
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.active, true))),
      recentActivity(db, storeId, { limit: 15 }),
    ]);

  const salespeople: SalespersonRow[] = people
    .filter((person) => person.role === 'salesman' || salesByPerson.some((s) => s.staffId === person.id))
    .map((person) => {
      const s = salesByPerson.find((row) => row.staffId === person.id);
      const e = exchangesByPerson.find((row) => row.staffId === person.id);
      return {
        id: person.id,
        name: person.name,
        active: person.active,
        today: { units: s?.todayUnits ?? 0, netPaise: (s?.todayTotal ?? 0) + (e?.todayDiff ?? 0) },
        month: { units: s?.monthUnits ?? 0, netPaise: (s?.monthTotal ?? 0) + (e?.monthDiff ?? 0) },
      };
    })
    .sort((a, b) => b.month.netPaise - a.month.netPaise);

  return {
    sales: totals,
    exchanges: exchangeSums,
    netRevenue: {
      today: totals.today.totalPaise + exchangeSums.today.differencePaise,
      month: totals.month.totalPaise + exchangeSums.month.differencePaise,
    },
    estimatedProfit: profitRow[0],
    salespeople,
    lowStock,
    stock: stockRow[0],
    activity,
  };
}

/** Full activity log for the admin. */
export async function shopActivity(db: Db, storeId: string, limit = 100) {
  return recentActivity(db, storeId, { limit });
}

// ------------------------------------------------------------------ reports

export type ReportPeriod = 'today' | '7d' | '30d' | 'month';
export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
];

/** Start of the period (shop time zone) as timestamptz SQL. */
function periodStart(period: ReportPeriod, now: Date): SQL {
  const at = sql`${now.toISOString()}::timestamptz`;
  const tz = STORE_TIMEZONE;
  const today = sql`(date_trunc('day', ${at} AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`;
  if (period === 'today') return today;
  if (period === 'month') return sql`(date_trunc('month', ${at} AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`;
  const days = period === '7d' ? 6 : 29; // today plus the previous 6 / 29 days
  return sql`(${today} - make_interval(days => ${days}))`;
}

export type GroupRow = { label: string; units: number; revenuePaise: number; profitPaise: number };

/** Owner report for a period: totals, by category / company / salesperson, top sellers, and stock that isn't moving. */
export async function salesReport(db: Db, storeId: string, period: ReportPeriod, now = new Date()) {
  const from = periodStart(period, now);
  const at = sql`${now.toISOString()}::timestamptz`;
  const inPeriod = and(eq(sales.storeId, storeId), gte(sales.createdAt, from), lte(sales.createdAt, at), saleApproved);
  const units = int(sql`coalesce(sum(${sales.quantity}), 0)`);
  const revenue = int(sql`coalesce(sum(${sales.totalPaise}), 0)`);
  const profit = int(sql`coalesce(sum(${sales.quantity} * (${sales.unitPricePaise} - ${sales.costPaise})) filter (where ${sales.costPaise} is not null), 0)`);
  const seller = alias(staff, 'seller');

  const [totals, exchangeTotal, byCategory, bySupplier, bySalesperson, topProducts, slowMovers] = await Promise.all([
    db.select({ count: int(sql`count(*)`), units, revenuePaise: revenue, profitPaise: profit }).from(sales).where(inPeriod),
    db
      .select({ count: int(sql`count(*)`), differencePaise: int(sql`coalesce(sum(${exchanges.differencePaise}), 0)`) })
      .from(exchanges)
      .where(and(eq(exchanges.storeId, storeId), gte(exchanges.createdAt, from), lte(exchanges.createdAt, at), exchangeApproved)),
    db
      .select({ label: products.category, units, revenuePaise: revenue, profitPaise: profit })
      .from(sales)
      .innerJoin(products, eq(products.id, sales.productId))
      .where(inPeriod)
      .groupBy(products.category)
      .orderBy(desc(revenue)),
    db
      .select({ label: sql<string>`coalesce(${suppliers.name}, 'No company')`, units, revenuePaise: revenue, profitPaise: profit })
      .from(sales)
      .innerJoin(products, eq(products.id, sales.productId))
      .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
      .where(inPeriod)
      .groupBy(suppliers.name)
      .orderBy(desc(revenue)),
    db
      .select({ label: seller.name, units, revenuePaise: revenue, profitPaise: profit })
      .from(sales)
      .innerJoin(seller, eq(seller.id, sales.soldBy))
      .where(inPeriod)
      .groupBy(seller.name)
      .orderBy(desc(revenue)),
    db
      .select({
        productId: sales.productId,
        label: sql<string>`${sales.productName} || ' · ' || ${sales.color} || ' · ' || ${sales.size}`,
        units,
        revenuePaise: revenue,
        profitPaise: profit,
      })
      .from(sales)
      .where(inPeriod)
      .groupBy(sales.productId, sales.productName, sales.color, sales.size)
      .orderBy(desc(units), desc(revenue))
      .limit(10),
    // In stock but nothing sold in the last 30 days (newest arrivals excluded: added more than 30 days ago or never sold).
    db
      .select({
        productId: products.id,
        label: sql<string>`${products.name} || ' · ' || ${products.color} || ' · ' || ${products.size}`,
        stock: products.stock,
        mrpValuePaise: int(sql`${products.stock} * ${products.mrpPaise}`),
        lastSoldAt: sql<Date | null>`(select max(${sales.createdAt}) from ${sales} where ${sales.productId} = ${products.id})`,
      })
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          eq(products.active, true),
          gte(products.stock, 1),
          sql`not exists (select 1 from ${sales} where ${sales.productId} = ${products.id} and ${sales.createdAt} >= ${at} - interval '30 days')`,
        ),
      )
      .orderBy(desc(sql`${products.stock} * ${products.mrpPaise}`))
      .limit(20),
  ]);
  return {
    totals: { ...totals[0], exchanges: exchangeTotal[0], netRevenuePaise: totals[0].revenuePaise + exchangeTotal[0].differencePaise },
    byCategory: byCategory as GroupRow[],
    bySupplier: bySupplier as GroupRow[],
    bySalesperson: bySalesperson as GroupRow[],
    topProducts,
    slowMovers: slowMovers.map((s) => ({ ...s, lastSoldAt: s.lastSoldAt ? new Date(s.lastSoldAt) : null })),
  };
}

/** Every sale and exchange in the period, for the accountant (owner only: includes purchase prices). */
export async function salesExportRows(db: Db, storeId: string, period: ReportPeriod, now = new Date()) {
  const from = periodStart(period, now);
  const at = sql`${now.toISOString()}::timestamptz`;
  const credited = alias(staff, 'credited');
  const recorder = alias(staff, 'recorder');
  const saleRows = await db
    .select({
      at: sales.createdAt,
      sku: sales.sku,
      name: sales.productName,
      size: sales.size,
      color: sales.color,
      category: products.category,
      company: suppliers.name,
      quantity: sales.quantity,
      unitPricePaise: sales.unitPricePaise,
      totalPaise: sales.totalPaise,
      mrpPaise: sales.mrpPaise,
      costPaise: sales.costPaise,
      creditedTo: credited.name,
      recordedBy: recorder.name,
      status: saleStatus,
      manual: sales.manual,
    })
    .from(sales)
    .leftJoin(products, eq(products.id, sales.productId))
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .innerJoin(credited, eq(credited.id, sales.soldBy))
    .innerJoin(recorder, eq(recorder.id, sales.recordedBy))
    .where(and(eq(sales.storeId, storeId), gte(sales.createdAt, from), lte(sales.createdAt, at)))
    .orderBy(asc(sales.createdAt));
  const returned = alias(products, 'returned');
  const exchangeRows = await db
    .select({
      at: exchanges.createdAt,
      returnedName: returned.name,
      returnedQuantity: exchanges.returnedQuantity,
      issuedSku: exchanges.issuedSku,
      issuedName: exchanges.issuedProductName,
      issuedQuantity: exchanges.issuedQuantity,
      differencePaise: exchanges.differencePaise,
      creditedTo: credited.name,
      recordedBy: recorder.name,
      status: exchangeStatus,
    })
    .from(exchanges)
    .innerJoin(returned, eq(returned.id, exchanges.returnedProductId))
    .innerJoin(credited, eq(credited.id, exchanges.creditedTo))
    .innerJoin(recorder, eq(recorder.id, exchanges.recordedBy))
    .where(and(eq(exchanges.storeId, storeId), gte(exchanges.createdAt, from), lte(exchanges.createdAt, at)))
    .orderBy(asc(exchanges.createdAt));
  return { saleRows, exchangeRows };
}

// ---------------------------------------------------------------- sales team

/** Shop dates (YYYY-MM-DD, shop time zone) covered by a report period, oldest first. */
export function periodDays(period: ReportPeriod, now = new Date(), timezone: string = STORE_TIMEZONE): string[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [y, m, d] = today.split('-').map(Number);
  const count = period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : d;
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d - (count - 1 - i))).toISOString().slice(0, 10));
}

export type TeamSeller = {
  id: string;
  name: string;
  role: 'admin' | 'salesman';
  active: boolean;
  /** Sales credited to this person (sold_by). */
  bills: number;
  units: number;
  salesPaise: number;
  /** MRP value of the pieces sold: how far below MRP they sold on average. */
  mrpPaise: number;
  /** Exchange differences credited to this person. */
  exchangePaise: number;
  netPaise: number;
  /** Share of the team's net sales, 0–100. */
  sharePct: number;
  /** Net sales per day, aligned with `days`. */
  daily: number[];
};

/**
 * Owner's sales-team dashboard for a period: every salesman (and anyone else
 * who sold), their sales, share of the team and day-by-day sales. Net sales =
 * sales credited to the person + exchange differences credited to them, as on
 * the dashboard. Days are shop days (IST).
 */
export async function teamReport(db: Db, storeId: string, period: ReportPeriod, now = new Date()) {
  const from = periodStart(period, now);
  const at = sql`${now.toISOString()}::timestamptz`;
  // The shop's zone written into the SQL once (a fixed config value), so GROUP BY matches the selected day exactly.
  const tz = sql.raw(`'${STORE_TIMEZONE.replace(/'/g, "''")}'`);
  const saleDay = sql<string>`to_char(${sales.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;
  const exchangeDay = sql<string>`to_char(${exchanges.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;
  const salesIn = and(eq(sales.storeId, storeId), gte(sales.createdAt, from), lte(sales.createdAt, at), saleApproved);
  const exchangesIn = and(eq(exchanges.storeId, storeId), gte(exchanges.createdAt, from), lte(exchanges.createdAt, at), exchangeApproved);

  const [people, saleRows, exchangeRows, saleDays, exchangeDays] = await Promise.all([
    db.select({ id: staff.id, name: staff.name, role: staff.role, active: staff.active }).from(staff).where(eq(staff.storeId, storeId)).orderBy(asc(staff.name)),
    db
      .select({
        staffId: sales.soldBy,
        bills: int(sql`count(*)`),
        units: int(sql`coalesce(sum(${sales.quantity}), 0)`),
        salesPaise: int(sql`coalesce(sum(${sales.totalPaise}), 0)`),
        mrpPaise: int(sql`coalesce(sum(${sales.quantity} * ${sales.mrpPaise}), 0)`),
      })
      .from(sales)
      .where(salesIn)
      .groupBy(sales.soldBy),
    db
      .select({ staffId: exchanges.creditedTo, differencePaise: int(sql`coalesce(sum(${exchanges.differencePaise}), 0)`) })
      .from(exchanges)
      .where(exchangesIn)
      .groupBy(exchanges.creditedTo),
    db
      .select({ staffId: sales.soldBy, day: saleDay, paise: int(sql`coalesce(sum(${sales.totalPaise}), 0)`) })
      .from(sales)
      .where(salesIn)
      .groupBy(sales.soldBy, saleDay),
    db
      .select({ staffId: exchanges.creditedTo, day: exchangeDay, paise: int(sql`coalesce(sum(${exchanges.differencePaise}), 0)`) })
      .from(exchanges)
      .where(exchangesIn)
      .groupBy(exchanges.creditedTo, exchangeDay),
  ]);

  const days = periodDays(period, now);
  const sellers = people
    .filter((p) => p.role === 'salesman' || saleRows.some((s) => s.staffId === p.id) || exchangeRows.some((e) => e.staffId === p.id))
    .map((p) => {
      const s = saleRows.find((r) => r.staffId === p.id);
      const exchangePaise = exchangeRows.find((r) => r.staffId === p.id)?.differencePaise ?? 0;
      const daily = days.map(
        (day) =>
          (saleDays.find((r) => r.staffId === p.id && r.day === day)?.paise ?? 0) +
          (exchangeDays.find((r) => r.staffId === p.id && r.day === day)?.paise ?? 0),
      );
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        active: p.active,
        bills: s?.bills ?? 0,
        units: s?.units ?? 0,
        salesPaise: s?.salesPaise ?? 0,
        mrpPaise: s?.mrpPaise ?? 0,
        exchangePaise,
        netPaise: (s?.salesPaise ?? 0) + exchangePaise,
        sharePct: 0,
        daily,
      };
    });
  const teamNet = sellers.reduce((sum, s) => sum + s.netPaise, 0);
  for (const s of sellers) s.sharePct = teamNet > 0 ? Math.max(0, (s.netPaise / teamNet) * 100) : 0;
  sellers.sort((a, b) => b.netPaise - a.netPaise || a.name.localeCompare(b.name));

  return {
    days,
    sellers: sellers as TeamSeller[],
    totals: {
      salesmen: people.filter((p) => p.role === 'salesman' && p.active).length,
      sold: sellers.filter((s) => s.bills > 0 || s.exchangePaise !== 0).length,
      netPaise: teamNet,
      bills: sellers.reduce((n, s) => n + s.bills, 0),
      units: sellers.reduce((n, s) => n + s.units, 0),
    },
  };
}
