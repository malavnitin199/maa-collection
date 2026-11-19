import type { PhoneCatalogue, QueuedSale } from './types';

/**
 * Plan v18 — where waiting sales and the counter's copy live on the phone.
 * IndexedDB first; if the browser blocks it, localStorage (one entry per sale).
 * A save resolves only when it is really written, so "Saved on this phone"
 * is true when the salesman sees it.
 */
export interface OfflineStore {
  all(): Promise<QueuedSale[]>;
  put(sale: QueuedSale): Promise<void>;
  /** Changes a waiting sale only if it is still there (another tab may have sent it). */
  update(operationId: string, change: Partial<QueuedSale>): Promise<void>;
  remove(operationId: string): Promise<void>;
  getCatalogue(): Promise<PhoneCatalogue | null>;
  setCatalogue(catalogue: PhoneCatalogue | null): Promise<void>;
}

/** For tests (and a last resort): nothing survives a reload. */
export function memoryStore(initial: QueuedSale[] = []): OfflineStore {
  const sales = new Map(initial.map((s) => [s.operationId, { ...s }]));
  let catalogue: PhoneCatalogue | null = null;
  return {
    all: async () => [...sales.values()].map((s) => ({ ...s })),
    put: async (sale) => void sales.set(sale.operationId, { ...sale }),
    update: async (id, change) => {
      const sale = sales.get(id);
      if (sale) sales.set(id, { ...sale, ...change });
    },
    remove: async (id) => void sales.delete(id),
    getCatalogue: async () => catalogue,
    setCatalogue: async (next) => void (catalogue = next),
  };
}

// ── IndexedDB ────────────────────────────────────────────────────────────────

const DB_NAME = 'maa-offline';
const OUTBOX = 'outbox';
const KV = 'kv';
const CATALOGUE_KEY = 'catalogue';

let opening: Promise<IDBDatabase> | null = null;

function openVersion(version?: number): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'));
    const request = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: 'operationId' });
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed'));
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

/** Opens whatever version is there; if its stores are missing, upgrades once to add them. */
async function openStores(): Promise<IDBDatabase> {
  let db = await openVersion();
  if (!db.objectStoreNames.contains(OUTBOX) || !db.objectStoreNames.contains(KV)) {
    const next = db.version + 1;
    db.close();
    db = await openVersion(next);
  }
  // Another tab upgrades: let it.
  db.onversionchange = () => {
    db.close();
    opening = null;
  };
  return db;
}

function openDb(): Promise<IDBDatabase> {
  if (opening) return opening;
  const attempt = openStores();
  opening = attempt;
  attempt.catch(() => {
    if (opening === attempt) opening = null;
  });
  return attempt;
}

/** One transaction; resolves when it is committed. */
async function inTransaction<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (objects: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = work(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request ? request.result : undefined);
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted'));
  });
}

const idb: OfflineStore = {
  all: async () => (await inTransaction<QueuedSale[]>(OUTBOX, 'readonly', (s) => s.getAll())) ?? [],
  put: async (sale) => void (await inTransaction(OUTBOX, 'readwrite', (s) => s.put(sale))),
  update: async (id, change) =>
    void (await inTransaction(OUTBOX, 'readwrite', (s) => {
      const read = s.get(id);
      read.onsuccess = () => {
        if (read.result) s.put({ ...read.result, ...change });
      };
    })),
  remove: async (id) => void (await inTransaction(OUTBOX, 'readwrite', (s) => s.delete(id))),
  getCatalogue: async () => (await inTransaction<PhoneCatalogue | undefined>(KV, 'readonly', (s) => s.get(CATALOGUE_KEY))) ?? null,
  setCatalogue: async (catalogue) =>
    void (await inTransaction(KV, 'readwrite', (s) => {
      if (catalogue) s.put(catalogue, CATALOGUE_KEY);
      else s.delete(CATALOGUE_KEY);
    })),
};

// ── localStorage fallback ────────────────────────────────────────────────────

const LS_SALE = 'maa-offline-sale:';
const LS_CATALOGUE = 'maa-offline-catalogue';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const local: OfflineStore = {
  all: async () => {
    const ls = storage();
    if (!ls) return [];
    const found: QueuedSale[] = [];
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key?.startsWith(LS_SALE)) continue;
      try {
        found.push(JSON.parse(ls.getItem(key) ?? 'null'));
      } catch {
        // A broken entry is skipped, never deleted.
      }
    }
    return found.filter(Boolean);
  },
  put: async (sale) => {
    const ls = storage();
    if (!ls) throw new Error('No storage on this phone');
    ls.setItem(LS_SALE + sale.operationId, JSON.stringify(sale));
  },
  update: async (id, change) => {
    const ls = storage();
    const raw = ls?.getItem(LS_SALE + id);
    if (ls && raw) ls.setItem(LS_SALE + id, JSON.stringify({ ...JSON.parse(raw), ...change }));
  },
  remove: async (id) => storage()?.removeItem(LS_SALE + id),
  getCatalogue: async () => {
    try {
      return JSON.parse(storage()?.getItem(LS_CATALOGUE) ?? 'null');
    } catch {
      return null;
    }
  },
  setCatalogue: async (catalogue) => {
    const ls = storage();
    if (!ls) return;
    if (catalogue) ls.setItem(LS_CATALOGUE, JSON.stringify(catalogue));
    else ls.removeItem(LS_CATALOGUE);
  },
};

// ── The phone's store: IndexedDB, falling back to localStorage ───────────────

async function idbWorks(): Promise<boolean> {
  try {
    await openDb();
    return true;
  } catch {
    return false;
  }
}

/** Both places are read, so a sale saved during an IndexedDB hiccup is never forgotten. */
export const phoneStore: OfflineStore = {
  all: async () => {
    const [fromIdb, fromLocal] = await Promise.all([idb.all().catch(() => []), local.all().catch(() => [])]);
    const byId = new Map<string, QueuedSale>();
    for (const sale of [...fromLocal, ...fromIdb]) byId.set(sale.operationId, sale);
    return [...byId.values()];
  },
  put: async (sale) => {
    if (await idbWorks()) {
      try {
        return await idb.put(sale);
      } catch {
        // Fall through to localStorage.
      }
    }
    await local.put(sale);
  },
  update: async (id, change) => {
    await Promise.all([idb.update(id, change).catch(() => {}), local.update(id, change).catch(() => {})]);
  },
  remove: async (id) => {
    await Promise.all([idb.remove(id).catch(() => {}), local.remove(id).catch(() => {})]);
  },
  getCatalogue: async () => ((await idbWorks()) ? idb.getCatalogue().catch(() => null) : local.getCatalogue()),
  setCatalogue: async (catalogue) => {
    if (await idbWorks()) {
      try {
        return await idb.setCatalogue(catalogue);
      } catch {
        // Fall through.
      }
    }
    try {
      await local.setCatalogue(catalogue);
    } catch {
      // A full phone keeps the old copy; scanning online still works.
    }
  },
};
