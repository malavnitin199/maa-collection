'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { requirePermission } from '@/server/auth';
import { errorText, getT } from '@/server/i18n';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { groupDesigns } from '@/lib/design-groups';
import { BILL_ITEMS_MAX, createBill, deleteBill, setBillCollections, updateBill, updateItemBill, type BillLineInput } from '@/server/services/bills';
import { findProductByCode, listProducts } from '@/server/services/products';
import { DomainError } from '@/server/services/errors';

/**
 * Bills section (owner's feedback 2026-11-21). Money, so only people with the
 * purchase-price right (the owner always has it).
 */
export type BillFormInput = {
  operationId?: string;
  billNumber: string;
  billDate: string;
  note: string;
  /** The companies chosen, in order. The amounts are worked out from the collections. */
  companies: string[];
  receiptIds?: string[];
};

/**
 * One size of a product, as New bill offers it (ADR-061): its pieces and purchase price now.
 * A box item (ADR-047) has `pack` (pieces in a box) and is billed by the box at `boxCostPaise`.
 */
export type BillProduct = { id: string; size: string; color: string; sku: string; stock: number; costPaise: number | null; pack: number | null; boxCostPaise: number | null };
/** A design in New bill's list (same name, company and MRP), with its sizes. */
export type BillDesign = { key: string; name: string; supplierName: string | null; pieces: number; sizes: BillProduct[] };
/** The item a scanned or typed code names. */
export type BillScanned = BillProduct & { name: string; supplierName: string | null };
/**
 * What New bill / Edit bill sends (ADR-061): the bill's one company ('' = none) and its lines —
 * a new item (`productId`) or a line already on the bill (`lineId`), how many, and the rate in
 * rupees as typed ('' = none, N/A).
 */
export type ItemBillInput = {
  operationId?: string;
  billNumber: string;
  billDate: string;
  note: string;
  supplierId: string;
  lines: { lineId?: string; productId?: string; quantity: number; rate: string }[];
};

/** Designs per page of New bill's list. */
const PAGE = 12;

/** What a bill line needs of an item; a box's purchase price is its own, or 'per piece × pieces'. */
function billProduct(p: { id: string; size: string; color: string; sku: string; stock: number; costPaise: number | null; packSize: number | null; packCostPaise: number | null }): BillProduct {
  const boxCostPaise = p.packSize ? (p.packCostPaise ?? (p.costPaise === null ? null : p.costPaise * p.packSize)) : null;
  return { id: p.id, size: p.size, color: p.color, sku: p.sku, stock: p.stock, costPaise: p.costPaise, pack: p.packSize, boxCostPaise };
}
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function fail(error: unknown): Promise<{ ok: false; error: string }> {
  const t = await getT();
  if (error instanceof DomainError) return { ok: false, error: errorText(error, t) };
  console.error(error);
  return { ok: false, error: t('error.generic') };
}

const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const ids = (list: unknown) => (Array.isArray(list) ? list.filter(uuid).slice(0, 500) : []) as string[];

const companies = (input: BillFormInput) => ids(input.companies).slice(0, 20);

function refresh() {
  revalidatePath('/admin', 'layout');
}

export async function updateBillAction(id: string, input: BillFormInput): Promise<Result> {
  await requirePermission('costs');
  try {
    if (!uuid(id)) throw new DomainError('Bill not found.', { key: 'bill.err.notFound' });
    await updateBill(await getDb(), STORE_ID, id, {
      billNumber: String(input.billNumber ?? ''),
      billDate: String(input.billDate ?? '') || null,
      note: String(input.note ?? ''),
      companies: companies(input),
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setBillCollectionsAction(id: string, change: { add?: string[]; remove?: string[] }): Promise<Result> {
  await requirePermission('costs');
  try {
    if (!uuid(id)) throw new DomainError('Bill not found.', { key: 'bill.err.notFound' });
    await setBillCollections(await getDb(), STORE_ID, id, { add: ids(change?.add), remove: ids(change?.remove) });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteBillAction(id: string): Promise<Result> {
  await requirePermission('costs');
  try {
    if (!uuid(id)) throw new DomainError('Bill not found.', { key: 'bill.err.notFound' });
    await deleteBill(await getDb(), STORE_ID, id);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * New bill's list (ADR-061): the shop's products, newest first, a page of designs at a time
 * (each with its sizes, pieces and purchase price); with a query, those whose name, code,
 * barcode, brand, category or colour match. Purchase-price right only.
 */
export async function browseBillProductsAction(input: { query?: string; offset?: number }): Promise<{ designs: BillDesign[]; more: boolean }> {
  await requirePermission('costs');
  const query = String(input?.query ?? '').trim().slice(0, 64);
  const offset = Math.max(0, Math.trunc(Number(input?.offset) || 0));
  const rows = await listProducts(await getDb(), STORE_ID, { search: query, active: true });
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const designs = groupDesigns(rows);
  return {
    designs: designs.slice(offset, offset + PAGE).map((d) => ({
      key: d.key,
      name: d.name,
      supplierName: d.supplierName,
      pieces: d.pieces,
      sizes: d.items.map(billProduct),
    })),
    more: designs.length > offset + PAGE,
  };
}

/** A scanned tag (QR link or barcode) or a typed code in New bill: its item, ready to add. */
export async function findBillProductAction(code: string): Promise<BillScanned | null> {
  await requirePermission('costs');
  const db = await getDb();
  const product = await findProductByCode(db, STORE_ID, String(code ?? '').slice(0, 300));
  if (!product) return null;
  const [row] = (await listProducts(db, STORE_ID, { search: product.barcode })).filter((p) => p.id === product.id);
  return { ...billProduct(product), name: product.name, supplierName: row?.supplierName ?? null };
}

/** The lines as typed: ids checked, quantities as numbers, rupees to paise ('' = no rate). */
function linesOf(input: ItemBillInput): BillLineInput[] {
  return (Array.isArray(input?.lines) ? input.lines : []).slice(0, BILL_ITEMS_MAX + 1).map((line) => {
    const raw = String(line?.rate ?? '').trim();
    let ratePaise: number | null = null;
    if (raw) {
      ratePaise = rupeesToPaise(raw);
      if (ratePaise === null) throw new DomainError('Enter a valid rate in rupees.', { key: 'bill.err.rate' });
    }
    return {
      lineId: uuid(line?.lineId) ? String(line.lineId) : undefined,
      productId: uuid(line?.productId) ? String(line.productId) : undefined,
      quantity: Number(line?.quantity),
      ratePaise,
    };
  });
}

/**
 * New bill (no `billId`) or Edit bill of a bill made from items (owner's feedback 2026-11-22,
 * ADR-061): its one company or none, and its lines with the quantities and rates as typed.
 */
export async function saveItemBillAction(input: ItemBillInput, billId?: string): Promise<Result<{ id: string }>> {
  const me = await requirePermission('costs');
  try {
    const db = await getDb();
    const lines = linesOf(input);
    const supplierId = uuid(input?.supplierId) ? String(input.supplierId) : null;
    const header = { billNumber: String(input?.billNumber ?? ''), billDate: String(input?.billDate ?? '') || null, note: String(input?.note ?? '') };
    if (billId !== undefined) {
      if (!uuid(billId)) throw new DomainError('Bill not found.', { key: 'bill.err.notFound' });
      await updateItemBill(db, STORE_ID, billId, { ...header, supplierId, lines });
      refresh();
      return { ok: true, id: billId };
    }
    const created = await createBill(db, STORE_ID, {
      operationId: String(input?.operationId ?? ''),
      ...header,
      companies: supplierId ? [supplierId] : [],
      receiptIds: [],
      items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity, ratePaise: line.ratePaise })),
      staffId: me.id,
    });
    refresh();
    return { ok: true, id: created.id };
  } catch (error) {
    return fail(error);
  }
}
