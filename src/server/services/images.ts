import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { productImages, products } from '@/db/schema';
import { DomainError } from './errors';

export const MAX_IMAGES_PER_PRODUCT = 8;
export const MAX_IMAGE_BYTES = 1_500_000;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type ImageMeta = { id: string; productId: string; sortOrder: number; width: number | null; height: number | null; url: string | null };

/** Where the browser loads a photo from: the external URL, or our image route. */
export function imageSrc(image: { id: string; url: string | null }): string {
  return image.url ?? `/api/product-images/${image.id}`;
}
// A `url` is either an external store (e.g. Vercel Blob) or, for a photo shared by
// several items, another photo's /api/product-images/<id> address.

/** Recognises JPEG / PNG / WebP by their first bytes, so a renamed file can't pass as an image. */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export async function addProductImage(
  db: Db,
  storeId: string,
  input: { productId: string; bytes: Uint8Array; width?: number | null; height?: number | null; staffId: string },
): Promise<ImageMeta> {
  if (input.bytes.length === 0) throw new DomainError('The photo is empty.', { key: 'stk.err.photoEmpty' });
  if (input.bytes.length > MAX_IMAGE_BYTES) throw new DomainError('That photo is too large. Try again (it is resized automatically).', { key: 'stk.err.photoTooLarge' });
  const contentType = sniffImageType(input.bytes);
  if (!contentType || !ALLOWED_TYPES.includes(contentType)) throw new DomainError('Only JPEG, PNG or WebP photos can be added.', { key: 'stk.err.photoType' });

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.id, input.productId)))
    .limit(1);
  if (!product) throw new DomainError('Product not found.', { key: 'error.productNotFound' });

  const [{ count, maxSort }] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      maxSort: sql<number>`coalesce(max(${productImages.sortOrder}), -1)`.mapWith(Number),
    })
    .from(productImages)
    .where(eq(productImages.productId, input.productId));
  if (count >= MAX_IMAGES_PER_PRODUCT) {
    throw new DomainError(`Up to ${MAX_IMAGES_PER_PRODUCT} photos per product. Delete one first.`, { key: 'stk.err.photoLimit', vars: { n: MAX_IMAGES_PER_PRODUCT } });
  }

  const [row] = await db
    .insert(productImages)
    .values({
      storeId,
      productId: input.productId,
      contentType,
      data: input.bytes,
      byteSize: input.bytes.length,
      width: input.width ?? null,
      height: input.height ?? null,
      sortOrder: maxSort + 1,
      createdBy: input.staffId,
    })
    .returning();
  return { id: row.id, productId: row.productId, sortOrder: row.sortOrder, width: row.width, height: row.height, url: row.url };
}

const metaColumns = {
  id: productImages.id,
  productId: productImages.productId,
  sortOrder: productImages.sortOrder,
  width: productImages.width,
  height: productImages.height,
  url: productImages.url,
};

export async function listProductImages(db: Db, storeId: string, productId: string): Promise<ImageMeta[]> {
  return db
    .select(metaColumns)
    .from(productImages)
    .where(and(eq(productImages.storeId, storeId), eq(productImages.productId, productId)))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
}

/** Main (first) photo for each product id that has one. */
export async function mainImages(db: Db, storeId: string, productIds: string[]): Promise<Map<string, ImageMeta>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select(metaColumns)
    .from(productImages)
    .where(and(eq(productImages.storeId, storeId), inArray(productImages.productId, productIds)))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
  const result = new Map<string, ImageMeta>();
  for (const row of rows) if (!result.has(row.productId)) result.set(row.productId, row);
  return result;
}

export async function getImageData(db: Db, storeId: string, imageId: string) {
  const [row] = await db
    .select({ data: productImages.data, contentType: productImages.contentType, url: productImages.url })
    .from(productImages)
    .where(and(eq(productImages.storeId, storeId), eq(productImages.id, imageId)))
    .limit(1);
  return row ?? null;
}

/** Makes this photo the main one (shown in lists and at the counter). */
export async function makeMainImage(db: Db, storeId: string, imageId: string) {
  const [image] = await db
    .select({ productId: productImages.productId })
    .from(productImages)
    .where(and(eq(productImages.storeId, storeId), eq(productImages.id, imageId)))
    .limit(1);
  if (!image) throw new DomainError('Photo not found.', { key: 'stk.err.photoNotFound' });
  const [{ minSort }] = await db
    .select({ minSort: sql<number>`coalesce(min(${productImages.sortOrder}), 0)`.mapWith(Number) })
    .from(productImages)
    .where(eq(productImages.productId, image.productId));
  await db.update(productImages).set({ sortOrder: minSort - 1 }).where(eq(productImages.id, imageId));
}

/** Our own address for a stored photo — also what shared copies point to. */
const ownSrc = (imageId: string) => `/api/product-images/${imageId}`;

/**
 * One photo for several items — e.g. every size of a colour, taken while
 * creating their tags. The first item stores the bytes; the others get a row
 * that points to it (no copies of the bytes). Max 60 items at once.
 */
export async function addPhotoToProducts(
  db: Db,
  storeId: string,
  input: { productIds: string[]; bytes: Uint8Array; width?: number | null; height?: number | null; staffId: string },
): Promise<ImageMeta[]> {
  const ids = [...new Set(input.productIds)];
  if (ids.length === 0) throw new DomainError('Choose the items for this photo.', { key: 'stk.err.photoChooseItems' });
  if (ids.length > 60) throw new DomainError('Too many items for one photo.', { key: 'stk.err.photoTooManyItems' });
  const owned = await db.select({ id: products.id }).from(products).where(and(eq(products.storeId, storeId), inArray(products.id, ids)));
  if (owned.length !== ids.length) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
  const first = await addProductImage(db, storeId, { ...input, productId: ids[0] });
  const contentType = sniffImageType(input.bytes)!;
  const shared: ImageMeta[] = [];
  for (const productId of ids.slice(1)) {
    const [{ count, maxSort }] = await db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        maxSort: sql<number>`coalesce(max(${productImages.sortOrder}), -1)`.mapWith(Number),
      })
      .from(productImages)
      .where(eq(productImages.productId, productId));
    if (count >= MAX_IMAGES_PER_PRODUCT) continue; // that item is full; it keeps its own photos
    const [row] = await db
      .insert(productImages)
      .values({
        storeId,
        productId,
        contentType,
        data: null,
        url: ownSrc(first.id),
        byteSize: 0,
        width: input.width ?? null,
        height: input.height ?? null,
        sortOrder: maxSort + 1,
        createdBy: input.staffId,
      })
      .returning();
    shared.push({ id: row.id, productId: row.productId, sortOrder: row.sortOrder, width: row.width, height: row.height, url: row.url });
  }
  return [first, ...shared];
}

/**
 * Deletes one item's photo. If other items share it (their `url` points here),
 * the bytes move to the first of them and the rest point to that one, so they
 * keep their photo.
 */
export async function deleteImage(db: Db, storeId: string, imageId: string) {
  await db.transaction(async (tx) => {
    const [image] = await tx
      .select({ data: productImages.data, byteSize: productImages.byteSize })
      .from(productImages)
      .where(and(eq(productImages.storeId, storeId), eq(productImages.id, imageId)))
      .limit(1);
    if (!image) throw new DomainError('Photo not found.', { key: 'stk.err.photoNotFound' });
    if (image.data) {
      const sharers = await tx
        .select({ id: productImages.id })
        .from(productImages)
        .where(and(eq(productImages.storeId, storeId), eq(productImages.url, ownSrc(imageId))))
        .orderBy(asc(productImages.createdAt), asc(productImages.id));
      const [heir, ...rest] = sharers;
      if (heir) {
        await tx.update(productImages).set({ data: image.data, url: null, byteSize: image.byteSize }).where(eq(productImages.id, heir.id));
        if (rest.length > 0) {
          await tx.update(productImages).set({ url: ownSrc(heir.id) }).where(inArray(productImages.id, rest.map((r) => r.id)));
        }
      }
    }
    await tx.delete(productImages).where(eq(productImages.id, imageId));
  });
}

/**
 * Before items' photos are deleted (ADR-050): a photo stored once and shared by
 * other items (their rows point at it) is handed to the first of those, so their
 * photos keep working. Then every photo row of the deleted items goes.
 */
export async function dropImagesOf(db: Db, storeId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const holders = await db
    .select({ id: productImages.id, data: productImages.data })
    .from(productImages)
    .where(and(eq(productImages.storeId, storeId), inArray(productImages.productId, productIds), sql`${productImages.data} IS NOT NULL`));
  for (const holder of holders) {
    const users = await db
      .select({ id: productImages.id })
      .from(productImages)
      .where(and(eq(productImages.storeId, storeId), eq(productImages.url, ownSrc(holder.id)), sql`${productImages.productId} NOT IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})`))
      .orderBy(asc(productImages.createdAt));
    if (users.length === 0) continue;
    const [heir, ...rest] = users;
    await db.update(productImages).set({ data: holder.data, url: null }).where(eq(productImages.id, heir.id));
    if (rest.length) await db.update(productImages).set({ url: ownSrc(heir.id) }).where(inArray(productImages.id, rest.map((r) => r.id)));
  }
  await db.delete(productImages).where(and(eq(productImages.storeId, storeId), inArray(productImages.productId, productIds)));
}
