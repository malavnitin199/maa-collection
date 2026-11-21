// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { listCategories } from './catalog';
import { deleteProducts } from './delete-products';
import { createDesign } from './products';
import { collectionsOverview, createSection, createType, deleteSection, renameSection } from './sections';
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
