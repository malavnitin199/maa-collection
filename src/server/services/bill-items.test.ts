// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { billsSummary, createBill, deleteBill, getBill, listBills, updateBill, updateItemBill } from './bills';
import { addPayment } from './company';
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

  it('needs items; one company or none; items or stock entries, not both; whole quantities from 1; the same tap twice makes one bill', async () => {
    const made = await design('Rule Kurta');
    const company = (await createSupplier(db, STORE_ID, { name: 'Rule Co', contactName: '', phone: '', gstin: '', notes: '' })).id;
    const other = (await createSupplier(db, STORE_ID, { name: 'Other Co', contactName: '', phone: '', gstin: '', notes: '' })).id;
    const item = { productId: made.products[0].id, quantity: 1 };
    await expect(createBill(db, STORE_ID, { operationId: op(), companies: [], receiptIds: [], staffId: owner })).rejects.toMatchObject({ key: 'bill.err.nothing' });
    await expect(createBill(db, STORE_ID, { operationId: op(), companies: [company], receiptIds: [], staffId: owner })).rejects.toMatchObject({ key: 'bill.err.noItems' });
    await expect(createBill(db, STORE_ID, { operationId: op(), companies: [company], receiptIds: [made.receipt.id], items: [item], staffId: owner })).rejects.toMatchObject({ key: 'bill.err.mixed' });
    await expect(createBill(db, STORE_ID, { operationId: op(), companies: [company, other], receiptIds: [], items: [item], staffId: owner })).rejects.toMatchObject({ key: 'bill.err.oneCompany' });
    await expect(createBill(db, STORE_ID, { operationId: op(), companies: [], receiptIds: [], items: [{ ...item, ratePaise: -1 }], staffId: owner })).rejects.toMatchObject({ key: 'bill.err.rate' });
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
    await updateBill(db, STORE_ID, coBill.id, { billNumber: 'NEW-2', billDate: '2026-11-21', note: 'paper copy', companies: [] }); // the earlier edit: number, date, note
    expect(await getBill(db, STORE_ID, coBill.id)).toMatchObject({ billNumber: 'NEW-2', billDate: '2026-11-21', note: 'paper copy', items: 1, status: 'record' });
    await deleteBill(db, STORE_ID, coBill.id);
    expect(await getBill(db, STORE_ID, coBill.id)).toBeNull();
  });

  it('with its one company and typed rates (ADR-061): the company’s part is the lines, it is owed, its page lists it', async () => {
    const made = await design('Owed Kurta');
    const [m, l] = made.products;
    const company = (await createSupplier(db, STORE_ID, { name: 'Owed Co', contactName: '', phone: '', gstin: '', notes: '' })).id;
    const { id } = await createBill(db, STORE_ID, {
      operationId: op(),
      companies: [company],
      receiptIds: [],
      items: [{ productId: m.id, quantity: 3, ratePaise: 35000 }, { productId: l.id, quantity: 2 }], // L: its purchase price (400)
      staffId: owner,
    });
    const bill = (await getBill(db, STORE_ID, id))!;
    expect(bill.itemLines.map((x) => [x.size, x.qty, x.ratePaise, x.amountPaise])).toEqual([['M', 3, 35000, 105000], ['L', 2, 40000, 80000]]);
    expect(bill.companies.map((c) => [c.name, c.amountPaise, c.duePaise])).toEqual([['Owed Co', 185000, 185000]]);
    expect([bill.totalPaise, bill.status]).toEqual([185000, 'open']);
    expect((await listBills(db, STORE_ID, { supplierId: company })).map((b) => b.id)).toEqual([id]);
    expect(await billsSummary(db, STORE_ID)).toMatchObject({ open: 1, duePaise: 185000 });
  });

  it('Edit bill: quantities and rates change, lines go and come; a kept line keeps its copy; the company changes unless it has payments', async () => {
    const made = await design('Edit Bill Kurta');
    const [m, l] = made.products;
    const extra = (await design('Extra Kurta')).products[0];
    const first = (await createSupplier(db, STORE_ID, { name: 'First Co', contactName: '', phone: '', gstin: '', notes: '' })).id;
    const second = (await createSupplier(db, STORE_ID, { name: 'Second Co', contactName: '', phone: '', gstin: '', notes: '' })).id;
    const { id } = await createBill(db, STORE_ID, { operationId: op(), companies: [first], receiptIds: [], items: [{ productId: m.id, quantity: 1 }, { productId: l.id, quantity: 1 }], staffId: owner });
    const [mLine] = (await getBill(db, STORE_ID, id))!.itemLines;
    // The item is renamed after the bill: the kept line still says what the bill said.
    await saveDesign(db, STORE_ID, m.id, { name: 'Renamed Later', staffId: owner });
    await updateItemBill(db, STORE_ID, id, {
      billNumber: 'E-1',
      billDate: '2026-11-21',
      note: '',
      supplierId: second,
      lines: [{ lineId: mLine.id, quantity: 4, ratePaise: 30000 }, { productId: extra.id, quantity: 2, ratePaise: null }],
    });
    const after = (await getBill(db, STORE_ID, id))!;
    expect(after.itemLines.map((x) => [x.name, x.size, x.qty, x.ratePaise, x.amountPaise])).toEqual([
      ['Edit Bill Kurta', 'M', 4, 30000, 120000],
      ['Extra Kurta', 'M', 2, null, 0],
    ]);
    expect(after.companies.map((c) => [c.name, c.amountPaise])).toEqual([['Second Co', 120000]]);
    expect(after.billNumber).toBe('E-1');
    // A payment names the bill: its company can no longer be taken off.
    await addPayment(db, STORE_ID, { operationId: op(), supplierId: second, amountPaise: 10000, paidOn: '2026-11-21', billId: id, staffId: owner });
    await expect(updateItemBill(db, STORE_ID, id, { supplierId: null, lines: [{ lineId: after.itemLines[0].id, quantity: 1 }] })).rejects.toMatchObject({ key: 'bill.err.paidCompany' });
    await expect(updateItemBill(db, STORE_ID, id, { supplierId: second, lines: [] })).rejects.toMatchObject({ key: 'bill.err.noItems' });
  });

  it('a box item (ADR-047) is billed by the box: quantity in boxes, the box purchase price, pieces = boxes × box', async () => {
    const box = await createDesign(db, STORE_ID, {
      operationId: `d-${Math.random()}`,
      supplierId: null,
      categoryId: typeId,
      name: 'Box Socks',
      brand: '',
      sizes: ['Free'],
      colors: [],
      mrpPaise: 4500,
      pricePaise: null,
      costPaise: 4000,
      quantityEach: 36,
      pack: { size: 12, mrpPaise: 54000, costPaise: 50000 },
      staffId: owner,
    });
    const { id } = await createBill(db, STORE_ID, { operationId: op(), companies: [], receiptIds: [], items: [{ productId: box.products[0].id, quantity: 3 }], staffId: owner });
    const bill = (await getBill(db, STORE_ID, id))!;
    expect(bill.itemLines.map((x) => [x.pack, x.qty, x.ratePaise, x.amountPaise])).toEqual([[12, 3, 50000, 150000]]);
    expect([bill.totalPaise, bill.pieces]).toEqual([150000, 36]);
  });
});
