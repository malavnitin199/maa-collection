import { and, asc, desc, eq, ilike, like, or, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { products, staff, stockMovements, type Product } from '@/db/schema';
import { inStoreEan13, isValidEan13 } from '@/features/scanning/ean13';
import { DomainError, isUniqueViolation } from './errors';

/** What salesman screens may see about a product: never the cost price. */
export type CounterProduct = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  mrpPaise: number;
  pricePaise: number;
  stock: number;
};

export function toCounterProduct(p: Product): CounterProduct {
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    brand: p.brand,
    category: p.category,
    size: p.size,
    color: p.color,
    mrpPaise: p.mrpPaise,
    pricePaise: p.pricePaise,
    stock: p.stock,
  };
}

/** Finds an active product by scanned barcode or typed SKU (case-insensitive). */
export async function findProductByCode(db: Db, storeId: string, code: string): Promise<Product | null> {
  const needle = code.trim();
  if (!needle) return null;
  const [row] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.active, true),
        or(eq(products.barcode, needle), sql`upper(${products.sku}) = upper(${needle})`),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getProduct(db: Db, storeId: string, id: string): Promise<Product | null> {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.id, id)))
    .limit(1);
  return row ?? null;
}

export async function listProducts(db: Db, storeId: string, search = ''): Promise<Product[]> {
  const term = search.trim();
  const filter = term
    ? or(
        ilike(products.name, `%${term}%`),
        ilike(products.sku, `%${term}%`),
        ilike(products.brand, `%${term}%`),
        ilike(products.category, `%${term}%`),
        eq(products.barcode, term),
      )
    : undefined;
  return db
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), filter))
    .orderBy(asc(products.sku));
}

export type ProductInput = {
  name: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  mrpPaise: number;
  pricePaise: number;
  costPaise: number | null;
};

function validateProductInput(input: ProductInput) {
  for (const field of ['name', 'brand', 'category', 'size', 'color'] as const) {
    if (!input[field].trim()) throw new DomainError(`Enter the ${field === 'name' ? 'product name' : field}.`);
  }
  if (!Number.isSafeInteger(input.mrpPaise) || input.mrpPaise <= 0) throw new DomainError('Enter a valid MRP.');
  if (!Number.isSafeInteger(input.pricePaise) || input.pricePaise <= 0) {
    throw new DomainError('Enter a valid selling price.');
  }
  if (input.pricePaise > input.mrpPaise) throw new DomainError('Selling price cannot be above MRP.');
  if (input.costPaise !== null && (!Number.isSafeInteger(input.costPaise) || input.costPaise < 0)) {
    throw new DomainError('Enter a valid cost price.');
  }
}

/** "Kurta" → "KU"; letters only, padded with X. */
export function skuPrefix(category: string): string {
  const letters = category.toUpperCase().replace(/[^A-Z]/g, '');
  return `MAA-${(letters + 'XX').slice(0, 2)}-`;
}

async function nextSku(db: Db, storeId: string, category: string): Promise<string> {
  const prefix = skuPrefix(category);
  const rows = await db
    .select({ sku: products.sku })
    .from(products)
    .where(and(eq(products.storeId, storeId), like(products.sku, `${prefix}%`)));
  const max = rows.reduce((highest, row) => {
    const n = Number(row.sku.slice(prefix.length));
    return Number.isInteger(n) && n > highest ? n : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

async function nextInStoreBarcode(db: Db, storeId: string): Promise<string> {
  const [row] = await db
    .select({ max: sql<string | null>`max(substring(${products.barcode} from 4 for 9))` })
    .from(products)
    .where(and(eq(products.storeId, storeId), like(products.barcode, '200%')));
  return inStoreEan13(Number(row?.max ?? 0) + 1);
}

/**
 * Admin adds a product. SKU is generated; the barcode is generated (in-store
 * "200…" EAN-13) unless the manufacturer's barcode is given.
 */
export async function createProduct(
  db: Db,
  storeId: string,
  input: ProductInput & { manufacturerBarcode?: string | null; openingStock: number; createdBy: string },
): Promise<Product> {
  validateProductInput(input);
  if (!Number.isInteger(input.openingStock) || input.openingStock < 0) {
    throw new DomainError('Opening stock must be 0 or more.');
  }
  const manual = input.manufacturerBarcode?.trim() || null;
  if (manual && !isValidEan13(manual)) {
    throw new DomainError('That barcode is not a valid 13-digit EAN-13 (check the last digit).');
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const txDb = tx as unknown as Db;
        const [created] = await tx
          .insert(products)
          .values({
            storeId,
            sku: await nextSku(txDb, storeId, input.category),
            barcode: manual ?? (await nextInStoreBarcode(txDb, storeId)),
            name: input.name.trim(),
            brand: input.brand.trim(),
            category: input.category.trim(),
            size: input.size.trim(),
            color: input.color.trim(),
            mrpPaise: input.mrpPaise,
            pricePaise: input.pricePaise,
            costPaise: input.costPaise,
            stock: input.openingStock,
            createdBy: input.createdBy,
          })
          .returning();
        if (input.openingStock > 0) {
          await tx.insert(stockMovements).values({
            storeId,
            productId: created.id,
            quantityChange: input.openingStock,
            reason: 'opening',
            staffId: input.createdBy,
          });
        }
        return created;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (manual) throw new DomainError('Another product already uses that barcode.');
      // Two admins generated the same SKU/barcode at once: try the next number.
    }
  }
  throw new DomainError('Could not generate a unique SKU/barcode. Try again.');
}

export async function updateProduct(
  db: Db,
  storeId: string,
  id: string,
  input: ProductInput & { active: boolean },
): Promise<Product> {
  validateProductInput(input);
  const [updated] = await db
    .update(products)
    .set({
      name: input.name.trim(),
      brand: input.brand.trim(),
      category: input.category.trim(),
      size: input.size.trim(),
      color: input.color.trim(),
      mrpPaise: input.mrpPaise,
      pricePaise: input.pricePaise,
      costPaise: input.costPaise,
      active: input.active,
    })
    .where(and(eq(products.storeId, storeId), eq(products.id, id)))
    .returning();
  if (!updated) throw new DomainError('Product not found.');
  return updated;
}

/** Admin receives new stock: +quantity, recorded as an append-only movement. */
export async function stockIn(
  db: Db,
  storeId: string,
  input: { productId: string; quantity: number; staffId: string; note?: string },
): Promise<Product> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100_000) {
    throw new DomainError('Quantity must be a whole number, at least 1.');
  }
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${input.quantity}` })
      .where(and(eq(products.storeId, storeId), eq(products.id, input.productId)))
      .returning();
    if (!updated) throw new DomainError('Product not found.');
    await tx.insert(stockMovements).values({
      storeId,
      productId: input.productId,
      quantityChange: input.quantity,
      reason: 'stock_in',
      staffId: input.staffId,
      note: input.note?.trim() || null,
    });
    return updated;
  });
}

export async function listMovements(db: Db, storeId: string, productId: string) {
  return db
    .select({
      id: stockMovements.id,
      quantityChange: stockMovements.quantityChange,
      reason: stockMovements.reason,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
      staffName: staff.name,
    })
    .from(stockMovements)
    .leftJoin(staff, eq(staff.id, stockMovements.staffId))
    .where(and(eq(stockMovements.storeId, storeId), eq(stockMovements.productId, productId)))
    .orderBy(desc(stockMovements.createdAt))
    .limit(50);
}
