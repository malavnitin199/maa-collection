// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { companyPeriod } from '@/lib/company-period';
import { createSupplier, deleteUnusedSuppliers, listCategories, listSuppliers, updateSupplier } from './catalog';
import { createBill } from './bills';
import { addPayment, companiesOverview, companyReport, companySummaries } from './company';
import { createDesign, listProducts, receiveStock, updateDesignRates } from './products';
import { listStaff } from './staff';

/** Company accounts (2026-11-20; real bills 2026-11-21): collections and their value, bills from the Bills section, payments, dues = bill amounts − payments, the period. */
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

/** A bill from the Bills section for this company (or several); its amount is the value of its collections. */
const bill = (receiptIds: string[], over: Partial<Parameters<typeof createBill>[2]> = {}) =>
  createBill(db, STORE_ID, { operationId: `bill-${Math.random()}`, billDate: '2026-11-05', companies: [supplierId], receiptIds, staffId: owner, ...over });

describe('companyReport', () => {
  it('collections with pieces, items and value from the purchase price on the day; a delivery is not a bill', async () => {
    // Two collections of kurtas (a design and a restock), 2 × 2 + 3 at ₹500; one of jeans, 2 × ₹700.
    const first = await createDesign(db, STORE_ID, design({ billNumber: 'INV-1', stockDate: '2026-11-02' }));
    await receiveStock(db, STORE_ID, { operationId: 'rs-1', supplierId, billNumber: 'inv-1', lines: [{ productId: first.products[0].id, quantity: 3 }], staffId: owner });
    await createDesign(db, STORE_ID, design({ billNumber: 'INV-2', categoryId: jeansId, name: 'Slim Jeans', mrpPaise: 199900, costPaise: 70000, quantityEach: 1, stockDate: '2026-11-10' }));
    // The purchase price goes up afterwards: old collections keep the old value.
    await updateDesignRates(db, STORE_ID, first.products[0].id, { mrpPaise: 129900, pricePaise: null, costPaise: 90000 });

    const r = await companyReport(db, STORE_ID, supplierId, { amounts: true });
    expect(r.totals).toMatchObject({ bills: 0, collections: 3, pieces: 9, items: 4, designs: 2, types: 2, estimated: false, billedPaise: 0 });
    expect(r.totals.amountPaise).toBe(7 * 50000 + 2 * 70000);
    // The restock has no stock date: it is dated the day it was entered (today), so it comes first.
    expect(r.deliveries.map((d) => [d.refNumber, d.pieces, d.amountPaise, d.billId])).toEqual([
      ['inv-1', 3, 150000, null],
      ['INV-2', 2, 140000, null],
      ['INV-1', 4, 200000, null],
    ]);
    expect(r.deliveries.slice(1).map((d) => d.date)).toEqual(['2026-11-10', '2026-11-02']);
    expect(r.months.reduce((n, m) => n + m.collections, 0)).toBe(3);
    expect(r.types.map((t) => [t.type, t.pieces, t.amountPaise])).toEqual([
      ['Kurta', 7, 350000],
      ['Jeans', 2, 140000],
    ]);
    // No bills yet: nothing billed, nothing due.
    expect(r.account).toMatchObject({ billedPaise: 0, paidPaise: 0, duePaise: 0, bills: 0, firstDate: '2026-11-02' });
  });

  it('bills from the Bills section: payments naming a bill close this company’s part; dues = bill amounts − payments', async () => {
    const a = await createDesign(db, STORE_ID, design({ stockDate: '2026-11-02' })); // 4 pcs × ₹500 = ₹2000
    const c = await createDesign(db, STORE_ID, design({ name: 'Anarkali', quantityEach: 1, stockDate: '2026-11-08' })); // 2 pcs × ₹500 = ₹1000
    const b1 = await bill([a.receipt.id], { billNumber: 'SS-1', billDate: '2026-11-03' });
    await bill([c.receipt.id], { billNumber: 'SS-2', billDate: '2026-11-09' });
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 150000, billId: b1.id, paidOn: '2026-11-06', staffId: owner });
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 50000, billId: b1.id, paidOn: '2026-11-07', staffId: owner });
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 30000, paidOn: '2026-11-08', note: 'advance', staffId: owner });

    const r = await companyReport(db, STORE_ID, supplierId, { amounts: true });
    expect(r.bills.map((x) => [x.billNumber, x.status, x.amountPaise, x.paidPaise, x.duePaise, x.collections])).toEqual([
      ['SS-2', 'open', 100000, 0, 100000, 1],
      ['SS-1', 'paid', 200000, 200000, 0, 1],
    ]);
    expect(r.totals).toMatchObject({ bills: 2, openBills: 1, closedBills: 1, billedPaise: 300000, paidPaise: 230000 });
    expect(r.account).toMatchObject({ billedPaise: 300000, paidPaise: 230000, duePaise: 70000, openBills: 1, lastBillDate: '2026-11-09' });
    expect(r.deliveries.find((d) => d.receiptId === a.receipt.id)!.billId).toBe(b1.id);
    expect(r.payments.map((p) => [p.paidOn, p.amountPaise, p.status, p.billNumber])).toEqual([
      ['2026-11-08', 30000, 'account', null],
      ['2026-11-07', 50000, 'bill', 'SS-1'],
      ['2026-11-06', 150000, 'bill', 'SS-1'],
    ]);
  });

  it('a bill with two companies: each sees only its own part; the other company is named', async () => {
    const mills = await createSupplier(db, STORE_ID, { name: 'Mumbai Mills', contactName: '', phone: '', gstin: '', notes: '' });
    const ours = await createDesign(db, STORE_ID, design()); // ₹2000
    const theirs = await createDesign(db, STORE_ID, design({ supplierId: mills.id, name: 'Cargo', quantityEach: 1 })); // ₹1000
    await bill([ours.receipt.id, theirs.receipt.id], { billNumber: 'JOINT', companies: [supplierId, mills.id] });
    const surat = await companyReport(db, STORE_ID, supplierId, { amounts: true });
    expect(surat.bills[0]).toMatchObject({ billNumber: 'JOINT', amountPaise: 200000, totalPaise: 300000, others: ['Mumbai Mills'] });
    expect(surat.account.duePaise).toBe(200000);
    const mumbai = await companyReport(db, STORE_ID, mills.id, { amounts: true });
    expect(mumbai.account.duePaise).toBe(100000);
  });

  it('the period limits bills, collections and payments by day; dues stay all-time', async () => {
    const sept = await createDesign(db, STORE_ID, design({ stockDate: '2026-09-15' }));
    const nov = await createDesign(db, STORE_ID, design({ name: 'Anarkali', stockDate: '2026-11-15' }));
    const old = await bill([sept.receipt.id], { billNumber: 'OLD', billDate: '2026-09-15' });
    await bill([nov.receipt.id], { billNumber: 'NEW', billDate: '2026-11-15' });
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 100000, billId: old.id, paidOn: '2026-09-20', staffId: owner });

    const period = companyPeriod({ period: 'custom', from: '2026-11-01', to: '2026-11-30' }, '2026-11-20');
    const r = await companyReport(db, STORE_ID, supplierId, { amounts: true, period });
    expect(r.bills.map((x) => x.billNumber)).toEqual(['NEW']);
    expect(r.totals).toMatchObject({ bills: 1, billedPaise: 200000, collections: 1, amountPaise: 200000, paidPaise: 0 });
    expect(r.payments).toHaveLength(0);
    expect(r.account).toMatchObject({ billedPaise: 400000, paidPaise: 100000, duePaise: 300000, bills: 2 });
  });

  it('old collections without a price snapshot are estimated from today’s price', async () => {
    const made = await createDesign(db, STORE_ID, design({ costPaise: null }));
    let r = await companyReport(db, STORE_ID, supplierId, { amounts: true });
    expect(r.deliveries[0]).toMatchObject({ amountPaise: 0, estimated: false });
    await updateDesignRates(db, STORE_ID, made.products[0].id, { mrpPaise: 129900, pricePaise: null, costPaise: 40000 });
    r = await companyReport(db, STORE_ID, supplierId, { amounts: true });
    expect(r.deliveries[0]).toMatchObject({ amountPaise: 160000, estimated: true });
    expect(r.totals.estimated).toBe(true);
  });

  it('hides every amount from people without the purchase-price right', async () => {
    const made = await createDesign(db, STORE_ID, design());
    await bill([made.receipt.id]);
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 1000, staffId: owner });
    const r = await companyReport(db, STORE_ID, supplierId, { amounts: false });
    expect(r.totals.amountPaise).toBeNull();
    expect(r.totals.billedPaise).toBeNull();
    expect(r.totals.paidPaise).toBeNull();
    expect(r.account.duePaise).toBeNull();
    expect(r.bills[0].amountPaise).toBeNull();
    expect(r.deliveries[0].amountPaise).toBeNull();
    expect(r.deliveries[0].lines[0].amountPaise).toBeNull();
    expect(r.totals.pieces).toBe(4);
  });
});

describe('addPayment', () => {
  it('refuses a bad amount, a future day or another company’s bill; defaults the day to today; takes the bill’s number', async () => {
    await expect(addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 0, staffId: owner })).rejects.toThrow(/amount/);
    await expect(addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 12.5, staffId: owner })).rejects.toThrow(/amount/);
    await expect(addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 100, paidOn: '2999-01-01', staffId: owner })).rejects.toThrow(/date/);
    const mills = await createSupplier(db, STORE_ID, { name: 'Mumbai Mills', contactName: '', phone: '', gstin: '', notes: '' });
    const theirStock = await createDesign(db, STORE_ID, design({ supplierId: mills.id, name: 'Cargo' }));
    const theirs = await bill([theirStock.receipt.id], { companies: [mills.id] });
    await expect(addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 100, billId: theirs.id, staffId: owner })).rejects.toMatchObject({ key: 'bill.err.notThisCompany' });
    const myStock = await createDesign(db, STORE_ID, design());
    const mine = await bill([myStock.receipt.id], { billNumber: 'INV-9' });
    const made = await addPayment(db, STORE_ID, { operationId: 'pay-once', supplierId, amountPaise: 100, billId: mine.id, staffId: owner });
    expect(made.paidOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(made).toMatchObject({ billId: mine.id, billNumber: 'INV-9' });
    // The same tap again (retried request): one payment, the first one back.
    const again = await addPayment(db, STORE_ID, { operationId: 'pay-once', supplierId, amountPaise: 100, staffId: owner });
    expect(again).toMatchObject({ id: made.id, duplicate: true });
    expect((await companyReport(db, STORE_ID, supplierId, { amounts: true })).payments).toHaveLength(1);
  });
});

describe('company location and the list', () => {
  it('keeps the location; summaries carry bills, pieces, billed amounts and dues', async () => {
    const supplier = (await listSuppliers(db, STORE_ID)).find((s) => s.id === supplierId)!;
    expect(supplier.location).toBe('Surat');
    await updateSupplier(db, STORE_ID, supplierId, { name: 'Surat Silks', contactName: '', phone: '', gstin: '', notes: '', location: '', active: true });
    expect((await listSuppliers(db, STORE_ID)).find((s) => s.id === supplierId)!.location).toBeNull();

    const made = await createDesign(db, STORE_ID, design());
    await bill([made.receipt.id]);
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, amountPaise: 50000, staffId: owner });
    const summary = (await companySummaries(db, STORE_ID, { amounts: true })).get(supplierId)!;
    expect(summary).toMatchObject({ bills: 1, openBills: 1, pieces: 4, collections: 1, amountPaise: 200000, paidPaise: 50000, duePaise: 150000 });
    expect((await companySummaries(db, STORE_ID, { amounts: false })).get(supplierId)!.duePaise).toBeNull();
    expect((await listProducts(db, STORE_ID, { supplierId })).length).toBe(2);
  });

  it('working since: a backdated day, separate from the day the company was added; refused when not a day or after today', async () => {
    const since = { name: 'Surat Silks', contactName: '', phone: '', gstin: '', notes: '', active: true };
    await updateSupplier(db, STORE_ID, supplierId, { ...since, workingSince: '2019-04-01' });
    const supplier = (await listSuppliers(db, STORE_ID)).find((s) => s.id === supplierId)!;
    expect(supplier.workingSince).toBe('2019-04-01');
    expect(supplier.createdAt.getFullYear()).toBeGreaterThanOrEqual(2026);
    await expect(updateSupplier(db, STORE_ID, supplierId, { ...since, workingSince: '2019-02-30' })).rejects.toMatchObject({ key: 'cat.err.workingSince' });
    await expect(updateSupplier(db, STORE_ID, supplierId, { ...since, workingSince: '2999-01-01' })).rejects.toMatchObject({ key: 'cat.err.workingSince' });
    await expect(updateSupplier(db, STORE_ID, supplierId, { ...since, workingSince: '1980-01-01' })).rejects.toMatchObject({ key: 'cat.err.workingSince' });
    await updateSupplier(db, STORE_ID, supplierId, { ...since, workingSince: ' ' });
    expect((await listSuppliers(db, STORE_ID)).find((s) => s.id === supplierId)!.workingSince).toBeNull();
    // On create too.
    const other = await createSupplier(db, STORE_ID, { ...since, name: 'Mumbai Mills', workingSince: '2024-12-31' });
    expect(other.workingSince).toBe('2024-12-31');
  });
});

describe('companiesOverview', () => {
  it('totals and one line per company: collections map to the company chosen when the item was made; open bills; latest activity first', async () => {
    const mills = await createSupplier(db, STORE_ID, { name: 'Mumbai Mills', contactName: '', phone: '', gstin: '', notes: '', workingSince: '2015-06-01' });
    // Surat Silks: two collections, two bills (one paid); Mumbai Mills: one collection of jeans and its bill.
    const k1 = await createDesign(db, STORE_ID, design({ stockDate: '2026-11-01' }));
    const k2 = await createDesign(db, STORE_ID, design({ name: 'Anarkali', mrpPaise: 249900, costPaise: 100000, quantityEach: 1, stockDate: '2026-11-15' }));
    const s1 = await bill([k1.receipt.id], { billDate: '2026-11-01' });
    await bill([k2.receipt.id], { billDate: '2026-11-15' });
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId, billId: s1.id, amountPaise: 200000, staffId: owner });
    const jeans = await createDesign(db, STORE_ID, design({ supplierId: mills.id, categoryId: jeansId, name: 'Slim Jeans', mrpPaise: 199900, costPaise: 70000, quantityEach: 1, stockDate: '2026-11-10' }));
    await bill([jeans.receipt.id], { billDate: '2026-11-10', companies: [mills.id] });

    const overview = await companiesOverview(db, STORE_ID, { amounts: true });
    const surat = overview.rows.find((r) => r.id === supplierId)!;
    expect(surat).toMatchObject({ name: 'Surat Silks', location: 'Surat', workingSince: null, bills: 2, openBills: 1, collections: 2, pieces: 6, amountPaise: 400000, paidPaise: 200000, duePaise: 200000, firstDate: '2026-11-01', lastDate: '2026-11-15' });
    expect(surat.addedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const mumbai = overview.rows.find((r) => r.id === mills.id)!;
    expect(mumbai).toMatchObject({ workingSince: '2015-06-01', bills: 1, openBills: 1, collections: 1, pieces: 2, amountPaise: 140000, duePaise: 140000 });
    // Latest activity first: both were added today (later than their bills), so the newest added comes first.
    expect(overview.rows.indexOf(mumbai)).toBeLessThan(overview.rows.indexOf(surat));
    expect(overview.rows.indexOf(mumbai)).toBe(0);
    expect(overview.totals.companies).toBe(overview.rows.length);
    expect(overview.totals.bills).toBe(overview.rows.reduce((n, r) => n + r.bills, 0));
    expect(overview.totals.openBills).toBe(overview.rows.reduce((n, r) => n + r.openBills, 0));
    expect(overview.totals.collections).toBe(overview.rows.reduce((n, r) => n + r.collections, 0));
    expect(overview.totals.purchasesPaise).toBe(overview.rows.reduce((n, r) => n + (r.amountPaise ?? 0), 0));
    expect(overview.totals.duePaise).toBe(overview.rows.reduce((n, r) => n + (r.duePaise ?? 0), 0));
    // A company with nothing yet still has a line.
    const empty = await createSupplier(db, STORE_ID, { name: 'New Co', contactName: '', phone: '', gstin: '', notes: '' });
    const again = await companiesOverview(db, STORE_ID, { amounts: false });
    expect(again.rows.find((r) => r.id === empty.id)).toMatchObject({ bills: 0, collections: 0, amountPaise: null, duePaise: null });
    expect(again.totals.purchasesPaise).toBeNull();
  });
});

describe('deleteUnusedSuppliers', () => {
  it('removes companies with nothing linked; keeps one with items, bills or payments and reports its counts', async () => {
    const blank = { contactName: '', phone: '', gstin: '', notes: '' };
    const empty = await createSupplier(db, STORE_ID, { ...blank, name: 'Empty Co' });
    const paidOnly = await createSupplier(db, STORE_ID, { ...blank, name: 'Advance Co' });
    await addPayment(db, STORE_ID, { operationId: `pay-${Math.random()}`, supplierId: paidOnly.id, amountPaise: 1000, staffId: owner });
    const billOnly = await createSupplier(db, STORE_ID, { ...blank, name: 'Billed Co' });
    const billed = await createDesign(db, STORE_ID, design({ supplierId: billOnly.id, name: 'Billed Kurta' }));
    await bill([billed.receipt.id], { companies: [billOnly.id] });
    await createDesign(db, STORE_ID, design()); // Surat Silks: 2 items, 1 collection

    const result = await deleteUnusedSuppliers(db, STORE_ID, [empty.id, paidOnly.id, billOnly.id, supplierId, empty.id]);
    expect(result.deleted).toEqual([empty.id]);
    expect(result.kept.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'Advance Co', items: 0, collections: 0, bills: 0, payments: 1 },
      { name: 'Billed Co', items: 2, collections: 1, bills: 1, payments: 0 },
      { name: 'Surat Silks', items: 2, collections: 1, bills: 0, payments: 0 },
    ]);
    const left = (await listSuppliers(db, STORE_ID)).map((s) => s.id);
    expect(left).not.toContain(empty.id);
    expect(left).toContain(paidOnly.id);
    expect(left).toContain(supplierId);
    expect(await deleteUnusedSuppliers(db, STORE_ID, [])).toEqual({ deleted: [], kept: [] });
  });
});

