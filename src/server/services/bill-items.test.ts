// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { billsSummary, createBill, deleteBill, getBill, listBills, updateBill } from './bills';
import { createSupplier, listCategories } from './catalog';
import { deleteProducts } from './delete-products';
import { createDesign, saveDesign } from './products';
import { listStaff } from './staff';

/** A bill stands on its own (owner, 2026-11-22, ADR-060): with no company, made from the shop's items. */
let db: Db;
let owner: string;
let typeId: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
  typeId = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!.id;
});

const design = (name: string, costPaise: number | null = 40000) =>
  createDesign(db, STORE_ID, {
    operationId: `d-${Math.random()}`,
    supplierId: null,
    categoryId: typeId,
    name,
    brand: '',
    sizes: ['M', 'L'],
    colors: [],
    mrpPaise: 100000,
    pricePaise: null,
    costPaise,
    quantityEach: 3,
    staffId: owner,
  });
const op = () => `b-${Math.random()}`;

describe('a bill made from items', () => {
  it('has no company: each line is quantity × the purchase price; its total, nothing owed', async () => {
    const made = await design('Bill Kurta');
    const [m, l] = made.products;
    const { id } = await createBill(db, STORE_ID, {
      operationId: op(),
      billNumber: 'ST-1',
      billDate: '2026-11-20',
      companies: [],
      receiptIds: [],
      items: [{ productId: m.id, quantity: 2 }, { productId: l.id, quantity: 1 }, { productId: m.id, quantity: 1 }],
      staffId: owner,
    });
    const bill = (await getBill(db, STORE_ID, id))!;
    expect(bill.companies).toEqual([]);
    expect(bill.itemLines.map((x) => [x.name, x.size, x.qty, x.ratePaise, x.amountPaise])).toEqual([
      ['Bill Kurta', 'M', 3, 40000, 120000], // the same item twice = one line
      ['Bill Kurta', 'L', 1, 40000, 40000],
    ]);
    expect([bill.totalPaise, bill.duePaise, bill.status, bill.items, bill.pieces, bill.collections]).toEqual([160000, 0, 'record', 2, 4, 0]);
    // Stock is not touched: the items are already in the shop.
    expect(made.products.map((p) => p.stock)).toEqual([3, 3]);
    // No dues on Home; no company's list shows it.
    expect(await billsSummary(db, STORE_ID)).toMatchObject({ open: 0, duePaise: 0 });
  });

  it('keeps its own copy: renaming, repricing or deleting the items later changes nothing on it', async () => {
    const made = await design('Copy Kurta');
    const [m] = made.products;
    const { id } = await createBill(db, STORE_ID, { operationId: op(), companies: [], receiptIds: [], items: [{ productId: m.id, quantity: 2 }], staffId: owner });
    const before = (await getBill(db, STORE_ID, id))!;
    await saveDesign(db, STORE_ID, m.id, { name: 'Renamed Kurta', costPaise: 99900, items: { [m.id]: { size: 'S' } }, staffId: owner });
    expect((await getBill(db, STORE_ID, id))!.itemLines).toEqual(before.itemLines);
    await deleteProducts(db, STORE_ID, made.products.map((p) => p.id));
    const after = (await getBill(db, STORE_ID, id))!;
    expect(after.itemLines.map((x) => [x.name, x.size, x.qty, x.ratePaise, x.amountPaise, x.productId])).toEqual([['Copy Kurta', 'M', 2, 40000, 80000, null]]);
    expect(after.totalPaise).toBe(before.totalPaise);
  });

  it('an item with no purchase price: rate N/A (null), amount 0', async () => {
    const made = await design('No Price Kurta', null);
    const { id } = await createBill(db, STORE_ID, { operationId: op(), companies: [], receiptIds: [], items: [{ productId: made.products[0].id, quantity: 5 }], staffId: owner });
    expect((await getBill(db, STORE_ID, id))!.itemLines.map((x) => [x.ratePaise, x.amountPaise])).toEqual([[null, 0]]);
  });

  it('needs a company or items, not both; quantities are whole numbers from 1; the same tap twice makes one bill', async () => {
    const made = await design('Rule Kurta');
    const company = (await createSupplier(db, STORE_ID, { name: 'Rule Co', contactName: '', phone: '', gstin: '', notes: '' })).id;
    const item = { productId: made.products[0].id, quantity: 1 };
    await expect(createBill(db, STORE_ID, { operationId: op(), companies: [], receiptIds: [], staffId: owner })).rejects.toMatchObject({ key: 'bill.err.nothing' });
    await expect(createBill(db, STORE_ID, { operationId: op(), companies: [company], receiptIds: [made.receipt.id], items: [item], staffId: owner })).rejects.toMatchObject({ key: 'bill.err.itemsNoCompany' });
    await expect(createBill(db, STORE_ID, { operationId: op(), companies: [], receiptIds: [], items: [{ ...item, quantity: 0 }], staffId: owner })).rejects.toMatchObject({ key: 'stk.err.quantity' });
    const once = op();
    const first = await createBill(db, STORE_ID, { operationId: once, companies: [], receiptIds: [], items: [item], staffId: owner });
    const again = await createBill(db, STORE_ID, { operationId: once, companies: [], receiptIds: [], items: [item], staffId: owner });
    expect(again).toEqual({ id: first.id, duplicate: true });
    expect((await listBills(db, STORE_ID)).filter((b) => b.id === first.id)).toHaveLength(1);
  });

  it('a company bill still works as before and shows on its company; an item bill edits its number, date and note, and can be deleted', async () => {
    const made = await design('Mixed Kurta');
    const company = (await createSupplier(db, STORE_ID, { name: 'List Co', contactName: '', phone: '', gstin: '', notes: '' })).id;
    const coBill = await createBill(db, STORE_ID, { operationId: op(), companies: [], receiptIds: [], items: [{ productId: made.products[0].id, quantity: 1 }], staffId: owner });
    expect((await listBills(db, STORE_ID, { supplierId: company })).map((b) => b.id)).not.toContain(coBill.id);
    await updateBill(db, STORE_ID, coBill.id, { billNumber: 'NEW-2', billDate: '2026-11-21', note: 'paper copy', companies: [] });
    expect(await getBill(db, STORE_ID, coBill.id)).toMatchObject({ billNumber: 'NEW-2', billDate: '2026-11-21', note: 'paper copy', items: 1, status: 'record' });
    await deleteBill(db, STORE_ID, coBill.id);
    expect(await getBill(db, STORE_ID, coBill.id)).toBeNull();
  });
});
