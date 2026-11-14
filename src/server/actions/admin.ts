'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { requireAdmin, requirePermission, type CurrentStaff } from '@/server/auth';
import { DomainError } from '@/server/services/errors';
import { createCategory, createSupplier, updateCategory, updateSupplier, type SupplierInput } from '@/server/services/catalog';
import {
  createDesign,
  createProductsBatch,
  getProduct,
  createProduct,
  listProducts,
  receiveStock,
  stockIn,
  updateDesignRates,
  updateProduct,
  type ProductInput,
} from '@/server/services/products';
import { updatePriceCode } from '@/server/services/settings';
import { createStaff, setStaffActive, setStaffPermissions, setStaffPin } from '@/server/services/staff';

export type FormState = { error?: string; message?: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

function money(formData: FormData, key: string, label: string, { optional = false } = {}): number | null {
  const raw = text(formData, key);
  if (!raw && optional) return null;
  const paise = rupeesToPaise(raw);
  if (paise === null) throw new DomainError(`Enter a valid ${label} in rupees.`);
  return paise;
}

function productInput(formData: FormData): ProductInput & { categoryId: string; supplierId: string | null } {
  const categoryId = text(formData, 'categoryId');
  if (!categoryId) throw new DomainError('Choose a category.');
  return {
    categoryId,
    supplierId: text(formData, 'supplierId') || null,
    name: text(formData, 'name'),
    brand: text(formData, 'brand'),
    // Resolved from categoryId by the service.
    category: '-',
    size: text(formData, 'size'),
    color: text(formData, 'color'),
    mrpPaise: money(formData, 'mrp', 'MRP') as number,
    pricePaise: money(formData, 'price', 'selling price') as number,
    costPaise: money(formData, 'cost', 'cost price', { optional: true }),
  };
}

/** Drops the purchase price for people without the "costs" right. */
function withoutCost<T extends { costPaise: number | null }>(input: T, me: CurrentStaff): T {
  return can(me, 'costs') ? input : { ...input, costPaise: null };
}

function failure(error: unknown): FormState {
  if (error instanceof DomainError) return { error: error.message };
  console.error(error);
  return { error: 'Something went wrong. Please try again.' };
}

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission('catalog');
  let createdId: string;
  try {
    const openingRaw = text(formData, 'openingStock') || '0';
    if (!/^\d+$/.test(openingRaw)) throw new DomainError('Opening stock must be a whole number.');
    const created = await createProduct(await getDb(), STORE_ID, {
      ...withoutCost(productInput(formData), admin),
      manufacturerBarcode: formData.get('barcodeMode') === 'manufacturer' ? text(formData, 'barcode') : null,
      openingStock: Number(openingRaw),
      createdBy: admin.id,
    });
    createdId = created.id;
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/admin', 'layout');
  redirect(`/admin/products/${createdId}?created=1`);
}

export async function updateProductAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePermission('catalog');
  try {
    const db = await getDb();
    const current = await getProduct(db, STORE_ID, productId);
    if (!current) throw new DomainError('Product not found.');
    const input = productInput(formData);
    await updateProduct(db, STORE_ID, productId, {
      ...input,
      // Without the "prices" right the current rates stay; without "costs" the purchase price stays.
      mrpPaise: can(me, 'prices') ? input.mrpPaise : current.mrpPaise,
      pricePaise: can(me, 'prices') ? input.pricePaise : current.pricePaise,
      costPaise: can(me, 'costs') ? input.costPaise : current.costPaise,
      active: formData.get('active') === 'on',
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/admin', 'layout');
  return { message: 'Saved.' };
}

export async function stockInAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission('stock');
  try {
    const raw = text(formData, 'quantity');
    if (!/^\d+$/.test(raw)) throw new DomainError('Quantity must be a whole number.');
    const updated = await stockIn(await getDb(), STORE_ID, {
      operationId: text(formData, 'operationId'),
      productId,
      quantity: Number(raw),
      staffId: admin.id,
      note: text(formData, 'note'),
    });
    revalidatePath('/admin', 'layout');
    if (updated.duplicate) return { message: `Already saved. Stock is ${updated.stock}.` };
    return { message: `Added ${raw}. Stock is now ${updated.stock}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function createStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const role = formData.get('role') === 'admin' ? 'admin' : 'salesman';
    const created = await createStaff(await getDb(), STORE_ID, { name: text(formData, 'name'), role, pin: text(formData, 'pin') });
    revalidatePath('/admin/staff');
    return { message: `${created.name} added. They can log in with the PIN you set.` };
  } catch (error) {
    return failure(error);
  }
}

export async function resetPinAction(staffId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    await setStaffPin(await getDb(), STORE_ID, staffId, text(formData, 'pin'));
    return { message: 'PIN changed.' };
  } catch (error) {
    return failure(error);
  }
}

/** Bound with (staffId, active) and used as a form action; the form state argument is unused. */
export async function setStaffActiveAction(staffId: string, active: boolean): Promise<FormState> {
  const admin = await requireAdmin();
  try {
    await setStaffActive(await getDb(), STORE_ID, staffId, active, admin.id);
    revalidatePath('/admin/staff');
    return { message: active ? 'Activated.' : 'Deactivated.' };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------- suppliers

function supplierInput(formData: FormData): SupplierInput {
  return {
    name: text(formData, 'name'),
    contactName: text(formData, 'contactName'),
    phone: text(formData, 'phone'),
    gstin: text(formData, 'gstin'),
    notes: text(formData, 'notes'),
  };
}

export async function createSupplierAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('catalog');
  try {
    const created = await createSupplier(await getDb(), STORE_ID, supplierInput(formData));
    revalidatePath('/admin', 'layout');
    return { message: `${created.name} added.` };
  } catch (error) {
    return failure(error);
  }
}

export async function updateSupplierAction(supplierId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('catalog');
  try {
    await updateSupplier(await getDb(), STORE_ID, supplierId, { ...supplierInput(formData), active: formData.get('active') === 'on' });
    revalidatePath('/admin', 'layout');
    return { message: 'Saved.' };
  } catch (error) {
    return failure(error);
  }
}

// --------------------------------------------------------------- categories

export async function createCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('catalog');
  try {
    const created = await createCategory(await getDb(), STORE_ID, { name: text(formData, 'name'), code: text(formData, 'code') });
    revalidatePath('/admin', 'layout');
    return { message: `${created.name} added with code ${created.code}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function updateCategoryAction(categoryId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('catalog');
  try {
    await updateCategory(await getDb(), STORE_ID, categoryId, {
      name: text(formData, 'name'),
      code: text(formData, 'code'),
      active: formData.get('active') === 'on',
    });
    revalidatePath('/admin', 'layout');
    return { message: 'Saved.' };
  } catch (error) {
    return failure(error);
  }
}

// ------------------------------------------------- new design (sizes × colours)

export type DesignActionInput = {
  operationId: string;
  supplierId: string;
  categoryId: string;
  name: string;
  brand: string;
  sizes: string[];
  colors: string[];
  mrp: string;
  price: string;
  cost: string;
  quantityEach: string;
  billNumber: string;
};

export type DesignActionResult = { ok: true; receiptId: string; created: number } | { ok: false; error: string };

export async function createDesignAction(input: DesignActionInput): Promise<DesignActionResult> {
  const admin = await requirePermission('catalog');
  try {
    const toPaise = (raw: string, label: string, optional = false) => {
      if (!raw.trim() && optional) return null;
      const paise = rupeesToPaise(raw);
      if (paise === null) throw new DomainError(`Enter a valid ${label} in rupees.`);
      return paise;
    };
    const qty = input.quantityEach.trim() || '0';
    if (!/^\d+$/.test(qty)) throw new DomainError('Pieces must be a whole number.');
    const mrpPaise = toPaise(input.mrp, 'MRP') as number;
    const result = await createDesign(await getDb(), STORE_ID, {
      operationId: String(input.operationId).slice(0, 100),
      supplierId: String(input.supplierId),
      categoryId: String(input.categoryId),
      name: String(input.name),
      brand: String(input.brand),
      sizes: Array.isArray(input.sizes) ? input.sizes.map(String) : [],
      colors: Array.isArray(input.colors) ? input.colors.map(String) : [],
      mrpPaise,
      pricePaise: input.price.trim() ? (toPaise(input.price, 'selling price') as number) : mrpPaise,
      costPaise: can(admin, 'costs') ? toPaise(input.cost, 'cost price', true) : null,
      quantityEach: Number(qty),
      billNumber: input.billNumber,
      staffId: admin.id,
    });
    revalidatePath('/admin', 'layout');
    return { ok: true, receiptId: result.receipt.id, created: result.products.length };
  } catch (error) {
    const state = failure(error);
    return { ok: false, error: state.error ?? 'Something went wrong.' };
  }
}

// ------------------------------------------------------- restock existing items

export type RestockItem = { id: string; sku: string; barcode: string; name: string; size: string; color: string; stock: number; supplierName: string | null };

/** Admin search for the restock screen: by scanned code, SKU, name or colour. */
export async function findRestockItemsAction(term: string): Promise<RestockItem[]> {
  await requirePermission('stock');
  const query = String(term).trim().slice(0, 64);
  if (!query) return [];
  const rows = await listProducts(await getDb(), STORE_ID, { search: query });
  const exact = rows.filter((p) => p.barcode === query || p.sku.toUpperCase() === query.toUpperCase());
  return (exact.length > 0 ? exact : rows).slice(0, 10).map((p) => ({
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    size: p.size,
    color: p.color,
    stock: p.stock,
    supplierName: p.supplierName,
  }));
}

export type ReceiveActionResult = { ok: true; receiptId: string } | { ok: false; error: string };

export async function receiveStockAction(input: {
  operationId: string;
  supplierId: string;
  billNumber: string;
  lines: { productId: string; quantity: number }[];
}): Promise<ReceiveActionResult> {
  const admin = await requirePermission('stock');
  try {
    const lines = (Array.isArray(input.lines) ? input.lines : []).map((l) => ({ productId: String(l.productId), quantity: Number(l.quantity) }));
    const result = await receiveStock(await getDb(), STORE_ID, {
      operationId: String(input.operationId).slice(0, 100),
      supplierId: input.supplierId ? String(input.supplierId) : null,
      billNumber: String(input.billNumber ?? ''),
      lines,
      staffId: admin.id,
    });
    revalidatePath('/admin', 'layout');
    return { ok: true, receiptId: result.receipt.id };
  } catch (error) {
    return { ok: false, error: failure(error).error ?? 'Something went wrong.' };
  }
}

export async function updateDesignRatesAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePermission('prices');
  try {
    const mrpPaise = money(formData, 'mrp', 'MRP') as number;
    const count = await updateDesignRates(await getDb(), STORE_ID, productId, {
      mrpPaise,
      pricePaise: text(formData, 'price') ? (money(formData, 'price', 'selling price') as number) : mrpPaise,
      // undefined = keep each item's purchase price (no "costs" right).
      costPaise: can(me, 'costs') ? money(formData, 'cost', 'cost price', { optional: true }) : undefined,
    });
    revalidatePath('/admin', 'layout');
    return { message: `Rates updated for ${count} item${count === 1 ? '' : 's'}.` };
  } catch (error) {
    return failure(error);
  }
}

// ------------------------------------------------------------------ settings

export async function updatePriceCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    await updatePriceCode(await getDb(), STORE_ID, {
      priceCodeWord: text(formData, 'priceCodeWord'),
      printPriceCode: formData.get('printPriceCode') === 'on',
    });
    revalidatePath('/admin', 'layout');
    return { message: 'Saved.' };
  } catch (error) {
    return failure(error);
  }
}

// ------------------------------------------------- quick add many products

export type QuickActionInput = {
  operationId: string;
  supplierId: string;
  categoryId: string;
  brand: string;
  billNumber: string;
  rows: { name: string; size: string; color: string; mrp: string; price: string; cost: string; quantity: string }[];
};

export async function createQuickAction(input: QuickActionInput): Promise<DesignActionResult> {
  const admin = await requirePermission('catalog');
  try {
    const rows = (Array.isArray(input.rows) ? input.rows : [])
      .filter((row) => String(row.name ?? '').trim())
      .map((row, i) => {
        const label = `Row ${i + 1} (${String(row.name).trim()})`;
        const mrpPaise = rupeesToPaise(String(row.mrp ?? ''));
        if (mrpPaise === null) throw new DomainError(`${label}: enter a valid MRP.`);
        const pricePaise = String(row.price ?? '').trim() ? rupeesToPaise(String(row.price)) : mrpPaise;
        if (pricePaise === null) throw new DomainError(`${label}: enter a valid selling price.`);
        const costRaw = String(row.cost ?? '').trim();
        const costPaise = costRaw && can(admin, 'costs') ? rupeesToPaise(costRaw) : null;
        if (costRaw && costPaise === null) throw new DomainError(`${label}: enter a valid purchase price.`);
        const qty = String(row.quantity ?? '').trim() || '0';
        if (!/^\d+$/.test(qty)) throw new DomainError(`${label}: pieces must be a whole number.`);
        return { name: String(row.name), size: String(row.size ?? ''), color: String(row.color ?? ''), mrpPaise, pricePaise, costPaise, quantity: Number(qty) };
      });
    const result = await createProductsBatch(await getDb(), STORE_ID, {
      operationId: String(input.operationId).slice(0, 100),
      supplierId: String(input.supplierId),
      categoryId: String(input.categoryId),
      brand: String(input.brand ?? ''),
      billNumber: String(input.billNumber ?? ''),
      rows,
      staffId: admin.id,
    });
    revalidatePath('/admin', 'layout');
    return { ok: true, receiptId: result.receipt.id, created: result.products.length };
  } catch (error) {
    return { ok: false, error: failure(error).error ?? 'Something went wrong.' };
  }
}

/** Owner ticks which extra rights a salesman has. */
export async function setStaffPermissionsAction(staffId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const granted = await setStaffPermissions(await getDb(), STORE_ID, staffId, formData.getAll('permissions').map(String));
    revalidatePath('/admin', 'layout');
    return { message: granted.length ? `Saved: ${granted.join(', ')}.` : 'Saved: counter only.' };
  } catch (error) {
    return failure(error);
  }
}
