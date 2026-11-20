// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { companyPeriod } from '@/lib/company-period';
import { createSupplier, listCategories, listSuppliers, updateSupplier } from './catalog';
import { addPayment, billKey, companyReport, companySummaries } from './company';
import { createDesign, listProducts, receiveStock, updateDesignRates } from './products';
import { listStaff } from './staff';

/** Company accounts (2026-11-20): bills by number, amounts from the price on the day, payments, dues, the period. */
let db: Db;
let owner: string;
let supplierId: string;
let kurtaId: string;
let jeansId: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
  supplierId = (await createSupplier(db, STORE_ID, { name: 'Surat Silks', contactName: '', phone: '', gstin: '', notes: '', location: ' Surat ' })).id;
  const cats = await listCategories(db, STORE_ID);
  kurtaId = cats.find((c) => c.code === 'KU')!.id;
  jeansId = cats.find((c) => c.code === 'JE')!.id;
});

const design = (over: Partial<Parameters<typeof createDesign>[2]> = {}) => ({
  operationId: `acc-${Math.random()}`,
  supplierId,
  categoryId: kurtaId,
  name: 'Chikan Kurta',
  brand: '',
  sizes: ['M', 'L'],
  colors: [] as string[],
  mrpPaise: 129900,
  pricePaise: null,
  costPaise: 50000,
  quantityEach: 2,
  staffId: owner,
  ...over,
});

describe('billKey', () => {
  it('groups by bill number in any letter case; a delivery without a number is its own bill', () => {
    expect(billKey('r1', ' INV-7 ')).toBe(billKey('r2', 'inv-7'));
    expect(billKey('r1', '')).toBe('r:r1');
    expect(billKey('r1', null)).not.toBe(billKey('r2', null));
  });
});

describe('companyReport', () => {
  it('bills, pieces, items, collections and the amount from the purchase price on the day', async () => {
    // Bill INV-1: two deliveries (a design and a restock), 2 × 2 kurtas at ₹500 + 3 more at ₹500.
    const first = await createDesign(db, STORE_ID, design({ billNumber: 'INV-1', stockDate: '2026-11-02' }));
    await receiveStock(db, STORE_ID, { operationId: 'rs-1', supplierId, billNumber: 'inv-1', lines: [{ productId: first.products[0].id, quantity: 3 }], staffId: owner });
    // Bill INV-2: jeans, 1 × 2 sizes at ₹700.
    await createDesign(db, STORE_ID, design({ billNumber: 'INV-2', categoryId: jeansId, name: 'Slim Jeans', mrpPaise: 199900, costPaise: 70000, quantityEach: 1, stockDate: '2026-11-10' }));
    // The purchase price goes up afterwards: old bills keep the old amount.
    await updateDesignRates(db, STORE_ID, first.products[0].id, { mrpPaise: 129900, pricePaise: null, costPaise: 90000 });

    const r = await companyReport(db, STORE_ID, supplierId, { amounts: true });
    expect(r.totals).toMatchObject({ bills: 2, openBills: 2, closedBills: 0, pieces: 9, items: 4, designs: 2, types: 2, estimated: false });
    expect(r.totals.amountPaise).toBe(7 * 50000 + 2 * 70000);
    const inv1 = r.bills.find((b) => b.billNumber === 'INV-1')!;
    expect(inv1.receiptIds).toHaveLength(2);
    expect(inv1).toMatchObject({ date: '2026-11-02', pieces: 7, items: 2, amountPaise: 350000, paidPaise: 0, duePaise: 350000, status: 'open' });
    expect(r.bills[0].billNumber).toBe('INV-2'); // newest first
    expect(r.months.map((m) => [m.month, m.bills, m.pieces])).toEqual([['2026-11', 2, 9]]);
    expect(r.types.map((t) => [t.type, t.pieces, t.amountPaise])).toEqual([
      ['Kurta', 7, 350000],
      ['Jeans', 2, 140000],
    ]);
    expect(r.account).toMatchObject({ purchasesPaise: 490000, paidPaise: 0, duePaise: 490000, bills: 2, openBills: 2, firstDate: '2026-11-02', lastDate: '2026-11-10' });
  });

  it('payments naming a bill close it; others sit on the account; dues = purchases − payments', async () => {
    await createDesign(db, STORE_ID, design({ billNumber: 'INV-1', stockDate: '2026-11-02' })); // ₹2000
    await createDesign(db, STORE_ID, design({ billNumber: 'INV-2', name: 'Anarkali', stockDate: '2026-11-05' })); // ₹2000
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 150000, billNumber: 'inv-1', paidOn: '2026-11-06', staffId: owner });
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 50000, billNumber: 'INV-1', paidOn: '2026-11-07', staffId: owner });
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 30000, paidOn: '2026-11-08', note: 'advance', staffId: owner });

    const r = await companyReport(db, STORE_ID, supplierId, { amounts: true });
    expect(r.bills.map((b) => [b.billNumber, b.status, b.paidPaise, b.duePaise])).toEqual([
      ['INV-2', 'open', 0, 200000],
      ['INV-1', 'closed', 200000, 0],
    ]);
    expect(r.totals).toMatchObject({ bills: 2, openBills: 1, closedBills: 1, paidPaise: 230000 });
    expect(r.account).toMatchObject({ purchasesPaise: 400000, paidPaise: 230000, duePaise: 170000, openBills: 1 });
    expect(r.payments.map((p) => [p.paidOn, p.amountPaise, p.status])).toEqual([
      ['2026-11-08', 30000, 'account'],
      ['2026-11-07', 50000, 'bill'],
      ['2026-11-06', 150000, 'bill'],
    ]);
  });

  it('the period limits bills and payments by day; dues stay all-time', async () => {
    await createDesign(db, STORE_ID, design({ billNumber: 'OLD', stockDate: '2026-09-15' }));
    await createDesign(db, STORE_ID, design({ billNumber: 'NEW', name: 'Anarkali', stockDate: '2026-11-15' }));
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 100000, billNumber: 'OLD', paidOn: '2026-09-20', staffId: owner });

    const period = companyPeriod({ period: 'custom', from: '2026-11-01', to: '2026-11-30' }, '2026-11-20');
    const r = await companyReport(db, STORE_ID, supplierId, { amounts: true, period });
    expect(r.bills.map((b) => b.billNumber)).toEqual(['NEW']);
    expect(r.totals).toMatchObject({ bills: 1, amountPaise: 200000, paidPaise: 0 });
    expect(r.payments).toHaveLength(0);
    expect(r.account).toMatchObject({ purchasesPaise: 400000, paidPaise: 100000, duePaise: 300000, bills: 2 });
  });

  it('old deliveries without a price snapshot are estimated from today’s price; no price = noPrice', async () => {
    const made = await createDesign(db, STORE_ID, design({ billNumber: 'B1', costPaise: null }));
    let r = await companyReport(db, STORE_ID, supplierId, { amounts: true });
    expect(r.bills[0]).toMatchObject({ amountPaise: 0, status: 'noPrice', estimated: false });
    // A price set later counts as an estimate for that old delivery.
    await updateDesignRates(db, STORE_ID, made.products[0].id, { mrpPaise: 129900, pricePaise: null, costPaise: 40000 });
    r = await companyReport(db, STORE_ID, supplierId, { amounts: true });
    expect(r.bills[0]).toMatchObject({ amountPaise: 160000, status: 'open', estimated: true });
    expect(r.totals.estimated).toBe(true);
  });

  it('hides every amount from people without the purchase-price right', async () => {
    await createDesign(db, STORE_ID, design({ billNumber: 'B1' }));
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 1000, staffId: owner });
    const r = await companyReport(db, STORE_ID, supplierId, { amounts: false });
    expect(r.totals.amountPaise).toBeNull();
    expect(r.totals.paidPaise).toBeNull();
    expect(r.account.duePaise).toBeNull();
    expect(r.bills[0].amountPaise).toBeNull();
    expect(r.bills[0].lines[0].amountPaise).toBeNull();
    expect(r.totals.pieces).toBe(4);
  });
});

describe('addPayment', () => {
  it('refuses a bad amount or a future day; defaults the day to today and trims the bill number', async () => {
    await expect(addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 0, staffId: owner })).rejects.toThrow(/amount/);
    await expect(addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 12.5, staffId: owner })).rejects.toThrow(/amount/);
    await expect(addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 100, paidOn: '2999-01-01', staffId: owner })).rejects.toThrow(/date/);
    const made = await addPayment(db, STORE_ID, { operationId: 'pay-once', supplierId, amountPaise: 100, billNumber: '  inv-9 ', staffId: owner });
    expect(made.paidOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(made.billNumber).toBe('inv-9');
    // The same tap again (retried request): one payment, the first one back.
    const again = await addPayment(db, STORE_ID, { operationId: 'pay-once', supplierId, amountPaise: 100, staffId: owner });
    expect(again).toMatchObject({ id: made.id, duplicate: true });
    expect((await companyReport(db, STORE_ID, supplierId, { amounts: true })).payments).toHaveLength(1);
  });
});

describe('company location and the list', () => {
  it('keeps the location; summaries carry bills, pieces, purchases and dues', async () => {
    const supplier = (await listSuppliers(db, STORE_ID)).find((s) => s.id === supplierId)!;
    expect(supplier.location).toBe('Surat');
    await updateSupplier(db, STORE_ID, supplierId, { name: 'Surat Silks', contactName: '', phone: '', gstin: '', notes: '', location: '', active: true });
    expect((await listSuppliers(db, STORE_ID)).find((s) => s.id === supplierId)!.location).toBeNull();

    await createDesign(db, STORE_ID, design({ billNumber: 'B1' }));
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 50000, staffId: owner });
    const summary = (await companySummaries(db, STORE_ID, { amounts: true })).get(supplierId)!;
    expect(summary).toMatchObject({ bills: 1, pieces: 4, amountPaise: 200000, duePaise: 150000 });
    expect((await companySummaries(db, STORE_ID, { amounts: false })).get(supplierId)!.duePaise).toBeNull();
    expect((await listProducts(db, STORE_ID, { supplierId })).length).toBe(2);
  });
});
