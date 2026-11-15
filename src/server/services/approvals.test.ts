// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { approvalDecisions, sales, stockMovements } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import {
  approveAll,
  approveExchange,
  approveSale,
  pendingCount,
  pendingForOwner,
  recentDecisions,
  rejectExchange,
  rejectSale,
  statusesForExchanges,
  statusesForSales,
} from './approvals';
import { findReturnableSales, recordExchange } from './exchanges';
import { clearAllStock, findProductByCode } from './products';
import { salesExportRows, salesReport, shopDashboard, staffDashboard, teamReport } from './reports';
import { recordSale } from './sales';
import { listStaff } from './staff';

let db: Db;
let people: Record<string, string>;
let op = 0;
const nextOp = () => `appr-${++op}`;

async function product(code: string) {
  const found = await findProductByCode(db, STORE_ID, code);
  if (!found) throw new Error(`missing ${code}`);
  return found;
}
const stockOf = async (code: string) => (await product(code)).stock;

/** A scanned sale by `soldBy`, recorded by the same person unless said otherwise. */
async function sell(code: string, soldBy: string, unitPricePaise: number, quantity = 1, recordedBy = soldBy) {
  const p = await product(code);
  return recordSale(db, STORE_ID, { operationId: nextOp(), productId: p.id, quantity, unitPricePaise, soldBy, recordedBy });
}
/** A sale entered without scanning (plan v12). */
const byHand = (name: string, unitPricePaise: number, soldBy: string, size?: string, quantity = 1) =>
  recordSale(db, STORE_ID, { operationId: nextOp(), manual: { name, size }, quantity, unitPricePaise, soldBy, recordedBy: soldBy });

const movementsFor = (refId: string) => db.select().from(stockMovements).where(eq(stockMovements.refId, refId));
/** Today in the shop's zone, as the queue groups it. */
const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  people = Object.fromEntries((await listStaff(db, STORE_ID)).map((p) => [p.name, p.id]));
});

describe('sale entered by hand', () => {
  it('moves no stock, has no MRP cap, keeps what was typed, and waits for the owner', async () => {
    const { sale, stockLeft, duplicate } = await byHand('  blue   kurti ', 999900, people.Vishal, 'M');
    expect(duplicate).toBe(false);
    expect(stockLeft).toBe(0);
    expect(sale).toMatchObject({ manual: true, productId: null, mrpPaise: null, costPaise: null, sku: '', color: '', size: 'M', productName: 'blue kurti', totalPaise: 999900 });
    expect(await movementsFor(sale.id)).toHaveLength(0);
    expect((await statusesForSales(db, [sale.id])).get(sale.id)).toBe('waiting');

    const count = await pendingCount(db, STORE_ID);
    expect(count).toMatchObject({ sales: 1, exchanges: 0, total: 1, oldestDay: todayIst() });
    const [day] = await pendingForOwner(db, STORE_ID);
    expect(day.day).toBe(todayIst());
    expect(day.totalPaise).toBe(999900);
    expect(day.entries[0]).toMatchObject({ kind: 'sale', manual: true, title: 'blue kurti', detail: 'M', mrpPaise: null, listPricePaise: null, soldBy: 'Vishal', recordedBy: 'Vishal' });

    // A retried submit returns the same sale (never two).
    const again = await recordSale(db, STORE_ID, { operationId: sale.operationId, manual: { name: 'blue kurti' }, quantity: 1, unitPricePaise: 999900, soldBy: people.Vishal, recordedBy: people.Vishal });
    expect(again.duplicate).toBe(true);
    expect(again.sale.id).toBe(sale.id);
    expect(await db.select().from(sales)).toHaveLength(1);
  });

  it('needs a name of up to 80 letters', async () => {
    await expect(byHand('   ', 1000, people.Vishal)).rejects.toThrow(/Type what the item is/);
    await expect(byHand('x'.repeat(81), 1000, people.Vishal)).rejects.toThrow(/too long/);
    await expect(recordSale(db, STORE_ID, { operationId: nextOp(), quantity: 1, unitPricePaise: 1000, soldBy: people.Vishal, recordedBy: people.Vishal })).rejects.toThrow(/Product not found/);
  });

  it('cannot be exchanged against (nothing to return)', async () => {
    const { sale } = await byHand('old saree', 150000, people.Vishal);
    const issued = await product('MAA-KU-001');
    await expect(
      recordExchange(db, STORE_ID, { operationId: nextOp(), originalSaleId: sale.id, returnedQuantity: 1, issuedProductId: issued.id, issuedQuantity: 1, issuedUnitPricePaise: 100000, creditedTo: people.Vishal, recordedBy: people.Vishal }),
    ).rejects.toThrow(/entered by hand/);
  });
});

describe('who waits and who does not', () => {
  it("the owner's own entries are approved as recorded; a salesman's wait; auto rows stay out of the decisions list", async () => {
    const mine = await sell('MAA-KU-001', people.Owner, 120000);
    const theirs = await sell('MAA-KU-001', people.Nitin, 120000);
    const statuses = await statusesForSales(db, [mine.sale.id, theirs.sale.id]);
    expect(statuses.get(mine.sale.id)).toBe('approved');
    expect(statuses.get(theirs.sale.id)).toBe('waiting');
    const [auto] = await db.select().from(approvalDecisions).where(eq(approvalDecisions.saleId, mine.sale.id));
    expect(auto).toMatchObject({ auto: true, decision: 'approved', decidedBy: people.Owner });
    expect(await recentDecisions(db, STORE_ID)).toHaveLength(0);
    expect((await pendingCount(db, STORE_ID)).total).toBe(1);
  });

  it('a sale the owner records for a salesman is approved too (the owner saw it)', async () => {
    const { sale } = await sell('MAA-KU-001', people.Vishal, 120000, 1, people.Owner);
    expect((await statusesForSales(db, [sale.id])).get(sale.id)).toBe('approved');
  });
});

describe('approve', () => {
  it('starts counting the sale; a second approve, or a salesman, changes nothing', async () => {
    const { sale } = await sell('MAA-KU-001', people.Vishal, 120000, 2);
    expect((await shopDashboard(db, STORE_ID)).netRevenue.today).toBe(0);
    expect(await approveSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Owner })).toEqual({ changed: true, status: 'approved' });
    expect((await shopDashboard(db, STORE_ID)).netRevenue.today).toBe(240000);
    expect(await approveSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Owner })).toEqual({ changed: false, status: 'approved' });
    await expect(approveSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Vishal })).rejects.toThrow(/Only the owner/);
    await expect(approveSale(db, STORE_ID, { saleId: '00000000-0000-0000-0000-000000000000', decidedBy: people.Owner })).rejects.toThrow(/Sale not found/);
    expect(await db.select().from(approvalDecisions)).toHaveLength(1);
  });

  it('approve all for one shop day is idempotent and leaves other days alone', async () => {
    const a = await sell('MAA-KU-001', people.Vishal, 120000);
    await byHand('green dupatta', 30000, people.Nitin);
    const old = await byHand('last month', 50000, people.Nitin);
    await db.update(sales).set({ createdAt: new Date('2026-11-01T05:00:00Z') }).where(eq(sales.id, old.sale.id));

    const batch = nextOp();
    expect(await approveAll(db, STORE_ID, { decidedBy: people.Owner, batchId: batch, range: { day: todayIst() } })).toEqual({ sales: 2, exchanges: 0, total: 2 });
    expect(await approveAll(db, STORE_ID, { decidedBy: people.Owner, batchId: nextOp(), range: { day: todayIst() } })).toEqual({ sales: 0, exchanges: 0, total: 0 });
    expect(await pendingCount(db, STORE_ID)).toMatchObject({ total: 1, oldestDay: '2026-11-01' });
    expect((await statusesForSales(db, [a.sale.id])).get(a.sale.id)).toBe('approved');
    const [row] = await db.select().from(approvalDecisions).where(eq(approvalDecisions.saleId, a.sale.id));
    expect(row.batchId).toBe(batch);

    expect((await approveAll(db, STORE_ID, { decidedBy: people.Owner, batchId: nextOp() })).total).toBe(1);
    expect((await pendingCount(db, STORE_ID)).total).toBe(0);
    expect(await pendingForOwner(db, STORE_ID)).toEqual([]);
    await expect(approveAll(db, STORE_ID, { decidedBy: people.Nitin, batchId: nextOp() })).rejects.toThrow(/Only the owner/);
  });
});

describe('reject', () => {
  it('a scanned sale: pieces come back through one movement, totals drop, nothing can be decided twice', async () => {
    const before = await stockOf('MAA-KU-001');
    const { sale } = await sell('MAA-KU-001', people.Vishal, 120000, 2);
    expect(await stockOf('MAA-KU-001')).toBe(before - 2);

    const result = await rejectSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Owner, reason: 'wrong_price', note: 'He said 1,100' });
    expect(result).toEqual({ changed: true, status: 'rejected', stockReturned: 2 });
    expect(await stockOf('MAA-KU-001')).toBe(before);
    const back = (await movementsFor(sale.id)).filter((m) => m.reason === 'sale_rejected');
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ quantityChange: 2, staffId: people.Owner, note: 'He said 1,100' });

    // Second decision of either kind: no change, no second movement.
    expect(await rejectSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Owner, reason: 'other' })).toEqual({ changed: false, status: 'rejected' });
    expect(await approveSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Owner })).toEqual({ changed: false, status: 'rejected' });
    expect(await stockOf('MAA-KU-001')).toBe(before);
    expect((await movementsFor(sale.id)).filter((m) => m.reason === 'sale_rejected')).toHaveLength(1);

    expect((await shopDashboard(db, STORE_ID)).netRevenue.today).toBe(0);
    const vishal = await staffDashboard(db, STORE_ID, people.Vishal);
    expect(vishal.activity[0]).toMatchObject({ status: 'rejected', manual: false });
    expect(vishal.waiting.today.count).toBe(0);
    const [decision] = await recentDecisions(db, STORE_ID);
    expect(decision).toMatchObject({ decision: 'rejected', reason: 'wrong_price', note: 'He said 1,100', decidedBy: 'Owner', saleName: sale.productName });

    // Nothing can be returned against a rejected sale.
    expect(await findReturnableSales(db, STORE_ID, sale.productId!)).toEqual([]);
    const issued = await product('MAA-KU-002');
    await expect(
      recordExchange(db, STORE_ID, { operationId: nextOp(), originalSaleId: sale.id, returnedQuantity: 1, issuedProductId: issued.id, issuedQuantity: 1, issuedUnitPricePaise: 100000, creditedTo: people.Vishal, recordedBy: people.Vishal }),
    ).rejects.toThrow(/rejected that sale/);
    await expect(rejectSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Owner, reason: 'bogus' as never })).rejects.toThrow(/Choose a reason/);
  });

  it('a hand-entered sale returns nothing (no piece was taken)', async () => {
    const { sale } = await byHand('torn tag shirt', 80000, people.Nitin);
    expect(await rejectSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Owner, reason: 'not_sold' })).toEqual({ changed: true, status: 'rejected', stockReturned: 0 });
    expect(await movementsFor(sale.id)).toHaveLength(0);
  });

  it('after the owner cleared stock, rejecting an earlier sale does not add pieces back', async () => {
    const { sale } = await sell('MAA-KU-001', people.Vishal, 120000);
    await clearAllStock(db, STORE_ID, { staffId: people.Owner });
    expect(await rejectSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Owner, reason: 'duplicate' })).toEqual({ changed: true, status: 'rejected', stockReturned: 0 });
    expect(await stockOf('MAA-KU-001')).toBe(0);
    expect((await movementsFor(sale.id)).some((m) => m.reason === 'sale_rejected')).toBe(false);
  });

  it('a sale with a live exchange is rejected only after the exchange; rejecting the exchange undoes the swap', async () => {
    const mBefore = await stockOf('MAA-KU-001');
    const lBefore = await stockOf('MAA-KU-002');
    const { sale } = await sell('MAA-KU-001', people.Vishal, 120000, 2);
    const issued = await product('MAA-KU-002');
    const { exchange } = await recordExchange(db, STORE_ID, { operationId: nextOp(), originalSaleId: sale.id, returnedQuantity: 1, issuedProductId: issued.id, issuedQuantity: 1, issuedUnitPricePaise: 100000, creditedTo: people.Vishal, recordedBy: people.Vishal });
    expect(await stockOf('MAA-KU-001')).toBe(mBefore - 1);
    expect(await stockOf('MAA-KU-002')).toBe(lBefore - 1);
    expect((await statusesForExchanges(db, [exchange.id])).get(exchange.id)).toBe('waiting');
    expect((await pendingCount(db, STORE_ID))).toMatchObject({ sales: 1, exchanges: 1, total: 2 });

    await expect(rejectSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Owner, reason: 'wrong_item' })).rejects.toThrow(/Reject the exchange first/);

    expect(await rejectExchange(db, STORE_ID, { exchangeId: exchange.id, decidedBy: people.Owner, reason: 'wrong_item' })).toEqual({ changed: true, status: 'rejected' });
    expect(await stockOf('MAA-KU-001')).toBe(mBefore - 2); // the returned piece is out again
    expect(await stockOf('MAA-KU-002')).toBe(lBefore); //     the new item came back
    const undone = (await movementsFor(exchange.id)).filter((m) => m.reason === 'exchange_rejected');
    expect(undone.map((m) => m.quantityChange).sort()).toEqual([-1, 1]);
    expect(await rejectExchange(db, STORE_ID, { exchangeId: exchange.id, decidedBy: people.Owner, reason: 'other' })).toEqual({ changed: false, status: 'rejected' });
    expect(await approveExchange(db, STORE_ID, { exchangeId: exchange.id, decidedBy: people.Owner })).toEqual({ changed: false, status: 'rejected' });

    expect(await rejectSale(db, STORE_ID, { saleId: sale.id, decidedBy: people.Owner, reason: 'wrong_item' })).toMatchObject({ changed: true, stockReturned: 2 });
    expect(await stockOf('MAA-KU-001')).toBe(mBefore);
    expect((await pendingCount(db, STORE_ID)).total).toBe(0);
  });

  it('an exchange whose returned piece was sold again cannot be undone', async () => {
    const { sale } = await sell('MAA-KU-001', people.Vishal, 120000, 1);
    const issued = await product('MAA-KU-002');
    const { exchange } = await recordExchange(db, STORE_ID, { operationId: nextOp(), originalSaleId: sale.id, returnedQuantity: 1, issuedProductId: issued.id, issuedQuantity: 1, issuedUnitPricePaise: 100000, creditedTo: people.Vishal, recordedBy: people.Vishal });
    // The owner sells every remaining M piece (approved as recorded).
    const left = await stockOf('MAA-KU-001');
    await sell('MAA-KU-001', people.Owner, 120000, left);
    expect(await stockOf('MAA-KU-001')).toBe(0);
    await expect(rejectExchange(db, STORE_ID, { exchangeId: exchange.id, decidedBy: people.Owner, reason: 'duplicate' })).rejects.toThrow(/sold again/);
    expect((await statusesForExchanges(db, [exchange.id])).get(exchange.id)).toBe('waiting');
    expect(await approveExchange(db, STORE_ID, { exchangeId: exchange.id, decidedBy: people.Owner })).toEqual({ changed: true, status: 'approved' });
  });
});

describe('what counts', () => {
  it('reports, the team dashboard and the owner dashboard count approved entries only; the export lists every entry with its status', async () => {
    const waiting = await sell('MAA-KU-001', people.Vishal, 120000);
    const hand = await byHand('red dupatta', 30000, people.Nitin, 'Free');
    await approveSale(db, STORE_ID, { saleId: hand.sale.id, decidedBy: people.Owner });

    const report = await salesReport(db, STORE_ID, 'today');
    expect(report.totals).toMatchObject({ count: 1, units: 1, revenuePaise: 30000, profitPaise: 0, netRevenuePaise: 30000 });
    expect(report.byCategory).toEqual([]); // a hand-entered sale has no item, so no category or company
    expect(report.bySalesperson).toEqual([expect.objectContaining({ label: 'Nitin', revenuePaise: 30000 })]);
    expect(report.topProducts[0]).toMatchObject({ productId: null, units: 1 });

    const team = await teamReport(db, STORE_ID, 'today');
    expect(team.totals).toMatchObject({ netPaise: 30000, bills: 1, units: 1 });
    expect(team.sellers.find((s) => s.name === 'Vishal')).toMatchObject({ bills: 0, netPaise: 0 });

    const shop = await shopDashboard(db, STORE_ID);
    expect(shop.netRevenue.today).toBe(30000);
    expect(shop.salespeople.find((p) => p.name === 'Vishal')?.today.netPaise).toBe(0);
    expect(shop.activity.map((e) => e.status)).toEqual(['approved', 'waiting']);
    expect(shop.activity[0]).toMatchObject({ manual: true, description: '1 × red dupatta (Free)' });

    const { saleRows } = await salesExportRows(db, STORE_ID, 'today');
    expect(saleRows.map((r) => [r.name, r.status, r.manual, r.category])).toEqual([
      [waiting.sale.productName, 'waiting', false, 'Kurta'],
      ['red dupatta', 'approved', true, null],
    ]);
  });
});
