// @vitest-environment node
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { products, sales, stockMovements } from '@/db/schema';
import { DEV_PIN } from '@/db/seed';
import { isValidEan13 } from '@/features/scanning/ean13';
import { STORE_ID } from '@/lib/app-config';
import { approveAll } from './approvals';
import { recordExchange, findReturnableSales } from './exchanges';
import { createProduct, findProductByCode, stockIn, toCounterProduct } from './products';
import { shopDashboard, shopToday, staffDashboard } from './reports';
import { recordSale } from './sales';
import { createStaff, listStaff, setStaffActive, setStaffPermissions, verifyLogin } from './staff';

let db: Db;
let people: Record<string, string>;
let op = 0;
const nextOp = () => `op-${++op}`;

async function product(code: string) {
  const found = await findProductByCode(db, STORE_ID, code);
  if (!found) throw new Error(`missing ${code}`);
  return found;
}

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  people = Object.fromEntries((await listStaff(db, STORE_ID)).map((p) => [p.name, p.id]));
});

describe('seed and staff', () => {
  it('creates the owner, the four salesmen and 8 demo products', async () => {
    expect(Object.keys(people).sort()).toEqual(['Balram', 'Nitin', 'Owner', 'Pradeep', 'Vishal']);
    expect(await db.select().from(products)).toHaveLength(8);
  });

  it('logs in with the right PIN only', async () => {
    expect((await verifyLogin(db, STORE_ID, people.Vishal, DEV_PIN))?.name).toBe('Vishal');
    expect(await verifyLogin(db, STORE_ID, people.Vishal, '0000')).toBeNull();
  });

  it('owner grants permissions; unknown names are dropped; login returns them', async () => {
    expect(await setStaffPermissions(db, STORE_ID, people.Nitin, ['catalog', 'costs', 'root', 'catalog'])).toEqual(['catalog', 'costs']);
    expect((await verifyLogin(db, STORE_ID, people.Nitin, DEV_PIN))?.permissions).toEqual(['catalog', 'costs']);
    expect(await setStaffPermissions(db, STORE_ID, people.Nitin, [])).toEqual([]);
  });

  it('blocks deactivating the last admin, and inactive staff cannot log in', async () => {
    await expect(setStaffActive(db, STORE_ID, people.Owner, false, people.Vishal)).rejects.toThrow(/at least one active admin/);
    const extra = await createStaff(db, STORE_ID, { name: 'Ramesh', role: 'salesman', pin: '4321' });
    await setStaffActive(db, STORE_ID, extra.id, false, people.Owner);
    expect(await verifyLogin(db, STORE_ID, extra.id, '4321')).toBeNull();
  });
});

describe('products and barcodes', () => {
  it('finds products by barcode or SKU, and the counter view never has cost', async () => {
    expect((await product('8902222000016')).sku).toBe('MAA-KU-001');
    const tee = await product('maa-ts-001');
    expect(tee.costPaise).not.toBeNull();
    expect(Object.keys(toCounterProduct(tee))).not.toContain('costPaise');
  });

  it('generates SKU and an in-store EAN-13 barcode for a new product', async () => {
    const base = { brand: 'Riya Ethnic', category: 'Kurta', size: 'XL', color: 'Pink', mrpPaise: 149900, pricePaise: 139900, costPaise: 80000, openingStock: 5, createdBy: people.Owner };
    const first = await createProduct(db, STORE_ID, { ...base, name: 'Straight Kurta' });
    const second = await createProduct(db, STORE_ID, { ...base, name: 'Straight Kurta 2' });
    expect(first.sku).toBe('MAA-KU-003');
    expect(first.barcode).toBe('2000000000015');
    expect(second.sku).toBe('MAA-KU-004');
    expect(second.barcode).toBe('2000000000022');
    expect(isValidEan13(second.barcode)).toBe(true);
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.productId, first.id));
    expect(moves.map((m) => [m.reason, m.quantityChange])).toEqual([['opening', 5]]);
  });

  it('accepts a valid manufacturer barcode and rejects invalid or duplicate ones and price above MRP', async () => {
    const base = { name: 'Polo', brand: 'X', category: 'T-Shirt', size: 'M', color: 'Red', mrpPaise: 99900, pricePaise: 99900, costPaise: null, openingStock: 0, createdBy: people.Owner };
    const polo = await createProduct(db, STORE_ID, { ...base, manufacturerBarcode: '4006381333931' });
    expect(polo.barcode).toBe('4006381333931');
    await expect(createProduct(db, STORE_ID, { ...base, manufacturerBarcode: '4006381333930' })).rejects.toThrow(/not a valid/);
    await expect(createProduct(db, STORE_ID, { ...base, manufacturerBarcode: '4006381333931' })).rejects.toThrow(/already uses/);
    await expect(createProduct(db, STORE_ID, { ...base, pricePaise: 100000 })).rejects.toThrow(/above MRP/);
  });

  it('a single product can carry For / Age tags (plan v17); none by default; unknown values refused', async () => {
    const base = { brand: 'X', category: 'Kurta', size: 'S', color: 'Red', mrpPaise: 49900, pricePaise: 49900, costPaise: null, openingStock: 1, createdBy: people.Owner };
    const kids = await createProduct(db, STORE_ID, { ...base, name: 'Kids Kurta', forGender: 'girls', ageGroup: 'child' });
    expect([kids.forGender, kids.ageGroup]).toEqual(['girls', 'child']);
    const plain = await createProduct(db, STORE_ID, { ...base, name: 'Plain Kurta' });
    expect([plain.forGender, plain.ageGroup]).toEqual([null, null]);
    await expect(createProduct(db, STORE_ID, { ...base, name: 'Odd Kurta', ageGroup: 'teen' })).rejects.toThrow(/who the item is for/);
    expect(await db.select().from(products).where(eq(products.name, 'Odd Kurta'))).toHaveLength(0);
  });

  it('stock-in adds stock once, even if the save is retried', async () => {
    const saree = await product('MAA-SA-001');
    expect((await stockIn(db, STORE_ID, { operationId: 'in-1', productId: saree.id, quantity: 4, staffId: people.Owner })).stock).toBe(4);
    // A retried save adds nothing the second time.
    expect((await stockIn(db, STORE_ID, { operationId: 'in-1', productId: saree.id, quantity: 4, staffId: people.Owner })).duplicate).toBe(true);
    expect((await product('MAA-SA-001')).stock).toBe(4);
  });
});

describe('sales', () => {
  it('deducts stock, credits the chosen salesperson and records who entered it', async () => {
    const tee = await product('MAA-TS-001');
    const result = await recordSale(db, STORE_ID, {
      operationId: nextOp(), productId: tee.id, quantity: 2, unitPricePaise: 45000, soldBy: people.Vishal, recordedBy: people.Nitin,
    });
    expect(result.stockLeft).toBe(1);
    expect(result.sale.totalPaise).toBe(90000);
    expect(result.sale.soldBy).toBe(people.Vishal);
    expect(result.sale.recordedBy).toBe(people.Nitin);
  });

  it('never sells twice for a retried operation', async () => {
    const tee = await product('MAA-TS-001');
    const input = { operationId: 'retry-me', productId: tee.id, quantity: 1, unitPricePaise: 49900, soldBy: people.Nitin, recordedBy: people.Nitin };
    await recordSale(db, STORE_ID, input);
    const again = await recordSale(db, STORE_ID, input);
    expect(again.duplicate).toBe(true);
    expect((await product('MAA-TS-001')).stock).toBe(2);
    expect(await db.select().from(sales)).toHaveLength(1);
  });

  it('refuses overselling, out of stock and price above MRP', async () => {
    const tee = await product('MAA-TS-001');
    const saree = await product('MAA-SA-001');
    const base = { soldBy: people.Nitin, recordedBy: people.Nitin };
    await expect(recordSale(db, STORE_ID, { ...base, operationId: nextOp(), productId: tee.id, quantity: 4, unitPricePaise: 100 })).rejects.toThrow('Only 3 left in stock.');
    await expect(recordSale(db, STORE_ID, { ...base, operationId: nextOp(), productId: saree.id, quantity: 1, unitPricePaise: 100 })).rejects.toThrow('Out of stock.');
    await expect(recordSale(db, STORE_ID, { ...base, operationId: nextOp(), productId: tee.id, quantity: 1, unitPricePaise: 50000 })).rejects.toThrow(/above MRP/);
    expect((await product('MAA-TS-001')).stock).toBe(3);
  });
});

describe('exchanges', () => {
  async function sellKurtas() {
    const kurtaM = await product('MAA-KU-001');
    const { sale } = await recordSale(db, STORE_ID, {
      operationId: nextOp(), productId: kurtaM.id, quantity: 2, unitPricePaise: 110000, soldBy: people.Vishal, recordedBy: people.Vishal,
    });
    return { kurtaM, sale, kurtaL: await product('MAA-KU-002') };
  }

  it('swaps an item: stock back and out, priced at what the customer paid, original sale untouched', async () => {
    const { kurtaM, sale, kurtaL } = await sellKurtas();
    expect((await findReturnableSales(db, STORE_ID, kurtaM.id))[0]).toMatchObject({ id: sale.id, returnable: 2, soldByName: 'Vishal' });
    const { exchange } = await recordExchange(db, STORE_ID, {
      operationId: nextOp(), originalSaleId: sale.id, returnedQuantity: 1, issuedProductId: kurtaL.id, issuedQuantity: 1, issuedUnitPricePaise: 120000, creditedTo: people.Vishal, recordedBy: people.Pradeep,
    });
    expect(exchange.returnedUnitPricePaise).toBe(110000);
    expect(exchange.differencePaise).toBe(10000);
    expect((await product('MAA-KU-001')).stock).toBe(3); // 4 − 2 sold + 1 back
    expect((await product('MAA-KU-002')).stock).toBe(1); // 2 − 1 issued
    const [original] = await db.select().from(sales).where(eq(sales.id, sale.id));
    expect(original.quantity).toBe(2);
    expect((await findReturnableSales(db, STORE_ID, kurtaM.id))[0].returnable).toBe(1);
  });

  it('cannot return more than was sold, and a retried exchange is not applied twice', async () => {
    const { sale, kurtaL } = await sellKurtas();
    const input = { operationId: 'ex-1', originalSaleId: sale.id, returnedQuantity: 2, issuedProductId: kurtaL.id, issuedQuantity: 1, issuedUnitPricePaise: 100000, creditedTo: people.Vishal, recordedBy: people.Vishal };
    const first = await recordExchange(db, STORE_ID, input);
    expect(first.exchange.differencePaise).toBe(-120000); // shop gives back
    expect((await recordExchange(db, STORE_ID, input)).duplicate).toBe(true);
    await expect(recordExchange(db, STORE_ID, { ...input, operationId: 'ex-2', returnedQuantity: 1 })).rejects.toThrow(/already been exchanged/);
    expect((await product('MAA-KU-002')).stock).toBe(1);
  });

  it('refuses an exchange when the new item is out of stock, leaving stock unchanged', async () => {
    const { sale } = await sellKurtas();
    const saree = await product('MAA-SA-001');
    await expect(
      recordExchange(db, STORE_ID, { operationId: nextOp(), originalSaleId: sale.id, returnedQuantity: 1, issuedProductId: saree.id, issuedQuantity: 1, issuedUnitPricePaise: 100, creditedTo: people.Vishal, recordedBy: people.Vishal }),
    ).rejects.toThrow(/out of stock/);
    expect((await product('MAA-KU-001')).stock).toBe(2);
  });
});

describe('dashboards', () => {
  it('counts "today" in Indian time and separates own sales from sales entered for others', async () => {
    const dress = await product('MAA-DR-001');
    const sell = (soldBy: string, recordedBy: string, pricePaise: number) =>
      recordSale(db, STORE_ID, { operationId: nextOp(), productId: dress.id, quantity: 1, unitPricePaise: pricePaise, soldBy, recordedBy });
    const a = await sell(people.Nitin, people.Nitin, 150000); // 00:30 IST on 15 Nov → today
    const b = await sell(people.Nitin, people.Nitin, 140000); // 23:30 IST on 14 Nov → this month only
    await sell(people.Vishal, people.Nitin, 130000); //            entered by Nitin for Vishal
    await db.update(sales).set({ createdAt: new Date('2026-11-14T19:00:00Z') }).where(eq(sales.id, a.sale.id));
    await db.update(sales).set({ createdAt: new Date('2026-11-14T18:00:00Z') }).where(eq(sales.id, b.sale.id));
    const now = new Date('2026-11-15T10:00:00Z');
    await db.update(sales).set({ createdAt: now }).where(eq(sales.soldBy, people.Vishal));
    // Salesmen's entries wait for the owner (plan v12): nothing counts until he approves.
    const before = await staffDashboard(db, STORE_ID, people.Nitin, now);
    expect(before.mine.month).toEqual({ count: 0, units: 0, totalPaise: 0 });
    expect(before.waiting.month).toEqual({ count: 2, units: 2, totalPaise: 290000 });
    expect(before.activity.every((e) => e.status === 'waiting')).toBe(true);
    expect((await approveAll(db, STORE_ID, { decidedBy: people.Owner, batchId: nextOp() })).total).toBe(3);

    const nitin = await staffDashboard(db, STORE_ID, people.Nitin, now);
    expect(nitin.mine.today).toEqual({ count: 1, units: 1, totalPaise: 150000 });
    expect(nitin.mine.month).toEqual({ count: 2, units: 2, totalPaise: 290000 });
    expect(nitin.forOthers.today).toEqual({ count: 1, units: 1, totalPaise: 130000 });
    expect(nitin.activity).toHaveLength(3);
    expect(nitin.waiting.month.count).toBe(0);
    expect(nitin.activity.every((e) => e.status === 'approved')).toBe(true);

    const shop = await shopDashboard(db, STORE_ID, now);
    expect(shop.netRevenue).toEqual({ today: 280000, month: 420000 });
    expect(shop.salespeople.find((p) => p.name === 'Vishal')?.today.netPaise).toBe(130000);
    expect(shop.estimatedProfit.month).toBe(420000 - 3 * (dress.costPaise ?? 0));
    expect(shop.lowStock.map((p) => p.sku)).toContain('MAA-SA-001');
    // Home (plan v17) shows just today's part, and it matches.
    expect(await shopToday(db, STORE_ID, now)).toEqual({ sales: shop.sales.today, netRevenuePaise: 280000 });
  });
});

describe('owner reports', () => {
  it('groups a period by category, company and salesperson; lists top sellers and stock not moving', async () => {
    const { salesReport } = await import('./reports');
    const kurta = await product('MAA-KU-001');
    const tee = await product('MAA-TS-001');
    const sell = (p: typeof kurta, qty: number, price: number, soldBy: string) =>
      recordSale(db, STORE_ID, { operationId: nextOp(), productId: p.id, quantity: qty, unitPricePaise: price, soldBy, recordedBy: soldBy });
    await sell(kurta, 2, 120000, people.Vishal);
    await sell(tee, 1, 45000, people.Nitin);
    const old = await sell(tee, 1, 49900, people.Nitin);
    await db.update(sales).set({ createdAt: new Date('2026-10-01T10:00:00Z') }).where(eq(sales.id, old.sale.id));
    const now = new Date('2026-11-15T10:00:00Z');
    await db.update(sales).set({ createdAt: now }).where(sql`${sales.createdAt} > '2026-11-01'`);
    await approveAll(db, STORE_ID, { decidedBy: people.Owner, batchId: nextOp() });

    const week = await salesReport(db, STORE_ID, '7d', now);
    expect(week.totals).toMatchObject({ count: 2, units: 3, revenuePaise: 285000, netRevenuePaise: 285000 });
    expect(week.byCategory.map((r) => [r.label, r.units, r.revenuePaise])).toEqual([['Kurta', 2, 240000], ['T-Shirt', 1, 45000]]);
    expect(week.bySupplier).toEqual([expect.objectContaining({ label: 'No company', units: 3 })]);
    expect(week.bySalesperson.map((r) => r.label)).toEqual(['Vishal', 'Nitin']);
    expect(week.topProducts[0]).toMatchObject({ label: 'Anarkali Kurta · M', units: 2 });
    // The 1 Oct sale is 45 days back: outside both the 7-day and the 30-day window.
    expect((await salesReport(db, STORE_ID, '30d', now)).totals.count).toBe(2);
    // Stock not moving: in stock, nothing sold in 30 days → excludes the kurta and tee sold this week.
    const slow = week.slowMovers.map((s) => s.label);
    expect(slow).toContain('Slim Fit Jeans · 32');
    expect(slow).not.toContain('Anarkali Kurta · M');
    expect(slow).not.toContain('Banarasi Saree · Free'); // out of stock
  });
});

describe('sales team dashboard', () => {
  it('counts sellers, each one’s share and sales per shop day (IST), including exchanges credited to them', async () => {
    const { periodDays, teamReport } = await import('./reports');
    const kurta = await product('MAA-KU-001'); // MRP ₹1,299
    const tee = await product('MAA-TS-001');
    const sell = (p: typeof kurta, qty: number, price: number, soldBy: string) =>
      recordSale(db, STORE_ID, { operationId: nextOp(), productId: p.id, quantity: qty, unitPricePaise: price, soldBy, recordedBy: soldBy });
    const now = new Date('2026-11-15T10:00:00Z'); // 15:30 IST
    const v1 = await sell(kurta, 2, 120000, people.Vishal); // ₹2,400 today
    const v2 = await sell(tee, 1, 40000, people.Vishal); //    ₹400 on 13 Nov (IST)
    const n1 = await sell(kurta, 1, 129900, people.Nitin); //  ₹1,299 at 23:30 IST on 14 Nov (18:00 UTC)
    await db.update(sales).set({ createdAt: now }).where(eq(sales.id, v1.sale.id));
    await db.update(sales).set({ createdAt: new Date('2026-11-13T06:00:00Z') }).where(eq(sales.id, v2.sale.id));
    await db.update(sales).set({ createdAt: new Date('2026-11-14T18:00:00Z') }).where(eq(sales.id, n1.sale.id));
    await approveAll(db, STORE_ID, { decidedBy: people.Owner, batchId: nextOp() });

    expect(periodDays('7d', now)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(periodDays('month', now)).toHaveLength(15);
    expect(periodDays('today', new Date('2026-11-14T19:00:00Z'))).toEqual(['2026-11-15']); // 00:30 IST

    const week = await teamReport(db, STORE_ID, '7d', now);
    expect(week.totals).toEqual({ salesmen: 4, sold: 2, netPaise: 409900, bills: 3, units: 4 });
    expect(week.sellers.map((s) => s.name).slice(0, 2)).toEqual(['Vishal', 'Nitin']); // most sales first
    const vishal = week.sellers.find((s) => s.name === 'Vishal')!;
    expect(vishal).toMatchObject({ bills: 2, units: 3, netPaise: 280000, mrpPaise: 2 * 129900 + tee.mrpPaise });
    expect(Math.round(vishal.sharePct)).toBe(68); // 2,800 of 4,099
    expect(vishal.daily).toEqual([0, 0, 0, 0, 40000, 0, 240000]);
    expect(week.sellers.find((s) => s.name === 'Nitin')!.daily).toEqual([0, 0, 0, 0, 0, 129900, 0]); // 23:30 IST stays on the 14th
    // Salesmen without sales are still listed (with 0), the owner only when they sold.
    expect(week.sellers.find((s) => s.name === 'Pradeep')).toMatchObject({ netPaise: 0, sharePct: 0, bills: 0 });
    expect(week.sellers.some((s) => s.name === 'Owner')).toBe(false);

    const today = await teamReport(db, STORE_ID, 'today', now);
    expect(today.totals.netPaise).toBe(240000);
    expect(today.sellers[0]).toMatchObject({ name: 'Vishal', sharePct: 100, daily: [240000] });
  });
});

describe('sale errors carry a message key (shown in the person’s language)', () => {
  it('out of stock / only N left / above MRP', async () => {
    const { DomainError } = await import('./errors');
    const { errorText } = await import('@/server/i18n');
    const { makeT, MESSAGES } = await import('@/lib/i18n');
    const tee = await product('MAA-TS-001'); // 3 in stock
    const attempt = (quantity: number, price: number) =>
      recordSale(db, STORE_ID, { operationId: nextOp(), productId: tee.id, quantity, unitPricePaise: price, soldBy: people.Vishal, recordedBy: people.Vishal }).catch((e: unknown) => e);
    const tooMany = await attempt(4, 100);
    expect(tooMany).toBeInstanceOf(DomainError);
    expect(tooMany).toMatchObject({ message: 'Only 3 left in stock.', key: 'error.onlyLeft', vars: { n: 3 } });
    expect(errorText(tooMany as InstanceType<typeof DomainError>, makeT(MESSAGES.hi))).toBe('स्टॉक में सिर्फ़ 3 बचे हैं।');
    expect(await attempt(1, 999999)).toMatchObject({ key: 'error.aboveMrp' });
  });
});
