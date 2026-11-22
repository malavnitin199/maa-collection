// @vitest-environment node
import { and, eq, inArray } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPgliteDb, type Db } from '@/db/client';
import { productImages } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { listCategories } from './catalog';
import { addPhotoToProducts, getImageData, mainImages, removeDesignPhoto, setDesignPhoto } from './images';
import { createDesign, saveDesign } from './products';
import { listStaff } from './staff';

/** The product page's one photo (owner, 2026-11-23, ADR-068): many sizes, one picture. */
let db: Db;
let owner: string;
let kurta: string;

beforeEach(async () => {
  db = await createPgliteDb(undefined, { seed: 'demo' });
  owner = (await listStaff(db, STORE_ID)).find((p) => p.role === 'admin')!.id;
  kurta = (await listCategories(db, STORE_ID)).find((c) => c.code === 'KU')!.id;
});

const jpeg = (size = 120, mark = 0) => {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0, mark]);
  return bytes;
};
const design = async (name: string, sizes = ['S', 'M', 'L']) =>
  (
    await createDesign(db, STORE_ID, {
      operationId: `photo-${name}`,
      supplierId: null,
      categoryId: kurta,
      name,
      brand: '',
      sizes,
      colors: [],
      mrpPaise: 100000,
      pricePaise: null,
      costPaise: 40000,
      quantityEach: 2,
      staffId: owner,
    })
  ).products.map((p) => p.id);
const rowsOf = (ids: string[]) =>
  db
    .select({ id: productImages.id, productId: productImages.productId, url: productImages.url, byteSize: productImages.byteSize })
    .from(productImages)
    .where(and(eq(productImages.storeId, STORE_ID), inArray(productImages.productId, ids)));

describe('one photo for the whole product', () => {
  it('stores the bytes once on the first size; every other size points to it', async () => {
    const ids = await design('One Photo Kurta');
    const photo = await setDesignPhoto(db, STORE_ID, { productIds: ids, bytes: jpeg(), width: 600, height: 800, staffId: owner });
    expect(photo).toMatchObject({ productId: ids[0], url: null, width: 600, height: 800 });
    const rows = await rowsOf(ids);
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.url === null)).toEqual([expect.objectContaining({ id: photo.id, byteSize: 120 })]);
    expect(rows.filter((r) => r.url !== null).map((r) => r.url)).toEqual([`/api/product-images/${photo.id}`, `/api/product-images/${photo.id}`]);
    expect((await mainImages(db, STORE_ID, ids)).size).toBe(3);
  });

  it('a new photo replaces the old one on every size — no extra photos left behind', async () => {
    const ids = await design('Change Photo Kurta');
    // Before: two photos on S (old screens allowed several), one on M.
    await addPhotoToProducts(db, STORE_ID, { productIds: [ids[0], ids[1]], bytes: jpeg(100, 1), staffId: owner });
    await addPhotoToProducts(db, STORE_ID, { productIds: [ids[0]], bytes: jpeg(100, 2), staffId: owner });
    const photo = await setDesignPhoto(db, STORE_ID, { productIds: ids, bytes: jpeg(140, 3), staffId: owner });
    const rows = await rowsOf(ids);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.productId))).toEqual(new Set(ids));
    expect((await getImageData(db, STORE_ID, photo.id))?.data?.[4]).toBe(3);
    for (const image of (await mainImages(db, STORE_ID, ids)).values()) expect(image.url ?? `/api/product-images/${image.id}`).toBe(`/api/product-images/${photo.id}`);
  });

  it('a photo another product shares is handed on to it, never lost', async () => {
    const mine = await design('Mine Kurta', ['M']);
    const theirs = await design('Theirs Kurta', ['M']);
    // One photo taken for both (stored on mine, theirs points to it).
    const [stored] = await addPhotoToProducts(db, STORE_ID, { productIds: [...mine, ...theirs], bytes: jpeg(100, 7), staffId: owner });
    await setDesignPhoto(db, STORE_ID, { productIds: mine, bytes: jpeg(100, 8), staffId: owner });
    const [their] = await rowsOf(theirs);
    expect(their.url).toBeNull();
    expect((await getImageData(db, STORE_ID, their.id))?.data?.[4]).toBe(7);
    expect(await getImageData(db, STORE_ID, stored.id)).toBeNull();
  });

  it('Remove photo: no size has one; checks refuse a bad photo and leave the old one', async () => {
    const ids = await design('Remove Photo Kurta');
    await setDesignPhoto(db, STORE_ID, { productIds: ids, bytes: jpeg(), staffId: owner });
    await expect(setDesignPhoto(db, STORE_ID, { productIds: ids, bytes: new TextEncoder().encode('<svg/>'), staffId: owner })).rejects.toThrow(/Only JPEG/);
    await expect(setDesignPhoto(db, STORE_ID, { productIds: ids, bytes: new Uint8Array(0), staffId: owner })).rejects.toThrow(/empty/);
    await expect(setDesignPhoto(db, STORE_ID, { productIds: [...ids, '00000000-0000-4000-8000-000000000000'], bytes: jpeg(), staffId: owner })).rejects.toThrow(/Product not found/);
    expect(await rowsOf(ids)).toHaveLength(3);
    await removeDesignPhoto(db, STORE_ID, ids);
    expect(await rowsOf(ids)).toHaveLength(0);
    expect((await mainImages(db, STORE_ID, ids)).size).toBe(0);
  });

  it('+ Add a size: the new size shows the product photo (a pointer, no copy); saving again adds nothing', async () => {
    const ids = await design('New Size Kurta', ['M', 'L']);
    const photo = await setDesignPhoto(db, STORE_ID, { productIds: ids, bytes: jpeg(), staffId: owner });
    const edit = { newSizes: [{ size: 'XL', pieces: 1 }], operationId: 'size-xl', staffId: owner };
    expect(await saveDesign(db, STORE_ID, ids[0], edit)).toMatchObject({ added: 1 });
    const { listDesignVariants } = await import('./products');
    const all = (await listDesignVariants(db, STORE_ID, ids[0])).map((v) => v.id);
    expect(all).toHaveLength(3);
    const xl = all.find((id) => !ids.includes(id))!;
    expect(await rowsOf([xl])).toEqual([expect.objectContaining({ url: `/api/product-images/${photo.id}`, byteSize: 0 })]);
    // A product with no photo: its new size gets none either.
    const plain = await design('Plain Kurta', ['M']);
    await saveDesign(db, STORE_ID, plain[0], { newSizes: [{ size: 'L', pieces: 1 }], operationId: 'plain-l', staffId: owner });
    expect((await mainImages(db, STORE_ID, (await listDesignVariants(db, STORE_ID, plain[0])).map((v) => v.id))).size).toBe(0);
  });

  it('+ Add a size on a colour: the new size shows the photo of the item it was added from', async () => {
    const made = await createDesign(db, STORE_ID, {
      operationId: 'photo-colours', supplierId: null, categoryId: kurta, name: 'Two Colour Kurta', brand: '',
      sizes: ['M'], colors: ['Blue', 'Red'], mrpPaise: 100000, pricePaise: null, costPaise: 40000, quantityEach: 1, staffId: owner,
    });
    const blue = made.products.find((p) => p.color === 'Blue')!.id;
    const red = made.products.find((p) => p.color === 'Red')!.id;
    const bluePhoto = await setDesignPhoto(db, STORE_ID, { productIds: [blue], bytes: jpeg(100, 1), staffId: owner });
    const redPhoto = await setDesignPhoto(db, STORE_ID, { productIds: [red], bytes: jpeg(100, 2), staffId: owner });
    await saveDesign(db, STORE_ID, red, { newSizes: [{ size: 'L', pieces: 1 }], operationId: 'red-l', staffId: owner });
    const { listDesignVariants } = await import('./products');
    const redL = (await listDesignVariants(db, STORE_ID, red)).find((v) => v.color === 'Red' && v.size === 'L')!.id;
    expect(await rowsOf([redL])).toEqual([expect.objectContaining({ url: `/api/product-images/${redPhoto.id}` })]);
    expect(bluePhoto.id).not.toBe(redPhoto.id);
  });
});
