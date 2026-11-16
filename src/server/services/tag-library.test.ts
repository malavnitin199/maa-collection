// @vitest-environment node
import { eq, inArray } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { products } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { groupTags } from '@/lib/tag-library';
import { createSupplier, listCategories } from './catalog';
import { createProductsBatch } from './products';
import { listStaff } from './staff';
import { listTagLibrary } from './tag-library';

let db: Db;
let owner: string;
let nitin: string;
const supplierInput = { contactName: '', phone: '', gstin: '', notes: '' };
const NOW = new Date('2026-11-16T06:30:00Z'); // 12:00 IST

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  const people = await listStaff(db, STORE_ID);
  owner = people.find((p) => p.role === 'admin')!.id;
  nitin = people.find((p) => p.name === 'Nitin')!.id;
});

/** Two deliveries from Royal (sarees today, by the owner) and old kurtis without a company (10 days ago, by Nitin). */
async function setUp() {
  const royal = await createSupplier(db, STORE_ID, { name: 'Royal Garments', ...supplierInput });
  const cats = await listCategories(db, STORE_ID);
  const saree = cats.find((c) => c.code === 'SA')!;
  const kurta = cats.find((c) => c.code === 'KU')!;
  const sarees = await createProductsBatch(db, STORE_ID, {
    operationId: 'lib-1',
    supplierId: royal.id,
    categoryId: saree.id,
    billNumber: 'RG-77',
    staffId: owner,
    rows: [
      { name: 'Lib Georgette Saree', mrpPaise: 250000, pricePaise: 220000, costPaise: null, quantity: 3 },
      { name: 'Lib Cotton Saree', mrpPaise: 120000, pricePaise: 110000, costPaise: null, quantity: 0 },
    ],
  });
  const old = await createProductsBatch(db, STORE_ID, {
    operationId: 'lib-2',
    categoryId: kurta.id,
    staffId: nitin,
    rows: [{ name: 'Lib Old Kurta', mrpPaise: 90000, pricePaise: 90000, costPaise: null, quantity: 2 }],
  });
  const tenDaysAgo = new Date(NOW.getTime() - 10 * 86_400_000);
  await db.update(products).set({ createdAt: tenDaysAgo }).where(eq(products.id, old.products[0].id));
  await db.update(products).set({ createdAt: NOW }).where(inArray(products.id, sarees.products.map((p) => p.id)));
  return { royal, saree, kurta, sarees, old };
}

const names = (rows: { name: string }[]) => rows.map((r) => r.name).filter((n) => n.startsWith('Lib ')).sort();

describe('All tags list', () => {
  it('lists active items newest first with company, maker and the delivery they came in', async () => {
    const { sarees } = await setUp();
    const rows = await listTagLibrary(db, STORE_ID, {}, { now: NOW });
    expect(rows[0].createdAt.getTime()).toBeGreaterThanOrEqual(rows[rows.length - 1].createdAt.getTime());
    const georgette = rows.find((r) => r.name === 'Lib Georgette Saree')!;
    expect(georgette).toMatchObject({ supplierName: 'Royal Garments', createdByName: 'Owner', receiptId: sarees.receipt.id, receiptBill: 'RG-77' });
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length); // one row per item

    // Grouped by delivery: both sarees under the Royal bill.
    const delivery = groupTags(rows, 'delivery').find((g) => g.key === sarees.receipt.id)!;
    expect(names(delivery.items)).toEqual(['Lib Cotton Saree', 'Lib Georgette Saree']);
    expect(delivery).toMatchObject({ name: 'Royal Garments', pieces: 3, delivery: { bill: 'RG-77' } });

    // Inactive items have no tag here.
    await db.update(products).set({ active: false }).where(eq(products.id, georgette.id));
    expect((await listTagLibrary(db, STORE_ID, {}, { now: NOW })).some((r) => r.id === georgette.id)).toBe(false);
  });

  it('filters by company (or no company), category, maker, stock and search', async () => {
    const { royal, kurta } = await setUp();
    const list = (f: Parameters<typeof listTagLibrary>[2]) => listTagLibrary(db, STORE_ID, f, { now: NOW }).then(names);
    expect(await list({ supplierId: royal.id })).toEqual(['Lib Cotton Saree', 'Lib Georgette Saree']);
    expect(await list({ supplierId: 'none' })).toEqual(['Lib Old Kurta']);
    expect(await list({ categoryId: kurta.id })).toEqual(['Lib Old Kurta']);
    expect(await list({ createdBy: nitin })).toEqual(['Lib Old Kurta']);
    expect(await list({ inStockOnly: true, supplierId: royal.id })).toEqual(['Lib Georgette Saree']);
    expect(await list({ search: 'georgette' })).toEqual(['Lib Georgette Saree']);
  });

  it('when made: today and 7 days leave out a tag from 10 days ago; 30 days and all time keep it', async () => {
    await setUp();
    const list = (when: 'today' | '7d' | '30d' | 'all') => listTagLibrary(db, STORE_ID, { when }, { now: NOW }).then(names);
    expect(await list('today')).toEqual(['Lib Cotton Saree', 'Lib Georgette Saree']);
    expect(await list('7d')).toEqual(['Lib Cotton Saree', 'Lib Georgette Saree']);
    expect(await list('30d')).toEqual(['Lib Cotton Saree', 'Lib Georgette Saree', 'Lib Old Kurta']);
    expect(await list('all')).toEqual(['Lib Cotton Saree', 'Lib Georgette Saree', 'Lib Old Kurta']);
  });
});
