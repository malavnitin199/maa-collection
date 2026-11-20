// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { companyPeriod } from '@/lib/company-period';
import { approveSale } from './approvals';
import { createSupplier, listCategories } from './catalog';
import { productReport } from './product-report';
import { createDesign, listDesignVariants, receiveStock } from './products';
import { recordSale } from './sales';
import { listStaff } from './staff';

/** The product page's figures (2026-11-20): sold (approved only), bought, profit, last sale / arrival, the period, hidden amounts. */
let db: Db;
let owner: string;
let seller: string;
let supplierId: string;
let kurtaId: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  const people = await listStaff(db, STORE_ID);
  owner = people.find((p) => p.role === 'admin')!.id;
  seller = people.find((p) => p.role !== 'admin')!.id;
  supplierId = (await createSupplier(db, STORE_ID, { name: 'Figures Mills', contactName: '', phone: '', gstin: '', notes: '' })).id;
  kurtaId = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!.id;
});

async function design(costPaise: number | null = 50000) {
  const made = await createDesign(db, STORE_ID, {
    operationId: `fig-${Math.random()}`, supplierId, categoryId: kurtaId, name: 'Figure Kurta', brand: '', sizes: ['M', 'L'], colors: [], mrpPaise: 129900,
    pricePaise: null, costPaise, quantityEach: 3, staffId: owner, billNumber: 'F-1', stockDate: '2026-11-01',
  });
  const variants = await listDesignVariants(db, STORE_ID, made.products[0].id);
  return { ids: variants.map((v) => v.id), m: variants.find((v) => v.size === 'M')!, l: variants.find((v) => v.size === 'L')! };
}

describe('productReport', () => {
  it('counts approved sales only, every arrival of the design, profit from the sale’s own cost, last sale and arrival', async () => {
    const d = await design();
    const s1 = await recordSale(db, STORE_ID, { operationId: 's1', productId: d.m.id, quantity: 2, unitPricePaise: 120000, soldBy: seller, recordedBy: seller });
    await recordSale(db, STORE_ID, { operationId: 's2', productId: d.l.id, quantity: 1, unitPricePaise: 110000, soldBy: seller, recordedBy: seller }); // waiting
    await approveSale(db, STORE_ID, { saleId: s1.sale.id, decidedBy: owner });
    await receiveStock(db, STORE_ID, { operationId: 'r1', supplierId, billNumber: 'F-2', lines: [{ productId: d.l.id, quantity: 4 }], staffId: owner });

    const r = await productReport(db, STORE_ID, d.ids, { amounts: true });
    expect(r.totals).toMatchObject({ soldPieces: 2, soldCount: 1, revenuePaise: 240000, profitPaise: 240000 - 2 * 50000, profitPartial: false, waiting: 1, boughtPieces: 10, purchasePaise: 10 * 50000, estimated: false });
    expect(r.sales.map((s) => [s.size, s.quantity, s.status])).toEqual([
      ['L', 1, 'waiting'],
      ['M', 2, 'approved'],
    ]);
    expect(r.arrivals.map((a) => [a.billNumber, a.pieces, a.amountPaise, a.reason])).toEqual([
      ['F-2', 4, 200000, 'stock_in'],
      ['F-1', 6, 300000, 'opening'],
    ]);
    expect(r.lastSale).toMatchObject({ day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(r.lastArrival).toMatchObject({ supplierName: 'Figures Mills', billNumber: 'F-2' });
  });

  it('the period limits sales and arrivals by day; amounts hide without the costs right', async () => {
    const d = await design();
    const period = companyPeriod({ period: 'custom', from: '2026-11-01', to: '2026-11-01' }, '2026-11-20');
    const r = await productReport(db, STORE_ID, d.ids, { amounts: true, period });
    expect(r.totals.boughtPieces).toBe(6);
    expect(r.arrivals).toHaveLength(1);
    const old = companyPeriod({ period: 'custom', from: '2020-01-01', to: '2020-01-31' }, '2026-11-20');
    expect((await productReport(db, STORE_ID, d.ids, { amounts: true, period: old })).totals.boughtPieces).toBe(0);

    const hidden = await productReport(db, STORE_ID, d.ids, { amounts: false });
    expect(hidden.totals.purchasePaise).toBeNull();
    expect(hidden.totals.profitPaise).toBeNull();
    expect(hidden.totals.revenuePaise).toBe(0);
    expect(hidden.arrivals[0].amountPaise).toBeNull();
  });

  it('no purchase price: profit is partial, arrivals have no amount', async () => {
    const d = await design(null);
    const s = await recordSale(db, STORE_ID, { operationId: 's3', productId: d.m.id, quantity: 1, unitPricePaise: 100000, soldBy: seller, recordedBy: seller });
    await approveSale(db, STORE_ID, { saleId: s.sale.id, decidedBy: owner });
    const r = await productReport(db, STORE_ID, d.ids, { amounts: true });
    expect(r.totals).toMatchObject({ soldPieces: 1, revenuePaise: 100000, profitPaise: 0, profitPartial: true, purchasePaise: 0 });
    expect(r.sales[0].profitPaise).toBeNull();
  });

  it('an empty design id list is an empty report', async () => {
    const r = await productReport(db, STORE_ID, [], { amounts: false });
    expect(r.totals.soldPieces).toBe(0);
    expect(r.sales).toEqual([]);
  });
});
