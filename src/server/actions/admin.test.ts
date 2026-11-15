// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPgliteDb, getDb, type Db } from '@/db/client';
import { products } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { sizeFieldName } from '@/lib/size-prices';
import { requirePermission, type CurrentStaff } from '@/server/auth';
import { createSupplier, listCategories } from '@/server/services/catalog';
import { listStaff } from '@/server/services/staff';
import { createDesignAction, updateDesignRatesAction } from './admin';

// The actions run as a chosen person against an in-memory database.
vi.mock('@/server/auth', () => ({ requirePermission: vi.fn(), requireAdmin: vi.fn() }));
vi.mock('@/db/client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/db/client')>()), getDb: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
// Messages in English (the person's language comes from the request in the app).
vi.mock('@/server/i18n', async (importOriginal) => {
  const { tEnglish } = await import('@/lib/i18n');
  return { ...(await importOriginal<typeof import('@/server/i18n')>()), getT: async () => tEnglish };
});

let db: Db;
let owner: CurrentStaff;
let catalogPerson: CurrentStaff;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  vi.mocked(getDb).mockResolvedValue(db);
  const people = await listStaff(db, STORE_ID);
  const pick = (name: string, permissions: string[]): CurrentStaff => {
    const p = people.find((s) => s.name === name)!;
    return { id: p.id, name: p.name, role: p.role, permissions };
  };
  owner = pick('Owner', []);
  catalogPerson = pick('Nitin', ['catalog', 'prices']); // no "costs" right
});

async function designInput(name: string) {
  const supplier = await createSupplier(db, STORE_ID, { name: `Co ${name}`, contactName: '', phone: '', gstin: '', notes: '' });
  const category = (await listCategories(db, STORE_ID)).find((c) => c.code === 'SH')!;
  return {
    operationId: `op-${name}`, supplierId: supplier.id, categoryId: category.id, name, brand: 'XYZ',
    sizes: ['M', 'L', 'XL'], colors: ['Black', 'White'], mrp: '700', price: '500', cost: '300', quantityEach: '1', billNumber: '',
    sizeRates: [
      { size: 'L', mrp: '', price: '550', cost: '330' },
      { size: 'XL', mrp: '750', price: '600', cost: '360' },
      { size: 'M', mrp: '', price: '', cost: '' }, // nothing of its own
    ],
  };
}

const rows = (name: string) => db.select().from(products).where(eq(products.name, name)).orderBy(products.sku);
const bySize = (list: { size: string; color: string; mrpPaise: number; pricePaise: number; costPaise: number | null }[]) =>
  Object.fromEntries(list.map((p) => [`${p.color} ${p.size}`, [p.mrpPaise, p.pricePaise, p.costPaise]]));

describe('new design with prices by size (server action)', () => {
  it('owner: rupees become paise, every colour of a size gets its prices', async () => {
    vi.mocked(requirePermission).mockResolvedValue(owner);
    const result = await createDesignAction(await designInput('Owner Shirt'));
    expect(result).toMatchObject({ ok: true, created: 6 });
    expect(bySize(await rows('Owner Shirt'))).toEqual({
      'Black M': [70000, 50000, 30000], 'Black L': [70000, 55000, 33000], 'Black XL': [75000, 60000, 36000],
      'White M': [70000, 50000, 30000], 'White L': [70000, 55000, 33000], 'White XL': [75000, 60000, 36000],
    });
  });

  it('without the "costs" right, purchase prices sent anyway are not saved (default or by size)', async () => {
    vi.mocked(requirePermission).mockResolvedValue(catalogPerson);
    const result = await createDesignAction(await designInput('Nitin Shirt'));
    expect(result).toMatchObject({ ok: true, created: 6 });
    const saved = await rows('Nitin Shirt');
    expect(saved.every((p) => p.costPaise === null)).toBe(true);
    expect(saved.filter((p) => p.size === 'XL').map((p) => [p.mrpPaise, p.pricePaise])).toEqual([[75000, 60000], [75000, 60000]]);
  });

  it('bad rupee text names the size', async () => {
    vi.mocked(requirePermission).mockResolvedValue(owner);
    const input = await designInput('Bad Shirt');
    const result = await createDesignAction({ ...input, sizeRates: [{ size: 'XL', mrp: '', price: '6,00.5x', cost: '' }] });
    expect(result).toEqual({ ok: false, error: 'Size XL: enter a valid selling price in rupees.' });
    expect(await rows('Bad Shirt')).toHaveLength(0);
  });
});

describe('rates by size on the product page (server action)', () => {
  function rateForm(fields: Record<string, string>, sizes: Record<string, { mrp?: string; price?: string; cost?: string }>) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    for (const [size, own] of Object.entries(sizes)) {
      form.append('rateSize', size);
      for (const field of ['mrp', 'price', 'cost'] as const) form.set(sizeFieldName(field, size), own[field] ?? '');
    }
    return form;
  }

  it('changes one size; without "costs" the purchase prices stay as they were', async () => {
    vi.mocked(requirePermission).mockResolvedValue(owner);
    await createDesignAction(await designInput('Rates Shirt'));
    const [first] = await rows('Rates Shirt');

    vi.mocked(requirePermission).mockResolvedValue(catalogPerson);
    const state = await updateDesignRatesAction(
      first.id,
      {},
      rateForm({ mrp: '700', price: '500', cost: '1' }, { M: {}, L: { price: '520', cost: '1' }, XL: { mrp: '750', price: '600', cost: '1' } }),
    );
    expect(state).toEqual({ message: 'Rates updated for 6 items.' });
    expect(bySize(await rows('Rates Shirt'))).toEqual({
      'Black M': [70000, 50000, 30000], 'Black L': [70000, 52000, 33000], 'Black XL': [75000, 60000, 36000],
      'White M': [70000, 50000, 30000], 'White L': [70000, 52000, 33000], 'White XL': [75000, 60000, 36000],
    });
  });
});
