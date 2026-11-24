// @vitest-environment node
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { stockMovements, stockReceipts } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { listCategories } from './catalog';
import { createDesign, createDesignsBulk, getReceiptForLabels, listProducts, type BulkRowInput } from './products';
import { listStaff } from './staff';

/** Bulk addition (owner, 2026-11-24, ADR-072): many products of one category, one save. */
let db: Db;
let owner: string;
let kurtaId: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
  kurtaId = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!.id;
});

const row = (name: string, cost: number, quantity: number): BulkRowInput => ({ name, mrpPaise: cost * 150, costPaise: cost * 100, quantity });
const bulk = (rows: BulkRowInput[], operationId = `bulk-${Math.random()}`) => createDesignsBulk(db, STORE_ID, { operationId, categoryId: kurtaId, rows, staffId: owner });

describe('createDesignsBulk', () => {
  it('saves every row as its own product with no size, colour, brand or company — one stock entry, pieces as arrivals', async () => {
    const result = await bulk([row('Bulk Kurta A', 400, 3), row('Bulk Kurta B', 550, 1), row('Bulk Kurta C', 700, 12)]);
    expect(result.duplicate).toBe(false);
    expect(result.products.map((p) => [p.name, p.size, p.color, p.brand, p.supplierId, p.stock, p.costPaise, p.mrpPaise, p.pricePaise])).toEqual([
      ['Bulk Kurta A', '', '', '', null, 3, 40000, 60000, 60000],
      ['Bulk Kurta B', '', '', '', null, 1, 55000, 82500, 82500],
      ['Bulk Kurta C', '', '', '', null, 12, 70000, 105000, 105000],
    ]);
    // Item codes follow the rows, and every barcode is its own.
    const numbers = result.products.map((p) => Number(p.sku.match(/-(\d+)$/)![1]));
    expect(numbers).toEqual([numbers[0], numbers[0] + 1, numbers[0] + 2]);
    expect(new Set(result.products.map((p) => p.barcode)).size).toBe(3);
    // One receipt holds them all (the tags page prints it), each with its opening movement at the purchase price.
    const receipt = await getReceiptForLabels(db, STORE_ID, result.receipt.id);
    expect(receipt!.lines.map((l) => [l.name, l.quantity])).toEqual([
      ['Bulk Kurta A', 3],
      ['Bulk Kurta B', 1],
      ['Bulk Kurta C', 12],
    ]);
    expect(receipt!.supplierId).toBeNull();
    const moves = await db.select().from(stockMovements).where(and(eq(stockMovements.storeId, STORE_ID), eq(stockMovements.refId, result.receipt.id)));
    expect(moves.map((m) => [m.reason, m.quantityChange, m.unitCostPaise]).sort((a, b) => Number(a[1]) - Number(b[1]))).toEqual([
      ['opening', 1, 55000],
      ['opening', 3, 40000],
      ['opening', 12, 70000],
    ]);
  });

  it('a blank name becomes the category and the number of its own item code', async () => {
    const result = await bulk([row('', 300, 2), row('Named One', 300, 2), row('   ', 300, 2)]);
    for (const p of [result.products[0], result.products[2]]) expect(p.name).toBe(`Kurta ${p.sku.match(/-(\d+)$/)![1]}`);
    expect(result.products[1].name).toBe('Named One');
    // The next bulk save goes on from there: no clash with the names just given.
    const again = await bulk([row('', 300, 1)]);
    expect(again.products[0].name).toBe(`Kurta ${again.products[0].sku.match(/-(\d+)$/)![1]}`);
    expect(again.products[0].name).not.toBe(result.products[2].name);
  });

  it('retrying the same save makes nothing twice', async () => {
    const first = await bulk([row('Retry Kurta', 300, 4)], 'bulk-retry-1');
    const second = await bulk([row('Retry Kurta', 300, 4)], 'bulk-retry-1');
    expect(second.duplicate).toBe(true);
    expect(second.receipt.id).toBe(first.receipt.id);
    expect(second.products.map((p) => p.id)).toEqual(first.products.map((p) => p.id));
    expect((await listProducts(db, STORE_ID, { categoryId: kurtaId })).filter((p) => p.name === 'Retry Kurta')).toHaveLength(1);
  });

  it('is all or nothing: one bad row saves no product and no stock entry', async () => {
    const before = (await listProducts(db, STORE_ID, { categoryId: kurtaId })).length;
    const receiptsBefore = (await db.select().from(stockReceipts).where(eq(stockReceipts.storeId, STORE_ID))).length;
    await expect(bulk([row('Good Kurta', 300, 2), { name: 'Free Kurta', mrpPaise: 0, costPaise: 0, quantity: 1 }])).rejects.toThrow(/Row 2 \(Free Kurta\): Enter a valid MRP/);
    await expect(bulk([row('Good Kurta', 300, 2), row('Half Kurta', 300, 1.5)])).rejects.toThrow(/Row 2 \(Half Kurta\): pieces must be 0 or more/);
    await expect(bulk([row('Good Kurta', 300, 2), row('good  kurta', 300, 1)])).rejects.toThrow(/The same product is entered twice: good kurta/);
    await expect(bulk([])).rejects.toThrow(/Add at least one product/);
    await expect(bulk(Array.from({ length: 51 }, (_, i) => row(`Many ${i}`, 100, 1)))).rejects.toThrow(/Up to 50 products at once/);
    expect((await listProducts(db, STORE_ID, { categoryId: kurtaId })).length).toBe(before);
    expect((await db.select().from(stockReceipts).where(eq(stockReceipts.storeId, STORE_ID))).length).toBe(receiptsBefore);
  });

  it('refuses a product that is in the catalogue already (same name, no size), like New item', async () => {
    await createDesign(db, STORE_ID, {
      operationId: `one-${Math.random()}`, supplierId: null, categoryId: kurtaId, name: 'Plain Kurta', brand: '', sizes: [], noSize: true, colors: [],
      mrpPaise: 90000, pricePaise: null, costPaise: 60000, quantityEach: 1, quantities: { '': 2 }, staffId: owner,
    });
    await expect(bulk([row('New Kurta', 300, 1), row('plain kurta', 300, 1)])).rejects.toThrow(/Already in the catalogue: Plain Kurta/);
    // A name whose sizes exist (M, L) but not as a no-size item is a new no-size item of that product: allowed, as in New item.
    await createDesign(db, STORE_ID, {
      operationId: `two-${Math.random()}`, supplierId: null, categoryId: kurtaId, name: 'Sized Kurta', brand: '', sizes: ['M', 'L'], colors: [],
      mrpPaise: 90000, pricePaise: null, costPaise: 60000, quantityEach: 1, staffId: owner,
    });
    const result = await bulk([row('Sized Kurta', 300, 1)]);
    expect(result.products[0].size).toBe('');
  });
});
