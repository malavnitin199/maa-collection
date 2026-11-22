// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { categories, sections } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { listCategories } from './catalog';
import { deleteProducts } from './delete-products';
import { createDesign } from './products';
import { collectionsOverview, createSection, createType, deleteSection, ensureFixedSection, listSections, newItemSections, renameSection, updateSection } from './sections';
import { listStaff } from './staff';

/** Home → Collections (owner, 2026-11-22, ADR-051): rename, items in each, delete only when empty. Company optional on items. */
let db: Db;
let owner: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
});

describe('collections', () => {
  it('counts items and pieces; renames; deletes only once no item is left (its empty categories go too)', async () => {
    const box = await createSection(db, STORE_ID, { name: 'Box' });
    const type = await createType(db, STORE_ID, { sectionId: box.id, name: 'Sando', sizes: '75, 80' });
    // No company (optional since ADR-051).
    const { products } = await createDesign(db, STORE_ID, {
      operationId: `c-${Math.random()}`,
      supplierId: null,
      categoryId: type.id,
      name: 'Boys Sando',
      brand: '',
      sizes: ['75', '80'],
      colors: [],
      mrpPaise: 5000,
      pricePaise: null,
      costPaise: null,
      quantityEach: 4,
      staffId: owner,
    });
    expect(products.map((p) => p.supplierId)).toEqual([null, null]);
    const row = (await collectionsOverview(db, STORE_ID)).find((r) => r.id === box.id);
    expect(row).toMatchObject({ name: 'Box', categories: 1, items: 2, pieces: 8 });

    expect((await renameSection(db, STORE_ID, box.id, '  Boxes ')).name).toBe('Boxes');
    await expect(deleteSection(db, STORE_ID, box.id)).rejects.toThrow(/still has 2 items/);

    await deleteProducts(db, STORE_ID, products.map((p) => p.id));
    expect(await deleteSection(db, STORE_ID, box.id)).toEqual({ name: 'Boxes', categories: 1 });
    expect((await collectionsOverview(db, STORE_ID)).some((r) => r.id === box.id)).toBe(false);
    expect((await listCategories(db, STORE_ID)).some((c) => c.id === type.id)).toBe(false);
  });
});

/** Owner, 2026-11-22 (ADR-064): Men and Women are fixed — always there, never deleted, renamed or hidden. */
describe('Men and Women are fixed', () => {
  const byName = async (name: string) => (await listSections(db, STORE_ID)).sections.find((s) => s.name === name)!;

  it('cannot be deleted (even when empty), renamed or hidden; the Hindi name, picture and letter case may change', async () => {
    const men = await byName('Men');
    const women = await byName('Women');
    expect([men.fixed, women.fixed, (await byName('Boys')).fixed]).toEqual(['men', 'women', null]);
    await expect(deleteSection(db, STORE_ID, men.id)).rejects.toThrow('Men always stays. It cannot be deleted, renamed or hidden.');
    await expect(renameSection(db, STORE_ID, women.id, 'Ladies')).rejects.toThrow('Women always stays.');
    await expect(updateSection(db, STORE_ID, men.id, { name: 'Gents', active: true })).rejects.toThrow('Men always stays.');
    await expect(updateSection(db, STORE_ID, men.id, { name: 'Men', active: false })).rejects.toThrow('Men always stays.');
    const kept = await updateSection(db, STORE_ID, men.id, { name: 'men', nameHi: 'पुरुष', icon: 'man', active: true });
    expect([kept.name, kept.nameHi, kept.icon, kept.active]).toEqual(['men', 'पुरुष', 'man', true]);

    // An empty Women is still refused; an empty Boys goes (the ADR-051 rule).
    await db.update(categories).set({ sectionId: null }).where(eq(categories.sectionId, women.id));
    await expect(deleteSection(db, STORE_ID, women.id)).rejects.toThrow('Women always stays.');
    const boys = await byName('Boys');
    await db.update(categories).set({ sectionId: null }).where(eq(categories.sectionId, boys.id));
    expect((await deleteSection(db, STORE_ID, boys.id)).name).toBe('Boys');
  });

  it('one the shop lacks is shown anyway and made by the tap that picks it: Women right after Men, Hindi name, the others keep their order', async () => {
    // Like the live shop (2026-11-22): Women was deleted before it was fixed.
    const women = await byName('Women');
    await db.update(categories).set({ sectionId: null }).where(eq(categories.sectionId, women.id));
    await db.delete(sections).where(eq(sections.id, women.id));
    await createSection(db, STORE_ID, { name: 'Kids' });

    const tiles = await newItemSections(db, STORE_ID, 'en');
    expect(tiles.map((s) => [s.name, s.standIn ?? false])).toEqual([['Men', false], ['Women', true], ['Boys', false], ['Girls', false], ['Kids', false]]);
    expect(tiles[1]).toMatchObject({ id: 'fixed:women', fixed: 'women', items: 0, types: [], icon: 'woman' });
    expect((await newItemSections(db, STORE_ID, 'hi'))[1].name).toBe('महिला');
    expect((await collectionsOverview(db, STORE_ID)).map((r) => r.name)).toEqual(['Men', 'Women', 'Boys', 'Girls', 'Kids']);
    expect(await listSections(db, STORE_ID).then((l) => l.sections.map((s) => s.name))).toEqual(['Men', 'Boys', 'Girls', 'Kids']); // nothing written by reading

    const made = await ensureFixedSection(db, STORE_ID, 'women');
    expect([made.name, made.nameHi, made.icon, made.active]).toEqual(['Women', 'महिला', 'woman', true]);
    expect((await listSections(db, STORE_ID)).sections.map((s) => [s.name, s.sort])).toEqual([['Men', 1], ['Women', 2], ['Boys', 3], ['Girls', 4], ['Kids', 5]]);
    expect((await ensureFixedSection(db, STORE_ID, 'women')).id).toBe(made.id); // once only
    expect((await newItemSections(db, STORE_ID, 'en')).some((s) => s.standIn)).toBe(false);
  });

  it('a hidden one (from before ADR-064) is shown and brought back with its categories', async () => {
    const women = await byName('Women');
    await db.update(sections).set({ active: false }).where(eq(sections.id, women.id));
    const tiles = await newItemSections(db, STORE_ID, 'en');
    expect(tiles.find((s) => s.fixed === 'women')).toMatchObject({ standIn: true });
    const back = await ensureFixedSection(db, STORE_ID, 'women');
    expect([back.id, back.active]).toEqual([women.id, true]);
    const shown = (await newItemSections(db, STORE_ID, 'en')).find((s) => s.fixed === 'women')!;
    expect(shown.standIn).toBeUndefined();
    expect(shown.types.length).toBe(women.types.filter((x) => x.active).length);
  });
});
