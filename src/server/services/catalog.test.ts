// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { products, stockMovements } from '@/db/schema';
import { isValidEan13 } from '@/features/scanning/ean13';
import { STORE_ID } from '@/lib/app-config';
import {
  createCategory,
  createSupplier,
  listCategories,
  listReceipts,
  listSuppliers,
  suggestCategoryCode,
  updateCategory,
  updateSupplier,
} from './catalog';
import { createDesign, findProductByCode, getReceiptForLabels, receiveStock } from './products';
import { listStaff } from './staff';

let db: Db;
let owner: string;
const supplierInput = { contactName: 'Ramesh', phone: '98765 43210', gstin: '', notes: '' };

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
});

describe('categories', () => {
  it('seeds categories from the demo catalogue and links products', async () => {
    const rows = await listCategories(db, STORE_ID);
    expect(rows.map((c) => `${c.code}:${c.name}`)).toContain('KU:Kurta');
    expect(rows.find((c) => c.code === 'KU')?.productCount).toBe(2);
  });

  it('suggests a free 2-letter code and refuses duplicates', async () => {
    expect(suggestCategoryCode('Kurti', new Set(['KU']))).toBe('KR');
    const lehenga = await createCategory(db, STORE_ID, { name: 'Lehenga' });
    expect(lehenga.code).toBe('LE');
    await expect(createCategory(db, STORE_ID, { name: 'lehenga 2', code: 'LE' })).rejects.toThrow(/already exists/);
    await expect(createCategory(db, STORE_ID, { name: 'Bad', code: 'K1' })).rejects.toThrow(/2 or 3 letters/);
  });

  it('renaming a category updates the name shown on its products', async () => {
    const kurta = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!;
    await updateCategory(db, STORE_ID, kurta.id, { name: 'Kurtas', code: 'KU', active: true });
    expect((await findProductByCode(db, STORE_ID, 'MAA-KU-001'))?.category).toBe('Kurtas');
  });
});

describe('suppliers', () => {
  it('adds, validates and edits suppliers', async () => {
    const xyz = await createSupplier(db, STORE_ID, { name: 'XYZ Textiles', ...supplierInput });
    expect(xyz.phone).toBe('98765 43210');
    await expect(createSupplier(db, STORE_ID, { name: 'XYZ Textiles', ...supplierInput })).rejects.toThrow(/already exists/);
    await expect(createSupplier(db, STORE_ID, { name: 'Bad', ...supplierInput, gstin: '123' })).rejects.toThrow(/GSTIN/);
    await updateSupplier(db, STORE_ID, xyz.id, { name: 'XYZ Textiles Pvt Ltd', ...supplierInput, gstin: '27ABCDE1234F1Z5', active: true });
    const [row] = await listSuppliers(db, STORE_ID);
    expect(row).toMatchObject({ name: 'XYZ Textiles Pvt Ltd', gstin: '27ABCDE1234F1Z5', productCount: 0 });
  });
});

describe('new design from a supplier (sizes × colours)', () => {
  async function setup() {
    const xyz = await createSupplier(db, STORE_ID, { name: 'XYZ Textiles', ...supplierInput });
    const kurta = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!;
    return { xyz, kurta };
  }

  it('creates one product per size/colour with SKUs, barcodes, stock and one receipt', async () => {
    const { xyz, kurta } = await setup();
    const result = await createDesign(db, STORE_ID, {
      operationId: 'design-1', supplierId: xyz.id, categoryId: kurta.id, name: 'Cotton Kurta', brand: 'XYZ',
      sizes: ['M', 'L', 'XL'], colors: ['Blue', 'Red'], mrpPaise: 129900, pricePaise: 119900, costPaise: 70000,
      quantityEach: 4, billNumber: 'INV-77', staffId: owner,
    });
    expect(result.products).toHaveLength(6);
    expect(result.products.map((p) => p.sku)).toEqual(['MAA-KU-003', 'MAA-KU-004', 'MAA-KU-005', 'MAA-KU-006', 'MAA-KU-007', 'MAA-KU-008']);
    expect(result.products.every((p) => isValidEan13(p.barcode) && p.barcode.startsWith('200') && p.stock === 4)).toBe(true);
    expect(new Set(result.products.map((p) => p.barcode)).size).toBe(6);
    expect(result.products.every((p) => p.supplierId === xyz.id && p.categoryId === kurta.id)).toBe(true);

    const receipts = await listReceipts(db, STORE_ID, { supplierId: xyz.id });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ billNumber: 'INV-77', lines: 6, units: 24, costValuePaise: 24 * 70000 });

    const labels = await getReceiptForLabels(db, STORE_ID, result.receipt.id);
    expect(labels?.lines.reduce((n, l) => n + l.quantity, 0)).toBe(24);
    expect((await listSuppliers(db, STORE_ID))[0]).toMatchObject({ productCount: 6, stockUnits: 24 });
  });

  it('a retried save creates nothing new; existing size/colour is refused', async () => {
    const { xyz, kurta } = await setup();
    const input = {
      operationId: 'design-2', supplierId: xyz.id, categoryId: kurta.id, name: 'Silk Kurta', brand: 'XYZ',
      sizes: ['M', 'm', ' L '], colors: ['Green'], mrpPaise: 199900, pricePaise: 189900, costPaise: null, quantityEach: 0, staffId: owner,
    };
    const first = await createDesign(db, STORE_ID, input);
    expect(first.products.map((p) => p.size)).toEqual(['M', 'L']); // duplicates and spaces cleaned
    const again = await createDesign(db, STORE_ID, input);
    expect(again.duplicate).toBe(true);
    expect(again.products).toHaveLength(2);
    expect(await db.select().from(products).where(eq(products.name, 'Silk Kurta'))).toHaveLength(2);
    await expect(createDesign(db, STORE_ID, { ...input, operationId: 'design-3', sizes: ['L', 'XL'] })).rejects.toThrow(/Already in the catalogue: Green L/);
  });

  it('validates sizes, colours and prices', async () => {
    const { xyz, kurta } = await setup();
    const base = { operationId: 'd', supplierId: xyz.id, categoryId: kurta.id, name: 'K', brand: 'B', sizes: ['M'], colors: ['Red'], mrpPaise: 1000, pricePaise: 1000, costPaise: null, quantityEach: 1, staffId: owner };
    await expect(createDesign(db, STORE_ID, { ...base, sizes: [] })).rejects.toThrow(/at least one size/);
    await expect(createDesign(db, STORE_ID, { ...base, colors: [' '] })).rejects.toThrow(/at least one colour/);
    await expect(createDesign(db, STORE_ID, { ...base, pricePaise: 2000 })).rejects.toThrow(/above MRP/);
  });
});

describe('receive stock for existing items', () => {
  it('adds several items in one receipt, once, linked to the supplier and bill', async () => {
    const xyz = await createSupplier(db, STORE_ID, { name: 'XYZ Textiles', ...supplierInput });
    const tee = (await findProductByCode(db, STORE_ID, 'MAA-TS-001'))!;
    const saree = (await findProductByCode(db, STORE_ID, 'MAA-SA-001'))!;
    const input = { operationId: 'rc-1', supplierId: xyz.id, billNumber: 'B-9', lines: [{ productId: tee.id, quantity: 5 }, { productId: saree.id, quantity: 2 }], staffId: owner };
    await receiveStock(db, STORE_ID, input);
    expect((await receiveStock(db, STORE_ID, input)).duplicate).toBe(true);
    expect((await findProductByCode(db, STORE_ID, 'MAA-TS-001'))?.stock).toBe(8);
    expect((await findProductByCode(db, STORE_ID, 'MAA-SA-001'))?.stock).toBe(2);
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.reason, 'stock_in'));
    expect(moves).toHaveLength(2);
    await expect(receiveStock(db, STORE_ID, { ...input, operationId: 'rc-2', lines: [{ productId: tee.id, quantity: 0 }] })).rejects.toThrow(/at least one item/);
    await expect(receiveStock(db, STORE_ID, { ...input, operationId: 'rc-3', lines: [{ productId: tee.id, quantity: 1 }, { productId: tee.id, quantity: 1 }] })).rejects.toThrow(/listed twice/);
  });
});
