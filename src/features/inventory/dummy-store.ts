'use client';

/**
 * In-browser dummy inventory store (localStorage) shared by the POS and the
 * admin dashboard. Replaced by the real PostgreSQL-backed API in Phase P2/P3.
 * Single-browser demo only: two devices do not see each other's sales.
 */
import { useSyncExternalStore } from 'react';
import type { CatalogItem } from '@/features/catalog/dummy-catalog';
import { validateSaleDraft, type SaleRecord, type StockMap } from './inventory';

export type InventoryState = { stock: StockMap; sales: SaleRecord[] };

export const INITIAL_STOCK: StockMap = {
  'MAA-TS-001': 3,
  'MAA-TS-002': 5,
  'MAA-KU-001': 4,
  'MAA-KU-002': 2,
  'MAA-JE-001': 6,
  'MAA-SH-001': 1,
  'MAA-SA-001': 0,
  'MAA-DR-001': 8,
};

const INITIAL_STATE: InventoryState = { stock: INITIAL_STOCK, sales: [] };
const STORAGE_KEY = 'maa-collection-demo-inventory-v1';

let state: InventoryState = INITIAL_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode/quota): demo keeps working in memory.
  }
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as InventoryState;
      if (parsed && typeof parsed.stock === 'object' && Array.isArray(parsed.sales)) {
        state = parsed;
      }
    }
  } catch {
    // Corrupt or unavailable storage: fall back to initial dummy data.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): InventoryState {
  load();
  return state;
}

function getServerSnapshot(): InventoryState {
  return INITIAL_STATE;
}

export type RecordSaleResult =
  | { ok: true; record: SaleRecord; stockLeft: number }
  | { ok: false; error: string };

export function recordSale(input: {
  item: CatalogItem;
  quantity: number;
  unitPricePaise: number;
  salesperson: string;
}): RecordSaleResult {
  load();
  if (!input.salesperson.trim()) return { ok: false, error: 'Select a salesperson.' };
  const available = state.stock[input.item.sku] ?? 0;
  const error = validateSaleDraft(
    { quantity: input.quantity, unitPricePaise: input.unitPricePaise },
    { stock: available, mrpPaise: input.item.mrpPaise },
  );
  if (error) return { ok: false, error };

  const record: SaleRecord = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    salesperson: input.salesperson,
    sku: input.item.sku,
    design: input.item.design,
    size: input.item.size,
    color: input.item.color,
    quantity: input.quantity,
    unitPricePaise: input.unitPricePaise,
    totalPaise: input.quantity * input.unitPricePaise,
    mrpPaise: input.item.mrpPaise,
  };
  const stockLeft = available - input.quantity;
  state = {
    stock: { ...state.stock, [input.item.sku]: stockLeft },
    sales: [record, ...state.sales],
  };
  persist();
  emit();
  return { ok: true, record, stockLeft };
}

export function resetDemo() {
  state = INITIAL_STATE;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean if storage is unavailable.
  }
  emit();
}

export function useInventory(): InventoryState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
