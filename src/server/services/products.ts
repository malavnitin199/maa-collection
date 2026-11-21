import { and, asc, desc, eq, ilike, inArray, isNull, like, or, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { categories, products, sections, staff, stockMovements, stockReceipts, suppliers, type Product, type StockReceipt } from '@/db/schema';
import { inStoreEan13, isValidEan13 } from '@/features/scanning/ean13';
import type { MessageKey } from '@/lib/i18n';
import { codeFromScan } from '@/lib/item-link';
import { AGE_GROUPS, FOR_GENDERS, parseTag, type AgeGroup, type ForGender, type ProductTags } from '@/lib/product-tags';
import { tagSizeRange } from '@/lib/size-lists';
import { packOf, perPiecePaise } from '@/lib/packs';
import { designSizesById, findSizeRates, ratesForSize, sameSize, type Rates, type SizeRates } from '@/lib/size-prices';
import { STORE_TIMEZONE } from '@/lib/app-config';
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
  /** Box packs (ADR-047): pieces in a box and the whole-box selling price (never the purchase price). */
  packSize?: number | null;
  packMrpPaise?: number | null;
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
    packSize: p.packSize,
    packMrpPaise: p.packMrpPaise,
  };
}

/**
 * Plan v18: every item in use, as the counter sees it, for the phone's offline
 * copy. Columns are picked one by one so the purchase price never leaves here.
 */
export async function counterCatalogue(db: Db, storeId: string): Promise<CounterProduct[]> {
  return db
    .select({
      id: products.id,
      sku: products.sku,
      barcode: products.barcode,
      name: products.name,
      brand: products.brand,
      category: products.category,
      size: products.size,
      color: products.color,
      mrpPaise: products.mrpPaise,
      pricePaise: products.pricePaise,
      stock: products.stock,
      packSize: products.packSize,
      packMrpPaise: products.packMrpPaise,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.active, true)))
    .orderBy(asc(products.name), asc(products.sku));
}

/** Finds an active product by scanned barcode, typed SKU (case-insensitive) or a tag's QR item link. */
export async function findProductByCode(db: Db, storeId: string, code: string): Promise<Product | null> {
  const needle = codeFromScan(code);
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

/** `active`: true = only items in use, false = only hidden ones (plan v17), unset = all. */
export type ProductListFilter = { search?: string; supplierId?: string; categoryId?: string; active?: boolean };
export type ProductListRow = Product & { supplierName: string | null };

export async function listProducts(db: Db, storeId: string, filter: ProductListFilter | string = {}): Promise<ProductListRow[]> {
  const { search = '', supplierId, categoryId, active } = typeof filter === 'string' ? { search: filter } : filter;
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
        active === undefined ? undefined : eq(products.active, active),
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
  if (!Number.isSafeInteger(input.mrpPaise) || input.mrpPaise <= 0) throw new DomainError('Enter a valid MRP.', { key: 'stk.err.price.mrp' });
  if (!Number.isSafeInteger(input.pricePaise) || input.pricePaise <= 0) {
    throw new DomainError('Enter a valid selling price.', { key: 'stk.err.price.price' });
  }
  if (input.pricePaise > input.mrpPaise) throw new DomainError('Selling price cannot be above MRP.', { key: 'stk.err.price.aboveMrp' });
  if (input.costPaise !== null && (!Number.isSafeInteger(input.costPaise) || input.costPaise < 0)) {
    throw new DomainError('Enter a valid cost price.', { key: 'stk.err.price.cost' });
  }
}

/** Which validatePrices rule failed — the same rule said for one size or one row ("Size M: …") has its own key. */
type PriceProblem = 'mrp' | 'price' | 'aboveMrp' | 'cost';
function priceProblem(error: unknown): PriceProblem | null {
  const match = error instanceof DomainError ? error.key?.match(/^stk\.err\.price\.(mrp|price|aboveMrp|cost)$/) : null;
  return match ? (match[1] as PriceProblem) : null;
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
      throw new DomainError(
        `Size ${row.size.trim() || '(blank)'} has its own price but is not one of the sizes.`,
        row.size.trim() ? { key: 'stk.err.sizeNotListed', vars: { size: row.size.trim() } } : { key: 'stk.err.blankSizeNotListed' },
      );
    }
    if (own.findIndex((other) => sameSize(other.size, row.size)) !== i) {
      throw new DomainError(`Size ${row.size.trim()} is priced twice.`, { key: 'stk.err.sizeTwice', vars: { size: row.size.trim() } });
    }
  });
  return new Map(
    sizes.map((size) => {
      const rates = ratesForSize(defaults, findSizeRates(own, size));
      const checked = { mrpPaise: rates.mrpPaise ?? NaN, pricePaise: rates.pricePaise ?? NaN, costPaise: rates.costPaise };
      try {
        validatePrices(checked);
      } catch (error) {
        const problem = priceProblem(error);
        throw error instanceof DomainError
          ? new DomainError(`Size ${size}: ${error.message}`, problem ? { key: `stk.err.size.${problem}`, vars: { size } } : undefined)
          : error;
      }
      return [size.trim().toLowerCase(), checked];
    }),
  );
}

const ENTER_KEY: Record<'name' | 'brand' | 'category' | 'size', MessageKey> = {
  name: 'stk.err.enter.name',
  brand: 'stk.err.enter.brand',
  category: 'stk.err.enter.category',
  size: 'stk.err.enter.size',
};

/** Colour is optional (owner, 2026-11-22): it is typed and shown only on the product page. */
function validateProductInput(input: ProductInput) {
  for (const field of ['name', 'brand', 'category', 'size'] as const) {
    if (!input[field].trim()) throw new DomainError(`Enter the ${field === 'name' ? 'product name' : field}.`, { key: ENTER_KEY[field] });
  }
  validatePrices(input);
}

/** SKU prefix from a category code ("KU") or, for legacy calls, a category name ("Kurta"). */
export function skuPrefix(codeOrCategory: string): string {
  const letters = codeOrCategory.toUpperCase().replace(/[^A-Z]/g, '');
  const code = /^[A-Z]{2,3}$/.test(codeOrCategory.trim()) ? codeOrCategory.trim() : (letters + 'XX').slice(0, 2);
  return `MAA-${code}-`;
}

/** "Pajama 013": the category's name and the number its next SKU will take. */
export async function defaultDesignName(db: Db, storeId: string, category: { name: string; code: string }): Promise<string> {
  const next = (await highestSkuNumber(db, storeId, skuPrefix(category.code))) + 1;
  return `${category.name} ${String(next).padStart(3, '0')}`;
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
  if (!category) throw new DomainError('Choose an active category.', { key: 'stk.err.activeCategory' });
  return category;
}

/**
 * Plan v19 (ADR-033): a NEW item needs both levels — its type must sit under a
 * section (Men / Women / Boys / Girls …) that is not hidden. Editing or moving
 * existing items uses `resolveCategory`: a category made before sections
 * ("Needs sorting") keeps working for them.
 */
async function resolveCategoryForNewItem(db: Db, storeId: string, categoryId: string) {
  const category = await resolveCategory(db, storeId, categoryId);
  if (!category.sectionId) throw new DomainError('Put this category under a collection first (Categories).', { key: 'sec.err.needsSection' });
  const [section] = await db
    .select({ id: sections.id, active: sections.active })
    .from(sections)
    .where(and(eq(sections.storeId, storeId), eq(sections.id, category.sectionId)))
    .limit(1);
  if (!section) throw new DomainError('Put this category under a collection first (Categories).', { key: 'sec.err.needsSection' });
  if (!section.active) throw new DomainError('This collection is hidden. Bring it back in Categories first.', { key: 'sec.err.hidden' });
  return category;
}

async function resolveSupplier(db: Db, storeId: string, supplierId: string) {
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.storeId, storeId), eq(suppliers.id, supplierId), eq(suppliers.active, true), isNull(suppliers.deletedAt)))
    .limit(1);
  if (!supplier) throw new DomainError('Choose an active company.', { key: 'stk.err.activeSupplier' });
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
    /** Who it is for (plan v17); empty = not set. */
    forGender?: string | null;
    ageGroup?: string | null;
  },
): Promise<Product> {
  let category = input.category;
  let prefix = skuPrefix(input.category);
  if (input.categoryId) {
    const row = await resolveCategoryForNewItem(db, storeId, input.categoryId);
    category = row.name;
    prefix = skuPrefix(row.code);
  }
  if (input.supplierId) await resolveSupplier(db, storeId, input.supplierId);
  validateProductInput({ ...input, category });
  const tags = resolveTags(input);
  if (!Number.isInteger(input.openingStock) || input.openingStock < 0) {
    throw new DomainError('Opening stock must be 0 or more.', { key: 'stk.err.openingStock' });
  }
  const manual = input.manufacturerBarcode?.trim() || null;
  if (manual && !isValidEan13(manual)) {
    throw new DomainError('That barcode is not a valid 13-digit EAN-13 (check the last digit).', { key: 'stk.err.ean13' });
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
            ...tags,
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
            unitCostPaise: input.costPaise ?? null,
          });
        }
        return created;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (manual) throw new DomainError('Another product already uses that barcode.', { key: 'stk.err.barcodeTaken' });
      // Two admins generated the same SKU/barcode at once: try the next number.
    }
  }
  throw new DomainError('Could not generate a unique SKU/barcode. Try again.', { key: 'stk.err.uniqueCode' });
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
  /** Optional (owner, 2026-11-22, ADR-051): empty = no company. */
  supplierId: string | null;
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
  /** Plan v19: pieces of each size (key: size, any letter case); sizes left out get `quantityEach`. */
  quantities?: Record<string, number>;
  billNumber?: string | null;
  /** Plan v19: the bill's (stock) date, YYYY-MM-DD; empty = the day it is entered. */
  stockDate?: string | null;
  /** Who it is for (plan v17), the same on every size and colour; empty = not set. */
  forGender?: string | null;
  ageGroup?: string | null;
  /**
   * Box packs (owner, 2026-11-21, ADR-047): pieces in one box and the whole-box prices.
   * Quantities stay in pieces (boxes × size). A box purchase price sets the piece's
   * cost (÷ size, to the paisa); a box MRP must not be above MRP × size.
   */
  pack?: { size: number; mrpPaise?: number | null; costPaise?: number | null } | null;
  /** New item with no size picked (ADR-052): one item, size empty; `quantities['']` = its pieces. */
  noSize?: boolean;
  staffId: string;
};

export type DesignResult = { receipt: StockReceipt; products: Product[]; duplicate: boolean };

/**
 * New stock from a supplier: one design in several sizes × colours. Creates one
 * product (SKU + in-store barcode) per combination and one stock receipt, in a
 * single transaction. Retrying the same operationId returns the first result.
 */
export async function createDesign(db: Db, storeId: string, input: DesignInput): Promise<DesignResult> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.', { key: 'stk.err.operationId' });
  const existing = await findReceiptByOperation(db, storeId, input.operationId);
  if (existing) return { ...(await receiptWithProducts(db, storeId, existing)), duplicate: true };

  let name = input.name.trim().replace(/\s+/g, ' ');
  // Plan v19 (D-V19-5): an empty brand stays empty (the old form sends the company's name itself).
  const brand = input.brand.trim();
  if (name.length > 120) throw new DomainError('Enter the design / product name.', { key: 'stk.err.designName' });
  // No size (owner, 2026-11-22, ADR-052): one item with an empty size, only its pieces.
  const sizes = input.noSize ? [''] : cleanList(input.sizes);
  // Plan v19 (D-V19-3): no colour given = one item per size with an empty colour, shown as nothing.
  const given = cleanList(input.colors);
  const colors = given.length > 0 ? given : [''];
  if (sizes.length === 0) throw new DomainError('Pick at least one size.', { key: 'stk.err.pickSize' });
  if (sizes.length * colors.length > 60) throw new DomainError('Too many combinations at once (max 60). Split the entry.', { key: 'stk.err.tooManyCombos' });
  const pack = resolvePack(input);
  const rates = resolveSizeRates(sizes, { ...input, costPaise: pack?.costPaise != null ? perPiecePaise(pack.costPaise, pack.size) : input.costPaise }, input.sizeRates);
  const tags = resolveTags(input);
  if (!Number.isInteger(input.quantityEach) || input.quantityEach < 0 || input.quantityEach > 10_000) {
    throw new DomainError('Pieces per size/colour must be 0 or more.', { key: 'stk.err.piecesEach' });
  }
  const quantities = new Map<string, number>();
  for (const [size, pieces] of Object.entries(input.quantities ?? {})) {
    if (!Number.isInteger(pieces) || pieces < 0 || pieces > 10_000) throw new DomainError('Pieces per size/colour must be 0 or more.', { key: 'stk.err.piecesEach' });
    quantities.set(size.trim().toLowerCase(), pieces);
  }
  const stockDate = cleanStockDate(input.stockDate);
  const category = await resolveCategoryForNewItem(db, storeId, input.categoryId);
  const supplierId = input.supplierId?.trim() || null;
  if (supplierId) await resolveSupplier(db, storeId, supplierId);
  // Owner's feedback 2026-11-21: the name is optional. A blank one becomes the category and the
  // number of the first SKU it gets ("Pajama 013" ↔ MAA-PJ-013), so the name and the tag line up.
  if (!name) name = await defaultDesignName(db, storeId, category);

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
    const list = clash.map((c) => `${c.size} (${c.sku})`).join(', ');
    throw new DomainError(`Already in the catalogue: ${list}. Use "Receive stock" for those instead.`, { key: 'stk.err.alreadyInCatalogue', vars: { list } });
  }

  return insertNewProducts(db, storeId, {
    operationId: input.operationId,
    supplierId,
    category,
    billNumber: input.billNumber,
    stockDate,
    note: `New design: ${name}`,
    staffId: input.staffId,
    rows: colors.flatMap((color) =>
      sizes.map((size) => ({
        name,
        brand,
        size,
        color,
        ...rates.get(size.toLowerCase())!,
        quantity: quantities.get(size.toLowerCase()) ?? input.quantityEach,
        ...tags,
        packSize: pack?.size ?? null,
        packMrpPaise: pack?.mrpPaise ?? null,
        packCostPaise: pack?.costPaise ?? null,
      })),
    ),
  });
}

/** Checks a box pack (ADR-047): 2 … 1000 pieces; whole-box prices positive, the box MRP not above MRP × pieces. */
function resolvePack(input: Pick<DesignInput, 'pack' | 'mrpPaise'>): { size: number; mrpPaise: number | null; costPaise: number | null } | null {
  if (!input.pack) return null;
  const size = packOf(input.pack.size);
  if (!size) throw new DomainError('Pieces in a box must be a whole number from 2 to 1000.', { key: 'pack.err.size' });
  const mrpPaise = input.pack.mrpPaise ?? null;
  const costPaise = input.pack.costPaise ?? null;
  if (mrpPaise !== null && (!Number.isSafeInteger(mrpPaise) || mrpPaise <= 0 || mrpPaise > input.mrpPaise * size)) {
    throw new DomainError('The whole-box MRP cannot be more than MRP × pieces in the box.', { key: 'pack.err.mrp' });
  }
  if (costPaise !== null && (!Number.isSafeInteger(costPaise) || costPaise < 0)) throw new DomainError('Enter a valid box purchase price.', { key: 'pack.err.cost' });
  return { size, mrpPaise, costPaise };
}

/** Plan v19: a stock date as typed (YYYY-MM-DD): a real day, from 2000 on, not after today in the shop. Empty = null. */
export function cleanStockDate(raw: string | null | undefined, today: string = shopToday()): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const day = new Date(`${value}T00:00:00Z`);
  // A day that does not exist (31 Feb) rolls over to another, so it no longer matches what was typed.
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
  if (!valid || value < '2000-01-01') throw new DomainError('Enter a valid stock date.', { key: 'ni.err.stockDate' });
  if (value > today) throw new DomainError('The stock date cannot be after today.', { key: 'ni.err.stockDateFuture' });
  return value;
}

/** Today's date in the shop's time zone (YYYY-MM-DD). */
export function shopToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIMEZONE }).format(new Date());
}

/** Checks the optional "for whom" tags (plan v17); unknown values are refused. */
function resolveTags(input: { forGender?: string | null; ageGroup?: string | null }): ProductTags {
  const forGender = parseTag(FOR_GENDERS, input.forGender);
  const ageGroup = parseTag(AGE_GROUPS, input.ageGroup);
  if (forGender === 'invalid' || ageGroup === 'invalid') throw new DomainError('Choose who the item is for from the list.', { key: 'stk.err.tagInvalid' });
  return { forGender, ageGroup };
}

/**
 * Sets the "for whom" tags (plan v17) on every size and colour of a product's
 * design (same name, brand and category — as `listDesignVariants`). Returns how
 * many items changed. Prices, stock and history are not touched.
 */
export async function setDesignTags(db: Db, storeId: string, productId: string, input: { forGender?: string | null; ageGroup?: string | null }): Promise<number> {
  const tags = resolveTags(input);
  const product = await getProduct(db, storeId, productId);
  if (!product) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
  const updated = await db
    .update(products)
    .set(tags)
    .where(
      and(
        eq(products.storeId, storeId),
        sql`lower(${products.name}) = lower(${product.name})`,
        sql`lower(${products.brand}) = lower(${product.brand})`,
        product.categoryId ? eq(products.categoryId, product.categoryId) : eq(products.category, product.category),
      ),
    )
    .returning({ id: products.id });
  return updated.length;
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
  forGender?: ForGender | null;
  ageGroup?: AgeGroup | null;
  /** Box packs (ADR-047): pieces in a box and the whole-box prices; absent = sold loose. */
  packSize?: number | null;
  packMrpPaise?: number | null;
  packCostPaise?: number | null;
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
    stockDate?: string | null;
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
            stockDate: input.stockDate ?? null,
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
              forGender: row.forGender ?? null,
              ageGroup: row.ageGroup ?? null,
              packSize: row.packSize ?? null,
              packMrpPaise: row.packMrpPaise ?? null,
              packCostPaise: row.packCostPaise ?? null,
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
            // Company accounts: the purchase price on the day, kept with the delivery.
            unitCostPaise: input.rows[i].costPaise ?? null,
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
  throw new DomainError('Could not generate unique SKUs/barcodes. Try again.', { key: 'stk.err.uniqueCodes' });
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
    /** Who it is for (plan v17), the same on every row; empty = not set. */
    forGender?: string | null;
    ageGroup?: string | null;
    staffId: string;
  },
): Promise<DesignResult> {
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.', { key: 'stk.err.operationId' });
  const existing = await findReceiptByOperation(db, storeId, input.operationId);
  if (existing) return { ...(await receiptWithProducts(db, storeId, existing)), duplicate: true };

  const category = await resolveCategoryForNewItem(db, storeId, input.categoryId);
  const supplier = input.supplierId ? await resolveSupplier(db, storeId, input.supplierId) : null;
  const brand = input.brand?.trim() || supplier?.name || 'Unbranded';
  const tags = resolveTags(input);
  const rows = input.rows.filter((r) => r.name.trim());
  if (rows.length === 0) throw new DomainError('Add at least one product with a name.', { key: 'stk.err.addNamedProduct' });
  if (rows.length > 50) throw new DomainError('Up to 50 products at once. Split the entry.', { key: 'stk.err.tooManyProducts' });

  const cleaned = rows.map((row, i) => {
    const label = `Row ${i + 1} (${row.name.trim()})`;
    const vars = { row: i + 1, name: row.name.trim() };
    try {
      validatePrices(row);
    } catch (error) {
      const problem = priceProblem(error);
      throw new DomainError(`${label}: ${(error as Error).message}`, problem ? { key: `stk.err.row.${problem}`, vars } : undefined);
    }
    if (!Number.isInteger(row.quantity) || row.quantity < 0 || row.quantity > 10_000) {
      throw new DomainError(`${label}: pieces must be 0 or more.`, { key: 'stk.err.row.pieces', vars });
    }
    const barcode = row.barcode?.trim() || null;
    if (barcode && !isValidEan13(barcode)) {
      throw new DomainError(`${label}: ${barcode} is not a valid 13-digit barcode.`, { key: 'stk.err.row.barcode', vars: { ...vars, barcode } });
    }
    return {
      barcode,
      name: row.name.trim(),
      brand,
      size: row.size?.trim() || 'Free',
      // No colour = empty (owner, 2026-11-22: colour lives on the product page only).
      color: row.color?.trim() ?? '',
      mrpPaise: row.mrpPaise,
      pricePaise: row.pricePaise,
      costPaise: row.costPaise,
      quantity: row.quantity,
      ...tags,
    };
  });
  const ownBarcodes = cleaned.flatMap((r) => (r.barcode ? [r.barcode] : []));
  if (new Set(ownBarcodes).size !== ownBarcodes.length) throw new DomainError('The same barcode is entered twice.', { key: 'stk.err.sameBarcodeTwice' });
  if (ownBarcodes.length > 0) {
    const taken = await db
      .select({ barcode: products.barcode, name: products.name, sku: products.sku })
      .from(products)
      .where(and(eq(products.storeId, storeId), inArray(products.barcode, ownBarcodes)));
    if (taken.length > 0) {
      const list = taken.map((t) => `${t.barcode} = ${t.name} (${t.sku})`).join(', ');
      throw new DomainError(`Barcode already in the app: ${list}. Add pieces to it instead.`, { key: 'stk.err.barcodeInApp', vars: { list } });
    }
  }
  const keys = cleaned.map((r) => `${r.name}|${r.size}|${r.color}`.toLowerCase());
  const repeated = keys.find((k, i) => keys.indexOf(k) !== i);
  if (repeated) {
    const item = repeated.split('|').join(' · ');
    throw new DomainError(`The same product is entered twice: ${item}.`, { key: 'stk.err.sameProductTwice', vars: { item } });
  }

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
    const list = clash.map((c) => `${c.name} ${c.size} (${c.sku})`).join(', ');
    throw new DomainError(`Already in the catalogue: ${list}. Use "Receive stock" for those instead.`, { key: 'stk.err.alreadyInCatalogue', vars: { list } });
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

/**
 * Fix an item right after tagging it (Tag old stock → Edit): name, size, colour,
 * category, company and prices. Same item, barcode and SKU; the piece count is
 * never touched here (stock only changes through the ledger).
 * Prices change with the "prices" right, or when the person who created the item
 * corrects it before it has ever been sold or exchanged (fixing what they just
 * typed). The purchase price needs the "costs" right. Otherwise the old values stay
 * and `pricesKept` says so.
 */
export async function correctTaggedItem(
  db: Db,
  storeId: string,
  input: {
    productId: string;
    staffId: string;
    canPrices: boolean;
    canCosts: boolean;
    name: string;
    categoryId: string;
    supplierId: string | null;
    size: string;
    color: string;
    mrpPaise: number;
    pricePaise: number;
    costPaise: number | null;
    /** Plan v17 tags for this item; undefined = keep, '' = clear. */
    forGender?: string | null;
    ageGroup?: string | null;
  },
): Promise<{ product: Product; pricesKept: boolean }> {
  const current = await getProduct(db, storeId, input.productId);
  if (!current) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
  let pricesAllowed = input.canPrices;
  if (!pricesAllowed && current.createdBy === input.staffId) {
    const [sold] = await db
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(and(eq(stockMovements.productId, current.id), inArray(stockMovements.reason, ['sale', 'exchange_return', 'exchange_issue'])))
      .limit(1);
    pricesAllowed = !sold;
  }
  // Check the tags before changing anything, so a bad value changes nothing.
  const tags = input.forGender === undefined && input.ageGroup === undefined ? null : resolveTags(input);
  const mrpPaise = pricesAllowed ? input.mrpPaise : current.mrpPaise;
  const pricePaise = pricesAllowed ? input.pricePaise : current.pricePaise;
  const costPaise = input.canCosts ? input.costPaise : current.costPaise;
  const product = await updateProduct(db, storeId, current.id, {
    name: input.name,
    brand: current.brand,
    category: current.category,
    categoryId: input.categoryId,
    supplierId: input.supplierId,
    size: input.size,
    color: input.color,
    mrpPaise,
    pricePaise,
    costPaise,
    active: current.active,
  });
  const pricesKept = mrpPaise !== input.mrpPaise || pricePaise !== input.pricePaise;
  if (!tags) return { product, pricesKept };
  const [tagged] = await db.update(products).set(tags).where(and(eq(products.storeId, storeId), eq(products.id, product.id))).returning();
  return { product: tagged, pricesKept };
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
  if (!updated) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
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
  if (!input.operationId || input.operationId.length > 100) throw new DomainError('Missing operation id.', { key: 'stk.err.operationId' });
  const existing = await findReceiptByOperation(db, storeId, input.operationId);
  if (existing) return { ...(await receiptWithProducts(db, storeId, existing)), duplicate: true };
  const lines = input.lines.filter((l) => l.quantity !== 0);
  if (lines.length === 0) throw new DomainError('Add at least one item with a quantity.', { key: 'stk.err.addLine' });
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100_000) {
      throw new DomainError('Quantity must be a whole number, at least 1.', { key: 'stk.err.quantity' });
    }
  }
  if (new Set(lines.map((l) => l.productId)).size !== lines.length) throw new DomainError('An item is listed twice.', { key: 'stk.err.listedTwice' });
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
        if (!row) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
        updated.push(row);
      }
      await tx.insert(stockMovements).values(
        lines.map((line, i) => ({
          storeId,
          productId: line.productId,
          quantityChange: line.quantity,
          reason: 'stock_in' as const,
          refId: receipt.id,
          staffId: input.staffId,
          note: input.note?.trim() || null,
          // Company accounts: the item's purchase price on the day, kept with the delivery.
          unitCostPaise: updated[i].costPaise,
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
/** How much stock the shop holds right now (for the Clear stock screen). */
export async function stockTotals(db: Db, storeId: string): Promise<{ items: number; pieces: number }> {
  const [row] = await db
    .select({ items: sql<number>`count(*)::int`, pieces: sql<number>`coalesce(sum(${products.stock}), 0)::int` })
    .from(products)
    .where(and(eq(products.storeId, storeId), sql`${products.stock} > 0`));
  return { items: row?.items ?? 0, pieces: row?.pieces ?? 0 };
}

/**
 * Clear stock (owner only): every item's count becomes 0. Nothing is erased —
 * items, barcodes, prices, photos and past sales stay, and each item gets a
 * 'cleared' entry in its stock history (minus what it had, who, when), so the
 * ledger still explains every number. Running it again changes nothing.
 */
export async function clearAllStock(db: Db, storeId: string, input: { staffId: string; note?: string }): Promise<{ items: number; pieces: number }> {
  return db.transaction(async (tx) => {
    const held = await tx
      .select({ id: products.id, stock: products.stock })
      .from(products)
      // Not zero: since plan v18 a count can be below zero (offline sales); it is reset too.
      .where(and(eq(products.storeId, storeId), sql`${products.stock} <> 0`))
      .for('update');
    if (held.length === 0) return { items: 0, pieces: 0 };
    await tx.insert(stockMovements).values(
      held.map((p) => ({
        storeId,
        productId: p.id,
        quantityChange: -p.stock,
        reason: 'cleared' as const,
        staffId: input.staffId,
        note: input.note?.trim().slice(0, 200) || 'Stock cleared',
      })),
    );
    await tx.update(products).set({ stock: 0 }).where(and(eq(products.storeId, storeId), inArray(products.id, held.map((p) => p.id))));
    return { items: held.length, pieces: held.reduce((n, p) => n + Math.max(p.stock, 0), 0) };
  });
}

export async function stockIn(
  db: Db,
  storeId: string,
  input: { operationId: string; productId: string; quantity: number; staffId: string; note?: string; supplierId?: string | null },
): Promise<Product & { duplicate: boolean }> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100_000) {
    throw new DomainError('Quantity must be a whole number, at least 1.', { key: 'stk.err.quantity' });
  }
  const result = await receiveStock(db, storeId, {
    operationId: input.operationId,
    supplierId: input.supplierId,
    note: input.note,
    lines: [{ productId: input.productId, quantity: input.quantity }],
    staffId: input.staffId,
  });
  const product = result.products.find((p) => p.id === input.productId) ?? (await getProduct(db, storeId, input.productId));
  if (!product) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
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

/** For each product (and its design siblings): the sizes its design is made in, in shop order — the size row on tags. */
export async function designSizesFor(db: Db, storeId: string, items: readonly { name: string }[]): Promise<Map<string, string[]>> {
  const names = [...new Set(items.map((p) => p.name.trim().toLowerCase()))];
  if (names.length === 0) return new Map();
  const rows = await db
    .select({ id: products.id, name: products.name, brand: products.brand, categoryId: products.categoryId, category: products.category, size: products.size })
    .from(products)
    .where(and(eq(products.storeId, storeId), inArray(sql`lower(${products.name})`, names)));
  return designSizesById(rows);
}

/** The size row printed on each item's tag: its category's sizes (else its design's), including its own size. */
export async function tagSizesFor(
  db: Db,
  storeId: string,
  items: readonly { id: string; name: string; size: string; categoryId: string | null }[],
): Promise<Map<string, string[]>> {
  const [design, categoryRows] = await Promise.all([
    designSizesFor(db, storeId, items),
    db.select({ id: categories.id, sizes: categories.sizes }).from(categories).where(eq(categories.storeId, storeId)),
  ]);
  const byCategory = new Map(categoryRows.map((c) => [c.id, c.sizes]));
  return new Map(items.map((p) => [p.id, tagSizeRange((p.categoryId && byCategory.get(p.categoryId)) || [], design.get(p.id) ?? [], p.size)]));
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
  if (variants.length === 0) throw new DomainError('Product not found.', { key: 'error.productNotFound' });
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

/**
 * Many items at once (plan v17, Products → Select). Every change is checked
 * first and applied in one transaction, so a bad value changes nothing.
 * "Hide" never deletes: sales and stock history point to items; hidden items
 * leave the counter, Products and All tags, and can be brought back.
 */
export type BulkProductChange =
  | { kind: 'hide' }
  | { kind: 'show' }
  | { kind: 'rename'; name: string }
  | { kind: 'company'; supplierId: string | null }
  | { kind: 'category'; categoryId: string }
  | { kind: 'tags'; forGender?: string | null; ageGroup?: string | null }
  /** null = keep each item's own value. */
  | { kind: 'prices'; mrpPaise: number | null; pricePaise: number | null };

export const BULK_MAX = 500;

export async function bulkUpdateProducts(db: Db, storeId: string, ids: readonly string[], change: BulkProductChange): Promise<number> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new DomainError('Choose at least one item.', { key: 'stk.err.bulkNone' });
  if (unique.length > BULK_MAX) throw new DomainError(`Up to ${BULK_MAX} items at once.`, { key: 'stk.err.bulkTooMany', vars: { n: BULK_MAX } });
  const mine = and(eq(products.storeId, storeId), inArray(products.id, unique));
  const set = async (values: Partial<typeof products.$inferInsert>) => (await db.update(products).set(values).where(mine).returning({ id: products.id })).length;

  switch (change.kind) {
    case 'hide':
    case 'show':
      return set({ active: change.kind === 'show' });
    case 'rename': {
      const name = change.name.trim();
      if (!name) throw new DomainError('Enter the product name.', { key: 'stk.err.enter.name' });
      if (name.length > 120) throw new DomainError('The name is too long (up to 120 letters).', { key: 'stk.err.nameTooLong' });
      return set({ name });
    }
    case 'company': {
      if (change.supplierId) await resolveSupplier(db, storeId, change.supplierId);
      return set({ supplierId: change.supplierId });
    }
    case 'category': {
      const category = await resolveCategory(db, storeId, change.categoryId);
      return set({ categoryId: category.id, category: category.name });
    }
    case 'tags':
      return set(resolveTags(change));
    case 'prices': {
      if (change.mrpPaise === null && change.pricePaise === null) throw new DomainError('Enter a new MRP or selling price.', { key: 'stk.err.bulkNoPrice' });
      const rows = await db.select({ id: products.id, sku: products.sku, mrpPaise: products.mrpPaise, pricePaise: products.pricePaise, costPaise: products.costPaise }).from(products).where(mine);
      // Check every item first: a selling price never above its MRP.
      const next = rows.map((r) => ({ ...r, mrpPaise: change.mrpPaise ?? r.mrpPaise, pricePaise: change.pricePaise ?? r.pricePaise }));
      const above = next.filter((r) => r.pricePaise > r.mrpPaise).map((r) => r.sku);
      if (above.length > 0) {
        const list = above.slice(0, 5).join(', ') + (above.length > 5 ? '…' : '');
        throw new DomainError(`Selling price would be above MRP for ${list}.`, { key: 'stk.err.bulkAboveMrp', vars: { list } });
      }
      for (const r of next) validatePrices(r);
      return db.transaction(async (tx) => {
        for (const r of next) await tx.update(products).set({ mrpPaise: r.mrpPaise, pricePaise: r.pricePaise }).where(and(eq(products.storeId, storeId), eq(products.id, r.id)));
        return next.length;
      });
    }
  }
}

/** The chosen items, in name / colour / size order (for printing their tags). */
export async function productsByIds(db: Db, storeId: string, ids: readonly string[]): Promise<Product[]> {
  const unique = [...new Set(ids)].slice(0, BULK_MAX);
  if (unique.length === 0) return [];
  return db
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.active, true), inArray(products.id, unique)))
    .orderBy(asc(products.name), asc(products.color), asc(products.size));
}
