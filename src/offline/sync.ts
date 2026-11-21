import { markReachable, markUnreachable, timeoutSignal } from './network';
import { outboxChanged } from './outbox';
import { createSignal } from './signal';
import { phoneStore, type OfflineStore } from './store';
import type { QueuedSale, SendOutcome, SyncReport } from './types';

export type SendOptions = {
  /** Also send sales the shop refused before (the salesman tapped Try again). */
  retryProblems?: boolean;
  /** Just this one sale. */
  only?: string;
};

/**
 * Plan v18 — sends this person's waiting sales, oldest first, one at a time.
 * Sent → removed from the phone. Refused → kept, marked with the reason. No
 * internet / not logged in → stop and keep everything for the next try.
 */
export async function sendWaiting(
  store: OfflineStore,
  staffId: string,
  send: (sale: QueuedSale) => Promise<SendOutcome>,
  options: SendOptions = {},
): Promise<SyncReport> {
  const report: SyncReport = { sent: 0, refused: 0, stopped: null };
  const queue = (await store.all())
    .filter((s) => s.recordedBy === staffId)
    .filter((s) => (options.only ? s.operationId === options.only : true))
    .filter((s) => s.state === 'waiting' || options.retryProblems)
    .sort((a, b) => a.madeAt.localeCompare(b.madeAt));
  for (const sale of queue) {
    const outcome = await send(sale);
    if (outcome.kind === 'sent') {
      await store.remove(sale.operationId);
      report.sent++;
    } else if (outcome.kind === 'refused') {
      await store.update(sale.operationId, { state: 'problem', problem: outcome.reason, tries: sale.tries + 1 });
      report.refused++;
    } else {
      await store.update(sale.operationId, { tries: sale.tries + 1 });
      report.stopped = outcome.kind;
      break;
    }
  }
  return report;
}

/** What the server is sent for one waiting sale (see /api/offline-sales). */
export function offlineSaleBody(sale: QueuedSale) {
  return {
    operationId: sale.operationId,
    productId: sale.productId,
    manual: sale.manual,
    quantity: sale.quantity,
    unitPricePaise: sale.unitPricePaise,
    totalPaise: sale.totalPaise,
    soldBy: sale.soldBy,
    recordedBy: sale.recordedBy,
    madeAt: sale.madeAt,
    mrpPaise: sale.mrpPaise,
  };
}

/** Sends one sale to the shop's server. */
export async function sendToShop(sale: QueuedSale): Promise<SendOutcome> {
  let res: Response;
  try {
    res = await fetch('/api/offline-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offlineSaleBody(sale)),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: timeoutSignal(20_000),
    });
  } catch {
    return { kind: 'offline' };
  }
  if (res.ok) return { kind: 'sent' };
  if (res.status === 401 || res.status === 403) return { kind: 'login' };
  if (res.status === 400 || res.status === 422) {
    const data: { error?: unknown } = await res.json().catch(() => ({}));
    return { kind: 'refused', reason: typeof data.error === 'string' ? data.error : '' };
  }
  // The server had a problem (or is being updated): keep it and try later.
  return { kind: 'offline' };
}

/** Screens watch these: sending now, and "log in again to send". */
export const sending = createSignal(false);
export const needsLogin = createSignal(false);
/** Count of sales sent by the last run (for the "sent" message). */
export const lastSent = createSignal<{ n: number; at: number } | null>(null);

let running: Promise<SyncReport> | null = null;

/**
 * Sends this person's waiting sales now (one run at a time, across tabs too).
 * Safe to call often: a sale already recorded comes back as "sent".
 */
export function syncNow(staffId: string, options: SendOptions = {}): Promise<SyncReport> {
  // A tap on Try again during a background run: run again right after it.
  if (running) return options.retryProblems || options.only ? running.then(() => syncNow(staffId, options)) : running;
  const work = async () => {
    sending.set(true);
    try {
      const report = await sendWaiting(phoneStore, staffId, sendToShop, options);
      if (report.stopped === 'offline') markUnreachable();
      else markReachable();
      needsLogin.set(report.stopped === 'login');
      if (report.sent > 0) lastSent.set({ n: report.sent, at: Date.now() });
      return report;
    } finally {
      sending.set(false);
      await outboxChanged();
    }
  };
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const run: Promise<SyncReport> = locks ? locks.request('maa-offline-send', () => work()).then((report) => report) : work();
  running = run.finally(() => {
    running = null;
  });
  return running;
}
