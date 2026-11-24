'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb, type Db } from '@/db/client';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { codeFromScan } from '@/lib/item-link';
import { type SizeRates } from '@/lib/size-prices';
import { isValidEan13 } from '@/features/scanning/ean13';
import { requireAdmin, requireAnyPermission, requirePermission, type CurrentStaff } from '@/server/auth';
import { deleteCompanies } from '@/server/services/delete-companies';
import { deleteProducts } from '@/server/services/delete-products';
import type { MessageKey } from '@/lib/i18n';
import { errorText, getLocale, getT } from '@/server/i18n';
import { asSectionIcon, fixedSectionKey, localName, typeNameEdit, type SectionIcon } from '@/lib/sections';
import { cleanSizeList, mergeSizeEdit } from '@/lib/size-lists';
import {
  addTypeSize,
  backfillSections,
  createSection,
  createType,
  deleteSection,
  ensureFixedSection,
  listSections,
  moveType,
  toPickSection,
  toPickType,
  updateSection,
  type PickSection,
  type PickType,
} from '@/server/services/sections';
import { addPayment } from '@/server/services/company';
import { DomainError } from '@/server/services/errors';
import { addOrRestoreSupplier, createCategory, createSupplier, deleteCategory, listSuppliers, restoreSupplier,
  setSuppliersActive, updateCategory, updateSupplier, type SupplierInput } from '@/server/services/catalog';
import {
  clearAllStock,
  correctTaggedItem,
  createDesign,
  createProductsBatch,
  createDesignsBulk,
  BULK_MAX_ROWS,
  findProductByCode,
  createProduct,
  listProducts,
  receiveStock,
  bulkUpdateProducts,
  type BulkProductChange,
  saveDesign,
  type DesignEdit,
  getProduct,
  listDesignVariants,
  stockIn,
  setDesignTags,
  type ProductInput,
} from '@/server/services/products';
import { addPhotoToProducts, addProductImage, removeDesignPhoto, setDesignPhoto } from '@/server/services/images';
import { updatePriceCode } from '@/server/services/settings';
import { createStaff, setStaffActive, setStaffPermissions, setStaffPin, verifyLogin } from '@/server/services/staff';

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
      forGender: text(formData, 'forGender'),
      ageGroup: text(formData, 'ageGroup'),
      createdBy: admin.id,
    });
    createdId = created.id;
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/admin', 'layout');
  redirect(`/admin/products/${createdId}?created=1`);
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
    location: text(formData, 'location'),
    workingSince: text(formData, 'workingSince'),
  };
}

/** Company accounts (2026-11-20): money paid to a company, by people with the purchase-price right. */
export async function addSupplierPaymentAction(supplierId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePermission('costs');
  try {
    const amountPaise = money(formData, 'amount', 'purchase price');
    await addPayment(await getDb(), STORE_ID, {
      operationId: text(formData, 'operationId'),
      supplierId,
      amountPaise: amountPaise ?? 0,
      paidOn: text(formData, 'paidOn') || null,
      billId: text(formData, 'billId') || null,
      note: text(formData, 'note') || null,
      staffId: me.id,
    });
    revalidatePath('/admin', 'layout');
    return { message: (await getT())('cat.acc.pay.saved') };
  } catch (error) {
    return failure(error);
  }
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

/** Companies → Select → Delete (2026-11-21): removes the chosen companies that have nothing linked; reports the rest. */
export async function deleteCompaniesAction(ids: string[]): Promise<{ ok: true; deleted: number; message: string } | { ok: false; error: string }> {
  // Owner's feedback 2026-11-22 (ADR-051): any company, after a confirmation; its items and stock entries stay.
  // Anyone with the Catalog right (bills and payments are not touched; they keep its name).
  await requirePermission('catalog');
  try {
    const list = (Array.isArray(ids) ? ids : []).map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500);
    const result = await deleteCompanies(await getDb(), STORE_ID, list);
    revalidatePath('/admin', 'layout');
    const t = await getT();
    const n = result.deleted.length;
    const parts = [t(n === 1 ? 'bulk.deleted.one' : 'bulk.deleted.other', { n })];
    if (result.unlinked.items) parts.push(t('bulk.deletedUnlinked', { items: result.unlinked.items }));
    return { ok: true, deleted: n, message: parts.join(' ') };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/**
 * Products → Select → Delete, and Delete on the product page (owner only, ADR-050):
 * items go for good after a confirmation; sales keep their figures. Items in an
 * exchange are kept and named in the message.
 */
export async function deleteProductsAction(ids: string[]): Promise<{ ok: true; deleted: number; message: string } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const list = (Array.isArray(ids) ? ids : []).map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500);
    const result = await deleteProducts(await getDb(), STORE_ID, list);
    revalidatePath('/admin', 'layout');
    revalidatePath('/pos');
    const t = await getT();
    const parts = [];
    if (result.deleted.length) parts.push(t(result.deleted.length === 1 ? 'prod.deleted.one' : 'prod.deleted.other', { n: result.deleted.length }));
    for (const k of result.kept) parts.push(t('prod.keptExchange', { name: k.name, size: k.size }));
    return { ok: true, deleted: result.deleted.length, message: parts.join(' ') };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** Companies → Select (plan v17): hide or bring back the chosen companies. */
export async function setCompaniesActiveAction(ids: string[], active: boolean): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  await requirePermission('catalog');
  try {
    const list = (Array.isArray(ids) ? ids : []).map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500);
    const changed = await setSuppliersActive(await getDb(), STORE_ID, list, Boolean(active));
    revalidatePath('/admin', 'layout');
    return { ok: true, message: (await getT())(changed === 1 ? 'act.bulkDone.one' : 'act.bulkDone.other', { n: changed }) };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

export type CompanyResult = { ok: true; company: { id: string; name: string } } | { ok: false; error: string };

/** Company picker (plan v17): "+ New company…" — add by name, or reuse / bring back one with that name. */
export async function addCompanyAction(name: string): Promise<CompanyResult> {
  await requirePermission('catalog');
  try {
    const { supplier } = await addOrRestoreSupplier(await getDb(), STORE_ID, String(name ?? ''));
    revalidatePath('/admin', 'layout');
    return { ok: true, company: { id: supplier.id, name: supplier.name } };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** Company picker (plan v17): tap a "previous" (hidden) company to use it again. */
export async function restoreCompanyAction(id: string): Promise<CompanyResult> {
  await requirePermission('catalog');
  try {
    const supplier = await restoreSupplier(await getDb(), STORE_ID, String(id));
    revalidatePath('/admin', 'layout');
    return { ok: true, company: { id: supplier.id, name: supplier.name } };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
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
    const created = await createCategory(await getDb(), STORE_ID, {
      name: text(formData, 'name'),
      code: text(formData, 'code'),
      sizes: text(formData, 'sizes'),
      // Plan v19: the section it goes under (Men / Women / Boys / Girls …) and its Hindi name.
      sectionId: text(formData, 'sectionId') || null,
      nameHi: text(formData, 'nameHi'),
    });
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
      sectionId: text(formData, 'sectionId') || undefined,
      nameHi: text(formData, 'nameHi'),
    });
    revalidatePath('/admin', 'layout');
    return { message: (await getT())('act.saved') };
  } catch (error) {
    return failure(error);
  }
}

// ------------------------------------------------ plan v19 (02b): sections on Categories

/** Categories → + Add section (e.g. Kids) with a Hindi name and a picture; it goes last. */
export async function createSectionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('catalog');
  try {
    const section = await createSection(await getDb(), STORE_ID, { name: text(formData, 'name'), nameHi: text(formData, 'nameHi'), icon: text(formData, 'icon') });
    revalidatePath('/admin', 'layout');
    return { message: (await getT())('sec.added', { name: localName(section, await getLocale()) }) };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Categories → "Set up Men / Women / Boys / Girls" (owner only, once): the explicit one-time
 * set-up of ADR-033 — the same `backfillSections` the script runs; never a side effect of a page read.
 */
export async function setUpSectionsAction(): Promise<FormState> {
  await requireAdmin();
  try {
    const result = await backfillSections(await getDb(), STORE_ID);
    revalidatePath('/admin', 'layout');
    const t = await getT();
    if (!result.created) return { error: t('sec.setup.already') };
    return { message: t('sec.setup.done', { sections: result.sections.map((s) => s.name).join(', '), added: result.typesAdded.length, unsorted: result.unsorted.length }) };
  } catch (error) {
    return failure(error);
  }
}

/** Categories → Needs sorting → Move under…: the category goes under the chosen section. */
export async function moveTypeAction(categoryId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('catalog');
  try {
    const { type, section } = await moveType(await getDb(), STORE_ID, categoryId, text(formData, 'sectionId'));
    revalidatePath('/admin', 'layout');
    const locale = await getLocale();
    return { message: (await getT())('sec.moved', { name: localName(type, locale), section: localName(section, locale) }) };
  } catch (error) {
    return failure(error);
  }
}

// ------------------------------- plan v19 (03a): "+ Add" on the New item steps

export type SectionResult = { ok: true; section: PickSection } | { ok: false; error: string };
export type TypeResult = { ok: true; type: PickType } | { ok: false; error: string };
export type SizesResult = { ok: true; sizes: string[] } | { ok: false; error: string };

/** A collection as New item draws it (names in the person's language, its shown categories). */
async function pickSection(db: Db, id: string): Promise<PickSection> {
  const section = (await listSections(db, STORE_ID)).sections.find((s) => s.id === id);
  if (!section) throw new DomainError('Choose a collection.', { key: 'sec.err.sectionNotFound' });
  return toPickSection(section, await getLocale());
}

/**
 * New item → "+ Add" on "Which collection?": a collection (e.g. Kids) with a picture; it goes
 * last. Men / Women typed here while the shop lacks them come back in their own place (ADR-064).
 */
export async function addSectionAction(input: { name: string; icon: string }): Promise<SectionResult> {
  await requirePermission('catalog');
  try {
    const db = await getDb();
    const name = String(input.name ?? '');
    const fixed = fixedSectionKey(name);
    const shown = fixed ? (await listSections(db, STORE_ID)).sections.some((s) => s.fixed === fixed && s.active) : false;
    if (shown) throw new DomainError('That name is already in the list.', { key: 'sec.err.exists' });
    const section = fixed ? await ensureFixedSection(db, STORE_ID, fixed) : await createSection(db, STORE_ID, { name, icon: String(input.icon ?? '') });
    revalidatePath('/admin', 'layout');
    return { ok: true, section: await pickSection(db, section.id) };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** New item → Men / Women when the shop lacks one (ADR-064): the tap that picks it makes it (or brings it back). */
export async function openFixedCollectionAction(key: string): Promise<SectionResult> {
  await requirePermission('catalog');
  try {
    if (key !== 'men' && key !== 'women') throw new DomainError('Choose a collection.', { key: 'sec.err.sectionNotFound' });
    const db = await getDb();
    const section = await ensureFixedSection(db, STORE_ID, key);
    revalidatePath('/admin', 'layout');
    return { ok: true, section: await pickSection(db, section.id) };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

export type EditCollectionResult = { ok: true; section: { id: string; name: string; icon: SectionIcon } } | { ok: false; error: string };

/**
 * New item → ✎ on a collection (owner only, ADR-064): the name as the person sees it (the
 * Hindi name when that is what is shown, else the name — a new name drops the old Hindi one)
 * and the picture. Men and Women keep their names (`updateSection` refuses).
 */
export async function editCollectionAction(input: { id: string; name: string; icon: string }): Promise<EditCollectionResult> {
  await requireAdmin();
  try {
    const db = await getDb();
    const locale = await getLocale();
    const current = (await listSections(db, STORE_ID)).sections.find((s) => s.id === String(input.id ?? ''));
    if (!current) throw new DomainError('Choose a collection.', { key: 'sec.err.sectionNotFound' });
    const typed = String(input.name ?? '').trim().replace(/\s+/g, ' ');
    if (!typed) throw new DomainError('Enter a name (up to 30 characters).', { key: 'sec.err.name' });
    const hindiShown = locale === 'hi' && Boolean(current.nameHi?.trim());
    const sameName = typed.toLowerCase() === current.name.toLowerCase();
    const updated = await updateSection(db, STORE_ID, current.id, {
      name: hindiShown ? current.name : typed,
      nameHi: hindiShown ? typed : sameName ? current.nameHi : null,
      icon: String(input.icon ?? ''),
      active: current.active,
    });
    revalidatePath('/admin', 'layout');
    return { ok: true, section: { id: updated.id, name: localName(updated, locale), icon: asSectionIcon(updated.icon) } };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** New item → "+ Add" on "What is it?": a category under the chosen section, with its sizes. */
export async function addTypeAction(input: { sectionId: string; name: string; sizes: string }): Promise<TypeResult> {
  await requirePermission('catalog');
  try {
    const type = await createType(await getDb(), STORE_ID, { sectionId: String(input.sectionId ?? ''), name: String(input.name ?? ''), sizes: String(input.sizes ?? '') });
    revalidatePath('/admin', 'layout');
    return { ok: true, type: toPickType(type, await getLocale()) };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/**
 * New item → ✎ on a category tile (owner, 2026-11-23, ADR-071): its name and its sizes. The sheet may
 * hold an old copy of the tile (a page kept alive, अ/A switched later, another phone), so only what it
 * changed is applied (pre-release review): the name only when edited — the one its tile showed (Hindi when
 * `hindi`), never for Jeans / Jacket / Shirt, a new English name dropping the old Hindi one (`typeNameEdit`) —
 * and only the sizes it added or removed, on top of today's list (`mergeSizeEdit`). The collection is passed
 * so the same duplicate-name check as the Categories page runs (letter case ignored). Code and collection stay.
 */
export async function editTypeAction(input: { id: string; name: string; sizes: string; was: { name: string; sizes: string[] }; hindi: boolean }): Promise<TypeResult> {
  await requireAdmin();
  try {
    const db = await getDb();
    const id = String(input.id ?? '');
    const section = (await listSections(db, STORE_ID)).sections.find((s) => s.types.some((x) => x.id === id));
    const current = section?.types.find((x) => x.id === id);
    if (!section || !current) throw new DomainError('Category not found.', { key: 'cat.err.categoryNotFound' });
    const names = typeNameEdit(current, { typed: String(input.name ?? ''), was: String(input.was?.name ?? ''), hindi: input.hindi === true });
    const was = Array.isArray(input.was?.sizes) ? input.was.sizes.map(String) : current.sizes;
    const sizes = mergeSizeEdit(current.sizes, was, cleanSizeList(String(input.sizes ?? '')));
    const updated = await updateCategory(db, STORE_ID, current.id, {
      ...names,
      code: current.code,
      active: current.active,
      sizes: sizes ?? undefined,
      sectionId: section.id,
    });
    revalidatePath('/admin', 'layout');
    return { ok: true, type: toPickType({ ...updated, productCount: current.productCount }, await getLocale()) };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** New item → "+ Add size": the category keeps it for next time. */
export async function addTypeSizeAction(categoryId: string, size: string): Promise<SizesResult> {
  await requirePermission('catalog');
  try {
    const sizes = await addTypeSize(await getDb(), STORE_ID, String(categoryId), String(size ?? ''));
    revalidatePath('/admin', 'layout');
    return { ok: true, sizes };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
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
  /** Plan v19: pieces of each size (size → whole number); sizes left out get `quantityEach`. */
  quantities?: Record<string, string | number>;
  billNumber: string;
  /** Plan v19: the bill's date, YYYY-MM-DD; empty = today. */
  stockDate?: string;
  /** Plan v17 tags: '' = not set. */
  forGender?: string;
  ageGroup?: string;
  /** Box packs (ADR-047): pieces in a box, whole-box MRP and purchase price ('' = not given). */
  pack?: { size: string | number; mrp?: string; cost?: string } | null;
  /** No size picked (ADR-052): one item with an empty size. */
  noSize?: boolean;
};

/** `items`: the saved items (in entry order) so photos can be attached right after. */
export type DesignActionResult =
  | { ok: true; receiptId: string; created: number; items: { id: string; name: string; color: string; sku: string; size: string }[] }
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
    const quantities: Record<string, number> = {};
    for (const [size, raw] of Object.entries(input.quantities ?? {})) {
      const value = String(raw).trim() || '0';
      if (!/^\d+$/.test(value)) throw new DomainError('Pieces must be a whole number.', { key: 'act.err.piecesWhole' });
      quantities[String(size).slice(0, 20)] = Number(value);
    }
    const mrpPaise = toPaise(input.mrp, 'MRP') as number;
    const result = await createDesign(await getDb(), STORE_ID, {
      operationId: String(input.operationId).slice(0, 100),
      // Optional (ADR-051): empty = no company.
      supplierId: String(input.supplierId ?? '').trim() || null,
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
      quantities,
      billNumber: input.billNumber,
      stockDate: String(input.stockDate ?? ''),
      forGender: String(input.forGender ?? ''),
      ageGroup: String(input.ageGroup ?? ''),
      pack: input.pack
        ? {
            size: /^\d+$/.test(String(input.pack.size).trim()) ? Number(String(input.pack.size).trim()) : NaN,
            mrpPaise: toPaise(String(input.pack.mrp ?? ''), 'MRP', true),
            costPaise: can(admin, 'costs') ? toPaise(String(input.pack.cost ?? ''), 'cost price', true) : null,
          }
        : null,
      noSize: input.noSize === true,
      staffId: admin.id,
    });
    revalidatePath('/admin', 'layout');
    return { ok: true, receiptId: result.receipt.id, created: result.products.length, items: result.products.map((p) => ({ id: p.id, name: p.name, color: p.color, sku: p.sku, size: p.size })) };
  } catch (error) {
    const state = await failure(error);
    return { ok: false, error: state.error ?? 'Something went wrong.' };
  }
}

// ------------------------------------------------------------ bulk addition

/** One row of Bulk addition as typed: rupees as text; `mrp` is the sale price (worked out on the phone from the purchase price). */
export type BulkActionRow = { name: string; mrp: string; cost: string; quantity: string | number };

/**
 * Bulk addition (owner, 2026-11-24, ADR-072): many products of one category saved together —
 * each row a product with no size yet. Catalog right; purchase prices only with the costs right.
 */
export async function createBulkAction(input: { operationId: string; categoryId: string; rows: BulkActionRow[] }): Promise<DesignActionResult> {
  const admin = await requirePermission('catalog');
  try {
    const typed = Array.isArray(input.rows) ? input.rows : [];
    if (typed.length > BULK_MAX_ROWS) throw new DomainError('Up to 50 products at once. Split the entry.', { key: 'stk.err.tooManyProducts' });
    const canCosts = can(admin, 'costs');
    const rows = typed.map((row, i) => {
      const name = String(row?.name ?? '');
      const vars = { row: i + 1, name: name.trim() || '—' };
      const paise = (raw: unknown, problem: 'mrp' | 'cost') => {
        const result = rupeesToPaise(String(raw ?? ''));
        if (result === null) throw new DomainError(`Row ${i + 1}: enter a valid price in rupees.`, { key: `stk.err.row.${problem}`, vars });
        return result;
      };
      const quantity = String(row?.quantity ?? '').trim();
      if (!/^\d{1,5}$/.test(quantity)) throw new DomainError(`Row ${i + 1}: pieces must be 0 or more.`, { key: 'stk.err.row.pieces', vars });
      return {
        name,
        mrpPaise: paise(row?.mrp, 'mrp'),
        costPaise: canCosts && String(row?.cost ?? '').trim() ? paise(row?.cost, 'cost') : null,
        quantity: Number(quantity),
      };
    });
    const result = await createDesignsBulk(await getDb(), STORE_ID, {
      operationId: String(input.operationId).slice(0, 100),
      categoryId: String(input.categoryId),
      rows,
      staffId: admin.id,
    });
    revalidatePath('/admin', 'layout');
    return { ok: true, receiptId: result.receipt.id, created: result.products.length, items: result.products.map((p) => ({ id: p.id, name: p.name, color: p.color, sku: p.sku, size: p.size })) };
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

export type BulkProductInput =
  | { kind: 'hide' | 'show' }
  | { kind: 'rename'; name: string }
  | { kind: 'company'; supplierId: string }
  | { kind: 'category'; categoryId: string }
  | { kind: 'tags'; forGender: string; ageGroup: string }
  /** Rupees as typed; '' = keep each item's own. */
  | { kind: 'prices'; mrp: string; price: string };

/** Products → Select (plan v17): one change for every chosen item. Prices need the Prices right; the rest Catalog. */
export async function bulkProductsAction(ids: string[], input: BulkProductInput): Promise<{ ok: true; changed: number; message: string } | { ok: false; error: string }> {
  await requirePermission(input?.kind === 'prices' ? 'prices' : 'catalog');
  try {
    const list = (Array.isArray(ids) ? ids : []).map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    const rupees = (raw: string, label: MoneyLabel) => {
      if (!String(raw ?? '').trim()) return null;
      const paise = rupeesToPaise(String(raw));
      if (paise === null) throw new DomainError(`Enter a valid ${label} in rupees.`, { key: RUPEES_KEY[label] });
      return paise;
    };
    const change: BulkProductChange =
      input.kind === 'rename'
        ? { kind: 'rename', name: String(input.name ?? '') }
        : input.kind === 'company'
          ? { kind: 'company', supplierId: String(input.supplierId ?? '') || null }
          : input.kind === 'category'
            ? { kind: 'category', categoryId: String(input.categoryId ?? '') }
            : input.kind === 'tags'
              ? { kind: 'tags', forGender: String(input.forGender ?? ''), ageGroup: String(input.ageGroup ?? '') }
              : input.kind === 'prices'
                ? { kind: 'prices', mrpPaise: rupees(input.mrp, 'MRP'), pricePaise: rupees(input.price, 'selling price') }
                : { kind: input.kind === 'show' ? 'show' : 'hide' };
    const changed = await bulkUpdateProducts(await getDb(), STORE_ID, list, change);
    revalidatePath('/admin', 'layout');
    return { ok: true, changed, message: (await getT())(changed === 1 ? 'act.bulkDone.one' : 'act.bulkDone.other', { n: changed }) };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** What the item page sends on Save (ADR-059): rupees as typed; an empty price keeps each size's own. */
export type ItemSaveInput = {
  name?: string;
  supplierId?: string;
  categoryId?: string;
  mrp?: string;
  price?: string;
  cost?: string;
  /** Item id → pieces now. */
  counts?: Record<string, number>;
  /** Item id → its size and colour, corrected. */
  items?: Record<string, { size?: string; color?: string }>;
  newSizes?: { size: string; pieces: number }[];
  operationId?: string;
};

/**
 * The item page's Save (owner's feedback 2026-11-22, ADR-059): only what this person may
 * change is used — name, company, category and new sizes with Catalog, MRP / selling with
 * Prices, purchase with Costs, pieces with Stock; anything else sent is left out.
 */
export async function saveItemAction(
  productId: string,
  input: ItemSaveInput,
): Promise<{ ok: true; counted: number; added: number } | { ok: false; error: string }> {
  const me = await requireAnyPermission(['catalog', 'prices', 'stock']);
  try {
    if (!/^[0-9a-f-]{36}$/i.test(String(productId))) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
    const rupees = (raw: string | undefined, label: MoneyLabel) => {
      if (!String(raw ?? '').trim()) return null;
      const paise = rupeesToPaise(String(raw));
      if (paise === null) throw new DomainError(`Enter a valid ${label} in rupees.`, { key: RUPEES_KEY[label] });
      return paise;
    };
    const edit: DesignEdit = { staffId: me.id };
    if (can(me, 'catalog')) {
      if (input.name !== undefined) edit.name = String(input.name);
      if (input.supplierId !== undefined) edit.supplierId = String(input.supplierId) || null;
      if (input.categoryId) edit.categoryId = String(input.categoryId);
      if (input.items && typeof input.items === 'object') {
        edit.items = Object.fromEntries(
          Object.entries(input.items)
            .slice(0, 200)
            .map(([id, c]) => [String(id), { size: c?.size === undefined ? undefined : String(c.size), color: c?.color === undefined ? undefined : String(c.color) }]),
        );
      }
      const sizes = (Array.isArray(input.newSizes) ? input.newSizes : []).slice(0, 30).map((n) => ({ size: String(n?.size ?? ''), pieces: Number(n?.pieces) }));
      if (sizes.length) Object.assign(edit, { newSizes: sizes, operationId: String(input.operationId ?? '') });
    }
    if (can(me, 'prices')) Object.assign(edit, { mrpPaise: rupees(input.mrp, 'MRP'), pricePaise: rupees(input.price, 'selling price') });
    if (can(me, 'costs')) edit.costPaise = rupees(input.cost, 'purchase price');
    if (can(me, 'stock') && input.counts && typeof input.counts === 'object') {
      edit.counts = Object.fromEntries(Object.entries(input.counts).slice(0, 200).map(([id, n]) => [String(id), Number(n)]));
    }
    const result = await saveDesign(await getDb(), STORE_ID, productId, edit);
    revalidatePath('/admin', 'layout');
    return { ok: true, counted: result.counted, added: result.added };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/**
 * Item page → + Add (owner's feedback 2026-11-22, ADR-061): new pieces of one size came in —
 * a stock entry at the item's purchase price, under its company while that company is in use
 * (so purchases and dues see it). A retried tap (same operation id) adds them once.
 */
export async function addPiecesAction(
  productId: string,
  input: { quantity: number; operationId: string },
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  const me = await requirePermission('stock');
  try {
    if (!/^[0-9a-f-]{36}$/i.test(String(productId))) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
    const db = await getDb();
    const product = await getProduct(db, STORE_ID, productId);
    if (!product) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
    const company = product.supplierId ? (await listSuppliers(db, STORE_ID)).find((c) => c.id === product.supplierId && c.active && !c.deletedAt) : undefined;
    const result = await stockIn(db, STORE_ID, {
      operationId: String(input?.operationId ?? ''),
      productId,
      quantity: Number(input?.quantity),
      staffId: me.id,
      supplierId: company?.id ?? null,
    });
    revalidatePath('/admin', 'layout');
    return { ok: true, stock: result.stock };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** Plan v17: "For" and "Age" tags on every size and colour of this product's design (catalog right). */
export async function updateDesignTagsAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('catalog');
  try {
    const count = await setDesignTags(await getDb(), STORE_ID, productId, { forGender: text(formData, 'forGender'), ageGroup: text(formData, 'ageGroup') });
    revalidatePath('/admin', 'layout');
    return { message: (await getT())(count === 1 ? 'act.tagsUpdated.one' : 'act.tagsUpdated.other', { n: count }) };
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

/** Settings → Clear stock: owner only, confirmed with the owner's own PIN. Sets every count to 0. */
export async function clearStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  try {
    const db = await getDb();
    if (!(await verifyLogin(db, STORE_ID, me.id, text(formData, 'pin')))) throw new DomainError('Wrong PIN. Nothing was changed.', { key: 'own.clear.wrongPin' });
    const { items, pieces } = await clearAllStock(db, STORE_ID, { staffId: me.id });
    revalidatePath('/', 'layout');
    const t = await getT();
    return { message: items === 0 ? t('own.clear.nothing') : t('own.clear.done', { items, pieces }) };
  } catch (error) {
    return failure(error);
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

/** The sizes of the product this item belongs to — the server works them out, never the phone. */
async function designIds(productId: string): Promise<string[]> {
  if (!/^[0-9a-f-]{36}$/i.test(String(productId))) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
  const variants = await listDesignVariants(await getDb(), STORE_ID, productId);
  if (variants.length === 0) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
  // The opened item first: it keeps the photo itself, the other sizes point to it.
  return [productId, ...variants.map((v) => v.id).filter((id) => id !== productId)];
}

/**
 * Product page → photo (owner, 2026-11-23, ADR-068): one photo for every size of the product;
 * a new one replaces the old. Catalog right.
 */
export async function setProductPhotoAction(productId: string, formData: FormData): Promise<{ ok: true; sizes: number } | { ok: false; error: string }> {
  const me = await requirePermission('catalog');
  try {
    const bytes = await readPhoto(formData.get('photo'));
    if (!bytes) throw new DomainError('Choose a photo first.', { key: 'act.err.choosePhoto' });
    const ids = await designIds(productId);
    const size = (key: string) => (/^\d+$/.test(text(formData, key)) ? Number(text(formData, key)) : null);
    await setDesignPhoto(await getDb(), STORE_ID, { productIds: ids, bytes, width: size('width'), height: size('height'), staffId: me.id });
    revalidatePath('/admin', 'layout');
    revalidatePath('/pos');
    return { ok: true, sizes: ids.length };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** Product page → Remove photo (ADR-068): no photo on any size of the product. Catalog right. */
export async function removeProductPhotoAction(productId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('catalog');
  try {
    await removeDesignPhoto(await getDb(), STORE_ID, await designIds(productId));
    revalidatePath('/admin', 'layout');
    revalidatePath('/pos');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
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
      forGender: text(formData, 'forGender'),
      ageGroup: text(formData, 'ageGroup'),
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
      forGender: text(formData, 'forGender'),
      ageGroup: text(formData, 'ageGroup'),
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

// ------------------------------------------- collections and categories: delete (ADR-051, ADR-064, ADR-066)

/** New item → 🗑 on a collection: delete one with no items left (owner only; never Men or Women). */
export async function deleteCollectionAction(id: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const result = await deleteSection(await getDb(), STORE_ID, String(id));
    revalidatePath('/admin', 'layout');
    return { ok: true, message: (await getT())('col.deleted', { name: result.name }) };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}

/** Categories → 🗑 on a category (owner only, ADR-066): only with no items left; never Jeans, Jacket or Shirt. */
export async function deleteCategoryAction(id: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const result = await deleteCategory(await getDb(), STORE_ID, String(id));
    revalidatePath('/admin', 'layout');
    return { ok: true, message: (await getT())('cat.deleted', { name: result.name }) };
  } catch (error) {
    return { ok: false, error: (await failure(error)).error ?? 'Something went wrong.' };
  }
}
