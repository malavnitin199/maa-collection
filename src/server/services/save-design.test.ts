// @vitest-environment node
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { stockMovements } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { createSupplier, listCategories } from './catalog';
import { createDesign, getProduct, listDesignVariants, saveDesign } from './products';
import { listStaff } from './staff';

/** The item page's one Save (owner, 2026-11-22, ADR-059). */
let db: Db;
let owner: string;
let company: string;
let kurta: string;
let saree: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
  company = (await createSupplier(db, STORE_ID, { name: 'Edit Co', contactName: '', phone: '', gstin: '', notes: '' })).id;
  const types = await listCategories(db, STORE_ID);
  kurta = types.find((c) => c.code === 'KU')!.id;
  saree = types.find((c) => c.code === 'SA')!.id;
});

const design = (name: string, sizes = ['M', 'L']) =>
  createDesign(db, STORE_ID, {
    operationId: `d-${Math.random()}`,
    supplierId: null,
    categoryId: kurta,
    name,
    brand: '',
    sizes,
    colors: [],
    mrpPaise: 100000,
    pricePaise: null,
    costPaise: 40000,
    quantityEach: 3,
    staffId: owner,
  });
const sizesOf = async (id: string) =>
  Object.fromEntries((await listDesignVariants(db, STORE_ID, id)).map((v) => [v.size, { name: v.name, supplierId: v.supplierId, category: v.category, mrp: v.mrpPaise, price: v.pricePaise, cost: v.costPaise, stock: v.stock }]));

describe('saveDesign', () => {
  it('name, company, category and prices go to every size of the design', async () => {
    const made = await design('Edit Kurta');
    const id = made.products[0].id;
    const r = await saveDesign(db, STORE_ID, id, { name: '  Edit   Kurta Long ', supplierId: company, categoryId: saree, mrpPaise: 120000, pricePaise: 110000, costPaise: 50000, staffId: owner });
    expect(r).toEqual({ items: 2, counted: 0, added: 0 });
    // listDesignVariants follows the new name and category.
    const after = await sizesOf(id);
    for (const size of ['M', 'L']) {
      expect(after[size]).toMatchObject({ name: 'Edit Kurta Long', supplierId: company, category: 'Saree', mrp: 120000, price: 110000, cost: 50000, stock: 3 });
    }
  });

  it('a price left out keeps each size its own; a bad price changes nothing at all', async () => {
    const made = await design('Own Price Kurta');
    const [m, l] = made.products;
    await saveDesign(db, STORE_ID, l.id, { pricePaise: 90000, staffId: owner }); // both sizes: selling 900
    await expect(saveDesign(db, STORE_ID, m.id, { name: 'Should Not Stick', mrpPaise: 80000, staffId: owner })).rejects.toMatchObject({ key: 'stk.err.bulkAboveMrp' });
    const after = await sizesOf(m.id);
    expect(after.M).toMatchObject({ name: 'Own Price Kurta', mrp: 100000, price: 90000, cost: 40000 });
    expect(after.L).toMatchObject({ name: 'Own Price Kurta', mrp: 100000, price: 90000, cost: 40000 });
  });

  it('pieces are a count correction: one "counted" stock entry with the difference, who and when; the same count again adds nothing', async () => {
    const made = await design('Count Kurta');
    const [m, l] = made.products;
    const r = await saveDesign(db, STORE_ID, m.id, { counts: { [m.id]: 5, [l.id]: 3 }, staffId: owner });
    expect(r.counted).toBe(1); // L was already 3
    expect((await getProduct(db, STORE_ID, m.id))!.stock).toBe(5);
    const entries = await db.select().from(stockMovements).where(and(eq(stockMovements.productId, m.id), eq(stockMovements.reason, 'counted')));
    expect(entries.map((e) => [e.quantityChange, e.staffId, e.note])).toEqual([[2, owner, 'Count corrected']]);
    // Down to 0, then the same again: one more entry (−5), then none.
    await saveDesign(db, STORE_ID, m.id, { counts: { [m.id]: 0 }, staffId: owner });
    await saveDesign(db, STORE_ID, m.id, { counts: { [m.id]: 0 }, staffId: owner });
    const all = await db.select().from(stockMovements).where(and(eq(stockMovements.productId, m.id), eq(stockMovements.reason, 'counted')));
    expect(all.map((e) => e.quantityChange).sort((a, b) => a - b)).toEqual([-5, 2]);
    expect((await getProduct(db, STORE_ID, m.id))!.stock).toBe(0);
  });

  it('refuses pieces below zero, or an item of another design', async () => {
    const one = await design('One Kurta');
    const two = await design('Two Kurta');
    await expect(saveDesign(db, STORE_ID, one.products[0].id, { counts: { [one.products[0].id]: -1 }, staffId: owner })).rejects.toMatchObject({ key: 'stk.err.pieces' });
    await expect(saveDesign(db, STORE_ID, one.products[0].id, { counts: { [two.products[0].id]: 9 }, staffId: owner })).rejects.toMatchObject({ key: 'error.productNotFound' });
    expect((await getProduct(db, STORE_ID, two.products[0].id))!.stock).toBe(3);
  });

  it('new sizes join the design with their pieces, after the rest of the changes (same name)', async () => {
    const made = await design('Grow Kurta', ['M']);
    const r = await saveDesign(db, STORE_ID, made.products[0].id, {
      name: 'Grow Kurta Plus',
      newSizes: [{ size: 'XL', pieces: 4 }, { size: ' XXL ', pieces: 0 }],
      operationId: `s-${Math.random()}`,
      staffId: owner,
    });
    expect(r).toMatchObject({ items: 1, added: 2 });
    const after = await sizesOf(made.products[0].id);
    expect(Object.keys(after).sort()).toEqual(['M', 'XL', 'XXL']);
    expect(after.XL).toMatchObject({ name: 'Grow Kurta Plus', stock: 4, mrp: 100000, cost: 40000 });
    expect(after.XXL.stock).toBe(0);
  });

  it('a size or colour can be corrected (no size → M, a colour added); a size the design already has is refused', async () => {
    const made = await design('Fix Kurta', ['M', 'L']);
    const [m, l] = made.products;
    await saveDesign(db, STORE_ID, m.id, { items: { [m.id]: { size: 'S', color: ' Blue ' } }, staffId: owner });
    expect(await getProduct(db, STORE_ID, m.id)).toMatchObject({ size: 'S', color: 'Blue' });
    await expect(saveDesign(db, STORE_ID, m.id, { items: { [l.id]: { size: 's', color: 'blue' } }, staffId: owner })).rejects.toMatchObject({ key: 'stk.err.sizeTaken' });
    // A swap in one go is fine: each size × colour still once.
    await saveDesign(db, STORE_ID, m.id, { items: { [m.id]: { size: 'L', color: '' }, [l.id]: { size: 'M' } }, staffId: owner });
    expect([(await getProduct(db, STORE_ID, m.id))!.size, (await getProduct(db, STORE_ID, l.id))!.size]).toEqual(['L', 'M']);
  });

  it('an empty name, a hidden company or a size the design has are refused', async () => {
    const made = await design('Rules Kurta');
    const id = made.products[0].id;
    await expect(saveDesign(db, STORE_ID, id, { name: '   ', staffId: owner })).rejects.toMatchObject({ key: 'stk.err.enter.name' });
    await expect(saveDesign(db, STORE_ID, id, { supplierId: '00000000-0000-4000-8000-000000000000', staffId: owner })).rejects.toMatchObject({ key: 'stk.err.activeSupplier' });
    await expect(saveDesign(db, STORE_ID, id, { newSizes: [{ size: 'M', pieces: 1 }], operationId: 'x-1', staffId: owner })).rejects.toBeTruthy();
    expect((await listDesignVariants(db, STORE_ID, id)).length).toBe(2);
  });
});
