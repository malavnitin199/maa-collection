// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { products, sales, stockMovements } from '@/db/schema';
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
import { createDesign, findProductByCode, getReceiptForLabels, listDesignVariants, receiveStock, updateDesignRates } from './products';
import { recordSale } from './sales';
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

describe('rates for a whole design', () => {
  it('updates every size/colour of the design, leaves other designs and past sales alone', async () => {
    const xyz = await createSupplier(db, STORE_ID, { name: 'XYZ Textiles', ...supplierInput });
    const kurta = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!;
    const { products: created } = await createDesign(db, STORE_ID, {
      operationId: 'rates-1', supplierId: xyz.id, categoryId: kurta.id, name: 'Cotton Kurta', brand: 'XYZ',
      sizes: ['M', 'L'], colors: ['Blue', 'Red'], mrpPaise: 100000, pricePaise: 90000, costPaise: 50000, quantityEach: 2, staffId: owner,
    });
    const { sale } = await recordSale(db, STORE_ID, {
      operationId: 'rates-sale', productId: created[0].id, quantity: 1, unitPricePaise: 85000, soldBy: owner, recordedBy: owner,
    });
    expect(await listDesignVariants(db, STORE_ID, created[0].id)).toHaveLength(4);
    expect(await updateDesignRates(db, STORE_ID, created[0].id, { mrpPaise: 120000, pricePaise: 110000, costPaise: 60000 })).toBe(4);
    const after = await listDesignVariants(db, STORE_ID, created[3].id);
    expect(after.every((p) => p.mrpPaise === 120000 && p.pricePaise === 110000 && p.costPaise === 60000)).toBe(true);
    expect((await findProductByCode(db, STORE_ID, 'MAA-KU-001'))?.mrpPaise).toBe(129900); // other design untouched
    const [saved] = await db.select().from(sales).where(eq(sales.id, sale.id));
    expect([saved.mrpPaise, saved.unitPricePaise, saved.costPaise]).toEqual([100000, 85000, 50000]); // sale snapshot unchanged
    await expect(updateDesignRates(db, STORE_ID, created[0].id, { mrpPaise: 1000, pricePaise: 2000, costPaise: null })).rejects.toThrow(/above MRP/);
  });
});

describe('code price setting', () => {
  it('saves a valid code word, refuses bad ones, and needs a word to print', async () => {
    const { getStoreSettings, updatePriceCode } = await import('./settings');
    expect((await getStoreSettings(db, STORE_ID)).printPriceCode).toBe(false);
    await expect(updatePriceCode(db, STORE_ID, { priceCodeWord: 'AABBCCDDEE', printPriceCode: true })).rejects.toThrow(/different/);
    await expect(updatePriceCode(db, STORE_ID, { priceCodeWord: '', printPriceCode: true })).rejects.toThrow(/Set a code word/);
    const saved = await updatePriceCode(db, STORE_ID, { priceCodeWord: ' black horse ', printPriceCode: true });
    expect(saved).toMatchObject({ priceCodeWord: 'BLACKHORSE', printPriceCode: true });
  });
});

describe('quick add many products', () => {
  it('creates different products with their own prices in one receipt; defaults size/colour and brand', async () => {
    const { createProductsBatch } = await import('./products');
    const ganesh = await createSupplier(db, STORE_ID, { name: 'Shree Ganesh', ...supplierInput });
    const saree = (await listCategories(db, STORE_ID)).find((c) => c.code === 'SA')!;
    const input = {
      operationId: 'quick-1', supplierId: ganesh.id, categoryId: saree.id, billNumber: 'SG-1', staffId: owner,
      rows: [
        { name: 'Georgette Saree', mrpPaise: 250000, pricePaise: 220000, costPaise: 140000, quantity: 3 },
        { name: 'Cotton Saree', color: 'Yellow', mrpPaise: 120000, pricePaise: 110000, costPaise: 60000, quantity: 5 },
        { name: '  ', mrpPaise: 1, pricePaise: 1, costPaise: null, quantity: 1 }, // blank row ignored
      ],
    };
    const result = await createProductsBatch(db, STORE_ID, input);
    expect(result.products.map((p) => [p.sku, p.name, p.size, p.color, p.brand, p.pricePaise, p.stock])).toEqual([
      ['MAA-SA-002', 'Georgette Saree', 'Free', 'Assorted', 'Shree Ganesh', 220000, 3],
      ['MAA-SA-003', 'Cotton Saree', 'Free', 'Yellow', 'Shree Ganesh', 110000, 5],
    ]);
    expect((await getReceiptForLabels(db, STORE_ID, result.receipt.id))?.lines.reduce((n, l) => n + l.quantity, 0)).toBe(8);
    expect((await createProductsBatch(db, STORE_ID, input)).duplicate).toBe(true);
    await expect(createProductsBatch(db, STORE_ID, { ...input, operationId: 'quick-2' })).rejects.toThrow(/Already in the catalogue: Georgette Saree/);
    await expect(
      createProductsBatch(db, STORE_ID, { ...input, operationId: 'quick-3', rows: [{ name: 'X', mrpPaise: 100, pricePaise: 200, costPaise: null, quantity: 1 }] }),
    ).rejects.toThrow(/Row 1 \(X\): Selling price cannot be above MRP/);
    await expect(
      createProductsBatch(db, STORE_ID, { ...input, operationId: 'quick-4', rows: [input.rows[0], { ...input.rows[0], name: 'georgette saree' }].map((r) => ({ ...r, name: r.name + ' New' })) }),
    ).rejects.toThrow(/entered twice/);
  });
});

describe('product photos', () => {
  const jpeg = (size = 100) => {
    const bytes = new Uint8Array(size);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    return bytes;
  };

  it('stores photos in order, picks a main photo, deletes, and checks type/size/limit', async () => {
    const images = await import('./images');
    const tee = (await findProductByCode(db, STORE_ID, 'MAA-TS-001'))!;
    const first = await images.addProductImage(db, STORE_ID, { productId: tee.id, bytes: jpeg(), width: 800, height: 600, staffId: owner });
    const second = await images.addProductImage(db, STORE_ID, { productId: tee.id, bytes: jpeg(200), staffId: owner });
    expect((await images.listProductImages(db, STORE_ID, tee.id)).map((i) => i.id)).toEqual([first.id, second.id]);
    expect((await images.mainImages(db, STORE_ID, [tee.id])).get(tee.id)?.id).toBe(first.id);

    await images.makeMainImage(db, STORE_ID, second.id);
    expect((await images.mainImages(db, STORE_ID, [tee.id])).get(tee.id)?.id).toBe(second.id);
    const stored = await images.getImageData(db, STORE_ID, second.id);
    expect(stored?.contentType).toBe('image/jpeg');
    expect(stored?.data?.length).toBe(200);

    await images.deleteImage(db, STORE_ID, second.id);
    expect((await images.listProductImages(db, STORE_ID, tee.id)).map((i) => i.id)).toEqual([first.id]);

    await expect(images.addProductImage(db, STORE_ID, { productId: tee.id, bytes: new TextEncoder().encode('<script>'), staffId: owner })).rejects.toThrow(/Only JPEG/);
    await expect(images.addProductImage(db, STORE_ID, { productId: tee.id, bytes: jpeg(images.MAX_IMAGE_BYTES + 1), staffId: owner })).rejects.toThrow(/too large/);
    for (let i = 0; i < images.MAX_IMAGES_PER_PRODUCT - 1; i++) await images.addProductImage(db, STORE_ID, { productId: tee.id, bytes: jpeg(), staffId: owner });
    await expect(images.addProductImage(db, STORE_ID, { productId: tee.id, bytes: jpeg(), staffId: owner })).rejects.toThrow(/Up to 8 photos/);
  });
});

describe('tag old stock', () => {
  it('creates an item without a company, and lists my labels from today', async () => {
    const { createProductsBatch, getMyLabelsToday } = await import('./products');
    const dupatta = await createCategory(db, STORE_ID, { name: 'Dupatta' });
    const result = await createProductsBatch(db, STORE_ID, {
      operationId: 'old-1', categoryId: dupatta.id, staffId: owner, note: 'Old stock',
      rows: [{ name: 'Phulkari Dupatta', color: 'Orange', mrpPaise: 89900, pricePaise: 79900, costPaise: null, quantity: 4 }],
    });
    expect(result.products[0]).toMatchObject({ supplierId: null, brand: 'Unbranded', sku: 'MAA-DU-001', stock: 4 });
    const mine = await getMyLabelsToday(db, STORE_ID, owner, 'Asia/Kolkata');
    expect(mine.map((l) => [l.name, l.quantity])).toEqual([['Phulkari Dupatta', 4]]);
    const someoneElse = (await listStaff(db, STORE_ID)).find((p) => p.name === 'Vishal')!.id;
    expect(await getMyLabelsToday(db, STORE_ID, someoneElse, 'Asia/Kolkata')).toEqual([]);
  });
});

describe('old stock with the manufacturer barcode', () => {
  it('uses a valid manufacturer barcode, refuses invalid or already-used ones', async () => {
    const { createProductsBatch } = await import('./products');
    const shirt = (await listCategories(db, STORE_ID)).find((c) => c.code === 'SH')!;
    const base = { categoryId: shirt.id, staffId: owner };
    const row = { name: 'Formal Shirt', size: '40', color: 'White', mrpPaise: 149900, pricePaise: 149900, costPaise: null, quantity: 2 };
    const made = await createProductsBatch(db, STORE_ID, { ...base, operationId: 'mfr-1', rows: [{ ...row, barcode: '4006381333931' }] });
    expect(made.products[0].barcode).toBe('4006381333931');
    await expect(createProductsBatch(db, STORE_ID, { ...base, operationId: 'mfr-2', rows: [{ ...row, size: '42', barcode: '4006381333930' }] })).rejects.toThrow(/not a valid 13-digit barcode/);
    await expect(createProductsBatch(db, STORE_ID, { ...base, operationId: 'mfr-3', rows: [{ ...row, size: '42', barcode: '4006381333931' }] })).rejects.toThrow(/already in the app: 4006381333931 = Formal Shirt/);
    // Without a barcode one is generated as before.
    const generated = await createProductsBatch(db, STORE_ID, { ...base, operationId: 'mfr-4', rows: [{ ...row, size: '42' }] });
    expect(generated.products[0].barcode).toMatch(/^200/);
  });
});
