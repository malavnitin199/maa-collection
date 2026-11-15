'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { codeFromScan } from '@/lib/item-link';
import { sizeFieldName, type SizeRates } from '@/lib/size-prices';
import { isValidEan13 } from '@/features/scanning/ean13';
import { requireAdmin, requirePermission, type CurrentStaff } from '@/server/auth';
import type { MessageKey } from '@/lib/i18n';
import { errorText, getT } from '@/server/i18n';
import { DomainError } from '@/server/services/errors';
import { createCategory, createSupplier, updateCategory, updateSupplier, type SupplierInput } from '@/server/services/catalog';
import {
  correctTaggedItem,
  createDesign,
  createProductsBatch,
  findProductByCode,
  getProduct,
  createProduct,
  listProducts,
  receiveStock,
  stockIn,
  updateDesignRates,
  updateProduct,
  type ProductInput,
} from '@/server/services/products';
import { addPhotoToProducts, addProductImage, deleteImage, makeMainImage } from '@/server/services/images';
import { updatePriceCode } from '@/server/services/settings';
import { createStaff, setStaffActive, setStaffPermissions, setStaffPin } from '@/server/services/staff';

export type FormState = { error?: string; message?: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

type MoneyLabel = 'MRP' | 'selling price' | 'cost price' | 'purchase price';
const RUPEES_KEY: Record<MoneyLabel, MessageKey> = {
  MRP: 'act.err.rupees.mrp',
  'selling price': 'act.err.rupees.price',
  'cost price': 'act.err.rupees.cost',
  'purchase price': 'act.err.rupees.purchase',
};
const SIZE_KEY: Record<'MRP' | 'selling price' | 'purchase price', MessageKey> = {
  MRP: 'act.err.size.mrp',
  'selling price': 'act.err.size.price',
  'purchase price': 'act.err.size.purchase',
};

function money(formData: FormData, key: string, label: MoneyLabel, { optional = false } = {}): number | null {
  const raw = text(formData, key);
  if (!raw && optional) return null;
  const paise = rupeesToPaise(raw);
  if (paise === null) throw new DomainError(`Enter a valid ${label} in rupees.`, { key: RUPEES_KEY[label] });
  return paise;
}

function productInput(formData: FormData): ProductInput & { categoryId: string; supplierId: string | null } {
  const categoryId = text(formData, 'categoryId');
  if (!categoryId) throw new DomainError('Choose a category.', { key: 'act.err.chooseCategory' });
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

/** A size's own rates as typed (rupees); empty = use the default. */
export type SizeRatesText = { size: string; mrp: string; price: string; cost: string };

/** Rupee text per size → paise. Purchase prices are dropped without the "costs" right; sizes with nothing of their own are left out. */
function sizeRatesInput(rows: unknown, me: CurrentStaff): SizeRates[] {
  if (!Array.isArray(rows)) return [];
  if (rows.length > 60) throw new DomainError('Too many sizes at once.', { key: 'act.err.tooManySizes' });
  return rows
    .map((row: Partial<Record<keyof SizeRatesText, unknown>>) => {
      const size = String(row?.size ?? '').trim();
      const paise = (raw: unknown, label: keyof typeof SIZE_KEY) => {
        const value = String(raw ?? '').trim();
        if (!value) return null;
        const result = rupeesToPaise(value);
        if (result === null) throw new DomainError(`Size ${size}: enter a valid ${label} in rupees.`, { key: SIZE_KEY[label], vars: { size } });
        return result;
      };
      return {
        size,
        mrpPaise: paise(row?.mrp, 'MRP'),
        pricePaise: paise(row?.price, 'selling price'),
        costPaise: can(me, 'costs') ? paise(row?.cost, 'purchase price') : null,
      };
    })
    .filter((r) => r.mrpPaise !== null || r.pricePaise !== null || r.costPaise !== null);
}

/** A failed action as a message in the person's language (rule errors with a key are translated). */
async function failure(error: unknown): Promise<FormState> {
  const t = await getT();
  if (error instanceof DomainError) return { error: errorText(error, t) };
  console.error(error);
  return { error: t('error.generic') };
}

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission('catalog');
  let createdId: string;
  try {
    const openingRaw = text(formData, 'openingStock') || '0';
    if (!/^\d+$/.test(openingRaw)) throw new DomainError('Opening stock must be a whole number.', { key: 'act.err.openingStock' });
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
    if (!current) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
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
  return { message: (await getT())('act.saved') };
}

export async function stockInAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission('stock');
  try {
    const raw = text(formData, 'quantity');
    if (!/^\d+$/.test(raw)) throw new DomainError('Quantity must be a whole number.', { key: 'act.err.quantityWhole' });
    const updated = await stockIn(await getDb(), STORE_ID, {
      operationId: text(formData, 'operationId'),
      productId,
      quantity: Number(raw),
      staffId: admin.id,
      note: text(formData, 'note'),
    });
    revalidatePath('/admin', 'layout');
    const t = await getT();
    if (updated.duplicate) return { message: t('act.stockAlready', { stock: updated.stock }) };
    return { message: t('act.stockAdded', { qty: raw, stock: updated.stock }) };
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
    return { message: (await getT())('act.staffAdded', { name: created.name }) };
  } catch (error) {
    return failure(error);
  }
}

export async function resetPinAction(staffId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    await setStaffPin(await getDb(), STORE_ID, staffId, text(formData, 'pin'));
    return { message: (await getT())('act.pinChanged') };
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
    return { message: (await getT())(active ? 'act.activated' : 'act.deactivated') };
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
    return { message: (await getT())('act.added', { name: created.name }) };
  } catch (error) {
    return failure(error);
  }
}

export async function updateSupplierAction(supplierId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('catalog');
  try {
    await updateSupplier(await getDb(), STORE_ID, supplierId, { ...supplierInput(formData), active: formData.get('active') === 'on' });
    revalidatePath('/admin', 'layout');
    return { message: (await getT())('act.saved') };
  } catch (error) {
    return failure(error);
  }
}

// --------------------------------------------------------------- categories

export async function createCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('catalog');
  try {
    const created = await createCategory(await getDb(), STORE_ID, { name: text(formData, 'name'), code: text(formData, 'code'), sizes: text(formData, 'sizes') });
    revalidatePath('/admin', 'layout');
    return { message: (await getT())('act.categoryAdded', { name: created.name, code: created.code }) };
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
      sizes: text(formData, 'sizes'),
    });
    revalidatePath('/admin', 'layout');
    return { message: (await getT())('act.saved') };
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
  /** Sizes with their own MRP / selling / purchase price (all colours of that size). */
  sizeRates?: SizeRatesText[];
  quantityEach: string;
  billNumber: string;
};

/** `items`: the saved items (in entry order) so photos can be attached right after. */
export type DesignActionResult =
  | { ok: true; receiptId: string; created: number; items: { id: string; color: string }[] }
  | { ok: false; error: string };

export async function createDesignAction(input: DesignActionInput): Promise<DesignActionResult> {
  const admin = await requirePermission('catalog');
  try {
    const toPaise = (raw: string, label: MoneyLabel, optional = false) => {
      if (!raw.trim() && optional) return null;
      const paise = rupeesToPaise(raw);
      if (paise === null) throw new DomainError(`Enter a valid ${label} in rupees.`, { key: RUPEES_KEY[label] });
      return paise;
    };
    const qty = input.quantityEach.trim() || '0';
    if (!/^\d+$/.test(qty)) throw new DomainError('Pieces must be a whole number.', { key: 'act.err.piecesWhole' });
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
      // Empty = each size sells at its own MRP.
      pricePaise: String(input.price ?? '').trim() ? toPaise(String(input.price), 'selling price') : null,
      costPaise: can(admin, 'costs') ? toPaise(String(input.cost ?? ''), 'cost price', true) : null,
      sizeRates: sizeRatesInput(input.sizeRates, admin),
      quantityEach: Number(qty),
      billNumber: input.billNumber,
      staffId: admin.id,
    });
    revalidatePath('/admin', 'layout');
    return { ok: true, receiptId: result.receipt.id, created: result.products.length, items: result.products.map((p) => ({ id: p.id, color: p.color })) };
  } catch (error) {
    const state = await failure(error);
    return { ok: false, error: state.error ?? 'Something went wrong.' };
  }
}

// ------------------------------------------------------- restock existing items

export type RestockItem = { id: string; sku: string; barcode: string; name: string; size: string; color: string; stock: number; supplierName: string | null };

/** Admin search for the restock screen: by scanned code, SKU, name or colour. */
export async function findRestockItemsAction(term: string): Promise<RestockItem[]> {
  await requirePermission('stock');
  const query = codeFromScan(String(term)).slice(0, 64);
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
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

export async function updateDesignRatesAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePermission('prices');
  try {
    const sizes = formData.getAll('rateSize').map(String);
    const count = await updateDesignRates(await getDb(), STORE_ID, productId, {
      mrpPaise: money(formData, 'mrp', 'MRP') as number,
      // Empty = each size sells at its own MRP.
      pricePaise: money(formData, 'price', 'selling price', { optional: true }),
      // undefined = keep each item's purchase price (no "costs" right).
      costPaise: can(me, 'costs') ? money(formData, 'cost', 'cost price', { optional: true }) : undefined,
      sizeRates: sizeRatesInput(
        sizes.map((size) => ({
          size,
          mrp: text(formData, sizeFieldName('mrp', size)),
          price: text(formData, sizeFieldName('price', size)),
          cost: text(formData, sizeFieldName('cost', size)),
        })),
        me,
      ),
    });
    revalidatePath('/admin', 'layout');
    return { message: (await getT())(count === 1 ? 'act.ratesUpdated.one' : 'act.ratesUpdated.other', { n: count }) };
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
    return { message: (await getT())('act.saved') };
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
        const vars = { row: i + 1, name: String(row.name).trim() };
        const mrpPaise = rupeesToPaise(String(row.mrp ?? ''));
        if (mrpPaise === null) throw new DomainError(`${label}: enter a valid MRP.`, { key: 'act.err.row.mrp', vars });
        const pricePaise = String(row.price ?? '').trim() ? rupeesToPaise(String(row.price)) : mrpPaise;
        if (pricePaise === null) throw new DomainError(`${label}: enter a valid selling price.`, { key: 'act.err.row.price', vars });
        const costRaw = String(row.cost ?? '').trim();
        const costPaise = costRaw && can(admin, 'costs') ? rupeesToPaise(costRaw) : null;
        if (costRaw && costPaise === null) throw new DomainError(`${label}: enter a valid purchase price.`, { key: 'act.err.row.purchase', vars });
        const qty = String(row.quantity ?? '').trim() || '0';
        if (!/^\d+$/.test(qty)) throw new DomainError(`${label}: pieces must be a whole number.`, { key: 'act.err.row.pieces', vars });
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
    return { ok: true, receiptId: result.receipt.id, created: result.products.length, items: result.products.map((p) => ({ id: p.id, color: p.color })) };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** Owner ticks which extra rights a salesman has. */
export async function setStaffPermissionsAction(staffId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const granted = await setStaffPermissions(await getDb(), STORE_ID, staffId, formData.getAll('permissions').map(String));
    revalidatePath('/admin', 'layout');
    const t = await getT();
    return { message: granted.length ? t('act.permsSaved', { list: granted.map((p) => t(`act.perm.${p}` as MessageKey)).join(', ') }) : t('act.permsNone') };
  } catch (error) {
    return failure(error);
  }
}

// -------------------------------------------------------------------- photos

async function readPhoto(file: FormDataEntryValue | null): Promise<Uint8Array | null> {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  return new Uint8Array(await file.arrayBuffer());
}

export async function uploadProductImageAction(productId: string, formData: FormData): Promise<FormState> {
  const me = await requirePermission('catalog');
  try {
    const bytes = await readPhoto(formData.get('photo'));
    if (!bytes) throw new DomainError('Choose a photo first.', { key: 'act.err.choosePhoto' });
    const size = (key: string) => (/^\d+$/.test(text(formData, key)) ? Number(text(formData, key)) : null);
    await addProductImage(await getDb(), STORE_ID, { productId, bytes, width: size('width'), height: size('height'), staffId: me.id });
    revalidatePath('/admin', 'layout');
    return { message: (await getT())('act.photoAdded') };
  } catch (error) {
    return failure(error);
  }
}

/** Optional photo taken while creating tags: one photo for the given items (e.g. every size of a colour). */
export async function addPhotoToItemsAction(productIds: string[], formData: FormData): Promise<FormState> {
  const me = await requirePermission('catalog');
  try {
    const bytes = await readPhoto(formData.get('photo'));
    if (!bytes) throw new DomainError('Choose a photo first.', { key: 'act.err.choosePhoto' });
    const ids = (Array.isArray(productIds) ? productIds : []).map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 60);
    const size = (key: string) => (/^\d+$/.test(text(formData, key)) ? Number(text(formData, key)) : null);
    await addPhotoToProducts(await getDb(), STORE_ID, { productIds: ids, bytes, width: size('width'), height: size('height'), staffId: me.id });
    revalidatePath('/admin', 'layout');
    return { message: (await getT())('act.photoAdded') };
  } catch (error) {
    return failure(error);
  }
}

export async function makeMainImageAction(imageId: string): Promise<FormState> {
  await requirePermission('catalog');
  try {
    await makeMainImage(await getDb(), STORE_ID, imageId);
    revalidatePath('/admin', 'layout');
    return { message: (await getT())('act.mainPhoto') };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteImageAction(imageId: string): Promise<FormState> {
  await requirePermission('catalog');
  try {
    await deleteImage(await getDb(), STORE_ID, imageId);
    revalidatePath('/admin', 'layout');
    return { message: (await getT())('act.photoDeleted') };
  } catch (error) {
    return failure(error);
  }
}

// ------------------------------------------------------------- tag old stock

export type OldStockResult =
  | {
      ok: true;
      product: { id: string; sku: string; barcode: string; name: string; size: string; color: string; mrpPaise: number };
      photoError?: string;
      /** Edit only: the price change wasn't allowed, the old prices stayed. */
      pricesKept?: boolean;
    }
  | { ok: false; error: string };

/** One old-stock item: details + counted pieces + photos → product with barcode. */
export async function tagOldStockAction(formData: FormData): Promise<OldStockResult> {
  const me = await requirePermission('catalog');
  try {
    const name = text(formData, 'name');
    if (!name) throw new DomainError('Enter the product name.', { key: 'act.err.productName' });
    const categoryId = text(formData, 'categoryId');
    if (!categoryId) throw new DomainError('Choose a category.', { key: 'act.err.chooseCategory' });
    const mrpPaise = money(formData, 'mrp', 'MRP') as number;
    const pricePaise = text(formData, 'price') ? (money(formData, 'price', 'selling price') as number) : mrpPaise;
    const costPaise = can(me, 'costs') ? money(formData, 'cost', 'purchase price', { optional: true }) : null;
    const qty = text(formData, 'quantity') || '1';
    if (!/^\d+$/.test(qty)) throw new DomainError('Pieces must be a whole number.', { key: 'act.err.piecesWhole' });
    const db = await getDb();
    const result = await createProductsBatch(db, STORE_ID, {
      operationId: text(formData, 'operationId').slice(0, 100),
      supplierId: text(formData, 'supplierId') || null,
      categoryId,
      brand: text(formData, 'brand'),
      note: 'Old stock tagged',
      rows: [{ barcode: text(formData, 'barcode') || null, name, size: text(formData, 'size'), color: text(formData, 'color'), mrpPaise, pricePaise, costPaise, quantity: Number(qty) }],
      staffId: me.id,
    });
    const product = result.products[0];
    let photoError: string | undefined;
    if (!result.duplicate) {
      for (const entry of formData.getAll('photos')) {
        const bytes = await readPhoto(entry);
        if (!bytes) continue;
        try {
          await addProductImage(db, STORE_ID, { productId: product.id, bytes, staffId: me.id });
        } catch (error) {
          photoError = error instanceof DomainError ? error.message : 'A photo could not be saved.';
        }
      }
    }
    revalidatePath('/admin', 'layout');
    return {
      ok: true,
      product: { id: product.id, sku: product.sku, barcode: product.barcode, name: product.name, size: product.size, color: product.color, mrpPaise: product.mrpPaise },
      photoError,
    };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** Tag old stock → Edit: fix the item just tagged (same barcode, piece count unchanged). */
export async function editTaggedItemAction(productId: string, formData: FormData): Promise<OldStockResult> {
  const me = await requirePermission('catalog');
  try {
    const name = text(formData, 'name');
    if (!name) throw new DomainError('Enter the product name.', { key: 'act.err.productName' });
    const categoryId = text(formData, 'categoryId');
    if (!categoryId) throw new DomainError('Choose a category.', { key: 'act.err.chooseCategory' });
    const mrpPaise = money(formData, 'mrp', 'MRP') as number;
    const pricePaise = text(formData, 'price') ? (money(formData, 'price', 'selling price') as number) : mrpPaise;
    const canCosts = can(me, 'costs');
    const { product, pricesKept } = await correctTaggedItem(await getDb(), STORE_ID, {
      productId: String(productId),
      staffId: me.id,
      canPrices: can(me, 'prices'),
      canCosts,
      name,
      categoryId,
      supplierId: text(formData, 'supplierId') || null,
      size: text(formData, 'size'),
      color: text(formData, 'color'),
      mrpPaise,
      pricePaise,
      costPaise: canCosts ? money(formData, 'cost', 'purchase price', { optional: true }) : null,
    });
    revalidatePath('/admin', 'layout');
    const { id, sku, barcode, size, color } = product;
    return { ok: true, product: { id, sku, barcode, name: product.name, size, color, mrpPaise: product.mrpPaise }, pricesKept };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

export type TagLookup =
  | { status: 'new'; barcode: string }
  | { status: 'exists'; product: { id: string; name: string; size: string; color: string; stock: number; sku: string } }
  | { status: 'invalid'; code: string };

/** Tag old stock: is this scanned tag barcode usable, or already in the app? */
export async function checkTagBarcodeAction(code: string): Promise<TagLookup> {
  await requirePermission('catalog');
  const value = codeFromScan(String(code)).slice(0, 64);
  const existing = await findProductByCode(await getDb(), STORE_ID, value);
  if (existing) {
    return { status: 'exists', product: { id: existing.id, name: existing.name, size: existing.size, color: existing.color, stock: existing.stock, sku: existing.sku } };
  }
  return isValidEan13(value) ? { status: 'new', barcode: value } : { status: 'invalid', code: value };
}
