/**
 * All tags (plan v13): the filters in the page address, and how tags are
 * grouped (by date made, company, category or delivery). Pure — shared by the
 * All tags page and its print page, and unit-tested.
 */
import { STORE_TIMEZONE } from './app-config';

export const TAG_GROUPS = ['date', 'company', 'category', 'delivery'] as const;
export type TagGroupBy = (typeof TAG_GROUPS)[number];

export const TAG_WHEN = ['today', '7d', '30d', 'all'] as const;
export type TagWhen = (typeof TAG_WHEN)[number];

/** Tags drawn at once on the All tags page (each QR is a few hundred squares). */
export const TAG_PAGE = 120;
/** Most tags the page will draw, after "Show more". */
export const TAG_LIMIT_MAX = 1200;
/** Most items printed from one All tags print. */
export const TAG_PRINT_MAX = 400;

export type TagParams = {
  q: string;
  /** A company id, or 'none' for items without a company. */
  supplier?: string;
  category?: string;
  /** Staff id of the person who made the tag. */
  made?: string;
  when: TagWhen;
  /** Only items with pieces in stock. */
  stock: boolean;
  group: TagGroupBy;
  /** One group (print page): a day `YYYY-MM-DD`, an id, or 'none'. */
  key?: string;
  limit: number;
};

export type TagFilter = {
  search: string;
  supplierId?: string;
  categoryId?: string;
  createdBy?: string;
  when: TagWhen;
  inStockOnly: boolean;
};

type Raw = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GROUP_KEY = /^(\d{4}-\d{2}-\d{2}|none|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const uuid = (value: string | undefined) => (value && UUID.test(value) ? value : undefined);
const pick = <T extends string>(list: readonly T[], value: string | undefined, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

/** Reads the page address; anything unknown or malformed falls back to the default. */
export function parseTagParams(raw: Raw): TagParams {
  const supplier = one(raw.supplier);
  const key = one(raw.key);
  const limit = Number.parseInt(one(raw.limit) ?? '', 10);
  return {
    q: (one(raw.q) ?? '').trim().slice(0, 80),
    supplier: supplier === 'none' ? 'none' : uuid(supplier),
    category: uuid(one(raw.category)),
    made: uuid(one(raw.made)),
    when: pick(TAG_WHEN, one(raw.when), 'all'),
    stock: one(raw.stock) === 'in',
    group: pick(TAG_GROUPS, one(raw.group), 'date'),
    key: key && GROUP_KEY.test(key) ? key : undefined,
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, TAG_PAGE), TAG_LIMIT_MAX) : TAG_PAGE,
  };
}

export function tagFilter(p: TagParams): TagFilter {
  return { search: p.q, supplierId: p.supplier, categoryId: p.category, createdBy: p.made, when: p.when, inStockOnly: p.stock };
}

/** True when any filter (not the grouping) narrows the list. */
export function hasTagFilters(p: TagParams): boolean {
  return Boolean(p.q || p.supplier || p.category || p.made || p.when !== 'all' || p.stock);
}

function query(p: TagParams, extra: [string, string][] = []): string {
  const s = new URLSearchParams();
  if (p.q) s.set('q', p.q);
  if (p.supplier) s.set('supplier', p.supplier);
  if (p.category) s.set('category', p.category);
  if (p.made) s.set('made', p.made);
  if (p.when !== 'all') s.set('when', p.when);
  if (p.stock) s.set('stock', 'in');
  if (p.group !== 'date') s.set('group', p.group);
  for (const [k, v] of extra) s.set(k, v);
  return s.toString();
}

/** The All tags page with some values changed. "Show more" is kept only when asked for. */
export function tagLibraryHref(p: TagParams, change: Partial<TagParams> = {}): string {
  const next = { ...p, limit: TAG_PAGE, ...change };
  const q = query(next, next.limit > TAG_PAGE ? [['limit', String(next.limit)]] : []);
  return q ? `/admin/labels?${q}` : '/admin/labels';
}

/** The print page for what the filters show, or for one group of it. */
export function tagPrintHref(p: TagParams, key?: string): string {
  const extra: [string, string][] = [['list', '1']];
  if (key) extra.push(['group', p.group], ['key', key]);
  return `/admin/labels/print?${query(p, extra)}`;
}

/** The calendar day (YYYY-MM-DD) in the shop's time zone. */
export function shopDay(date: Date, timezone: string = STORE_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** What grouping needs from a tag row. */
export type GroupableTag = {
  createdAt: Date;
  stock: number;
  supplierId: string | null;
  supplierName: string | null;
  categoryId: string | null;
  category: string;
  createdByName: string | null;
  receiptId: string | null;
  receiptBill: string | null;
  receiptAt: Date | null;
};

export type TagGroup<T> = {
  /** In the address: a day, an id, or 'none'. */
  key: string;
  by: TagGroupBy;
  /** Day (YYYY-MM-DD), company or category name; null = no company / no category / added one by one. */
  name: string | null;
  items: T[];
  /** Pieces in stock across the group. */
  pieces: number;
  /** Delivery groups: the bill, when and by whom. */
  delivery?: { bill: string | null; at: Date; by: string | null };
};

function keyAndName(row: GroupableTag, by: TagGroupBy, timezone: string): [string, string | null] {
  if (by === 'date') {
    const day = shopDay(row.createdAt, timezone);
    return [day, day];
  }
  if (by === 'company') return [row.supplierId ?? 'none', row.supplierId ? row.supplierName : null];
  if (by === 'category') return [row.categoryId ?? 'none', row.categoryId ? row.category : null];
  return [row.receiptId ?? 'none', row.receiptId ? row.supplierName : null];
}

const byName = (a: string | null, b: string | null) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : a.localeCompare(b, 'en', { sensitivity: 'base' });

/**
 * Groups tags, keeping each group's rows in the order given (newest first from
 * the query). Order: days newest first; companies and categories A–Z; deliveries
 * newest first. The "none" group (no company / category / delivery) comes last.
 */
export function groupTags<T extends GroupableTag>(rows: readonly T[], by: TagGroupBy, timezone: string = STORE_TIMEZONE): TagGroup<T>[] {
  const groups = new Map<string, TagGroup<T>>();
  for (const row of rows) {
    const [key, name] = keyAndName(row, by, timezone);
    let group = groups.get(key);
    if (!group) {
      group = { key, by, name, items: [], pieces: 0 };
      if (by === 'delivery' && row.receiptId && row.receiptAt) group.delivery = { bill: row.receiptBill, at: row.receiptAt, by: row.createdByName };
      groups.set(key, group);
    }
    group.items.push(row);
    group.pieces += Math.max(row.stock, 0);
  }
  const list = [...groups.values()];
  const noneLast = (a: TagGroup<T>, b: TagGroup<T>) => (a.key === 'none' ? 1 : 0) - (b.key === 'none' ? 1 : 0);
  if (by === 'date') return list.sort((a, b) => b.key.localeCompare(a.key));
  if (by === 'delivery') return list.sort((a, b) => noneLast(a, b) || (b.delivery?.at.getTime() ?? 0) - (a.delivery?.at.getTime() ?? 0));
  return list.sort((a, b) => noneLast(a, b) || byName(a.name, b.name));
}

/** Draws at most `limit` tags, group by group in order; each group keeps its full counts. */
export function capGroups<T>(groups: readonly TagGroup<T>[], limit: number) {
  let left = limit;
  const capped = groups.map((g) => {
    const shown = g.items.slice(0, Math.max(left, 0));
    left -= shown.length;
    return { ...g, shown };
  });
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return { groups: capped.filter((g) => g.shown.length > 0), shown: Math.min(total, limit), total };
}
