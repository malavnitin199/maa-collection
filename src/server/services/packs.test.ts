// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { sheetParts } from '@/features/bills/sheet-parts';
import { STORE_ID } from '@/lib/app-config';
import { boxSale, tagsFor } from '@/lib/packs';
import { listCollections } from './bills';
import { createSupplier, listCategories } from './catalog';
import { counterCatalogue, createDesign, toCounterProduct } from './products';
import { recordSale } from './sales';
import { listStaff } from './staff';

/** Box packs (owner, 2026-11-21, ADR-047): boys' sandos in boxes of 12 — entered, tagged, sold and billed by the box. */
let db: Db;
let owner: string;
let company: string;
let typeId: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
  company = (await createSupplier(db, STORE_ID, { name: 'Sando House', contactName: '', phone: '', gstin: '', notes: '' })).id;
  typeId = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!.id;
});

const sandos = (over: Partial<Parameters<typeof createDesign>[2]> = {}) =>
  createDesign(db, STORE_ID, {
    operationId: `p-${Math.random()}`,
    supplierId: company,
    categoryId: typeId,
    name: 'Boys Sando',
    brand: '',
    sizes: ['75', '80'],
    colors: [],
    mrpPaise: 5000, // ₹50 a piece
    pricePaise: null,
    costPaise: null,
    quantityEach: 0,
    quantities: { '75': 36, '80': 12 }, // 3 boxes + 1 box of 12
    pack: { size: 12, mrpPaise: 54000, costPaise: 50000 }, // box: sells ₹540, bought ₹500
    staffId: owner,
    ...over,
  });

describe('box packs', () => {
  it('New item: box size and box prices on every size; stock in pieces; the piece cost from the box price', async () => {
    const { products } = await sandos();
    expect(products.map((p) => [p.size, p.stock, p.packSize, p.packMrpPaise, p.packCostPaise, p.costPaise, p.mrpPaise])).toEqual([
      ['75', 36, 12, 54000, 50000, 4167, 5000],
      ['80', 12, 12, 54000, 50000, 4167, 5000],
    ]);
    // One tag per box.
    expect(products.map((p) => tagsFor(p.stock, p.packSize))).toEqual([3, 1]);
    // The counter sees the box (and its selling price), never the purchase price.
    const counter = toCounterProduct(products[0]);
    expect(counter).toMatchObject({ packSize: 12, packMrpPaise: 54000 });
    expect(Object.keys(counter)).not.toContain('packCostPaise');
    expect((await counterCatalogue(db, STORE_ID)).find((p) => p.id === products[0].id)).toMatchObject({ packSize: 12, packMrpPaise: 54000 });
  });

  it('refuses a box of 1, and a box MRP above MRP × pieces', async () => {
    await expect(sandos({ pack: { size: 1 } })).rejects.toThrow(/2 to 1000/);
    await expect(sandos({ pack: { size: 12, mrpPaise: 60001 } })).rejects.toThrow(/whole-box MRP/);
  });

  it('the counter sells pieces (1, 2) or a whole box at the box price — the box total stays exact', async () => {
    const [m] = (await sandos({ pack: { size: 12, mrpPaise: 40000, costPaise: 30000 } })).products; // ₹400 a box: ₹33.33… a piece
    const one = await recordSale(db, STORE_ID, { operationId: `s-${Math.random()}`, productId: m.id, quantity: 2, unitPricePaise: 4500, soldBy: owner, recordedBy: owner });
    expect([one.sale.totalPaise, one.stockLeft]).toEqual([9000, 34]);
    const box = boxSale(1, 12, 40000);
    const whole = await recordSale(db, STORE_ID, { operationId: `s-${Math.random()}`, productId: m.id, ...box, soldBy: owner, recordedBy: owner });
    expect([whole.sale.quantity, whole.sale.unitPricePaise, whole.sale.totalPaise, whole.stockLeft]).toEqual([12, 3333, 40000, 22]);
    // A total that is not the pieces × piece price (beyond rounding) is refused.
    await expect(
      recordSale(db, STORE_ID, { operationId: `s-${Math.random()}`, productId: m.id, quantity: 12, unitPricePaise: 3333, totalPaise: 45000, soldBy: owner, recordedBy: owner }),
    ).rejects.toThrow(/sale price/);
  });

  it('bill check: boxes at the box rate, as on the paper (Sando (box of 12) · 3 · 500.00 · 1,500.00)', async () => {
    const { receipt } = await sandos();
    const [collection] = await listCollections(db, STORE_ID, { receiptIds: [receipt.id] });
    expect(collection.valuePaise).toBe(200000); // 4 boxes × ₹500
    const [part] = sheetParts([{ id: company, name: 'Sando House' }], [collection]);
    expect(part.lines.map((l) => [l.name, l.sizes.join(' '), l.pack, l.qty, l.ratePaise, l.amountPaise])).toEqual([['Boys Sando', '75 80', 12, 4, 50000, 200000]]);
    expect([part.units, part.pieces, part.totalPaise]).toEqual([4, 48, 200000]);
  });
});
