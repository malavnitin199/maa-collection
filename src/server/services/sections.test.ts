// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { categories, sections } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { createCategory, createSupplier, listCategories, suggestSectionCode, updateCategory } from './catalog';
import { bulkUpdateProducts, createDesign, createProduct, createProductsBatch, listProducts, receiveStock } from './products';
import { addTypeSize, backfillSections, createSection, createType, listSections, moveSection, moveType, unsortedCount, updateSection } from './sections';
import { listStaff } from './staff';

/** Plan v19, V19-02a (ADR-033): sections, the one-time set-up, and "a new item needs both levels". */
let db: Db;
let owner: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
});

const names = (list: Awaited<ReturnType<typeof listSections>>, section: string) => list.sections.find((s) => s.name === section)!.types.map((t) => t.name);

/** The live shop's shape: categories (with items) but no sections yet. */
async function likeTheLiveShop() {
  await db.update(categories).set({ sectionId: null });
  await db.delete(sections);
}

describe('one-time set-up (backfillSections)', () => {
  it('makes Men, Women, Boys, Girls with Hindi names; leaves every existing category for the owner to sort; adds starters only for names the shop lacks', async () => {
    await likeTheLiveShop();
    const before = (await listCategories(db, STORE_ID)).map((c) => `${c.code}:${c.name}`).sort();

    const report = await backfillSections(db, STORE_ID, { dryRun: true });
    expect(report.created).toBe(true);
    // Nothing written by a dry run.
    expect(await db.select().from(sections)).toHaveLength(0);

    const result = await backfillSections(db, STORE_ID);
    expect(result.created).toBe(true);
    expect(result.unsorted.sort()).toEqual(['Dress', 'Dress Material', 'Jeans', 'Kurta', 'Saree', 'Shirt', 'T-Shirt']);
    // Demo shop has Shirt, T-Shirt, Jeans, Kurta, Saree, Dress: those starters are skipped everywhere (D-V19-2).
    expect(result.typesSkipped).toEqual([
      'Men › Shirt', 'Men › T-shirt', 'Men › Jeans', 'Men › Kurta',
      'Women › Saree', 'Women › Jeans',
      'Boys › Jeans', 'Boys › Shirt', 'Boys › T-shirt',
      'Girls › Dress', 'Girls › Jeans',
    ]);
    expect(result.typesAdded).toEqual(['Women › Kurti', 'Women › Lehenga', 'Women › Dupatta', 'Women › Leggings', 'Women › Night Suit', 'Women › Tops', 'Girls › Skirt', 'Girls › Tops']);
    expect(report).toMatchObject({ typesAdded: result.typesAdded, typesSkipped: result.typesSkipped });
    expect([...report.unsorted].sort()).toEqual(result.unsorted);

    const list = await listSections(db, STORE_ID);
    expect(list.sections.map((s) => [s.name, s.nameHi, s.icon, s.sort])).toEqual([
      ['Men', 'पुरुष', 'man', 1],
      ['Women', 'महिला', 'woman', 2],
      ['Boys', 'लड़के', 'boy', 3],
      ['Girls', 'लड़कियाँ', 'girl', 4],
    ]);
    expect(names(list, 'Men')).toEqual([]);
    expect(names(list, 'Women')).toEqual(['Dupatta', 'Kurti', 'Leggings', 'Lehenga', 'Night Suit', 'Tops']);
    expect(names(list, 'Boys')).toEqual([]);
    expect(names(list, 'Girls')).toEqual(['Skirt', 'Tops']);
    expect(list.unsorted.map((t) => t.name).sort()).toEqual(['Dress', 'Dress Material', 'Jeans', 'Kurta', 'Saree', 'Shirt', 'T-Shirt']);
    expect(await unsortedCount(db, STORE_ID)).toBe(7);
    // The existing categories themselves (codes, sizes, items) are untouched.
    const kept = (await listCategories(db, STORE_ID)).filter((c) => !c.sectionId).map((c) => `${c.code}:${c.name}`).sort();
    expect(kept).toEqual(before);
    expect((await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')?.productCount).toBe(2);
    // Starter types have Hindi names, sizes and unique 2–3 letter codes.
    const tops = list.sections.find((s) => s.name === 'Girls')!.types.find((t) => t.name === 'Tops')!;
    expect([tops.nameHi, tops.code, tops.sizes]).toEqual(['टॉप', 'GT', ['M', 'L', 'XL', 'XXL']]);
    // Starter codes are the shop's usual ones (Kurti KR, Dupatta DU …) unless taken.
    expect(list.sections.find((s) => s.name === 'Women')!.types.map((t) => `${t.code}:${t.name}`)).toEqual(['DU:Dupatta', 'KR:Kurti', 'LG:Leggings', 'LE:Lehenga', 'NS:Night Suit', 'TP:Tops']);
    const codes = (await listCategories(db, STORE_ID)).map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^[A-Z]{2,3}$/.test(c))).toBe(true);
  });

  it('runs once: a shop with sections is left exactly as it is', async () => {
    const before = await listSections(db, STORE_ID);
    const again = await backfillSections(db, STORE_ID);
    expect(again.created).toBe(false);
    expect(await listSections(db, STORE_ID)).toEqual(before);
  });

  it('the dev / test seed puts every demo category under a section, except one old-style one for "Needs sorting"', async () => {
    const list = await listSections(db, STORE_ID);
    expect(list.sections.map((s) => s.name)).toEqual(['Men', 'Women', 'Boys', 'Girls']);
    expect(list.unsorted.map((t) => t.name)).toEqual(['Dress Material']);
    expect(names(list, 'Men')).toEqual(['Jeans', 'Kurta', 'Shirt', 'T-Shirt']);
    expect(names(list, 'Women')).toEqual(['Dress', 'Saree']);
  });
});

describe('sections', () => {
  it('the owner adds one with a picture and a Hindi name; names are unique (any letter case); rename, hide, reorder', async () => {
    const kids = await createSection(db, STORE_ID, { name: '  Kids  ', nameHi: ' बच्चे ', icon: 'baby' });
    expect([kids.name, kids.nameHi, kids.icon, kids.sort]).toEqual(['Kids', 'बच्चे', 'baby', 5]);
    await expect(createSection(db, STORE_ID, { name: 'kids' })).rejects.toThrow('That name is already in the list.');
    await expect(createSection(db, STORE_ID, { name: '' })).rejects.toThrow('Enter a name (up to 30 characters).');
    expect((await createSection(db, STORE_ID, { name: 'Accessories', icon: 'not-a-picture' })).icon).toBe('hanger');

    await updateSection(db, STORE_ID, kids.id, { name: 'Kids wear', nameHi: '', active: false });
    const hidden = (await listSections(db, STORE_ID)).sections.find((s) => s.id === kids.id)!;
    expect([hidden.name, hidden.nameHi, hidden.active]).toEqual(['Kids wear', null, false]);
    expect((await listSections(db, STORE_ID, { activeOnly: true })).sections.map((s) => s.name)).toEqual(['Men', 'Women', 'Boys', 'Girls', 'Accessories']);
    await expect(updateSection(db, STORE_ID, kids.id, { name: 'women', active: true })).rejects.toThrow('That name is already in the list.');

    // Reorder: Girls above Boys; moving the first one up changes nothing.
    const girls = (await listSections(db, STORE_ID)).sections.find((s) => s.name === 'Girls')!;
    await moveSection(db, STORE_ID, girls.id, 'up');
    expect((await listSections(db, STORE_ID)).sections.map((s) => s.name)).toEqual(['Men', 'Women', 'Girls', 'Boys', 'Kids wear', 'Accessories']);
    const men = (await listSections(db, STORE_ID)).sections.find((s) => s.name === 'Men')!;
    await moveSection(db, STORE_ID, men.id, 'up');
    expect((await listSections(db, STORE_ID)).sections.map((s) => s.name)).toEqual(['Men', 'Women', 'Girls', 'Boys', 'Kids wear', 'Accessories']);
  });

  it('a type goes under a section with its sizes; the same name may sit under another section only; types can be moved', async () => {
    const { sections: list } = await listSections(db, STORE_ID);
    const boys = list.find((s) => s.name === 'Boys')!;
    const girls = list.find((s) => s.name === 'Girls')!;
    const shorts = await createType(db, STORE_ID, { sectionId: boys.id, name: 'Shorts', nameHi: 'शॉर्ट्स', sizes: '24, 26, 28' });
    // Code: the type's own letters (SH) are Shirt's, so section + type: BS.
    expect([shorts.sectionId, shorts.nameHi, shorts.sizes, shorts.code]).toEqual([boys.id, 'शॉर्ट्स', ['24', '26', '28'], 'BS']);
    await expect(createType(db, STORE_ID, { sectionId: boys.id, name: 'shorts', sizes: [] })).rejects.toThrow(/already exists/);
    expect((await createType(db, STORE_ID, { sectionId: girls.id, name: 'Shorts', sizes: [] })).sectionId).toBe(girls.id);
    await expect(createType(db, STORE_ID, { sectionId: '00000000-0000-4000-8000-000000000000', name: 'Caps', sizes: [] })).rejects.toThrow('Choose Men, Women, Boys or Girls.');
    // Moving a type to another section; never onto a name that section already has.
    const women = list.find((s) => s.name === 'Women')!;
    const gown = await createType(db, STORE_ID, { sectionId: women.id, name: 'Gown', sizes: [] });
    expect((await updateCategory(db, STORE_ID, gown.id, { name: 'Gown', code: gown.code, active: true, sectionId: girls.id })).sectionId).toBe(girls.id);
    const dress = women.types.find((t) => t.name === 'Dress')!;
    await createType(db, STORE_ID, { sectionId: girls.id, name: 'Dress', sizes: [] });
    await expect(updateCategory(db, STORE_ID, dress.id, { name: 'Dress', code: dress.code, active: true, sectionId: girls.id })).rejects.toThrow(/already exists/);
    const row = (await listCategories(db, STORE_ID)).find((c) => c.id === shorts.id)!;
    expect([row.sectionName, row.sectionNameHi]).toEqual(['Boys', 'लड़के']);
    // A category made without a section (older screens) is allowed and lands in "Needs sorting".
    const socks = await createCategory(db, STORE_ID, { name: 'Socks' });
    expect(socks.sectionId).toBeNull();
    expect((await listSections(db, STORE_ID)).unsorted.map((t) => t.name)).toEqual(['Dress Material', 'Socks']);
  });

  it('codes: the type\'s own letters when free, else section letter + type letters', () => {
    expect(suggestSectionCode('Boys', 'Jeans', new Set())).toBe('JE');
    expect(suggestSectionCode('Girls', 'Jeans', new Set(['JE']))).toBe('GJ');
    expect(suggestSectionCode('Girls', 'Jeans', new Set(['JE', 'GJ']))).toBe('GJE');
    expect(suggestSectionCode('Girls', 'Jeans', new Set(['JE', 'GJ', 'GJE']))).toBe('GJA');
  });

  it('"+ Add size" keeps the size on the type, once, after the others', async () => {
    const jeans = (await listSections(db, STORE_ID)).sections.find((s) => s.name === 'Men')!.types.find((t) => t.name === 'Jeans')!;
    expect(await addTypeSize(db, STORE_ID, jeans.id, ' 38 ')).toEqual([...jeans.sizes, '38']);
    expect(await addTypeSize(db, STORE_ID, jeans.id, '38')).toEqual([...jeans.sizes, '38']);
    await expect(addTypeSize(db, STORE_ID, jeans.id, '  ')).rejects.toThrow('Type a size.');
  });
});

describe('a new item needs both levels (section + type)', () => {
  const design = (categoryId: string, operationId: string, supplierId: string) => ({
    operationId, supplierId, categoryId, name: 'Woollen Socks', brand: 'Sock Co', sizes: ['Free'], colors: ['Grey'],
    mrpPaise: 19900, pricePaise: null, costPaise: 9900, quantityEach: 2, staffId: owner,
  });

  it('refuses a category that is not sorted yet, on every way of making items; allows it once sorted; refuses a hidden section', async () => {
    const company = await createSupplier(db, STORE_ID, { name: 'Sock Co', contactName: '', phone: '', gstin: '', notes: '' });
    const socks = await createCategory(db, STORE_ID, { name: 'Socks' });
    const needsSorting = 'Sort this category under Men, Women, Boys or Girls first (Categories).';
    await expect(createDesign(db, STORE_ID, design(socks.id, 'ns-1', company.id))).rejects.toThrow(needsSorting);
    await expect(
      createProductsBatch(db, STORE_ID, { operationId: 'ns-2', categoryId: socks.id, staffId: owner, rows: [{ name: 'Old Socks', mrpPaise: 9900, pricePaise: 9900, costPaise: null, quantity: 1 }] }),
    ).rejects.toThrow(needsSorting);
    await expect(
      createProduct(db, STORE_ID, { name: 'One Sock', brand: 'B', category: 'Socks', categoryId: socks.id, size: 'Free', color: 'Grey', mrpPaise: 9900, pricePaise: 9900, costPaise: null, openingStock: 1, createdBy: owner }),
    ).rejects.toThrow(needsSorting);
    expect(await listProducts(db, STORE_ID, { categoryId: socks.id })).toEqual([]);

    // Sorted under Men: all three ways work.
    const men = (await listSections(db, STORE_ID)).sections.find((s) => s.name === 'Men')!;
    await updateCategory(db, STORE_ID, socks.id, { name: 'Socks', code: socks.code, active: true, sectionId: men.id });
    const made = await createDesign(db, STORE_ID, design(socks.id, 'ns-3', company.id));
    expect(made.products).toHaveLength(1);
    await createProductsBatch(db, STORE_ID, { operationId: 'ns-4', categoryId: socks.id, staffId: owner, rows: [{ name: 'Old Socks', mrpPaise: 9900, pricePaise: 9900, costPaise: null, quantity: 1 }] });
    await createProduct(db, STORE_ID, { name: 'One Sock', brand: 'B', category: 'Socks', categoryId: socks.id, size: 'Free', color: 'Grey', mrpPaise: 9900, pricePaise: 9900, costPaise: null, openingStock: 1, createdBy: owner });
    expect(await listProducts(db, STORE_ID, { categoryId: socks.id })).toHaveLength(3);

    // A hidden section takes no new items (its items and types stay).
    await updateSection(db, STORE_ID, men.id, { name: 'Men', active: false });
    await expect(createDesign(db, STORE_ID, { ...design(socks.id, 'ns-5', company.id), name: 'Other Socks' })).rejects.toThrow('This section is hidden. Bring it back in Categories first.');
    expect(await listProducts(db, STORE_ID, { categoryId: socks.id })).toHaveLength(3);
  });

  it('items made before sections keep working: more pieces, edits and moving them to another category', async () => {
    await likeTheLiveShop();
    const kurta = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!;
    const [item] = await listProducts(db, STORE_ID, { categoryId: kurta.id });
    const before = item.stock;
    await receiveStock(db, STORE_ID, { operationId: 'old-ok-1', staffId: owner, lines: [{ productId: item.id, quantity: 3 }] });
    expect((await listProducts(db, STORE_ID, { categoryId: kurta.id })).find((p) => p.id === item.id)?.stock).toBe(before + 3);
    const saree = (await listCategories(db, STORE_ID)).find((c) => c.code === 'SA')!;
    expect(await bulkUpdateProducts(db, STORE_ID, [item.id], { kind: 'category', categoryId: saree.id })).toBe(1);
    // But no new item in an unsorted category.
    await expect(
      createProductsBatch(db, STORE_ID, { operationId: 'old-ok-2', categoryId: kurta.id, staffId: owner, rows: [{ name: 'New Kurta', mrpPaise: 9900, pricePaise: 9900, costPaise: null, quantity: 1 }] }),
    ).rejects.toThrow(/Sort this category/);
  });
});

describe('Categories → Move under… (moveType)', () => {
  it('puts an unsorted category under a section; code, sizes and items stay; a hidden section or a taken name is refused', async () => {
    const { sections: list, unsorted } = await listSections(db, STORE_ID);
    const women = list.find((s) => s.name === 'Women')!;
    const boys = list.find((s) => s.name === 'Boys')!;
    const material = unsorted.find((t) => t.name === 'Dress Material')!;
    const before = (await listCategories(db, STORE_ID)).find((c) => c.id === material.id)!;

    const moved = await moveType(db, STORE_ID, material.id, women.id);
    expect(moved.section.name).toBe('Women');
    expect([moved.type.code, moved.type.sizes, moved.type.active]).toEqual([before.code, before.sizes, before.active]);
    const after = await listSections(db, STORE_ID);
    expect(after.unsorted).toEqual([]);
    expect(names(after, 'Women')).toContain('Dress Material');
    expect(await unsortedCount(db, STORE_ID)).toBe(0);
    // Again to the same place: nothing to do.
    expect((await moveType(db, STORE_ID, material.id, women.id)).type.sectionId).toBe(women.id);

    // A sorted category can be moved too (Women › Dress Material → Boys).
    expect((await moveType(db, STORE_ID, material.id, boys.id)).type.sectionId).toBe(boys.id);
    // Women already has a Dress: a Boys › Dress cannot go there.
    const boysDress = await createType(db, STORE_ID, { sectionId: boys.id, name: 'Dress', sizes: [] });
    await expect(moveType(db, STORE_ID, boysDress.id, women.id)).rejects.toThrow(/already exists/);
    // Hidden section: bring it back first.
    await updateSection(db, STORE_ID, boys.id, { name: 'Boys', active: false });
    await expect(moveType(db, STORE_ID, material.id, boys.id)).rejects.toThrow(/hidden/);
    await expect(moveType(db, STORE_ID, material.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(/Choose Men/);
    await expect(moveType(db, STORE_ID, '00000000-0000-0000-0000-000000000000', women.id)).rejects.toThrow(/not found/);
  });
});
