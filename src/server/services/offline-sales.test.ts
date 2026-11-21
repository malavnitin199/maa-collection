// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { products, sales, stockMovements } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { pendingForOwner } from './approvals';
import { clearAllStock, counterCatalogue, findProductByCode } from './products';
import { recordSale } from './sales';
import { createStaff, listStaff, setStaffActive } from './staff';

/**
 * Plan v18: sales made on a phone without internet are sent later and are
 * always recorded (owner's decision D-07: "let stock go below zero"), while
 * online sales keep every refusal.
 */
let db: Db;
let people: Record<string, string>;
let op = 0;
const nextOp = () => `offline-op-${++op}`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

async function product(code: string) {
  const found = await findProductByCode(db, STORE_ID, code);
  if (!found) throw new Error(`missing ${code}`);
  return found;
}

async function stockOf(id: string) {
  const [row] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, id));
  return row.stock;
}

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  people = Object.fromEntries((await listStaff(db, STORE_ID)).map((p) => [p.name, p.id]));
});

describe('sales made offline (plan v18)', () => {
  it('are recorded even when the stock goes below zero, with the phone’s time and a normal stock movement', async () => {
    const tee = await product('MAA-TS-001'); // 3 in stock
    const madeAt = hoursAgo(2);
    const result = await recordSale(db, STORE_ID, {
      operationId: nextOp(), productId: tee.id, quantity: 5, unitPricePaise: 45000, soldBy: people.Vishal, recordedBy: people.Vishal, offline: { at: madeAt },
    });
    expect(result.stockLeft).toBe(-2);
    expect(await stockOf(tee.id)).toBe(-2);
    expect(result.sale.offlineAt?.getTime()).toBe(madeAt.getTime());
    expect(result.sale.totalPaise).toBe(225000);
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.refId, result.sale.id));
    expect(moves.map((m) => [m.reason, m.quantityChange])).toEqual([['sale', -5]]);
  });

  it('still sell an item hidden since, at the price agreed, keeping the MRP the phone showed even if it was lowered since', async () => {
    const tee = await product('MAA-TS-001'); // MRP ₹499 on the tag and the phone
    await db.update(products).set({ active: false, mrpPaise: 39900, pricePaise: 39900 }).where(eq(products.id, tee.id));
    const base = { productId: tee.id, quantity: 1, soldBy: people.Nitin, recordedBy: people.Nitin };
    const result = await recordSale(db, STORE_ID, { ...base, operationId: nextOp(), unitPricePaise: 45000, offline: { at: hoursAgo(1), mrpPaise: 49900 } });
    expect(result.sale.unitPricePaise).toBe(45000);
    expect(result.sale.mrpPaise).toBe(49900);
    expect(result.stockLeft).toBe(2);
    // No MRP from the phone (or one below the price): never below the price agreed.
    const bare = await recordSale(db, STORE_ID, { ...base, operationId: nextOp(), unitPricePaise: 45000, offline: { at: hoursAgo(1), mrpPaise: 100 } });
    expect(bare.sale.mrpPaise).toBe(45000);
  });

  it('online sales keep refusing what an offline sale allows', async () => {
    const saree = await product('MAA-SA-001'); // 0 in stock
    const tee = await product('MAA-TS-001');
    const base = { soldBy: people.Nitin, recordedBy: people.Nitin };
    await expect(recordSale(db, STORE_ID, { ...base, operationId: nextOp(), productId: saree.id, quantity: 1, unitPricePaise: 100 })).rejects.toThrow('Out of stock.');
    await expect(recordSale(db, STORE_ID, { ...base, operationId: nextOp(), productId: tee.id, quantity: 4, unitPricePaise: 100 })).rejects.toThrow('Only 3 left in stock.');
    await db.update(products).set({ active: false }).where(eq(products.id, tee.id));
    await expect(recordSale(db, STORE_ID, { ...base, operationId: nextOp(), productId: tee.id, quantity: 1, unitPricePaise: 100 })).rejects.toThrow('Product not found.');
    expect(await stockOf(saree.id)).toBe(0);
    expect(await stockOf(tee.id)).toBe(3);

    const offline = await recordSale(db, STORE_ID, { ...base, operationId: nextOp(), productId: saree.id, quantity: 1, unitPricePaise: 100, offline: { at: hoursAgo(1) } });
    expect(offline.stockLeft).toBe(-1);
  });

  it('a sale sent twice (the phone retried) is recorded once; a phone clock set ahead is pulled back to now', async () => {
    const tee = await product('MAA-TS-001');
    const input = {
      operationId: 'phone-retry', productId: tee.id, quantity: 1, unitPricePaise: 49900, soldBy: people.Vishal, recordedBy: people.Vishal,
      offline: { at: new Date(Date.now() + 86_400_000) },
    };
    const first = await recordSale(db, STORE_ID, input);
    const again = await recordSale(db, STORE_ID, input);
    expect(again.duplicate).toBe(true);
    expect(again.sale.id).toBe(first.sale.id);
    expect(await stockOf(tee.id)).toBe(2);
    expect(await db.select().from(sales)).toHaveLength(1);
    expect(first.sale.offlineAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('a salesperson removed since keeps the credit; an online sale cannot credit them', async () => {
    const ramesh = await createStaff(db, STORE_ID, { name: 'Ramesh', role: 'salesman', pin: '4321' });
    await setStaffActive(db, STORE_ID, ramesh.id, false, people.Owner);
    const tee = await product('MAA-TS-001');
    const base = { productId: tee.id, quantity: 1, unitPricePaise: 49900, soldBy: ramesh.id, recordedBy: people.Vishal };
    await expect(recordSale(db, STORE_ID, { ...base, operationId: nextOp() })).rejects.toThrow(/not active/);
    const offline = await recordSale(db, STORE_ID, { ...base, operationId: nextOp(), offline: { at: hoursAgo(3) } });
    expect(offline.sale.soldBy).toBe(ramesh.id);
  });

  it('a hand-entered sale made offline keeps its time and changes no stock', async () => {
    const madeAt = hoursAgo(1);
    const before = await db.select({ id: products.id, stock: products.stock }).from(products);
    const result = await recordSale(db, STORE_ID, {
      operationId: nextOp(), manual: { name: 'Blue dupatta' }, quantity: 2, unitPricePaise: 30000, soldBy: people.Pradeep, recordedBy: people.Pradeep, offline: { at: madeAt },
    });
    expect(result.sale.manual).toBe(true);
    expect(result.sale.offlineAt?.getTime()).toBe(madeAt.getTime());
    expect(await db.select({ id: products.id, stock: products.stock }).from(products)).toEqual(before);
  });

  it('the owner’s Approvals show which sales were made offline', async () => {
    const tee = await product('MAA-TS-001');
    const madeAt = hoursAgo(1);
    const base = { productId: tee.id, quantity: 1, unitPricePaise: 49900, soldBy: people.Vishal, recordedBy: people.Vishal };
    const online = await recordSale(db, STORE_ID, { ...base, operationId: nextOp() });
    const offline = await recordSale(db, STORE_ID, { ...base, operationId: nextOp(), offline: { at: madeAt } });
    const entries = (await pendingForOwner(db, STORE_ID)).flatMap((d) => d.entries);
    expect(entries.find((e) => e.id === online.sale.id)?.offlineAt).toBeNull();
    expect(entries.find((e) => e.id === offline.sale.id)?.offlineAt?.getTime()).toBe(madeAt.getTime());
  });
});

describe('a count below zero (plan v18)', () => {
  it('Clear stock resets it to 0 too, with a cleared entry that explains the jump', async () => {
    const tee = await product('MAA-TS-001'); // 3 in stock
    await recordSale(db, STORE_ID, {
      operationId: nextOp(), productId: tee.id, quantity: 5, unitPricePaise: 45000, soldBy: people.Vishal, recordedBy: people.Vishal, offline: { at: hoursAgo(1) },
    });
    expect(await stockOf(tee.id)).toBe(-2);
    const before = await db.select({ stock: products.stock }).from(products);
    const cleared = await clearAllStock(db, STORE_ID, { staffId: people.Owner });
    // Every item that was not at 0 is reset; "pieces cleared" counts only pieces that were there.
    expect(cleared).toEqual({
      items: before.filter((p) => p.stock !== 0).length,
      pieces: before.reduce((n, p) => n + Math.max(p.stock, 0), 0),
    });
    expect(await stockOf(tee.id)).toBe(0);
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.productId, tee.id));
    expect(moves.find((m) => m.reason === 'cleared')?.quantityChange).toBe(2);
  });
});

describe('the phone’s copy of the counter (plan v18)', () => {
  it('lists every item in use, never the purchase price, and leaves hidden items out', async () => {
    const tee = await product('MAA-TS-001');
    await db.update(products).set({ active: false }).where(eq(products.id, tee.id));
    const items = await counterCatalogue(db, STORE_ID);
    expect(items).toHaveLength(7);
    expect(items.map((i) => i.id)).not.toContain(tee.id);
    for (const item of items) expect(Object.keys(item)).not.toContain('costPaise');
    expect(Object.keys(items[0]).sort()).toEqual(['barcode', 'brand', 'category', 'color', 'id', 'mrpPaise', 'name', 'packMrpPaise', 'packSize', 'pricePaise', 'size', 'sku', 'stock']);
  });
});
