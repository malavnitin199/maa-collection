// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { createSupplier, listCategories } from './catalog';
import { cleanStockDate, createDesign, listProducts } from './products';
import { listStaff } from './staff';

/** Plan v19 task 03a: the step-by-step New item saves through `createDesign` — pieces per size, a stock date, no colour, an empty brand. */
let db: Db;
let owner: string;
let supplierId: string;
let kurtaId: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
  supplierId = (await createSupplier(db, STORE_ID, { name: 'Wizard Mills', contactName: '', phone: '', gstin: '', notes: '' })).id;
  kurtaId = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!.id;
});

const base = () => ({
  operationId: `wiz-${Math.random()}`,
  supplierId,
  categoryId: kurtaId,
  name: 'Chikan Kurta',
  brand: '',
  sizes: ['M', 'L', 'XL'],
  colors: [] as string[],
  mrpPaise: 129900,
  pricePaise: null,
  costPaise: 70000,
  quantityEach: 1,
  staffId: owner,
});

describe('createDesign for the step-by-step New item', () => {
  it('pieces per size (2 × M, 2 × L, 5 × XL), one item per size with an empty colour and an empty brand', async () => {
    const result = await createDesign(db, STORE_ID, { ...base(), quantities: { M: 2, l: 2, XL: 5 } });
    expect(result.duplicate).toBe(false);
    expect(result.products).toHaveLength(3);
    const rows = await listProducts(db, STORE_ID, { categoryId: kurtaId });
    const mine = rows.filter((p) => p.name === 'Chikan Kurta').sort((a, b) => a.size.localeCompare(b.size));
    expect(mine.map((p) => [p.size, p.color, p.brand, p.stock])).toEqual([
      ['L', '', '', 2],
      ['M', '', '', 2],
      ['XL', '', '', 5],
    ]);
    expect(result.receipt.stockDate).toBeNull();
    // Same operation again: the first receipt, nothing added.
    const again = await createDesign(db, STORE_ID, { ...base(), operationId: result.receipt.operationId, quantities: { M: 2, L: 2, XL: 5 } });
    expect(again.duplicate).toBe(true);
    expect(again.receipt.id).toBe(result.receipt.id);
  });

  it('a size left out of the pieces list gets the default; bad pieces are refused', async () => {
    const result = await createDesign(db, STORE_ID, { ...base(), quantityEach: 3, quantities: { M: 1 } });
    const stock = Object.fromEntries(result.products.map((p) => [p.size, p.stock]));
    expect(stock).toEqual({ M: 1, L: 3, XL: 3 });
    await expect(createDesign(db, STORE_ID, { ...base(), quantities: { M: -1 } })).rejects.toThrow(/0 or more/);
    await expect(createDesign(db, STORE_ID, { ...base(), quantities: { M: 1.5 } })).rejects.toThrow(/0 or more/);
  });

  it('keeps the bill\'s stock date; a wrong or future date is refused', async () => {
    const result = await createDesign(db, STORE_ID, { ...base(), stockDate: '2026-11-01' });
    expect(result.receipt.stockDate).toBe('2026-11-01');
    await expect(createDesign(db, STORE_ID, { ...base(), stockDate: '2026-02-31' })).rejects.toThrow(/valid stock date/);
    await expect(createDesign(db, STORE_ID, { ...base(), stockDate: '2999-01-01' })).rejects.toThrow(/after today/);
    expect(cleanStockDate('', '2026-11-19')).toBeNull();
    expect(cleanStockDate(' 2026-11-19 ', '2026-11-19')).toBe('2026-11-19');
    expect(() => cleanStockDate('2026-11-20', '2026-11-19')).toThrow(/after today/);
    expect(() => cleanStockDate('1999-12-31', '2026-11-19')).toThrow(/valid stock date/);
    expect(() => cleanStockDate('19-11-2026', '2026-11-19')).toThrow(/valid stock date/);
  });

  it('the old form still works as before: colours given, brand given', async () => {
    const result = await createDesign(db, STORE_ID, { ...base(), brand: 'Libas', colors: ['Blue', 'Red'], quantityEach: 2 });
    expect(result.products).toHaveLength(6);
    expect(new Set(result.products.map((p) => p.color))).toEqual(new Set(['Blue', 'Red']));
    expect(result.products.every((p) => p.brand === 'Libas' && p.stock === 2)).toBe(true);
  });
});
