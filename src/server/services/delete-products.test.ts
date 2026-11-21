// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { products, sales, stockMovements, stockReceipts } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { createBill, getBill } from './bills';
import { createSupplier, listCategories } from './catalog';
import { deleteProducts } from './delete-products';
import { recordExchange } from './exchanges';
import { addPhotoToProducts, getImageData, listProductImages } from './images';
import { createDesign } from './products';
import { salesReport } from './reports';
import { recordSale } from './sales';
import { listStaff } from './staff';

/** Delete items (owner, 2026-11-22, ADR-050): any item, even sold ones; sales keep their figures. */
let db: Db;
let owner: string;
let company: string;
let typeId: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
  company = (await createSupplier(db, STORE_ID, { name: 'Delete Co', contactName: '', phone: '', gstin: '', notes: '' })).id;
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
const sell = (productId: string, quantity = 1) =>
  recordSale(db, STORE_ID, { operationId: `s-${Math.random()}`, productId, quantity, unitPricePaise: 90000, soldBy: owner, recordedBy: owner });

describe('deleteProducts', () => {
  it('a sold item goes; its sale keeps name, size, amount and profit (marked item deleted); totals do not change', async () => {
    const { products: [m] } = await design('Gone Kurta');
    const { sale } = await sell(m.id, 2);
    const before = (await salesReport(db, STORE_ID, 'today')).totals;

    const result = await deleteProducts(db, STORE_ID, [m.id]);
    expect(result).toEqual({ deleted: [{ id: m.id, name: 'Gone Kurta', size: 'M' }], kept: [] });
    expect(await db.select().from(products).where(eq(products.id, m.id))).toHaveLength(0);
    expect(await db.select().from(stockMovements).where(eq(stockMovements.productId, m.id))).toHaveLength(0);
    const [kept] = await db.select().from(sales).where(eq(sales.id, sale.id));
    expect(kept).toMatchObject({ productId: null, itemDeleted: true, manual: false, productName: 'Gone Kurta', size: 'M', quantity: 2, totalPaise: 180000, costPaise: 40000 });
    const after = await salesReport(db, STORE_ID, 'today');
    expect(after.totals).toEqual(before);
    expect(after.byCategory.reduce((n, r) => n + r.revenuePaise, 0)).toBe(after.totals.revenuePaise);
  });

  it('bills are never changed: a bill keeps its amount and its stock entries, even when their items are deleted', async () => {
    const kept = await design('Stay Kurta');
    const gone = await design('Bye Kurta');
    const loose = await design('Loose Kurta');
    const { id } = await createBill(db, STORE_ID, { operationId: `b-${Math.random()}`, billDate: '2026-11-10', companies: [company], receiptIds: [kept.receipt.id, gone.receipt.id], staffId: owner });
    const before = (await getBill(db, STORE_ID, id))!;
    expect(before.totalPaise).toBe(480000); // 2 × (2 sizes × 3 × ₹400)

    await deleteProducts(db, STORE_ID, [kept.products[0].id, ...gone.products.map((p) => p.id), ...loose.products.map((p) => p.id)]);
    const after = (await getBill(db, STORE_ID, id))!;
    expect(after.totalPaise).toBe(480000);
    expect(after.companies).toEqual(before.companies);
    // The emptied entry on the bill stays; the emptied one on no bill goes.
    expect(await db.select().from(stockReceipts).where(eq(stockReceipts.id, gone.receipt.id))).toHaveLength(1);
    expect(await db.select().from(stockReceipts).where(eq(stockReceipts.id, loose.receipt.id))).toHaveLength(0);
  });

  it('a photo shared by sizes is handed to the size still there', async () => {
    const { products: [m, l] } = await design('Photo Kurta');
    const bytes = new Uint8Array(80);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    await addPhotoToProducts(db, STORE_ID, { productIds: [m.id, l.id], bytes, staffId: owner }); // stored on M, L points at it
    await deleteProducts(db, STORE_ID, [m.id]);
    const [photo] = await listProductImages(db, STORE_ID, l.id);
    const data = await getImageData(db, STORE_ID, photo.id);
    expect(data?.data?.length).toBe(80);
  });

  it('an item in an exchange is kept and named', async () => {
    const { products: [m, l] } = await design('Swap Kurta');
    const { sale } = await sell(m.id);
    await recordExchange(db, STORE_ID, { operationId: `x-${Math.random()}`, originalSaleId: sale.id, returnedQuantity: 1, issuedProductId: l.id, issuedQuantity: 1, issuedUnitPricePaise: 90000, creditedTo: owner, recordedBy: owner });
    const other = await design('Free Kurta', ['M']);
    const result = await deleteProducts(db, STORE_ID, [m.id, l.id, other.products[0].id]);
    expect(result.deleted.map((d) => d.name)).toEqual(['Free Kurta']);
    expect(result.kept.map((k) => `${k.name} ${k.size}`).sort()).toEqual(['Swap Kurta L', 'Swap Kurta M']);
  });
});
