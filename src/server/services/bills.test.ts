// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { billsSummary, createBill, deleteBill, getBill, listBills, listCollections, setBillCollections, updateBill } from './bills';
import { createSupplier, listCategories } from './catalog';
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
const base = (over: Partial<Parameters<typeof createBill>[2]> = {}) => ({
  operationId: `b-${Math.random()}`,
  billDate: '2026-11-10',
  companies: [{ supplierId: surat, amountPaise: 500000 }],
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
    await createBill(db, STORE_ID, base({ receiptIds: [jeans.receipt.id] }));
    expect((await listCollections(db, STORE_ID, { unbilled: true })).some((c) => c.receiptId === jeans.receipt.id)).toBe(false);
  });
});

describe('createBill', () => {
  it('a bill with 3 collections: total typed, value of the collections beside it, the bill date and the day entered', async () => {
    const made = await Promise.all([collection(surat, 'Jeans A'), collection(surat, 'Jeans B'), collection(surat, 'Jeans C')]);
    const { id } = await createBill(db, STORE_ID, base({ billNumber: ' SS-101 ', receiptIds: made.map((m) => m.receipt.id) }));
    const bill = (await getBill(db, STORE_ID, id))!;
    expect(bill).toMatchObject({ billNumber: 'SS-101', billDate: '2026-11-10', totalPaise: 500000, paidPaise: 0, duePaise: 500000, status: 'open', collections: 3, pieces: 36, valuePaise: 1440000 });
    expect(bill.createdOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(bill.list.map((c) => c.names[0]).sort()).toEqual(['Jeans A', 'Jeans B', 'Jeans C']);
    expect(bill.companies).toEqual([{ supplierId: surat, name: 'Surat Silks', amountPaise: 500000, paidPaise: 0, duePaise: 500000 }]);
  });

  it('several companies, each with its part; the total is their sum; payments close a part', async () => {
    const { id } = await createBill(db, STORE_ID, base({ companies: [{ supplierId: surat, amountPaise: 300000 }, { supplierId: mumbai, amountPaise: 200000 }] }));
    await addPayment(db, STORE_ID, { operationId: `p-${Math.random()}`, supplierId: mumbai, amountPaise: 200000, billId: id, staffId: owner });
    const bill = (await getBill(db, STORE_ID, id))!;
    expect(bill.totalPaise).toBe(500000);
    expect(bill.companies.map((c) => [c.name, c.amountPaise, c.duePaise])).toEqual([
      ['Mumbai Mills', 200000, 0],
      ['Surat Silks', 300000, 300000],
    ]);
    expect(bill).toMatchObject({ paidPaise: 200000, duePaise: 300000, status: 'open', hasPayments: true });
    expect(await billsSummary(db, STORE_ID)).toEqual({ bills: 1, open: 1, duePaise: 300000 });
    expect((await listBills(db, STORE_ID, { supplierId: mumbai })).map((b) => b.id)).toEqual([id]);
  });

  it('refuses: no company, a zero bill, a future date, a collection already on another bill; the same tap twice makes one bill', async () => {
    await expect(createBill(db, STORE_ID, base({ companies: [] }))).rejects.toMatchObject({ key: 'bill.err.company' });
    await expect(createBill(db, STORE_ID, base({ companies: [{ supplierId: surat, amountPaise: 0 }] }))).rejects.toMatchObject({ key: 'bill.err.amount' });
    await expect(createBill(db, STORE_ID, base({ billDate: '2999-01-01' }))).rejects.toMatchObject({ key: 'bill.err.date' });
    const c = await collection(surat, 'Taken');
    await createBill(db, STORE_ID, base({ receiptIds: [c.receipt.id] }));
    await expect(createBill(db, STORE_ID, base({ receiptIds: [c.receipt.id] }))).rejects.toMatchObject({ key: 'bill.err.taken' });
    const once = base();
    const first = await createBill(db, STORE_ID, once);
    expect(await createBill(db, STORE_ID, once)).toEqual({ id: first.id, duplicate: true });
  });
});

describe('changing a bill', () => {
  it('collections added and taken off; details and amounts edited; a company with payments stays; deleting frees its collections', async () => {
    const a = await collection(surat, 'A');
    const b = await collection(surat, 'B');
    const { id } = await createBill(db, STORE_ID, base({ receiptIds: [a.receipt.id] }));
    await setBillCollections(db, STORE_ID, id, { add: [b.receipt.id], remove: [a.receipt.id] });
    expect((await getBill(db, STORE_ID, id))!.list.map((c) => c.names[0])).toEqual(['B']);

    await updateBill(db, STORE_ID, id, { billNumber: 'NEW-1', billDate: '2026-11-01', companies: [{ supplierId: surat, amountPaise: 450000 }, { supplierId: mumbai, amountPaise: 50000 }] });
    expect(await getBill(db, STORE_ID, id)).toMatchObject({ billNumber: 'NEW-1', billDate: '2026-11-01', totalPaise: 500000 });

    await addPayment(db, STORE_ID, { operationId: `p-${Math.random()}`, supplierId: mumbai, amountPaise: 1000, billId: id, staffId: owner });
    await expect(updateBill(db, STORE_ID, id, { billDate: '2026-11-01', companies: [{ supplierId: surat, amountPaise: 1 }] })).rejects.toMatchObject({ key: 'bill.err.paidCompany' });
    await expect(deleteBill(db, STORE_ID, id)).rejects.toMatchObject({ key: 'bill.err.hasPayments' });

    const other = await createBill(db, STORE_ID, base({ receiptIds: [a.receipt.id] }));
    await deleteBill(db, STORE_ID, other.id);
    expect(await getBill(db, STORE_ID, other.id)).toBeNull();
    expect((await listCollections(db, STORE_ID, { unbilled: true })).some((c) => c.receiptId === a.receipt.id)).toBe(true);
  });
});
