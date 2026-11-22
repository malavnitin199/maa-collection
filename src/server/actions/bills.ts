'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { requirePermission } from '@/server/auth';
import { errorText, getT } from '@/server/i18n';
import { BILL_ITEMS_MAX, createBill, deleteBill, setBillCollections, updateBill } from '@/server/services/bills';
import { listProducts } from '@/server/services/products';
import { codeFromScan } from '@/lib/item-link';
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
  /** A bill with no company (ADR-060): the shop's items and how many of each. */
  items?: { productId: string; quantity: number }[];
};

/** An item the bill's search finds (ADR-060): what the line will show, and its purchase price now. */
export type BillItemOption = { id: string; name: string; size: string; color: string; sku: string; stock: number; costPaise: number | null };
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

export async function createBillAction(input: BillFormInput): Promise<Result<{ id: string }>> {
  const me = await requirePermission('costs');
  try {
    const created = await createBill(await getDb(), STORE_ID, {
      operationId: String(input.operationId ?? ''),
      billNumber: String(input.billNumber ?? ''),
      billDate: String(input.billDate ?? '') || null,
      note: String(input.note ?? ''),
      companies: companies(input),
      receiptIds: ids(input.receiptIds),
      items: (Array.isArray(input.items) ? input.items : [])
        .slice(0, BILL_ITEMS_MAX + 1)
        .filter((i) => uuid(i?.productId))
        .map((i) => ({ productId: String(i.productId), quantity: Number(i.quantity) })),
      staffId: me.id,
    });
    refresh();
    return { ok: true, id: created.id };
  } catch (error) {
    return fail(error);
  }
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
 * New bill → items (ADR-060): the shop's items by name, code, barcode or colour (a scanned
 * code finds just its item), with today's purchase price for the line. Purchase-price right only.
 */
export async function searchBillItemsAction(term: string): Promise<BillItemOption[]> {
  await requirePermission('costs');
  const query = codeFromScan(String(term ?? '')).trim().slice(0, 64);
  if (!query) return [];
  const rows = await listProducts(await getDb(), STORE_ID, { search: query });
  const exact = rows.filter((p) => p.barcode === query || p.sku.toUpperCase() === query.toUpperCase());
  return (exact.length > 0 ? exact : rows).slice(0, 12).map((p) => ({ id: p.id, name: p.name, size: p.size, color: p.color, sku: p.sku, stock: p.stock, costPaise: p.costPaise }));
}
