import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { products, sales, staff, stockMovements, stockReceipts, suppliers } from '@/db/schema';
import { STORE_TIMEZONE } from '@/lib/app-config';
import { inRange, type DayRange } from '@/lib/company-period';
import { saleStatus, type ApprovalStatus } from './approvals';

/**
 * The product page's figures (owner's feedback 2026-11-20, plan v19 V19-05):
 * for a whole design (every size / colour), what was sold, what came in, the
 * profit, and the last sale / arrival — for a period. Sold totals count
 * approved sales only (the owner's rule for every total); the list shows
 * every sale with its status. Amounts that need the purchase price (profit,
 * purchase value) are null without the *costs* right.
 */
export type ProductSaleRow = {
  id: string;
  day: string;
  createdAt: Date;
  size: string;
  color: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  profitPaise: number | null;
  soldByName: string;
  status: ApprovalStatus;
  offline: boolean;
};
export type ProductArrivalRow = {
  key: string;
  day: string;
  createdAt: Date;
  billNumber: string | null;
  supplierId: string | null;
  supplierName: string | null;
  staffName: string | null;
  pieces: number;
  amountPaise: number | null;
  estimated: boolean;
  reason: 'opening' | 'stock_in';
};
export type ProductReport = {
  totals: {
    soldPieces: number;
    soldCount: number;
    revenuePaise: number;
    profitPaise: number | null;
    /** Some approved sale has no purchase price: profit is for the rest only. */
    profitPartial: boolean;
    waiting: number;
    boughtPieces: number;
    purchasePaise: number | null;
    estimated: boolean;
  };
  lastSale: { day: string; soldByName: string } | null;
  lastArrival: { day: string; supplierName: string | null; billNumber: string | null } | null;
  sales: ProductSaleRow[];
  arrivals: ProductArrivalRow[];
};

const tz = sql.raw(`'${STORE_TIMEZONE.replace(/'/g, "''")}'`);
const ALL: DayRange = { key: 'all', from: null, to: null };
const dayOf = (column: ReturnType<typeof sql>) => sql<string>`to_char(${column} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;

export async function productReport(
  db: Db,
  storeId: string,
  productIds: readonly string[],
  { amounts, period = ALL }: { amounts: boolean; period?: DayRange },
): Promise<ProductReport> {
  if (productIds.length === 0) {
    return { totals: { soldPieces: 0, soldCount: 0, revenuePaise: 0, profitPaise: amounts ? 0 : null, profitPartial: false, waiting: 0, boughtPieces: 0, purchasePaise: amounts ? 0 : null, estimated: false }, lastSale: null, lastArrival: null, sales: [], arrivals: [] };
  }
  const ids = [...productIds];
  const [saleRows, arrivalRows] = await Promise.all([
    db
      .select({
        id: sales.id,
        day: dayOf(sql`${sales.createdAt}`),
        createdAt: sales.createdAt,
        size: sales.size,
        color: sales.color,
        quantity: sales.quantity,
        unitPricePaise: sales.unitPricePaise,
        totalPaise: sales.totalPaise,
        costPaise: sales.costPaise,
        soldByName: staff.name,
        status: saleStatus,
        offlineAt: sales.offlineAt,
      })
      .from(sales)
      .innerJoin(staff, eq(staff.id, sales.soldBy))
      .where(and(eq(sales.storeId, storeId), inArray(sales.productId, ids)))
      .orderBy(desc(sales.createdAt))
      .limit(500),
    db
      .select({
        id: stockMovements.id,
        refId: stockMovements.refId,
        reason: stockMovements.reason,
        quantity: stockMovements.quantityChange,
        unitCost: sql<number | null>`coalesce(${stockMovements.unitCostPaise}, ${products.costPaise})`,
        snapshot: stockMovements.unitCostPaise,
        createdAt: stockMovements.createdAt,
        day: sql<string>`coalesce(${stockReceipts.stockDate}::text, to_char(${stockMovements.createdAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD'))`,
        billNumber: stockReceipts.billNumber,
        supplierId: stockReceipts.supplierId,
        supplierName: suppliers.name,
        staffName: staff.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .leftJoin(stockReceipts, eq(stockReceipts.id, stockMovements.refId))
      .leftJoin(suppliers, eq(suppliers.id, stockReceipts.supplierId))
      .leftJoin(staff, eq(staff.id, stockMovements.staffId))
      .where(and(eq(stockMovements.storeId, storeId), inArray(stockMovements.productId, ids), inArray(stockMovements.reason, ['opening', 'stock_in'])))
      .orderBy(desc(stockMovements.createdAt)),
  ]);

  const hide = (value: number) => (amounts ? value : null);
  const everySale: ProductSaleRow[] = saleRows.map((row) => ({
    id: row.id,
    day: row.day,
    createdAt: row.createdAt,
    size: row.size,
    color: row.color,
    quantity: row.quantity,
    unitPricePaise: row.unitPricePaise,
    totalPaise: row.totalPaise,
    profitPaise: row.costPaise === null ? null : hide(row.totalPaise - row.costPaise * row.quantity),
    soldByName: row.soldByName,
    status: row.status,
    offline: row.offlineAt !== null,
  }));
  // One row per delivery (receipt); a lone opening entry is its own row.
  const byDelivery = new Map<string, ProductArrivalRow & { amount: number }>();
  for (const row of arrivalRows) {
    if (row.quantity <= 0) continue;
    const key = row.refId ?? row.id;
    const cost = row.unitCost === null ? null : Number(row.unitCost);
    let entry = byDelivery.get(key);
    if (!entry) {
      entry = { key, day: row.day, createdAt: row.createdAt, billNumber: row.billNumber, supplierId: row.supplierId, supplierName: row.supplierName, staffName: row.staffName, pieces: 0, amountPaise: null, amount: 0, estimated: false, reason: row.reason as 'opening' | 'stock_in' };
      byDelivery.set(key, entry);
    }
    entry.pieces += row.quantity;
    entry.amount += row.quantity * (cost ?? 0);
    if (row.snapshot === null && cost !== null) entry.estimated = true;
  }
  const everyArrival = [...byDelivery.values()].sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.getTime() - a.createdAt.getTime());

  const shownSales = everySale.filter((s) => inRange(s.day, period));
  const shownArrivals = everyArrival.filter((a) => inRange(a.day, period));
  const approved = shownSales.filter((s) => s.status === 'approved');
  const withCost = approved.filter((s) => s.profitPaise !== null || !amounts);
  const lastSale = everySale.find((s) => s.status === 'approved') ?? null;
  const lastArrival = everyArrival[0] ?? null;
  return {
    totals: {
      soldPieces: approved.reduce((n, s) => n + s.quantity, 0),
      soldCount: approved.length,
      revenuePaise: approved.reduce((n, s) => n + s.totalPaise, 0),
      profitPaise: hide(approved.reduce((n, s) => n + (s.profitPaise ?? 0), 0)),
      profitPartial: amounts && withCost.length < approved.length,
      waiting: shownSales.filter((s) => s.status === 'waiting').length,
      boughtPieces: shownArrivals.reduce((n, a) => n + a.pieces, 0),
      purchasePaise: hide(shownArrivals.reduce((n, a) => n + a.amount, 0)),
      estimated: shownArrivals.some((a) => a.estimated),
    },
    lastSale: lastSale ? { day: lastSale.day, soldByName: lastSale.soldByName } : null,
    lastArrival: lastArrival ? { day: lastArrival.day, supplierName: lastArrival.supplierName, billNumber: lastArrival.billNumber } : null,
    sales: shownSales,
    arrivals: shownArrivals.map(({ amount, ...row }) => ({ ...row, amountPaise: hide(amount) })),
  };
}
