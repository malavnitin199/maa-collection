import { and, asc, desc, eq, ilike, inArray, like, or, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { categories, products, staff, stockMovements, stockReceipts, suppliers, type Product, type StockReceipt } from '@/db/schema';
import { inStoreEan13, isValidEan13 } from '@/features/scanning/ean13';
import { findSizeRates, ratesForSize, sameSize, type Rates, type SizeRates } from '@/lib/size-prices';
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
  /** Main photo, if any (set by the counter lookup). */
  imageSrc?: string | null;
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

export type ProductListFilter = { search?: string; supplierId?: string; categoryId?: string };
export type ProductListRow = Product & { supplierName: string | null };

export async function listProducts(db: Db, storeId: string, filter: ProductListFilter | string = {}): Promise<ProductListRow[]> {
  const { search = '', supplierId, categoryId } = typeof filter === 'string' ? { search: filter } : filter;
  const term = search.trim();
  const textFilter = term
    ? or(
        ilike(products.name, `%${term}%`),
        ilike(products.sku, `%${term}%`),
        ilike(products.brand, `%${term}%`),
        ilike(products.category, `%${term}%`),
        ilike(products.color, `%${term}%`),
        eq(products.barcode, term),
      )
    : undefined;
  const rows = await db
    .select({ product: products, supplierName: suppliers.name })
    .from(products)
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(
      and(
        eq(products.storeId, storeId),
        textFilter,
        supplierId ? eq(products.supplierId, supplierId) : undefined,
        categoryId ? eq(products.categoryId, categoryId) : undefined,
      ),
    )
    .orderBy(asc(products.name), asc(products.color), asc(products.size));
  return rows.map((r) => ({ ...r.product, supplierName: r.supplierName }));
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

function validatePrices(input: { mrpPaise: number; pricePaise: number; costPaise: number | null }) {
  if (!Number.isSafeInteger(input.mrpPaise) || input.mrpPaise <= 0) throw new DomainError('Enter a valid MRP.');
  if (!Number.isSafeInteger(input.pricePaise) || input.pricePaise <= 0) {
    throw new DomainError('Enter a valid selling price.');
  }
  if (input.pricePaise > input.mrpPaise) throw new DomainError('Selling price cannot be above MRP.');
  if (input.costPaise !== null && (!Number.isSafeInteger(input.costPaise) || input.costPaise < 0)) {
    throw new DomainError('Enter a valid cost price.');
  }
}

type CheckedRates = { mrpPaise: number; pricePaise: number; costPaise: number | null };

/**
 * Rates for every size of a design: the defaults, or a size's own MRP / selling /
 * purchase price. Checked here on the server (errors name the size). Keyed by
 * lower-case size; every colour of a size gets the same rates.
 */
function resolveSizeRates(sizes: readonly string[], defaults: { mrpPaise: number } & Rates, own: readonly SizeRates[] = []): Map<string, CheckedRates> {
  validatePrices({ ...defaults, pricePaise: defaults.pricePaise ?? defaults.mrpPaise });
  own.forEach((row, i) => {
    if (!sizes.some((s) => sameSize(s, row.size))) {
      throw new DomainError(`Size ${row.size.trim() || '(blank)'} has its own price but is not one of the sizes.`);
    }
    if (own.findIndex((other) => sameSize(other.size, row.size)) !== i) throw new DomainError(`Size ${row.size.trim()} is priced twice.`);
  });
  return new Map(
    sizes.map((size) => {
      const rates = ratesForSize(defaults, findSizeRates(own, size));
      const checked = { mrpPaise: rates.mrpPaise ?? NaN, pricePaise: rates.pricePaise ?? NaN, costPaise: rates.costPaise };
      try {
        validatePrices(checked);
      } catch (error) {
        throw error instanceof DomainError ? new DomainError(`Size ${size}: ${error.message}`) : error;
      }
      return [size.trim().toLowerCase(), checked];
    }),
  );
}

function validateProductInput(input: ProductInput) {
  for (const field of ['name', 'brand', 'category', 'size', 'color'] as const) {
    if (!input[field].trim()) throw new DomainError(`Enter the ${field === 'name' ? 'product name' : field}.`);
  }
  validatePrices(input);
}

/** SKU prefix from a category code ("KU") or, for legacy calls, a category name ("Kurta"). */
export function skuPrefix(codeOrCategory: string): string {
  const letters = codeOrCategory.toUpperCase().replace(/[^A-Z]/g, '');
  const code = /^[A-Z]{2,3}$/.test(codeOrCategory.trim()) ? codeOrCategory.trim() : (letters + 'XX').slice(0, 2);
  return `MAA-${code}-`;
}

async function highestSkuNumber(db: Db, storeId: string, prefix: string): Promise<number> {
  const rows = await db
    .select({ sku: products.sku })
    .from(products)
    .where(and(eq(products.storeId, storeId), like(products.sku, `${prefix}%`)));
  return rows.reduce((highest, row) => {
    const n = Number(row.sku.slice(prefix.length));
    return Number.isInteger(n) && n > highest ? n : highest;
  }, 0);
}

async function highestInStoreBarcode(db: Db, storeId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<string | null>`max(substring(${products.barcode} from 4 for 9))` })
    .from(products)
    .where(and(eq(products.storeId, storeId), like(products.barcode, '200%')));
  return Number(row?.max ?? 0);
}

async function resolveCategory(db: Db, storeId: string, categoryId: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.id, categoryId), eq(categories.active, true)))
    .limit(1);
  if (!category) throw new DomainError('Choose an active category.');
  return category;
}

async function resolveSupplier(db: Db, storeId: string, supplierId: string) {
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.storeId, storeId), eq(suppliers.id, supplierId), eq(suppliers.active, true)))
    .limit(1);
  if (!supplier) throw new DomainError('Choose an active supplier.');
  return supplier;
}

/**
 * Admin adds one product. SKU is generated; the barcode is generated (in-store
 * "200…" EAN-13) unless the manufacturer's barcode is given.
 */
export async function createProduct(
  db: Db,
  storeId: string,
  input: ProductInput & {
    manufacturerBarcode?: string | null;
    openingStock: number;
    createdBy: string;
    categoryId?: string | null;
    supplierId?: string | null;
  },
): Promise<Product> {
  let category = input.category;
  let prefix = skuPrefix(input.category);
  if (input.categoryId) {
    const row = await resolveCategory(db, storeId, input.categoryId);
    category = row.name;
    prefix = skuPrefix(row.code);
  }
  if (input.supplierId) await resolveSupplier(db, storeId, input.supplierId);
  validateProductInput({ ...input, category });
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
        const sku = `${prefix}${String((await highestSkuNumber(txDb, storeId, prefix)) + 1).padStart(3, '0')}`;
        const barcode = manual ?? inStoreEan13((await highestInStoreBarcode(txDb, storeId)) + 1);
        const [created] = await tx
          .insert(products)
          .values({
            storeId,
            sku,
            barcode,
            name: input.name.trim(),
            brand: input.brand.trim(),
            category,
            categoryId: input.categoryId ?? null,
            supplierId: input.supplierId ?? null,
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

/** Trims, drops blanks and case-insensitive duplicates, keeping the first spelling. */
function cleanList(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((v) => v.trim())
    .filter((v) => v && !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()));
}

export type DesignInput = {
  operationId: string;
  supplierId: string;
  categoryId: string;
  name: string;
  brand: string;
  sizes: string[];
  colors: string[];
  /** Defaults for every size. */
  mrpPaise: number;
  /** null = sell at MRP (each size's own MRP). */
  pricePaise: number | null;
  costPaise: number | null;
  /** A size's own MRP / selling / purchase price, for all its colours (optional). */
  sizeRates?: SizeRates[];
  /** Pieces received per size/colour combination (0 = add to catalogue only). */
  quantityEach: number;
  billNumber?: string | null;
  staffId: string;
};

export type DesignResult = { receipt: StockReceipt; products: Product[]; duplicate: boolean };

/**
 * New stock from a supplier: one design in several sizes × colours. Creates one
 * product (SKU + in-store barcode) per combination and one stock receipt, in a
 * single transaction. Retrying the same operationId returns the first result.
 */
export async function createDesign(db: Db, storeId: string, input: DesignInput): Promise<DesignResult> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.');
  const existing = await findReceiptByOperation(db, storeId, input.operationId);
  if (existing) return { ...(await receiptWithProducts(db, storeId, existing)), duplicate: true };

  const name = input.name.trim();
  const brand = input.brand.trim();
  if (!name) throw new DomainError('Enter the design / product name.');
  if (!brand) throw new DomainError('Enter the brand.');
  const sizes = cleanList(input.sizes);
  const colors = cleanList(input.colors);
  if (sizes.length === 0) throw new DomainError('Pick at least one size.');
  if (colors.length === 0) throw new DomainError('Add at least one colour.');
  if (sizes.length * colors.length > 60) throw new DomainError('Too many combinations at once (max 60). Split the entry.');
  const rates = resolveSizeRates(sizes, input, input.sizeRates);
  if (!Number.isInteger(input.quantityEach) || input.quantityEach < 0 || input.quantityEach > 10_000) {
    throw new DomainError('Pieces per size/colour must be 0 or more.');
  }
  const category = await resolveCategory(db, storeId, input.categoryId);
  await resolveSupplier(db, storeId, input.supplierId);

  const clash = await db
    .select({ size: products.size, color: products.color, sku: products.sku })
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        sql`lower(${products.name}) = lower(${name})`,
        sql`lower(${products.brand}) = lower(${brand})`,
        eq(products.categoryId, category.id),
        inArray(sql`lower(${products.size})`, sizes.map((s) => s.toLowerCase())),
        inArray(sql`lower(${products.color})`, colors.map((c) => c.toLowerCase())),
      ),
    );
  if (clash.length > 0) {
    const list = clash.map((c) => `${c.color} ${c.size} (${c.sku})`).join(', ');
    throw new DomainError(`Already in the catalogue: ${list}. Use "Receive stock" for those instead.`);
  }

  return insertNewProducts(db, storeId, {
    operationId: input.operationId,
    supplierId: input.supplierId,
    category,
    billNumber: input.billNumber,
    note: `New design: ${name}`,
    staffId: input.staffId,
    rows: colors.flatMap((color) =>
      sizes.map((size) => ({
        name,
        brand,
        size,
        color,
        ...rates.get(size.toLowerCase())!,
        quantity: input.quantityEach,
      })),
    ),
  });
}

type NewProductRow = {
  /** Manufacturer barcode to use instead of generating one. */
  barcode?: string | null;
  name: string;
  brand: string;
  size: string;
  color: string;
  mrpPaise: number;
  pricePaise: number;
  costPaise: number | null;
  quantity: number;
};

/**
 * Shared by "new design" and "quick add": inserts one stock receipt and one
 * product per row (next SKUs for the category, next in-store barcodes) with
 * their opening movements, in a single transaction. Retrying the same
 * operationId returns the first result; a SKU/barcode race retries.
 */
async function insertNewProducts(
  db: Db,
  storeId: string,
  input: {
    operationId: string;
    supplierId: string | null;
    category: { id: string; name: string; code: string };
    billNumber?: string | null;
    note: string;
    staffId: string;
    rows: NewProductRow[];
  },
): Promise<DesignResult> {
  const prefix = skuPrefix(input.category.code);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const txDb = tx as unknown as Db;
        let skuNumber = await highestSkuNumber(txDb, storeId, prefix);
        let barcodeNumber = await highestInStoreBarcode(txDb, storeId);
        const [receipt] = await tx
          .insert(stockReceipts)
          .values({
            storeId,
            operationId: input.operationId,
            supplierId: input.supplierId,
            billNumber: input.billNumber?.trim() || null,
            note: input.note,
            staffId: input.staffId,
          })
          .returning();
        const created = await tx
          .insert(products)
          .values(
            input.rows.map((row) => ({
              storeId,
              sku: `${prefix}${String(++skuNumber).padStart(3, '0')}`,
              barcode: row.barcode ?? inStoreEan13(++barcodeNumber),
              name: row.name,
              brand: row.brand,
              category: input.category.name,
              categoryId: input.category.id,
              supplierId: input.supplierId,
              size: row.size,
              color: row.color,
              mrpPaise: row.mrpPaise,
              pricePaise: row.pricePaise,
              costPaise: row.costPaise,
              stock: row.quantity,
              createdBy: input.staffId,
            })),
          )
          .returning();
        // One movement per product (0 when only cataloguing) links each product to this receipt.
        await tx.insert(stockMovements).values(
          created.map((p, i) => ({
            storeId,
            productId: p.id,
            quantityChange: input.rows[i].quantity,
            reason: 'opening' as const,
            refId: receipt.id,
            staffId: input.staffId,
          })),
        );
        return { receipt, products: created, duplicate: false };
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const again = await findReceiptByOperation(db, storeId, input.operationId);
      if (again) return { ...(await receiptWithProducts(db, storeId, again)), duplicate: true };
      // SKU/barcode taken by a concurrent save: retry with fresh numbers.
    }
  }
  throw new DomainError('Could not generate unique SKUs/barcodes. Try again.');
}

export type QuickRowInput = {
  /** Optional manufacturer EAN-13 already on the tag (no new label needed). */
  barcode?: string | null;
  name: string;
  size?: string;
  color?: string;
  mrpPaise: number;
  pricePaise: number;
  costPaise: number | null;
  quantity: number;
};

/**
 * Quick add: many different products from one supplier in one category, each
 * row with its own name, MRP, selling and purchase price, and pieces. Size and
 * colour are optional (default "Free" / "Assorted"). One receipt, one save.
 */
export async function createProductsBatch(
  db: Db,
  storeId: string,
  input: {
    operationId: string;
    /** Optional: old stock often has no known company. */
    supplierId?: string | null;
    categoryId: string;
    brand?: string | null;
    billNumber?: string | null;
    note?: string;
    rows: QuickRowInput[];
    staffId: string;
  },
): Promise<DesignResult> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.');
  const existing = await findReceiptByOperation(db, storeId, input.operationId);
  if (existing) return { ...(await receiptWithProducts(db, storeId, existing)), duplicate: true };

  const category = await resolveCategory(db, storeId, input.categoryId);
  const supplier = input.supplierId ? await resolveSupplier(db, storeId, input.supplierId) : null;
  const brand = input.brand?.trim() || supplier?.name || 'Unbranded';
  const rows = input.rows.filter((r) => r.name.trim());
  if (rows.length === 0) throw new DomainError('Add at least one product with a name.');
  if (rows.length > 50) throw new DomainError('Up to 50 products at once. Split the entry.');

  const cleaned = rows.map((row, i) => {
    const label = `Row ${i + 1} (${row.name.trim()})`;
    try {
      validatePrices(row);
    } catch (error) {
      throw new DomainError(`${label}: ${(error as Error).message}`);
    }
    if (!Number.isInteger(row.quantity) || row.quantity < 0 || row.quantity > 10_000) {
      throw new DomainError(`${label}: pieces must be 0 or more.`);
    }
    const barcode = row.barcode?.trim() || null;
    if (barcode && !isValidEan13(barcode)) throw new DomainError(`${label}: ${barcode} is not a valid 13-digit barcode.`);
    return {
      barcode,
      name: row.name.trim(),
      brand,
      size: row.size?.trim() || 'Free',
      color: row.color?.trim() || 'Assorted',
      mrpPaise: row.mrpPaise,
      pricePaise: row.pricePaise,
      costPaise: row.costPaise,
      quantity: row.quantity,
    };
  });
  const ownBarcodes = cleaned.flatMap((r) => (r.barcode ? [r.barcode] : []));
  if (new Set(ownBarcodes).size !== ownBarcodes.length) throw new DomainError('The same barcode is entered twice.');
  if (ownBarcodes.length > 0) {
    const taken = await db
      .select({ barcode: products.barcode, name: products.name, sku: products.sku })
      .from(products)
      .where(and(eq(products.storeId, storeId), inArray(products.barcode, ownBarcodes)));
    if (taken.length > 0) {
      throw new DomainError(`Barcode already in the app: ${taken.map((t) => `${t.barcode} = ${t.name} (${t.sku})`).join(', ')}. Add pieces to it instead.`);
    }
  }
  const keys = cleaned.map((r) => `${r.name}|${r.size}|${r.color}`.toLowerCase());
  const repeated = keys.find((k, i) => keys.indexOf(k) !== i);
  if (repeated) throw new DomainError(`The same product is entered twice: ${repeated.split('|').join(' · ')}.`);

  const clash = await db
    .select({ name: products.name, size: products.size, color: products.color, sku: products.sku })
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.categoryId, category.id),
        sql`lower(${products.brand}) = lower(${brand})`,
        inArray(sql`lower(${products.name}) || '|' || lower(${products.size}) || '|' || lower(${products.color})`, keys),
      ),
    );
  if (clash.length > 0) {
    const list = clash.map((c) => `${c.name} ${c.color} ${c.size} (${c.sku})`).join(', ');
    throw new DomainError(`Already in the catalogue: ${list}. Use "Receive stock" for those instead.`);
  }

  return insertNewProducts(db, storeId, {
    operationId: input.operationId,
    supplierId: supplier?.id ?? null,
    category,
    billNumber: input.billNumber,
    note: input.note ?? `Quick add: ${cleaned.length} products`,
    staffId: input.staffId,
    rows: cleaned,
  });
}

export async function updateProduct(
  db: Db,
  storeId: string,
  id: string,
  input: ProductInput & { active: boolean; categoryId?: string | null; supplierId?: string | null },
): Promise<Product> {
  let category = input.category;
  if (input.categoryId) category = (await resolveCategory(db, storeId, input.categoryId)).name;
  if (input.supplierId) await resolveSupplier(db, storeId, input.supplierId);
  validateProductInput({ ...input, category });
  const [updated] = await db
    .update(products)
    .set({
      name: input.name.trim(),
      brand: input.brand.trim(),
      category,
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId } : {}),
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

export type ReceiveStockInput = {
  operationId: string;
  supplierId?: string | null;
  billNumber?: string | null;
  note?: string | null;
  lines: { productId: string; quantity: number }[];
  staffId: string;
};

/**
 * Stock arrives for existing products (restock). One receipt + one movement per
 * line, atomically. Retrying the same operationId adds nothing the second time.
 */
export async function receiveStock(
  db: Db,
  storeId: string,
  input: ReceiveStockInput,
): Promise<{ receipt: StockReceipt; products: Product[]; duplicate: boolean }> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.');
  const existing = await findReceiptByOperation(db, storeId, input.operationId);
  if (existing) return { ...(await receiptWithProducts(db, storeId, existing)), duplicate: true };
  const lines = input.lines.filter((l) => l.quantity !== 0);
  if (lines.length === 0) throw new DomainError('Add at least one item with a quantity.');
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100_000) {
      throw new DomainError('Quantity must be a whole number, at least 1.');
    }
  }
  if (new Set(lines.map((l) => l.productId)).size !== lines.length) throw new DomainError('An item is listed twice.');
  if (input.supplierId) await resolveSupplier(db, storeId, input.supplierId);

  try {
    return await db.transaction(async (tx) => {
      const [receipt] = await tx
        .insert(stockReceipts)
        .values({
          storeId,
          operationId: input.operationId,
          supplierId: input.supplierId ?? null,
          billNumber: input.billNumber?.trim() || null,
          note: input.note?.trim() || null,
          staffId: input.staffId,
        })
        .returning();
      const updated: Product[] = [];
      for (const line of lines) {
        const [row] = await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${line.quantity}` })
          .where(and(eq(products.storeId, storeId), eq(products.id, line.productId)))
          .returning();
        if (!row) throw new DomainError('Product not found.');
        updated.push(row);
      }
      await tx.insert(stockMovements).values(
        lines.map((line) => ({
          storeId,
          productId: line.productId,
          quantityChange: line.quantity,
          reason: 'stock_in' as const,
          refId: receipt.id,
          staffId: input.staffId,
          note: input.note?.trim() || null,
        })),
      );
      return { receipt, products: updated, duplicate: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const again = await findReceiptByOperation(db, storeId, input.operationId);
      if (again) return { ...(await receiptWithProducts(db, storeId, again)), duplicate: true };
    }
    throw error;
  }
}

/** Single-product stock-in (product page). Same guarantees as receiveStock. */
export async function stockIn(
  db: Db,
  storeId: string,
  input: { operationId: string; productId: string; quantity: number; staffId: string; note?: string; supplierId?: string | null },
): Promise<Product & { duplicate: boolean }> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100_000) {
    throw new DomainError('Quantity must be a whole number, at least 1.');
  }
  const result = await receiveStock(db, storeId, {
    operationId: input.operationId,
    supplierId: input.supplierId,
    note: input.note,
    lines: [{ productId: input.productId, quantity: input.quantity }],
    staffId: input.staffId,
  });
  const product = result.products.find((p) => p.id === input.productId) ?? (await getProduct(db, storeId, input.productId));
  if (!product) throw new DomainError('Product not found.');
  return { ...product, duplicate: result.duplicate };
}

async function findReceiptByOperation(db: Db, storeId: string, operationId: string) {
  const [row] = await db
    .select()
    .from(stockReceipts)
    .where(and(eq(stockReceipts.storeId, storeId), eq(stockReceipts.operationId, operationId)))
    .limit(1);
  return row ?? null;
}

async function receiptWithProducts(db: Db, storeId: string, receipt: StockReceipt) {
  const rows = await db
    .select({ product: products })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(and(eq(stockMovements.storeId, storeId), eq(stockMovements.refId, receipt.id)));
  return { receipt, products: rows.map((r) => r.product) };
}

export type ReceiptLabelLine = Product & { quantity: number };

/** A receipt with its items and quantities — for printing one label per piece. */
export async function getReceiptForLabels(db: Db, storeId: string, receiptId: string) {
  const [receipt] = await db
    .select({ receipt: stockReceipts, supplierName: suppliers.name, staffName: staff.name })
    .from(stockReceipts)
    .innerJoin(staff, eq(staff.id, stockReceipts.staffId))
    .leftJoin(suppliers, eq(suppliers.id, stockReceipts.supplierId))
    .where(and(eq(stockReceipts.storeId, storeId), eq(stockReceipts.id, receiptId)))
    .limit(1);
  if (!receipt) return null;
  const movementLines = await db
    .select({ product: products, quantity: stockMovements.quantityChange })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(and(eq(stockMovements.storeId, storeId), eq(stockMovements.refId, receiptId)))
    .orderBy(asc(products.name), asc(products.color), asc(products.size));
  const lines: ReceiptLabelLine[] = movementLines.map((l) => ({ ...l.product, quantity: l.quantity }));
  return { ...receipt.receipt, supplierName: receipt.supplierName, staffName: receipt.staffName, lines };
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
      billNumber: stockReceipts.billNumber,
      supplierName: suppliers.name,
    })
    .from(stockMovements)
    .leftJoin(staff, eq(staff.id, stockMovements.staffId))
    .leftJoin(stockReceipts, eq(stockReceipts.id, stockMovements.refId))
    .leftJoin(suppliers, eq(suppliers.id, stockReceipts.supplierId))
    .where(and(eq(stockMovements.storeId, storeId), eq(stockMovements.productId, productId)))
    .orderBy(desc(stockMovements.createdAt))
    .limit(50);
}

/** Every size/colour of the same design: same name, brand and category. */
export async function listDesignVariants(db: Db, storeId: string, productId: string): Promise<Product[]> {
  const product = await getProduct(db, storeId, productId);
  if (!product) return [];
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        sql`lower(${products.name}) = lower(${product.name})`,
        sql`lower(${products.brand}) = lower(${product.brand})`,
        product.categoryId ? eq(products.categoryId, product.categoryId) : eq(products.category, product.category),
      ),
    )
    .orderBy(asc(products.color), asc(products.size));
}

/**
 * Sets MRP, selling price and cost for every size/colour of a design at once:
 * the defaults, or a size's own rates (the same for all colours of that size).
 * Past sales keep their own price/MRP/cost snapshots, so history is unchanged.
 */
export async function updateDesignRates(
  db: Db,
  storeId: string,
  productId: string,
  rates: {
    mrpPaise: number;
    /** null = sell at MRP (each size's own MRP). */
    pricePaise: number | null;
    /** undefined = keep every item's purchase price (no "costs" right); sizes' own purchase prices are then ignored too. */
    costPaise: number | null | undefined;
    sizeRates?: SizeRates[];
  },
): Promise<number> {
  const keepCost = rates.costPaise === undefined;
  const own = (rates.sizeRates ?? []).map((row) => (keepCost ? { ...row, costPaise: null } : row));
  const variants = await listDesignVariants(db, storeId, productId);
  if (variants.length === 0) throw new DomainError('Product not found.');
  const groups: { size: string; ids: string[] }[] = [];
  for (const v of variants) {
    const group = groups.find((g) => sameSize(g.size, v.size));
    if (group) group.ids.push(v.id);
    else groups.push({ size: v.size, ids: [v.id] });
  }
  const bySize = resolveSizeRates(
    groups.map((g) => g.size),
    { mrpPaise: rates.mrpPaise, pricePaise: rates.pricePaise, costPaise: rates.costPaise ?? null },
    own,
  );
  return db.transaction(async (tx) => {
    let count = 0;
    for (const group of groups) {
      const size = bySize.get(group.size.trim().toLowerCase())!;
      const updated = await tx
        .update(products)
        .set({ mrpPaise: size.mrpPaise, pricePaise: size.pricePaise, ...(keepCost ? {} : { costPaise: size.costPaise }) })
        .where(and(eq(products.storeId, storeId), inArray(products.id, group.ids)))
        .returning({ id: products.id });
      count += updated.length;
    }
    return count;
  });
}

/** Every label line from receipts this person entered today (shop time zone) — "print today's labels". */
export async function getMyLabelsToday(db: Db, storeId: string, staffId: string, timezone: string, now = new Date()) {
  const at = sql`${now.toISOString()}::timestamptz`;
  const rows = await db
    .select({ product: products, quantity: stockMovements.quantityChange, receiptAt: stockReceipts.createdAt })
    .from(stockReceipts)
    .innerJoin(stockMovements, eq(stockMovements.refId, stockReceipts.id))
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(
      and(
        eq(stockReceipts.storeId, storeId),
        eq(stockReceipts.staffId, staffId),
        sql`${stockReceipts.createdAt} >= (date_trunc('day', ${at} AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})`,
      ),
    )
    .orderBy(asc(stockReceipts.createdAt), asc(products.name));
  return rows.map((r) => ({ ...r.product, quantity: r.quantity }));
}
