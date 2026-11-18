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
import { createDesign, findProductByCode, getReceiptForLabels, listDesignVariants, receiveStock, setDesignTags, updateDesignRates } from './products';
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

describe('category sizes', () => {
  it('seeded categories carry their size lists; owner can set, change and keep them', async () => {
    const rows = await listCategories(db, STORE_ID);
    expect(rows.find((c) => c.code === 'KU')?.sizes).toEqual(['M', 'L', 'XL', 'XXL']);
    expect(rows.find((c) => c.code === 'SA')?.sizes).toEqual(['Free']);
    const ladies = await createCategory(db, STORE_ID, { name: 'Ladies Jeans 2', code: 'LX', sizes: '26, 28, 30, 32, 28' });
    expect(ladies.sizes).toEqual(['26', '28', '30', '32']);
    const changed = await updateCategory(db, STORE_ID, ladies.id, { name: 'Ladies Jeans 2', code: 'LX', active: true, sizes: '24, 26, 28, 30, 32' });
    expect(changed.sizes).toEqual(['24', '26', '28', '30', '32']);
    const kept = await updateCategory(db, STORE_ID, ladies.id, { name: 'Ladies Jeans 3', code: 'LX', active: true });
    expect(kept.sizes).toEqual(['24', '26', '28', '30', '32']); // sizes left out = unchanged
    await expect(createCategory(db, STORE_ID, { name: 'Too many', sizes: Array.from({ length: 21 }, (_, i) => String(i)) })).rejects.toThrow(/Up to 20 sizes/);
    await expect(createCategory(db, STORE_ID, { name: 'Too long', sizes: 'Extra Extra Large Plus' })).rejects.toThrow(/too long/);
  });

  it("tags print the category's whole size list, with the piece's own size added if missing", async () => {
    const { tagSizesFor } = await import('./products');
    const kurta = (await findProductByCode(db, STORE_ID, 'MAA-KU-001'))!; // Kurta M (design has M, L)
    const shirt = (await findProductByCode(db, STORE_ID, 'MAA-SH-001'))!; // Shirt in size 40
    const sizes = await tagSizesFor(db, STORE_ID, [kurta, shirt]);
    expect(sizes.get(kurta.id)).toEqual(['M', 'L', 'XL', 'XXL']);
    expect(sizes.get(shirt.id)).toEqual(['S', 'M', 'L', 'XL', 'XXL', '40']);
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

  it('who it is for (plan v17): saved on every size and colour, changed for the whole design only, unknown values refused', async () => {
    const { xyz, kurta } = await setup();
    const base = { supplierId: xyz.id, categoryId: kurta.id, brand: 'XYZ', colors: ['Pink', 'Blue'], mrpPaise: 99900, pricePaise: null, costPaise: null, quantityEach: 1, staffId: owner };
    const girls = await createDesign(db, STORE_ID, { ...base, operationId: 'tags-1', name: 'Frock', sizes: ['M', 'L'], forGender: 'girls', ageGroup: 'child' });
    expect(girls.products.map((p) => [p.forGender, p.ageGroup])).toEqual(Array(4).fill(['girls', 'child']));
    // Not set = empty, as on every older item.
    const plain = await createDesign(db, STORE_ID, { ...base, operationId: 'tags-2', name: 'Plain Kurta', sizes: ['M'], forGender: '', ageGroup: null });
    expect(plain.products.map((p) => [p.forGender, p.ageGroup])).toEqual([[null, null], [null, null]]);

    expect(await setDesignTags(db, STORE_ID, girls.products[0].id, { forGender: 'both', ageGroup: '' })).toBe(4);
    const after = await db.select().from(products).where(eq(products.name, 'Frock'));
    expect(after.map((p) => [p.forGender, p.ageGroup])).toEqual(Array(4).fill(['both', null]));
    expect((await db.select().from(products).where(eq(products.name, 'Plain Kurta'))).every((p) => p.forGender === null)).toBe(true);
    // Prices and stock are untouched.
    expect(after.every((p) => p.mrpPaise === 99900 && p.stock === 1)).toBe(true);

    await expect(createDesign(db, STORE_ID, { ...base, operationId: 'tags-3', name: 'Odd', sizes: ['M'], forGender: 'men' })).rejects.toThrow(/who the item is for/);
    await expect(setDesignTags(db, STORE_ID, girls.products[0].id, { ageGroup: 'teen' })).rejects.toThrow(/who the item is for/);
    // The database refuses unknown values too.
    await expect(db.update(products).set({ ageGroup: 'teen' }).where(eq(products.id, girls.products[0].id))).rejects.toThrow();
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

describe('prices by size (same for every colour of a size)', () => {
  type Row = { size: string; color: string; mrpPaise: number; pricePaise: number; costPaise: number | null };
  /** "Black M" → [mrp, price, cost] in rupees, for easy reading. */
  const priceTable = (rows: Row[]) =>
    Object.fromEntries(rows.map((p) => [`${p.color} ${p.size}`, [p.mrpPaise / 100, p.pricePaise / 100, p.costPaise === null ? null : p.costPaise / 100]]));

  async function shirt(extra: Partial<Parameters<typeof createDesign>[2]> = {}) {
    const xyz = (await listSuppliers(db, STORE_ID))[0] ?? (await createSupplier(db, STORE_ID, { name: 'XYZ Textiles', ...supplierInput }));
    const shirtCategory = (await listCategories(db, STORE_ID)).find((c) => c.code === 'SH')!;
    return createDesign(db, STORE_ID, {
      operationId: `shirt-${Math.random()}`, supplierId: xyz.id, categoryId: shirtCategory.id, name: 'Linen Shirt', brand: 'XYZ',
      sizes: ['M', 'L', 'XL'], colors: ['Black', 'White'], mrpPaise: 70000, pricePaise: 50000, costPaise: 30000, quantityEach: 1, staffId: owner,
      ...extra,
    });
  }

  it('default prices apply to every size and colour', async () => {
    const { products: created } = await shirt();
    expect(created).toHaveLength(6);
    expect(created.every((p) => p.mrpPaise === 70000 && p.pricePaise === 50000 && p.costPaise === 30000)).toBe(true);
  });

  it("a size's own purchase, selling price and MRP apply to all its colours; other sizes keep the defaults", async () => {
    const { products: created } = await shirt({
      sizeRates: [
        { size: 'L', pricePaise: 55000, costPaise: 33000 },
        { size: 'xl', mrpPaise: 75000, pricePaise: 60000, costPaise: 36000 }, // size matched without case
      ],
    });
    expect(priceTable(created)).toEqual({
      'Black M': [700, 500, 300], 'White M': [700, 500, 300],
      'Black L': [700, 550, 330], 'White L': [700, 550, 330],
      'Black XL': [750, 600, 360], 'White XL': [750, 600, 360],
    });
  });

  it('purchase price alone can differ by size (selling price stays the default)', async () => {
    const { products: created } = await shirt({ sizeRates: [{ size: 'XL', costPaise: 36000 }] });
    expect(created.filter((p) => p.size === 'XL').map((p) => [p.pricePaise, p.costPaise])).toEqual([[50000, 36000], [50000, 36000]]);
    expect(created.filter((p) => p.size !== 'XL').every((p) => p.costPaise === 30000)).toBe(true);
  });

  it('no selling price = each size sells at its own MRP', async () => {
    const { products: created } = await shirt({ pricePaise: null, sizeRates: [{ size: 'XL', mrpPaise: 80000 }] });
    expect(created.map((p) => [p.size, p.pricePaise])).toEqual([['M', 70000], ['L', 70000], ['XL', 80000], ['M', 70000], ['L', 70000], ['XL', 80000]]);
  });

  it('checks every size on the server and names the size', async () => {
    await expect(shirt({ sizeRates: [{ size: 'XL', pricePaise: 80000 }] })).rejects.toThrow('Size XL: Selling price cannot be above MRP.');
    await expect(shirt({ sizeRates: [{ size: 'L', mrpPaise: 40000 }] })).rejects.toThrow('Size L: Selling price cannot be above MRP.');
    await expect(shirt({ sizeRates: [{ size: 'M', costPaise: -1 }] })).rejects.toThrow('Size M: Enter a valid cost price.');
    await expect(shirt({ sizeRates: [{ size: 'M', pricePaise: 499.5 }] })).rejects.toThrow('Size M: Enter a valid selling price.');
    await expect(shirt({ sizeRates: [{ size: 'XXL', pricePaise: 50000 }] })).rejects.toThrow(/Size XXL has its own price but is not one of the sizes/);
    await expect(shirt({ sizeRates: [{ size: 'M', pricePaise: 1 }, { size: 'm', pricePaise: 2 }] })).rejects.toThrow(/priced twice/);
    await expect(shirt({ pricePaise: 80000 })).rejects.toThrow('Selling price cannot be above MRP.');
    expect(await db.select().from(products).where(eq(products.name, 'Linen Shirt'))).toHaveLength(0);
  });

  it('changing one size on the product page leaves the other sizes alone; colour never splits a price', async () => {
    const { products: created } = await shirt({ sizeRates: [{ size: 'L', pricePaise: 55000 }, { size: 'XL', pricePaise: 60000, costPaise: 36000 }] });
    const count = await updateDesignRates(db, STORE_ID, created[0].id, {
      mrpPaise: 70000, pricePaise: 50000, costPaise: 30000,
      sizeRates: [{ size: 'L', pricePaise: 52000, costPaise: 31000 }, { size: 'XL', pricePaise: 60000, costPaise: 36000 }],
    });
    expect(count).toBe(6);
    expect(priceTable(await listDesignVariants(db, STORE_ID, created[0].id))).toEqual({
      'Black M': [700, 500, 300], 'White M': [700, 500, 300],
      'Black L': [700, 520, 310], 'White L': [700, 520, 310],
      'Black XL': [700, 600, 360], 'White XL': [700, 600, 360],
    });
  });

  it('saving rates makes all colours of a size equal again, and keeps purchase prices without the costs right', async () => {
    const { products: created } = await shirt({ sizeRates: [{ size: 'XL', costPaise: 36000 }] });
    const blackM = created.find((p) => p.color === 'Black' && p.size === 'M')!;
    await db.update(products).set({ pricePaise: 45000 }).where(eq(products.id, blackM.id)); // e.g. edited one item alone
    // undefined cost = no "costs" right: purchase prices (also sizes' own) are not touched.
    await updateDesignRates(db, STORE_ID, blackM.id, { mrpPaise: 70000, pricePaise: 48000, costPaise: undefined, sizeRates: [{ size: 'XL', costPaise: 1 }] });
    expect(priceTable(await listDesignVariants(db, STORE_ID, blackM.id))).toEqual({
      'Black M': [700, 480, 300], 'White M': [700, 480, 300],
      'Black L': [700, 480, 300], 'White L': [700, 480, 300],
      'Black XL': [700, 480, 360], 'White XL': [700, 480, 360],
    });
    await expect(updateDesignRates(db, STORE_ID, blackM.id, { mrpPaise: 70000, pricePaise: null, costPaise: null, sizeRates: [{ size: 'S', pricePaise: 1 }] })).rejects.toThrow(/Size S has its own price/);
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

describe('QC check list', () => {
  it('lists items without photo, company, stock or purchase price', async () => {
    const { catalogAttention } = await import('./catalog');
    const images = await import('./images');
    const before = await catalogAttention(db, STORE_ID);
    expect(before.noPhoto.count).toBe(8);
    expect(before.noSupplier.count).toBe(8); // demo items have no company
    expect(before.outOfStock.items.map((i) => i.sku)).toEqual(['MAA-SA-001']);
    expect(before.noCost.count).toBe(0);
    const tee = (await findProductByCode(db, STORE_ID, 'MAA-TS-001'))!;
    const jpeg = new Uint8Array(50);
    jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
    await images.addProductImage(db, STORE_ID, { productId: tee.id, bytes: jpeg, staffId: owner });
    const after = await catalogAttention(db, STORE_ID);
    expect(after.noPhoto.count).toBe(7);
    expect(after.noPhoto.items.map((i) => i.sku)).not.toContain('MAA-TS-001');
  });
});

describe('photo taken while creating tags (shared by every size of a colour)', () => {
  const jpeg = (size = 120) => {
    const bytes = new Uint8Array(size);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    return bytes;
  };

  it('stores the bytes once; the other sizes point to it and keep it when the original is deleted', async () => {
    const images = await import('./images');
    const xyz = await createSupplier(db, STORE_ID, { name: 'Photo Co', ...supplierInput });
    const kurta = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!;
    const { products: made } = await createDesign(db, STORE_ID, {
      operationId: 'photo-1', supplierId: xyz.id, categoryId: kurta.id, name: 'Photo Kurta', brand: 'XYZ',
      sizes: ['M', 'L', 'XL'], colors: ['Blue'], mrpPaise: 100000, pricePaise: null, costPaise: null, quantityEach: 1, staffId: owner,
    });
    const ids = made.map((p) => p.id);
    const [original, ...shared] = await images.addPhotoToProducts(db, STORE_ID, { productIds: ids, bytes: jpeg(), width: 800, height: 1000, staffId: owner });
    expect(original.url).toBeNull();
    expect(shared.map((s) => s.url)).toEqual([`/api/product-images/${original.id}`, `/api/product-images/${original.id}`]);
    expect((await images.getImageData(db, STORE_ID, original.id))?.data?.length).toBe(120);
    expect(await images.getImageData(db, STORE_ID, shared[0].id)).toMatchObject({ data: null, url: `/api/product-images/${original.id}` });
    // Every size shows a photo (counter, lists).
    expect((await images.mainImages(db, STORE_ID, ids)).size).toBe(3);

    // Deleting the photo on size M: one of the other sizes takes over the bytes, the last points to it.
    await images.deleteImage(db, STORE_ID, original.id);
    const after = await Promise.all(shared.map((s) => images.getImageData(db, STORE_ID, s.id)));
    const heirIndex = after.findIndex((row) => row?.data);
    expect(heirIndex).toBeGreaterThanOrEqual(0);
    expect(after[heirIndex]).toMatchObject({ url: null });
    expect(after[heirIndex]?.data?.length).toBe(120);
    expect(after[1 - heirIndex]?.url).toBe(`/api/product-images/${shared[heirIndex].id}`);
    expect((await images.mainImages(db, STORE_ID, ids)).size).toBe(2);

    await expect(images.addPhotoToProducts(db, STORE_ID, { productIds: [], bytes: jpeg(), staffId: owner })).rejects.toThrow(/Choose the items/);
    await expect(images.addPhotoToProducts(db, STORE_ID, { productIds: ['00000000-0000-0000-0000-000000000000'], bytes: jpeg(), staffId: owner })).rejects.toThrow(/Product not found/);
    await expect(images.addPhotoToProducts(db, STORE_ID, { productIds: ids, bytes: new TextEncoder().encode('<svg/>'), staffId: owner })).rejects.toThrow(/Only JPEG/);
  });
});

describe('fixing an item right after tagging it (Tag old stock → Edit)', () => {
  async function tagOne(staffId: string) {
    const { createProductsBatch } = await import('./products');
    const kurta = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!;
    const result = await createProductsBatch(db, STORE_ID, {
      operationId: `old-${staffId}`, supplierId: null, categoryId: kurta.id, brand: '', note: 'Old stock tagged', staffId,
      rows: [{ barcode: null, name: 'Cotton Kurta', size: 'M', color: 'Blue', mrpPaise: 99900, pricePaise: 89900, costPaise: 50000, quantity: 3 }],
    });
    return { product: result.products[0], kurta };
  }
  const fix = (overrides: Record<string, unknown>) => ({
    name: 'Cotton Kurta Long', size: 'L', color: 'Navy', supplierId: null, mrpPaise: 109900, pricePaise: 99900, costPaise: 55000, canPrices: false, canCosts: false, ...overrides,
  });

  it('fixes details and prices of an unsold item its creator just tagged; barcode, SKU and pieces stay', async () => {
    const { correctTaggedItem } = await import('./products');
    const catalogPerson = (await listStaff(db, STORE_ID)).find((p) => p.name === 'Nitin')!.id;
    const { product, kurta } = await tagOne(catalogPerson);
    const { product: fixed, pricesKept } = await correctTaggedItem(db, STORE_ID, { productId: product.id, staffId: catalogPerson, categoryId: kurta.id, ...fix({}) });
    expect(pricesKept).toBe(false);
    expect([fixed.name, fixed.size, fixed.color, fixed.mrpPaise, fixed.pricePaise]).toEqual(['Cotton Kurta Long', 'L', 'Navy', 109900, 99900]);
    expect([fixed.barcode, fixed.sku, fixed.stock]).toEqual([product.barcode, product.sku, 3]);
    expect(fixed.costPaise).toBe(50000); // purchase price needs the "costs" right
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.productId, product.id));
    expect(moves).toHaveLength(1); // no stock entry added or changed
  });

  it('keeps prices once sold (or for someone else’s item) unless the person has the "prices" right', async () => {
    const { correctTaggedItem } = await import('./products');
    const staffList = await listStaff(db, STORE_ID);
    const nitin = staffList.find((p) => p.name === 'Nitin')!.id;
    const vishal = staffList.find((p) => p.name === 'Vishal')!.id;
    const { product, kurta } = await tagOne(nitin);
    // Someone else without the prices right: details change, prices stay.
    const other = await correctTaggedItem(db, STORE_ID, { productId: product.id, staffId: vishal, categoryId: kurta.id, ...fix({}) });
    expect([other.pricesKept, other.product.mrpPaise, other.product.name]).toEqual([true, 99900, 'Cotton Kurta Long']);
    // Sold once: the creator can't change prices any more…
    await recordSale(db, STORE_ID, { operationId: 'sold-1', productId: product.id, quantity: 1, unitPricePaise: 85000, soldBy: nitin, recordedBy: nitin });
    const creator = await correctTaggedItem(db, STORE_ID, { productId: product.id, staffId: nitin, categoryId: kurta.id, ...fix({ mrpPaise: 120000, pricePaise: 110000 }) });
    expect([creator.pricesKept, creator.product.mrpPaise, creator.product.pricePaise]).toEqual([true, 99900, 89900]);
    // …but someone with the prices (and costs) right can.
    const owners = await correctTaggedItem(db, STORE_ID, { productId: product.id, staffId: owner, categoryId: kurta.id, ...fix({ mrpPaise: 120000, pricePaise: 110000, canPrices: true, canCosts: true }) });
    expect([owners.pricesKept, owners.product.mrpPaise, owners.product.pricePaise, owners.product.costPaise, owners.product.stock]).toEqual([false, 120000, 110000, 55000, 2]);
    await expect(correctTaggedItem(db, STORE_ID, { productId: product.id, staffId: owner, categoryId: kurta.id, ...fix({ pricePaise: 999999, canPrices: true }) })).rejects.toThrow(/above MRP/);
  });
});

describe('clear stock (owner): every count to 0, nothing erased', () => {
  it('zeroes all stock with a "cleared" history entry per item; sales and items stay; running again does nothing', async () => {
    const { clearAllStock, stockTotals } = await import('./products');
    const tee = (await findProductByCode(db, STORE_ID, 'MAA-TS-001'))!;
    await recordSale(db, STORE_ID, { operationId: 'before-clear', productId: tee.id, quantity: 1, unitPricePaise: 10000, soldBy: owner, recordedBy: owner });
    const before = await stockTotals(db, STORE_ID);
    const itemCount = (await db.select().from(products)).length;
    expect(before.pieces).toBeGreaterThan(0);

    const cleared = await clearAllStock(db, STORE_ID, { staffId: owner });
    expect(cleared).toEqual(before);
    expect(await stockTotals(db, STORE_ID)).toEqual({ items: 0, pieces: 0 });
    const all = await db.select().from(products);
    expect(all).toHaveLength(itemCount); // no item deleted
    expect(all.every((p) => p.stock === 0)).toBe(true);
    expect(await db.select().from(sales)).toHaveLength(1); // past sales stay

    // Each item that had stock has one 'cleared' entry for exactly what it held, by the owner.
    const entries = await db.select().from(stockMovements).where(eq(stockMovements.reason, 'cleared'));
    expect(entries).toHaveLength(before.items);
    expect(entries.reduce((n, e) => n + e.quantityChange, 0)).toBe(-before.pieces);
    expect(entries.every((e) => e.staffId === owner)).toBe(true);
    const teeEntry = entries.find((e) => e.productId === tee.id)!;
    expect(teeEntry.quantityChange).toBe(-(tee.stock - 1));

    // The ledger still adds up to the stock, and a second run changes nothing.
    const teeMoves = await db.select().from(stockMovements).where(eq(stockMovements.productId, tee.id));
    expect(teeMoves.reduce((n, m) => n + m.quantityChange, 0)).toBe(0);
    expect(await clearAllStock(db, STORE_ID, { staffId: owner })).toEqual({ items: 0, pieces: 0 });
    expect(await db.select().from(stockMovements).where(eq(stockMovements.reason, 'cleared'))).toHaveLength(before.items);
    // Selling a cleared item is refused; receiving stock works again.
    await expect(recordSale(db, STORE_ID, { operationId: 'after-clear', productId: tee.id, quantity: 1, unitPricePaise: 10000, soldBy: owner, recordedBy: owner })).rejects.toThrow('Out of stock.');
    await receiveStock(db, STORE_ID, { operationId: 'refill', lines: [{ productId: tee.id, quantity: 4 }], staffId: owner });
    expect((await findProductByCode(db, STORE_ID, 'MAA-TS-001'))!.stock).toBe(4);
  });
});
