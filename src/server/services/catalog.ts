import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { categories, productImages, products, staff, stockMovements, stockReceipts, suppliers, type Category, type Supplier } from '@/db/schema';
import { cleanSizeList, MAX_SIZES } from '@/lib/size-lists';
import { DomainError, isUniqueViolation } from './errors';

const int = (expression: ReturnType<typeof sql>) => sql<number>`${expression}`.mapWith(Number);

// ---------------------------------------------------------------- categories

/** Suggests a 2-letter SKU code not yet taken: Kurta → KU, then KR, KT… */
export function suggestCategoryCode(name: string, taken: Set<string>): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '') || 'X';
  const first = letters[0];
  const candidates = [letters.slice(0, 2).padEnd(2, 'X'), ...letters.slice(1).split('').map((l) => first + l)];
  for (const code of candidates) if (code.length === 2 && !taken.has(code)) return code;
  for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!taken.has(first + a)) return first + a;
  for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!taken.has(a + b)) return a + b;
  throw new DomainError('No free category code left.', { key: 'cat.err.noFreeCode' });
}

export type CategoryRow = Category & { productCount: number; stockUnits: number };

export async function listCategories(db: Db, storeId: string, { activeOnly = false } = {}): Promise<CategoryRow[]> {
  return db
    .select({
      id: categories.id,
      storeId: categories.storeId,
      name: categories.name,
      code: categories.code,
      sizes: categories.sizes,
      active: categories.active,
      createdAt: categories.createdAt,
      productCount: int(sql`count(${products.id})`),
      stockUnits: int(sql`coalesce(sum(${products.stock}), 0)`),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(and(eq(categories.storeId, storeId), activeOnly ? eq(categories.active, true) : undefined))
    .groupBy(categories.id)
    .orderBy(asc(categories.name));
}

function cleanCode(code: string | undefined | null): string | null {
  const value = (code ?? '').trim().toUpperCase();
  if (!value) return null;
  if (!/^[A-Z]{2,3}$/.test(value)) throw new DomainError('Code must be 2 or 3 letters, e.g. KU.', { key: 'cat.err.codeLetters' });
  return value;
}

/** A category's size list: cleaned, in the given order, short sizes, at most MAX_SIZES. */
function checkedSizes(input: string | readonly string[] | undefined): string[] {
  const sizes = cleanSizeList(input ?? []);
  if (sizes.length > MAX_SIZES) throw new DomainError(`Up to ${MAX_SIZES} sizes per category.`, { key: 'cat.err.tooManySizes', vars: { n: MAX_SIZES } });
  const long = sizes.find((s) => s.length > 12);
  if (long) throw new DomainError(`Size "${long}" is too long (up to 12 characters).`, { key: 'cat.err.sizeTooLong', vars: { size: long } });
  return sizes;
}

export async function createCategory(
  db: Db,
  storeId: string,
  input: { name: string; code?: string | null; sizes?: string | readonly string[] },
): Promise<Category> {
  const name = input.name.trim();
  if (!name || name.length > 40) throw new DomainError('Enter a category name (up to 40 characters).', { key: 'cat.err.categoryName' });
  const sizes = checkedSizes(input.sizes);
  let code = cleanCode(input.code);
  if (!code) {
    const taken = new Set((await db.select({ code: categories.code }).from(categories).where(eq(categories.storeId, storeId))).map((r) => r.code));
    code = suggestCategoryCode(name, taken);
  }
  try {
    const [created] = await db.insert(categories).values({ storeId, name, code, sizes }).returning();
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('A category with that name or code already exists.', { key: 'cat.err.categoryExists' });
    throw error;
  }
}

/** Rename / recode / (de)activate / change sizes. Renaming also updates the name shown on its products. */
export async function updateCategory(
  db: Db,
  storeId: string,
  id: string,
  input: { name: string; code: string; active: boolean; sizes?: string | readonly string[] },
): Promise<Category> {
  const name = input.name.trim();
  if (!name || name.length > 40) throw new DomainError('Enter a category name (up to 40 characters).', { key: 'cat.err.categoryName' });
  const code = cleanCode(input.code);
  // Leaving sizes out keeps the current list.
  const sizes = input.sizes === undefined ? undefined : checkedSizes(input.sizes);
  if (!code) throw new DomainError('Enter a 2–3 letter code.', { key: 'cat.err.codeRequired' });
  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(categories)
        .set({ name, code, active: input.active, ...(sizes ? { sizes } : {}) })
        .where(and(eq(categories.storeId, storeId), eq(categories.id, id)))
        .returning();
      if (!updated) throw new DomainError('Category not found.', { key: 'cat.err.categoryNotFound' });
      await tx.update(products).set({ category: name }).where(eq(products.categoryId, id));
      return updated;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('A category with that name or code already exists.', { key: 'cat.err.categoryExists' });
    throw error;
  }
}

// ----------------------------------------------------------------- suppliers

export type SupplierInput = { name: string; contactName: string; phone: string; gstin: string; notes: string };

function cleanSupplier(input: SupplierInput) {
  const name = input.name.trim();
  if (!name || name.length > 80) throw new DomainError('Enter the company name (up to 80 characters).', { key: 'cat.err.supplierName' });
  const phone = input.phone.trim();
  if (phone && !/^[+\d][\d\s-]{6,17}$/.test(phone)) throw new DomainError('Enter a valid phone number.', { key: 'cat.err.phone' });
  const gstin = input.gstin.trim().toUpperCase();
  if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) throw new DomainError('GSTIN must be 15 letters/digits.', { key: 'cat.err.gstin' });
  return {
    name,
    contactName: input.contactName.trim() || null,
    phone: phone || null,
    gstin: gstin || null,
    notes: input.notes.trim() || null,
  };
}

export type SupplierRow = Supplier & { productCount: number; stockUnits: number; lastReceiptAt: Date | null };

export async function listSuppliers(db: Db, storeId: string, { activeOnly = false } = {}): Promise<SupplierRow[]> {
  const rows = await db
    .select({
      supplier: suppliers,
      productCount: int(sql`(select count(*) from ${products} where ${products.supplierId} = ${suppliers.id})`),
      stockUnits: int(sql`(select coalesce(sum(${products.stock}), 0) from ${products} where ${products.supplierId} = ${suppliers.id})`),
      lastReceiptAt: sql<Date | null>`(select max(${stockReceipts.createdAt}) from ${stockReceipts} where ${stockReceipts.supplierId} = ${suppliers.id})`,
    })
    .from(suppliers)
    .where(and(eq(suppliers.storeId, storeId), activeOnly ? eq(suppliers.active, true) : undefined))
    .orderBy(asc(suppliers.name));
  return rows.map((r) => ({
    ...r.supplier,
    productCount: r.productCount,
    stockUnits: r.stockUnits,
    lastReceiptAt: r.lastReceiptAt ? new Date(r.lastReceiptAt) : null,
  }));
}

export async function getSupplier(db: Db, storeId: string, id: string): Promise<Supplier | null> {
  const [row] = await db.select().from(suppliers).where(and(eq(suppliers.storeId, storeId), eq(suppliers.id, id))).limit(1);
  return row ?? null;
}

export async function createSupplier(db: Db, storeId: string, input: SupplierInput): Promise<Supplier> {
  try {
    const [created] = await db.insert(suppliers).values({ storeId, ...cleanSupplier(input) }).returning();
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('A supplier with that name already exists.', { key: 'cat.err.supplierExists' });
    throw error;
  }
}

export async function updateSupplier(
  db: Db,
  storeId: string,
  id: string,
  input: SupplierInput & { active: boolean },
): Promise<Supplier> {
  try {
    const [updated] = await db
      .update(suppliers)
      .set({ ...cleanSupplier(input), active: input.active })
      .where(and(eq(suppliers.storeId, storeId), eq(suppliers.id, id)))
      .returning();
    if (!updated) throw new DomainError('Supplier not found.', { key: 'cat.err.supplierNotFound' });
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('A supplier with that name already exists.', { key: 'cat.err.supplierExists' });
    throw error;
  }
}

/**
 * Company picker on the add screens (plan v17): a typed name becomes a company,
 * unless one with that name already exists (any case) — then that one is used,
 * and brought back if it was hidden. Never makes a duplicate.
 */
export async function addOrRestoreSupplier(db: Db, storeId: string, rawName: string): Promise<{ supplier: Supplier; status: 'created' | 'restored' | 'existing' }> {
  const name = rawName.trim();
  const [same] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.storeId, storeId), sql`lower(${suppliers.name}) = lower(${name})`))
    .limit(1);
  if (same) {
    if (same.active) return { supplier: same, status: 'existing' };
    return { supplier: await restoreSupplier(db, storeId, same.id), status: 'restored' };
  }
  const supplier = await createSupplier(db, storeId, { name, contactName: '', phone: '', gstin: '', notes: '' });
  return { supplier, status: 'created' };
}

/** Brings a hidden ("previous") company back into the lists. Its details are kept. */
export async function restoreSupplier(db: Db, storeId: string, id: string): Promise<Supplier> {
  const [restored] = await db
    .update(suppliers)
    .set({ active: true })
    .where(and(eq(suppliers.storeId, storeId), eq(suppliers.id, id)))
    .returning();
  if (!restored) throw new DomainError('Supplier not found.', { key: 'cat.err.supplierNotFound' });
  return restored;
}

// ------------------------------------------------------------------ receipts

export type ReceiptSummary = {
  id: string;
  createdAt: Date;
  supplierId: string | null;
  supplierName: string | null;
  billNumber: string | null;
  staffName: string;
  lines: number;
  units: number;
  costValuePaise: number;
};

/** Stock arrivals, newest first (optionally for one supplier). */
export async function listReceipts(
  db: Db,
  storeId: string,
  { supplierId, limit = 30 }: { supplierId?: string; limit?: number } = {},
): Promise<ReceiptSummary[]> {
  const rows = await db
    .select({
      id: stockReceipts.id,
      createdAt: stockReceipts.createdAt,
      supplierId: stockReceipts.supplierId,
      supplierName: suppliers.name,
      billNumber: stockReceipts.billNumber,
      staffName: staff.name,
      lines: int(sql`(select count(*) from ${stockMovements} where ${stockMovements.refId} = ${stockReceipts.id})`),
      units: int(sql`(select coalesce(sum(${stockMovements.quantityChange}), 0) from ${stockMovements} where ${stockMovements.refId} = ${stockReceipts.id})`),
      costValuePaise: int(
        sql`(select coalesce(sum(${stockMovements.quantityChange} * coalesce(${products.costPaise}, 0)), 0) from ${stockMovements} join ${products} on ${products.id} = ${stockMovements.productId} where ${stockMovements.refId} = ${stockReceipts.id})`,
      ),
    })
    .from(stockReceipts)
    .innerJoin(staff, eq(staff.id, stockReceipts.staffId))
    .leftJoin(suppliers, eq(suppliers.id, stockReceipts.supplierId))
    .where(and(eq(stockReceipts.storeId, storeId), supplierId ? eq(stockReceipts.supplierId, supplierId) : undefined))
    .orderBy(desc(stockReceipts.createdAt))
    .limit(limit);
  return rows;
}

// ------------------------------------------------------------- QC check list

export type AttentionItem = { id: string; name: string; size: string; color: string; sku: string; stock: number };
export type CatalogAttention = {
  noPhoto: { count: number; items: AttentionItem[] };
  noSupplier: { count: number; items: AttentionItem[] };
  outOfStock: { count: number; items: AttentionItem[] };
  noCost: { count: number; items: AttentionItem[] };
};

/** What a catalog / QC person still has to fix, among active products (up to `limit` items per list). */
export async function catalogAttention(db: Db, storeId: string, limit = 50): Promise<CatalogAttention> {
  const columns = { id: products.id, name: products.name, size: products.size, color: products.color, sku: products.sku, stock: products.stock };
  const active = and(eq(products.storeId, storeId), eq(products.active, true));
  const noPhotoWhere = and(active, sql`not exists (select 1 from ${productImages} where ${productImages.productId} = ${products.id})`);
  const lists = {
    noPhoto: noPhotoWhere,
    noSupplier: and(active, sql`${products.supplierId} is null`),
    outOfStock: and(active, sql`${products.stock} <= 0`),
    noCost: and(active, sql`${products.costPaise} is null`),
  };
  const entries = await Promise.all(
    Object.entries(lists).map(async ([key, where]) => {
      const [items, [{ count }]] = await Promise.all([
        db.select(columns).from(products).where(where).orderBy(asc(products.name), asc(products.color), asc(products.size)).limit(limit),
        db.select({ count: int(sql`count(*)`) }).from(products).where(where),
      ]);
      return [key, { count, items }] as const;
    }),
  );
  return Object.fromEntries(entries) as CatalogAttention;
}
