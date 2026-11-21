// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { sheetParts } from '@/features/bills/sheet-parts';
import { STORE_ID } from '@/lib/app-config';
import { eq } from 'drizzle-orm';
import { billCollections } from '@/db/schema';
import { backfillBillCopies, createBill, getBill, listBills } from './bills';
import { createSupplier, listCategories, updateSupplier } from './catalog';
import { deleteCompanies } from './delete-companies';
import { deleteProducts } from './delete-products';
import { addDesignSizes, createDesign, getProduct, listDesignVariants, updateProduct } from './products';
import { listStaff } from './staff';

/** Owner, 2026-11-22 (ADR-054): a bill keeps its own copy; items can be edited and get more sizes. */
let db: Db;
let owner: string;
let company: string;
let typeId: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
  company = (await createSupplier(db, STORE_ID, { name: 'Copy Co', contactName: '', phone: '', gstin: '', notes: '' })).id;
  typeId = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!.id;
});

const design = (name: string, sizes = ['M', 'L']) =>
  createDesign(db, STORE_ID, {
    operationId: `d-${Math.random()}`,
    supplierId: company,
    categoryId: typeId,
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

describe('a bill keeps its own copy', () => {
  it('renaming or deleting its items and its company changes nothing on the bill', async () => {
    const made = await design('Copy Kurta');
    const { id } = await createBill(db, STORE_ID, { operationId: `b-${Math.random()}`, billDate: '2026-11-10', companies: [company], receiptIds: [made.receipt.id], staffId: owner });
    const before = (await getBill(db, STORE_ID, id))!;
    const sheetBefore = sheetParts(before.companies.map((c) => ({ id: c.supplierId, name: c.name })), before.list);

    // Rename an item and the company, then delete the items and the company.
    const [m] = made.products;
    await updateProduct(db, STORE_ID, m.id, { name: 'Renamed', brand: '', category: m.category, size: 'M', color: '', mrpPaise: 100000, pricePaise: 100000, costPaise: 99900, active: true });
    await updateSupplier(db, STORE_ID, company, { name: 'New Name Co', contactName: '', phone: '', gstin: '', notes: '', active: true });
    await deleteProducts(db, STORE_ID, made.products.map((p) => p.id));
    await deleteCompanies(db, STORE_ID, [company]);

    const after = (await getBill(db, STORE_ID, id))!;
    expect(after.companies.map((c) => [c.name, c.amountPaise, c.deleted])).toEqual([['Copy Co', 240000, true]]);
    expect([after.totalPaise, after.collections, after.pieces, after.valuePaise]).toEqual([before.totalPaise, before.collections, before.pieces, before.valuePaise]);
    expect(after.list.map((c) => c.names)).toEqual([['Copy Kurta']]);
    expect(sheetParts(after.companies.map((c) => ({ id: c.supplierId, name: c.name })), after.list)).toEqual(sheetBefore);
    expect((await listBills(db, STORE_ID))[0].totalPaise).toBe(240000);
  });
});

describe('editing items (ADR-054)', () => {
  it('an item with no brand or size can be edited; + Add sizes makes new sizes of the design with their pieces', async () => {
    const { products: [plain] } = await createDesign(db, STORE_ID, {
      operationId: `p-${Math.random()}`, supplierId: null, categoryId: typeId, name: 'Plain Kurta', brand: '', sizes: [], noSize: true, colors: [],
      mrpPaise: 50000, pricePaise: null, costPaise: 20000, quantityEach: 0, quantities: { '': 2 }, staffId: owner,
    });
    const edited = await updateProduct(db, STORE_ID, plain.id, { name: 'Plain Kurta', brand: '', category: plain.category, categoryId: typeId, size: 'M', color: '', mrpPaise: 60000, pricePaise: 60000, costPaise: 20000, active: true });
    expect([edited.size, edited.brand, edited.mrpPaise]).toEqual(['M', '', 60000]);

    const added = await addDesignSizes(db, STORE_ID, plain.id, { operationId: `s-${Math.random()}`, sizes: ['L', 'XL'], quantities: { L: 4, XL: 1 }, staffId: owner });
    expect(added.products.map((p) => [p.size, p.stock, p.mrpPaise, p.costPaise, p.name])).toEqual([
      ['L', 4, 60000, 20000, 'Plain Kurta'],
      ['XL', 1, 60000, 20000, 'Plain Kurta'],
    ]);
    expect((await listDesignVariants(db, STORE_ID, plain.id)).map((v) => v.size).sort()).toEqual(['L', 'M', 'XL']);
    await expect(addDesignSizes(db, STORE_ID, plain.id, { operationId: `s-${Math.random()}`, sizes: ['M'], quantities: { M: 1 }, staffId: owner })).rejects.toThrow(/Already in the catalogue/);
    expect((await getProduct(db, STORE_ID, plain.id))?.stock).toBe(2);
  });
});

describe('backfillBillCopies', () => {
  it('gives an older bill (no copy) its copy, once', async () => {
    const made = await design('Old Bill Kurta');
    const { id } = await createBill(db, STORE_ID, { operationId: `b-${Math.random()}`, billDate: '2026-11-10', companies: [company], receiptIds: [made.receipt.id], staffId: owner });
    await db.update(billCollections).set({ snapshot: null }).where(eq(billCollections.billId, id));
    expect(await backfillBillCopies(db, STORE_ID)).toBe(1);
    expect(await backfillBillCopies(db, STORE_ID)).toBe(0);
    await deleteProducts(db, STORE_ID, made.products.map((p) => p.id));
    expect((await getBill(db, STORE_ID, id))!.list.map((c) => c.names)).toEqual([['Old Bill Kurta']]);
  });
});

