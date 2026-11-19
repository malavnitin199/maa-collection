// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { categories, sections, stockReceipts } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { createCategory, createSupplier, listCategories, suggestSectionCode, updateCategory } from './catalog';
import { companyReport, companySummaries } from './company';
import { cleanStockDate, createDesign, receiveStock } from './products';
import { addTypeSize, createSection, createType, ensureSections, listSections, updateSection } from './sections';
import { listStaff } from './staff';

/** Plan v19: Man / Woman / Girl / Boy with their types, the stock date, pieces per size, and a company's bills. */
let db: Db;
let owner: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
});

const typeNames = (list: Awaited<ReturnType<typeof listSections>>, section: string) =>
  list.sections.find((s) => s.name === section)!.types.map((t) => t.name);

describe('sections (plan v19)', () => {
  it('start as Man, Woman, Girl, Boy; existing types sorted under them; the starting types added', async () => {
    const list = await listSections(db, STORE_ID);
    expect(list.sections.map((s) => [s.name, s.icon])).toEqual([
      ['Man', 'man'],
      ['Woman', 'woman'],
      ['Girl', 'girl'],
      ['Boy', 'boy'],
    ]);
    // Demo types: Shirt, T-Shirt and Kurta are men's; Saree, Dress and Jeans go under Woman (owner's choice).
    expect(typeNames(list, 'Man')).toEqual(['Jeans', 'Kurta', 'Shirt', 'T-Shirt']);
    expect(typeNames(list, 'Woman')).toEqual(['Dress', 'Dupatta', 'Jeans', 'Kurti', 'Leggings', 'Lehenga', 'Night Suit', 'Saree', 'Tops']);
    expect(typeNames(list, 'Girl')).toEqual(['Dress', 'Jeans', 'Skirt', 'Tops']);
    expect(typeNames(list, 'Boy')).toEqual(['Jeans', 'Shirt', 'T-shirt']);
    expect(list.unsorted).toEqual([]);

    // The owner's sizes for the new types; existing types keep theirs.
    const boy = list.sections.find((s) => s.name === 'Boy')!;
    expect(boy.types.find((t) => t.name === 'Jeans')!.sizes).toEqual(['28', '30', '32', '34']);
    expect(boy.types.find((t) => t.name === 'Shirt')!.sizes).toEqual(['M', 'L', 'XL', 'XXL']);
    const kurta = list.sections.find((s) => s.name === 'Man')!.types.find((t) => t.name === 'Kurta')!;
    expect(kurta.code).toBe('KU');
    expect(kurta.productCount).toBe(2);
    // Every code is still unique and 2–3 letters.
    const codes = list.sections.flatMap((s) => s.types.map((t) => t.code));
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^[A-Z]{2,3}$/.test(c))).toBe(true);
  });

  it('are set up once: a second run, or two at the same time, change nothing', async () => {
    await Promise.all([ensureSections(db, STORE_ID), ensureSections(db, STORE_ID)]);
    const first = await db.select().from(categories);
    await ensureSections(db, STORE_ID);
    expect(await db.select().from(sections)).toHaveLength(4);
    expect(await db.select().from(categories)).toHaveLength(first.length);
    // A type the owner hides is not brought back.
    const skirt = first.find((c) => c.name === 'Skirt')!;
    await updateCategory(db, STORE_ID, skirt.id, { name: 'Skirt', code: skirt.code, active: false });
    await ensureSections(db, STORE_ID);
    expect((await listSections(db, STORE_ID, { activeOnly: true })).sections.find((s) => s.name === 'Girl')!.types.map((t) => t.name)).not.toContain('Skirt');
  });

  it('the owner adds a section with a picture; names are unique (any letter case); hide and rename', async () => {
    await ensureSections(db, STORE_ID);
    const kids = await createSection(db, STORE_ID, { name: '  Kids  ', icon: 'baby' });
    expect([kids.name, kids.icon, kids.sort]).toEqual(['Kids', 'baby', 5]);
    await expect(createSection(db, STORE_ID, { name: 'kids' })).rejects.toThrow('That name is already in the list.');
    expect((await createSection(db, STORE_ID, { name: 'Accessories', icon: 'not-a-picture' })).icon).toBe('hanger');
    await updateSection(db, STORE_ID, kids.id, { name: 'Kids wear', active: false });
    const list = await listSections(db, STORE_ID, { activeOnly: true });
    expect(list.sections.map((s) => s.name)).toEqual(['Man', 'Woman', 'Girl', 'Boy', 'Accessories']);
  });

  it('a type is added under a section with its sizes; the same name may sit under another section only', async () => {
    const { sections: list } = await listSections(db, STORE_ID);
    const boy = list.find((s) => s.name === 'Boy')!;
    const girl = list.find((s) => s.name === 'Girl')!;
    const shorts = await createType(db, STORE_ID, { sectionId: boy.id, name: 'Shorts', sizes: '24, 26, 28' });
    expect([shorts.sectionId, shorts.sizes, shorts.code]).toEqual([boy.id, ['24', '26', '28'], 'BSH']);
    await expect(createType(db, STORE_ID, { sectionId: boy.id, name: 'shorts', sizes: [] })).rejects.toThrow(/already exists/);
    expect((await createType(db, STORE_ID, { sectionId: girl.id, name: 'Shorts', sizes: [] })).sectionId).toBe(girl.id);
    await expect(createType(db, STORE_ID, { sectionId: '00000000-0000-4000-8000-000000000000', name: 'Caps', sizes: [] })).rejects.toThrow('Choose Man, Woman, Girl or Boy.');
    // Moving a type to another section; never onto a name that section already has.
    const woman = list.find((s) => s.name === 'Woman')!;
    const gown = await createType(db, STORE_ID, { sectionId: woman.id, name: 'Gown', sizes: [] });
    expect((await updateCategory(db, STORE_ID, gown.id, { name: 'Gown', code: gown.code, active: true, sectionId: girl.id })).sectionId).toBe(girl.id);
    const tops = woman.types.find((t) => t.name === 'Tops')!;
    await expect(updateCategory(db, STORE_ID, tops.id, { name: 'Tops', code: tops.code, active: true, sectionId: girl.id })).rejects.toThrow(/already exists/);
    expect((await listCategories(db, STORE_ID)).find((c) => c.id === shorts.id)?.sectionName).toBe('Boy');
  });

  it('codes: section letter + type letter first, then more letters', () => {
    expect(suggestSectionCode('Boy', 'Jeans', new Set())).toBe('BJ');
    expect(suggestSectionCode('Girl', 'Jeans', new Set(['GJ']))).toBe('GJE');
    expect(suggestSectionCode('Girl', 'Jeans', new Set(['GJ', 'GJE']))).toBe('GJA');
  });

  it('"+ Add size" keeps the size on the type, once, after the others', async () => {
    const { sections: list } = await listSections(db, STORE_ID);
    const jeans = list.find((s) => s.name === 'Boy')!.types.find((t) => t.name === 'Jeans')!;
    expect(await addTypeSize(db, STORE_ID, jeans.id, ' 36 ')).toEqual(['28', '30', '32', '34', '36']);
    expect(await addTypeSize(db, STORE_ID, jeans.id, '36')).toEqual(['28', '30', '32', '34', '36']);
    await expect(addTypeSize(db, STORE_ID, jeans.id, '  ')).rejects.toThrow('Type a size.');
    // A plain category (made before sections) still works.
    const plain = await createCategory(db, STORE_ID, { name: 'Socks' });
    expect(plain.sectionId).toBeNull();
  });
});

describe('new stock: stock date and pieces per size (plan v19)', () => {
  it('saves the stock date on the delivery and each size its own pieces (every colour of a size)', async () => {
    const company = await createSupplier(db, STORE_ID, { name: 'Denim House', contactName: '', phone: '', gstin: '', notes: '' });
    const jeans = (await listSections(db, STORE_ID)).sections.find((s) => s.name === 'Boy')!.types.find((t) => t.name === 'Jeans')!;
    const result = await createDesign(db, STORE_ID, {
      operationId: 'v19-1', supplierId: company.id, categoryId: jeans.id, name: 'Slim Jeans', brand: 'Denim House',
      sizes: ['28', '30', '32'], colors: ['Blue', 'Black'], mrpPaise: 99900, pricePaise: null, costPaise: 50000,
      quantityEach: 1, quantities: { '28': 3, '30': 0 }, billNumber: 'D-1', stockDate: '2026-11-02', staffId: owner,
    });
    const stock = Object.fromEntries(result.products.map((p) => [`${p.color} ${p.size}`, p.stock]));
    expect(stock).toEqual({ 'Blue 28': 3, 'Blue 30': 0, 'Blue 32': 1, 'Black 28': 3, 'Black 30': 0, 'Black 32': 1 });
    expect(result.receipt.stockDate).toBe('2026-11-02');
    expect(result.products[0].sku).toMatch(/^MAA-BJ-\d{3}$/);
  });

  it('a stock date must be a real day, not after today; empty means the day it is entered', () => {
    expect(cleanStockDate('', '2026-11-19')).toBeNull();
    expect(cleanStockDate(' 2026-11-19 ', '2026-11-19')).toBe('2026-11-19');
    expect(() => cleanStockDate('2026-11-20', '2026-11-19')).toThrow('The stock date cannot be after today.');
    expect(() => cleanStockDate('2026-02-30', '2026-11-19')).toThrow('Enter a valid stock date.');
    expect(() => cleanStockDate('2026-13-45', '2026-11-19')).toThrow('Enter a valid stock date.');
    expect(() => cleanStockDate('19/11/2026', '2026-11-19')).toThrow('Enter a valid stock date.');
    expect(() => cleanStockDate('1999-12-31', '2026-11-19')).toThrow('Enter a valid stock date.');
  });
});

describe('company details (plan v19)', () => {
  it('bills by bill number, month by month and by category; amounts from purchase price × pieces', async () => {
    const company = await createSupplier(db, STORE_ID, { name: 'Denim House', contactName: '', phone: '', gstin: '', notes: '' });
    const list = (await listSections(db, STORE_ID)).sections;
    const boyJeans = list.find((s) => s.name === 'Boy')!.types.find((t) => t.name === 'Jeans')!;
    const girlTops = list.find((s) => s.name === 'Girl')!.types.find((t) => t.name === 'Tops')!;
    const base = { supplierId: company.id, brand: 'Denim House', colors: ['Blue'], pricePaise: null, quantityEach: 2, staffId: owner };
    // Bill D-1 (1 Oct) entered as two items; bill d-1 typed in other letters is the same bill.
    const jeans = await createDesign(db, STORE_ID, { ...base, operationId: 'c-1', categoryId: boyJeans.id, name: 'Slim Jeans', sizes: ['28', '30'], mrpPaise: 99900, costPaise: 50000, billNumber: 'D-1', stockDate: '2026-10-01' });
    await createDesign(db, STORE_ID, { ...base, operationId: 'c-2', categoryId: girlTops.id, name: 'Crop Top', sizes: ['M'], mrpPaise: 59900, costPaise: 30000, billNumber: 'd-1 ', stockDate: '2026-10-03' });
    // A delivery in November without a bill number is its own bill.
    await createDesign(db, STORE_ID, { ...base, operationId: 'c-3', categoryId: boyJeans.id, name: 'Cargo Jeans', sizes: ['32'], mrpPaise: 109900, costPaise: 60000, billNumber: '', stockDate: '2026-11-05', quantityEach: 1 });
    // More pieces of an item arrive later on bill D-9 (receive stock).
    await receiveStock(db, STORE_ID, { operationId: 'c-4', supplierId: company.id, billNumber: 'D-9', staffId: owner, lines: [{ productId: jeans.products[0].id, quantity: 4 }] });

    const report = await companyReport(db, STORE_ID, company.id, { amounts: true });
    expect(report.totals).toMatchObject({ bills: 3, items: 4, pieces: 4 + 2 + 1 + 4, types: 2 });
    // 2×(2×500) + 2×300 + 1×600 + 4×500 = 2000 + 600 + 600 + 2000 (₹) = ₹5,200
    expect(report.totals.amountPaise).toBe(520000);
    const d1 = report.bills.find((b) => b.billNumber === 'D-1')!;
    expect(d1).toMatchObject({ date: '2026-10-01', items: 3, pieces: 6, amountPaise: 260000 });
    expect(d1.receiptIds).toHaveLength(2);
    expect(d1.lines.map((l) => `${l.section} › ${l.type}: ${l.name} ${l.size}`).sort()).toEqual([
      'Boy › Jeans: Slim Jeans 28',
      'Boy › Jeans: Slim Jeans 30',
      'Girl › Tops: Crop Top M',
    ]);
    expect(report.bills.find((b) => b.billNumber === null)).toMatchObject({ date: '2026-11-05', pieces: 1, amountPaise: 60000 });
    // D-9 has no stock date: it is dated the day it was entered.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    expect(report.bills.find((b) => b.billNumber === 'D-9')).toMatchObject({ date: today, items: 1, pieces: 4, amountPaise: 200000 });
    expect(report.months.find((m) => m.month === '2026-10')).toEqual({ month: '2026-10', bills: 1, items: 3, pieces: 6, amountPaise: 260000 });
    expect(report.types).toEqual([
      { section: 'Boy', type: 'Jeans', items: 3, pieces: 9, amountPaise: 460000 },
      { section: 'Girl', type: 'Tops', items: 1, pieces: 2, amountPaise: 60000 },
    ]);

    // Without the purchase-price right: the same counts, no amounts at all.
    const counts = await companyReport(db, STORE_ID, company.id, { amounts: false });
    expect(counts.totals.amountPaise).toBeNull();
    expect([...counts.bills.map((b) => b.amountPaise), ...counts.bills.flatMap((b) => b.lines.map((l) => l.amountPaise)), ...counts.months.map((m) => m.amountPaise), ...counts.types.map((t) => t.amountPaise)].every((v) => v === null)).toBe(true);

    const summaries = await companySummaries(db, STORE_ID, { amounts: true });
    expect(summaries.get(company.id)).toEqual({ bills: 3, pieces: 11, amountPaise: 520000, lastDate: today });
    expect((await companySummaries(db, STORE_ID, { amounts: false })).get(company.id)?.amountPaise).toBeNull();
    // Only arrivals count: the stock date column is on the delivery.
    expect((await db.select().from(stockReceipts).where(eq(stockReceipts.supplierId, company.id))).map((r) => r.stockDate).sort()).toEqual(['2026-10-01', '2026-10-03', '2026-11-05', null]);
  });
});
