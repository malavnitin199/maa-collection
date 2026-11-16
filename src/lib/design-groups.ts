/**
 * Combined view (plan v14): items with the same name, company and MRP are one
 * design on screen — only their size or colour differs. Each item keeps its own
 * barcode and tag; this only changes how lists are shown. Pure, unit-tested.
 */
import { sortSizes } from './size-prices';

export type DesignRow = {
  id: string;
  name: string;
  supplierId: string | null;
  supplierName: string | null;
  mrpPaise: number;
  pricePaise: number;
  size: string;
  color: string;
  stock: number;
};

export type DesignGroup<T> = {
  /** Stable key for links (`company~mrp~name`). */
  key: string;
  name: string;
  supplierName: string | null;
  mrpPaise: number;
  /** Its items: by colour (first seen), then size in shop order. */
  items: T[];
  /** Every size in shop order with its pieces in stock (all colours). */
  sizes: { size: string; pieces: number }[];
  /** Every colour in first-seen order with its pieces in stock (all sizes). */
  colors: { color: string; pieces: number }[];
  pieces: number;
  minPricePaise: number;
  maxPricePaise: number;
};

const KEY = /^(none|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})~\d{1,12}~.{1,120}$/i;

export function designKey(row: Pick<DesignRow, 'name' | 'supplierId' | 'mrpPaise'>): string {
  return `${row.supplierId ?? 'none'}~${row.mrpPaise}~${row.name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

/** A design key from a page address, or undefined when it isn't one. */
export function parseDesignKey(value: string | undefined): string | undefined {
  return value && value.length <= 200 && KEY.test(value) ? value : undefined;
}

const norm = (value: string) => value.trim().toLowerCase();

export function groupDesigns<T extends DesignRow>(rows: readonly T[]): DesignGroup<T>[] {
  const groups = new Map<string, DesignGroup<T>>();
  for (const row of rows) {
    const key = designKey(row);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: row.name.trim(),
        supplierName: row.supplierName,
        mrpPaise: row.mrpPaise,
        items: [],
        sizes: [],
        colors: [],
        pieces: 0,
        minPricePaise: row.pricePaise,
        maxPricePaise: row.pricePaise,
      };
      groups.set(key, group);
    }
    const pieces = Math.max(row.stock, 0);
    group.items.push(row);
    group.pieces += pieces;
    group.minPricePaise = Math.min(group.minPricePaise, row.pricePaise);
    group.maxPricePaise = Math.max(group.maxPricePaise, row.pricePaise);
    const size = group.sizes.find((s) => norm(s.size) === norm(row.size));
    if (size) size.pieces += pieces;
    else group.sizes.push({ size: row.size.trim(), pieces });
    const color = group.colors.find((c) => norm(c.color) === norm(row.color));
    if (color) color.pieces += pieces;
    else group.colors.push({ color: row.color.trim(), pieces });
  }
  for (const group of groups.values()) {
    const order = sortSizes(group.sizes.map((s) => s.size));
    group.sizes.sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size));
    const colorRank = (row: T) => group.colors.findIndex((c) => norm(c.color) === norm(row.color));
    const sizeRank = (row: T) => group.sizes.findIndex((s) => norm(s.size) === norm(row.size));
    group.items.sort((a, b) => colorRank(a) - colorRank(b) || sizeRank(a) - sizeRank(b));
  }
  return [...groups.values()];
}
