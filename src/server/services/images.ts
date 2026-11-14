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
  if (input.bytes.length === 0) throw new DomainError('The photo is empty.');
  if (input.bytes.length > MAX_IMAGE_BYTES) throw new DomainError('That photo is too large. Try again (it is resized automatically).');
  const contentType = sniffImageType(input.bytes);
  if (!contentType || !ALLOWED_TYPES.includes(contentType)) throw new DomainError('Only JPEG, PNG or WebP photos can be added.');

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.id, input.productId)))
    .limit(1);
  if (!product) throw new DomainError('Product not found.');

  const [{ count, maxSort }] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      maxSort: sql<number>`coalesce(max(${productImages.sortOrder}), -1)`.mapWith(Number),
    })
    .from(productImages)
    .where(eq(productImages.productId, input.productId));
  if (count >= MAX_IMAGES_PER_PRODUCT) throw new DomainError(`Up to ${MAX_IMAGES_PER_PRODUCT} photos per product. Delete one first.`);

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
  if (!image) throw new DomainError('Photo not found.');
  const [{ minSort }] = await db
    .select({ minSort: sql<number>`coalesce(min(${productImages.sortOrder}), 0)`.mapWith(Number) })
    .from(productImages)
    .where(eq(productImages.productId, image.productId));
  await db.update(productImages).set({ sortOrder: minSort - 1 }).where(eq(productImages.id, imageId));
}

export async function deleteImage(db: Db, storeId: string, imageId: string) {
  const deleted = await db
    .delete(productImages)
    .where(and(eq(productImages.storeId, storeId), eq(productImages.id, imageId)))
    .returning({ id: productImages.id });
  if (deleted.length === 0) throw new DomainError('Photo not found.');
}
