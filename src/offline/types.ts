import type { CounterProduct } from '@/server/services/products';

/**
 * Plan v18 — a sale made when the shop's server could not be reached. It waits
 * on the phone (IndexedDB) until it is sent; `operationId` makes sending it
 * twice harmless. Only the person who made it can send it.
 */
export type QueuedSale = {
  operationId: string;
  /** Who made it (logged in on this phone at the time). */
  recordedBy: string;
  recordedByName: string;
  /** Phone time when it was made (ISO). */
  madeAt: string;
  /** Scanned item; absent for a sale entered by hand. */
  productId?: string;
  /** Scanned item: the MRP the phone showed. */
  mrpPaise?: number;
  manual?: { name: string; size?: string };
  quantity: number;
  unitPricePaise: number;
  soldBy: string;
  soldByName: string;
  /** For the list on the phone. */
  name: string;
  size: string;
  color: string;
  /** waiting = will be sent; problem = the shop refused it (reason kept), sent again only when asked. */
  state: 'waiting' | 'problem';
  problem?: string;
  tries: number;
};

/** The counter's copy on the phone, from /api/counter-catalogue (never purchase prices). */
export type PhoneCatalogue = {
  v: 1;
  savedAt: string;
  me: { id: string; name: string };
  staff: { id: string; name: string }[];
  items: CounterProduct[];
};

/** What happened when one waiting sale was sent. */
export type SendOutcome =
  | { kind: 'sent' }
  | { kind: 'refused'; reason: string }
  | { kind: 'login' }
  | { kind: 'offline' };

export type SyncReport = { sent: number; refused: number; stopped: 'login' | 'offline' | null };
