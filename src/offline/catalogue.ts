import { codeFromScan } from '@/lib/item-link';
import type { CounterProduct } from '@/server/services/products';
import { timeoutSignal } from './network';
import { phoneStore } from './store';
import type { PhoneCatalogue } from './types';

/** Plan v18 — the counter's copy on the phone: find a scanned code the way the server does. */
export function findOnPhone(catalogue: PhoneCatalogue | null, code: string): CounterProduct | null {
  if (!catalogue) return null;
  const needle = codeFromScan(code);
  if (!needle) return null;
  const upper = needle.toUpperCase();
  return catalogue.items.find((p) => p.barcode === needle || p.sku.toUpperCase() === upper) ?? null;
}

export async function phoneCatalogue(): Promise<PhoneCatalogue | null> {
  return phoneStore.getCatalogue().catch(() => null);
}

/** Downloads a fresh copy unless this person's copy is newer than `maxAgeMs`. */
export async function refreshCatalogue(staffId: string, { maxAgeMs = 0 } = {}): Promise<boolean> {
  const current = await phoneCatalogue();
  if (current && current.me.id === staffId && Date.now() - Date.parse(current.savedAt) < maxAgeMs) return true;
  try {
    const res = await fetch('/api/counter-catalogue', { cache: 'no-store', credentials: 'same-origin', signal: timeoutSignal(20_000) });
    if (!res.ok) return false;
    const data = (await res.json()) as PhoneCatalogue;
    // Another tab may have logged in as someone else: keep that person's copy.
    if (data?.v !== 1 || !Array.isArray(data.items) || data.me?.id !== staffId) return false;
    await phoneStore.setCatalogue(data);
    return true;
  } catch {
    return false;
  }
}

/** After a sale: the copy's count follows (the server's count wins at the next download). */
export async function setPhoneStock(productId: string, stock: (current: number) => number) {
  const current = await phoneCatalogue();
  const item = current?.items.find((p) => p.id === productId);
  if (!current || !item) return;
  const next = stock(item.stock);
  if (next === item.stock) return;
  const items = current.items.map((p) => (p.id === productId ? { ...p, stock: next } : p));
  await phoneStore.setCatalogue({ ...current, items }).catch(() => {});
}

export async function forgetCatalogue() {
  await phoneStore.setCatalogue(null).catch(() => {});
}
