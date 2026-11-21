// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { billsSummary, createBill, deleteBill, getBill, listBills, listCollections, setBillCollections, updateBill } from './bills';
import { createSupplier, listCategories } from './catalog';
import { sheetParts } from '@/features/bills/sheet-parts';
import { addPayment } from './company';
import { createDesign } from './products';
import { listStaff } from './staff';

/** Bills section (owner's feedback 2026-11-21): bills with companies and amounts, the collections on them, dues. */
let db: Db;
let owner: string;
let surat: string;
let mumbai: string;
let kurtaId: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
  const blank = { contactName: '', phone: '', gstin: '', notes: '' };
  surat = (await createSupplier(db, STORE_ID, { ...blank, name: 'Surat Silks' })).id;
  mumbai = (await createSupplier(db, STORE_ID, { ...blank, name: 'Mumbai Mills' })).id;
  kurtaId = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!.id;
});

const collection = (supplierId: string, name: string, sizes = ['28', '30', '32', '34', '36', '38']) =>
  createDesign(db, STORE_ID, {
    operationId: `c-${Math.random()}`,
    supplierId,
    categoryId: kurtaId,
    name,
    brand: '',
    sizes,
    colors: [],
    mrpPaise: 99900,
    pricePaise: null,
    costPaise: 40000,
    quantityEach: 2,
    staffId: owner,
  });
const base = (receiptIds: string[], over: Partial<Parameters<typeof createBill>[2]> = {}) => ({
  operationId: `b-${Math.random()}`,
  billDate: '2026-11-10',
  companies: [surat],
  receiptIds,
  staffId: owner,
  ...over,
});

describe('collections', () => {
  it('one per save: names, sizes, pieces and value; the ones on no bill are "waiting"', async () => {
    const jeans = await collection(surat, 'Slim Jeans'); // 6 sizes × 2 = 12 pcs × ₹400
    await collection(mumbai, 'Cargo', ['M', 'L']);
    const waiting = await listCollections(db, STORE_ID, { unbilled: true });
    const mine = waiting.find((c) => c.receiptId === jeans.receipt.id)!;
    expect(mine).toMatchObject({ supplierName: 'Surat Silks', names: ['Slim Jeans'], items: 6, pieces: 12, valuePaise: 480000, billId: null });
    expect(mine.sizes).toEqual(['28', '30', '32', '34', '36', '38']);
    // As the paper bill: one line per name and rate, qty × rate = amount.
    expect(mine.lines).toEqual([{ name: 'Slim Jeans', sizes: ['28', '30', '32', '34', '36', '38'], pieces: 12, qty: 12, pack: null, ratePaise: 40000, amountPaise: 480000 }]);
    await createBill(db, STORE_ID, base([jeans.receipt.id]));
    expect((await listCollections(db, STORE_ID, { unbilled: true })).some((c) => c.receiptId === jeans.receipt.id)).toBe(false);
  });
});

describe('paper-bill lines (sheetParts)', () => {
  it('per company, oldest collection first; the same name and rate from two collections is one line', async () => {
    const a = await collection(surat, 'Jacket', ['M', 'L']); // 4 pcs × ₹400
    const b = await collection(surat, 'Suit', ['S']); // 2 pcs × ₹400
    const c = await collection(surat, 'Jacket', ['XL']); // 2 pcs × ₹400 — same name and rate as a
    const m = await collection(mumbai, 'Pajama', ['M']);
    const list = await listCollections(db, STORE_ID, { receiptIds: [a, b, c, m].map((x) => x.receipt.id) });
    const parts = sheetParts([{ id: surat, name: 'Surat Silks' }, { id: mumbai, name: 'Mumbai Mills' }], list);
    expect(parts.map((p) => [p.name, p.pieces, p.totalPaise])).toEqual([['Surat Silks', 8, 320000], ['Mumbai Mills', 2, 80000]]);
    expect(parts[0].lines.map((l) => [l.name, l.sizes.join(' '), l.pieces, l.ratePaise, l.amountPaise])).toEqual([
      ['Jacket', 'M L XL', 6, 40000, 240000],
      ['Suit', 'S', 2, 40000, 80000],
    ]);
  });
});

describe('createBill', () => {
  it('a bill with 3 collections: the amount is worked out from them (never typed); the bill date and the day entered', async () => {
    const made = await Promise.all([collection(surat, 'Jeans A'), collection(surat, 'Jeans B'), collection(surat, 'Jeans C')]);
    const { id } = await createBill(db, STORE_ID, base(made.map((m) => m.receipt.id), { billNumber: ' SS-101 ' }));
    const bill = (await getBill(db, STORE_ID, id))!;
    // 3 × (6 sizes × 2 pcs × ₹400) = ₹14,400.
    expect(bill).toMatchObject({ billNumber: 'SS-101', billDate: '2026-11-10', totalPaise: 1440000, paidPaise: 0, duePaise: 1440000, status: 'open', collections: 3, pieces: 36, valuePaise: 1440000 });
    expect(bill.createdOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(bill.list.map((c) => c.names[0]).sort()).toEqual(['Jeans A', 'Jeans B', 'Jeans C']);
    expect(bill.companies).toEqual([{ supplierId: surat, name: 'Surat Silks', deleted: false, amountPaise: 1440000, paidPaise: 0, duePaise: 1440000 }]);
  });

  it('several companies: each part is its own collections’ value; the total is their sum; payments close a part', async () => {
    const s1 = await collection(surat, 'Surat Jeans'); // 12 pcs × ₹400 = ₹4,800
    const m1 = await collection(mumbai, 'Mumbai Cargo', ['M', 'L']); // 4 pcs × ₹400 = ₹1,600
    const { id } = await createBill(db, STORE_ID, base([s1.receipt.id, m1.receipt.id], { companies: [surat, mumbai] }));
    await addPayment(db, STORE_ID, { operationId: `p-${Math.random()}`, supplierId: mumbai, amountPaise: 160000, billId: id, staffId: owner });
    const bill = (await getBill(db, STORE_ID, id))!;
    expect(bill.totalPaise).toBe(640000);
    expect(bill.companies.map((c) => [c.name, c.amountPaise, c.duePaise])).toEqual([
      ['Mumbai Mills', 160000, 0],
      ['Surat Silks', 480000, 480000],
    ]);
    expect(bill).toMatchObject({ paidPaise: 160000, duePaise: 480000, status: 'open', hasPayments: true });
    expect(await billsSummary(db, STORE_ID)).toEqual({ bills: 1, open: 1, duePaise: 480000 });
    expect((await listBills(db, STORE_ID, { supplierId: mumbai })).map((b) => b.id)).toEqual([id]);
  });

  it('refuses: no company, no collection, another company’s collection, a future date, a collection already on another bill; the same tap twice makes one bill', async () => {
    const c = await collection(surat, 'Taken');
    const m = await collection(mumbai, 'Theirs', ['M']);
    await expect(createBill(db, STORE_ID, base([c.receipt.id], { companies: [] }))).rejects.toMatchObject({ key: 'bill.err.company' });
    await expect(createBill(db, STORE_ID, base([]))).rejects.toMatchObject({ key: 'bill.err.noCollection' });
    await expect(createBill(db, STORE_ID, base([m.receipt.id]))).rejects.toMatchObject({ key: 'bill.err.otherCompany' });
    await expect(createBill(db, STORE_ID, base([c.receipt.id], { billDate: '2999-01-01' }))).rejects.toMatchObject({ key: 'bill.err.date' });
    await createBill(db, STORE_ID, base([c.receipt.id]));
    await expect(createBill(db, STORE_ID, base([c.receipt.id]))).rejects.toMatchObject({ key: 'bill.err.taken' });
    const free = await collection(surat, 'Free');
    const once = base([free.receipt.id]);
    const first = await createBill(db, STORE_ID, once);
    expect(await createBill(db, STORE_ID, once)).toEqual({ id: first.id, duplicate: true });
  });
});

describe('changing a bill', () => {
  it('collections added and taken off move the amount; a company added or taken off (with its collections); one with payments stays; deleting frees its collections', async () => {
    const a = await collection(surat, 'A'); // ₹4,800
    const b = await collection(surat, 'B', ['M', 'L']); // ₹1,600
    const m = await collection(mumbai, 'M1', ['M']); // ₹800
    const { id } = await createBill(db, STORE_ID, base([a.receipt.id]));
    await setBillCollections(db, STORE_ID, id, { add: [b.receipt.id], remove: [a.receipt.id] });
    expect(await getBill(db, STORE_ID, id)).toMatchObject({ totalPaise: 160000, collections: 1 });
    expect((await getBill(db, STORE_ID, id))!.list.map((c) => c.names[0])).toEqual(['B']);
    await expect(setBillCollections(db, STORE_ID, id, { add: [m.receipt.id] })).rejects.toMatchObject({ key: 'bill.err.otherCompany' });

    await updateBill(db, STORE_ID, id, { billNumber: 'NEW-1', billDate: '2026-11-01', companies: [surat, mumbai] });
    await setBillCollections(db, STORE_ID, id, { add: [m.receipt.id] });
    expect(await getBill(db, STORE_ID, id)).toMatchObject({ billNumber: 'NEW-1', billDate: '2026-11-01', totalPaise: 240000 });

    await addPayment(db, STORE_ID, { operationId: `p-${Math.random()}`, supplierId: mumbai, amountPaise: 1000, billId: id, staffId: owner });
    await expect(updateBill(db, STORE_ID, id, { billDate: '2026-11-01', companies: [surat] })).rejects.toMatchObject({ key: 'bill.err.paidCompany' });
    await expect(deleteBill(db, STORE_ID, id)).rejects.toMatchObject({ key: 'bill.err.hasPayments' });

    // Taking a company (without payments) off takes its collections off too.
    const two = await createBill(db, STORE_ID, base([a.receipt.id]));
    const n1 = await collection(mumbai, 'N1', ['L']);
    await updateBill(db, STORE_ID, two.id, { billDate: '2026-11-01', companies: [surat, mumbai] });
    await setBillCollections(db, STORE_ID, two.id, { add: [n1.receipt.id] });
    await updateBill(db, STORE_ID, two.id, { billDate: '2026-11-01', companies: [surat] });
    expect(await getBill(db, STORE_ID, two.id)).toMatchObject({ collections: 1, totalPaise: 480000 });
    await deleteBill(db, STORE_ID, two.id);

    const other = await createBill(db, STORE_ID, base([a.receipt.id]));
    await deleteBill(db, STORE_ID, other.id);
    expect(await getBill(db, STORE_ID, other.id)).toBeNull();
    expect((await listCollections(db, STORE_ID, { unbilled: true })).some((c) => c.receiptId === a.receipt.id)).toBe(true);
  });
});
