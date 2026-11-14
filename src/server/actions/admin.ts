'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { STORE_ID } from '@/lib/app-config';
import { requireAdmin } from '@/server/auth';
import { DomainError } from '@/server/services/errors';
import { createProduct, stockIn, updateProduct, type ProductInput } from '@/server/services/products';
import { createStaff, setStaffActive, setStaffPin } from '@/server/services/staff';

export type FormState = { error?: string; message?: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

function money(formData: FormData, key: string, label: string, { optional = false } = {}): number | null {
  const raw = text(formData, key);
  if (!raw && optional) return null;
  const paise = rupeesToPaise(raw);
  if (paise === null) throw new DomainError(`Enter a valid ${label} in rupees.`);
  return paise;
}

function productInput(formData: FormData): ProductInput {
  return {
    name: text(formData, 'name'),
    brand: text(formData, 'brand'),
    category: text(formData, 'category'),
    size: text(formData, 'size'),
    color: text(formData, 'color'),
    mrpPaise: money(formData, 'mrp', 'MRP') as number,
    pricePaise: money(formData, 'price', 'selling price') as number,
    costPaise: money(formData, 'cost', 'cost price', { optional: true }),
  };
}

function failure(error: unknown): FormState {
  if (error instanceof DomainError) return { error: error.message };
  console.error(error);
  return { error: 'Something went wrong. Please try again.' };
}

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  let createdId: string;
  try {
    const openingRaw = text(formData, 'openingStock') || '0';
    if (!/^\d+$/.test(openingRaw)) throw new DomainError('Opening stock must be a whole number.');
    const created = await createProduct(await getDb(), STORE_ID, {
      ...productInput(formData),
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
  await requireAdmin();
  try {
    await updateProduct(await getDb(), STORE_ID, productId, {
      ...productInput(formData),
      active: formData.get('active') === 'on',
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/admin', 'layout');
  return { message: 'Saved.' };
}

export async function stockInAction(productId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  try {
    const raw = text(formData, 'quantity');
    if (!/^\d+$/.test(raw)) throw new DomainError('Quantity must be a whole number.');
    const updated = await stockIn(await getDb(), STORE_ID, {
      productId,
      quantity: Number(raw),
      staffId: admin.id,
      note: text(formData, 'note'),
    });
    revalidatePath('/admin', 'layout');
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
