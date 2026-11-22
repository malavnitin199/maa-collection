'use server';

import { getDb } from '@/db/client';
import type { TagProduct } from '@/features/catalog/hang-tag';
import { STORE_ID } from '@/lib/app-config';
import { itemLink } from '@/lib/item-link';
import { PRINT_MAX } from '@/lib/selection-limits';
import { appOrigin } from '@/server/app-origin';
import { requireAnyPermission } from '@/server/auth';
import { productsByIds, tagSizesFor } from '@/server/services/products';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';

/** One item's hang tag, as the label sheet draws it: exactly what the printed tag says. */
export type ProductLabel = {
  id: string;
  tag: TagProduct;
  /** The tag's size row (the category's sizes, this one ticked). */
  sizes: string[];
  /** The QR code's item link. */
  qr: string;
  /** The purchase price in the owner's letter code, when tags print it. */
  priceCode: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stocks → a card's QR button (owner's feedback 2026-11-23, ADR-070): the tags of that design's
 * items, in the card's order (`ids`: colour, then size), hidden ones too. Fetched only when the
 * sheet opens, so the list stays light. The same people as the print page (catalog or stock);
 * no purchase price is sent, only the tag's own letter code when the shop prints it.
 */
export async function productLabelsAction(ids: readonly string[]): Promise<ProductLabel[]> {
  await requireAnyPermission(['catalog', 'stock']);
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((id) => UUID.test(id)))].slice(0, PRINT_MAX);
  if (wanted.length === 0) return [];
  const db = await getDb();
  const [rows, settings, origin] = await Promise.all([productsByIds(db, STORE_ID, wanted, { hidden: true }), getStoreSettings(db, STORE_ID), appOrigin()]);
  const sizes = await tagSizesFor(db, STORE_ID, rows);
  const rank = new Map(wanted.map((id, i) => [id, i]));
  return rows
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .map((p) => ({
      id: p.id,
      // Colour is never shown outside the product page (ADR-049); the tag doesn't print it.
      tag: { sku: p.sku, barcode: p.barcode, name: p.name, brand: p.brand || undefined, size: p.size, color: '', mrpPaise: p.mrpPaise, packSize: p.packSize, packMrpPaise: p.packMrpPaise },
      sizes: sizes.get(p.id) ?? [],
      qr: itemLink(origin, p.barcode),
      priceCode: labelPriceCode(settings, p.costPaise),
    }));
}
