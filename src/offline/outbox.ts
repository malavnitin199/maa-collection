import { phoneStore } from './store';
import type { QueuedSale } from './types';

/**
 * Plan v18 — the waiting sales as screens see them: one shared, sorted list
 * (oldest first) that every tab re-reads when any tab changes it.
 */
const EMPTY: readonly QueuedSale[] = Object.freeze([]);
let snapshot: readonly QueuedSale[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function listenToOtherTabs() {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel('maa-offline');
  channel.onmessage = () => void reloadOutbox();
}

export async function reloadOutbox() {
  const all = await phoneStore.all().catch(() => [] as QueuedSale[]);
  snapshot = Object.freeze(all.sort((a, b) => a.madeAt.localeCompare(b.madeAt)));
  loaded = true;
  for (const listener of listeners) listener();
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  listenToOtherTabs();
  if (!loaded) void reloadOutbox();
  return () => void listeners.delete(listener);
}

export const outboxSnapshot = () => snapshot;
export const emptyOutbox = () => EMPTY;

/** After a change: this tab and the others read the list again. */
export async function outboxChanged() {
  await reloadOutbox();
  channel?.postMessage('changed');
}

/** Saves a sale on the phone. Throws only if the phone cannot store it at all. */
export async function queueSale(sale: QueuedSale) {
  await phoneStore.put(sale);
  await outboxChanged();
}

export async function removeQueued(operationId: string) {
  await phoneStore.remove(operationId);
  await outboxChanged();
}
