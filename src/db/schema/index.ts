import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Every table carries store_id so more shops can be added later.
 * Money is integer paise. sales, exchanges and stock_movements are append-only.
 */

export const stores = pgTable('stores', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  /** Owner's secret 10-letter word for the code price on tags (letters = 1…9,0). */
  priceCodeWord: text('price_code_word'),
  /** Print the purchase price, in code, on barcode labels. */
  printPriceCode: boolean('print_price_code').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    name: text('name').notNull(),
    role: text('role', { enum: ['admin', 'salesman'] }).notNull(),
    /** Extra rights the owner grants a salesman: catalog, prices, stock, costs (admins have all). */
    permissions: text('permissions').array().notNull().default(sql`'{}'::text[]`),
    pinHash: text('pin_hash').notNull(),
    /** Screen language this person chose ('en' / 'hi'); null = this phone's choice, else English. */
    language: text('language'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('staff_store_name_uq').on(t.storeId, t.name)],
);

/** Companies the shop buys from (e.g. "XYZ Textiles"). */
export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    phone: text('phone'),
    gstin: text('gstin'),
    notes: text('notes'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('suppliers_store_name_uq').on(t.storeId, t.name)],
);

/** Shop-defined categories; `code` (2–3 letters) goes into generated SKUs. */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    name: text('name').notNull(),
    code: text('code').notNull(),
    /** Sizes this category comes in, shop order (tags print them all; stock entry offers them first). */
    sizes: text('sizes').array().notNull().default(sql`'{}'::text[]`),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('categories_store_name_uq').on(t.storeId, t.name),
    uniqueIndex('categories_store_code_uq').on(t.storeId, t.code),
  ],
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    sku: text('sku').notNull(),
    barcode: text('barcode').notNull(),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    /** Category name snapshot (display/search); categoryId links to `categories`. */
    category: text('category').notNull(),
    categoryId: uuid('category_id').references(() => categories.id),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    size: text('size').notNull(),
    color: text('color').notNull(),
    mrpPaise: integer('mrp_paise').notNull(),
    /** Default selling price, prefilled at the counter; bargaining may go lower. */
    pricePaise: integer('price_paise').notNull(),
    /** Admin-only. Never sent to salesman screens. */
    costPaise: integer('cost_paise'),
    stock: integer('stock').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdBy: uuid('created_by').references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('products_store_sku_uq').on(t.storeId, t.sku),
    uniqueIndex('products_store_barcode_uq').on(t.storeId, t.barcode),
    check('products_stock_nonnegative', sql`${t.stock} >= 0`),
    check('products_price_le_mrp', sql`${t.pricePaise} > 0 AND ${t.pricePaise} <= ${t.mrpPaise}`),
  ],
);

/**
 * One stock arrival (purchase entry): who it came from, their bill number, who
 * entered it. Its lines are the stock_movements with ref_id = receipt id.
 * operation_id makes a retried "Save" add the stock only once.
 */
export const stockReceipts = pgTable(
  'stock_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    operationId: text('operation_id').notNull(),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    billNumber: text('bill_number'),
    note: text('note'),
    staffId: uuid('staff_id').notNull().references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('stock_receipts_store_operation_uq').on(t.storeId, t.operationId),
    index('stock_receipts_supplier_idx').on(t.supplierId, t.createdAt),
  ],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    productId: uuid('product_id').notNull().references(() => products.id),
    quantityChange: integer('quantity_change').notNull(),
    reason: text('reason', {
      enum: ['opening', 'stock_in', 'sale', 'exchange_return', 'exchange_issue'],
    }).notNull(),
    refId: uuid('ref_id'),
    staffId: uuid('staff_id').references(() => staff.id),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('stock_movements_product_idx').on(t.productId, t.createdAt)],
);

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    /** Idempotency key from the client: a retried submit never sells twice. */
    operationId: text('operation_id').notNull(),
    productId: uuid('product_id').notNull().references(() => products.id),
    sku: text('sku').notNull(),
    productName: text('product_name').notNull(),
    size: text('size').notNull(),
    color: text('color').notNull(),
    mrpPaise: integer('mrp_paise').notNull(),
    quantity: integer('quantity').notNull(),
    unitPricePaise: integer('unit_price_paise').notNull(),
    totalPaise: integer('total_paise').notNull(),
    /** Admin-only cost snapshot for profit reports; never sent to salesman screens. */
    costPaise: integer('cost_paise'),
    /** Salesperson the sale is credited to. */
    soldBy: uuid('sold_by').notNull().references(() => staff.id),
    /** Logged-in staff member who entered it (may differ: "sale on behalf of"). */
    recordedBy: uuid('recorded_by').notNull().references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sales_store_operation_uq').on(t.storeId, t.operationId),
    index('sales_store_created_idx').on(t.storeId, t.createdAt),
    index('sales_product_idx').on(t.productId, t.createdAt),
    check('sales_quantity_positive', sql`${t.quantity} > 0`),
    check('sales_price_le_mrp', sql`${t.unitPricePaise} > 0 AND ${t.unitPricePaise} <= ${t.mrpPaise}`),
  ],
);

export const exchanges = pgTable(
  'exchanges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    operationId: text('operation_id').notNull(),
    originalSaleId: uuid('original_sale_id').notNull().references(() => sales.id),
    returnedProductId: uuid('returned_product_id').notNull().references(() => products.id),
    returnedQuantity: integer('returned_quantity').notNull(),
    /** Price the customer actually paid per unit in the original sale. */
    returnedUnitPricePaise: integer('returned_unit_price_paise').notNull(),
    issuedProductId: uuid('issued_product_id').notNull().references(() => products.id),
    issuedSku: text('issued_sku').notNull(),
    issuedProductName: text('issued_product_name').notNull(),
    issuedSize: text('issued_size').notNull(),
    issuedColor: text('issued_color').notNull(),
    issuedQuantity: integer('issued_quantity').notNull(),
    issuedUnitPricePaise: integer('issued_unit_price_paise').notNull(),
    issuedMrpPaise: integer('issued_mrp_paise').notNull(),
    /** issued total − returned value. Positive: customer pays; negative: shop gives back. */
    differencePaise: integer('difference_paise').notNull(),
    creditedTo: uuid('credited_to').notNull().references(() => staff.id),
    recordedBy: uuid('recorded_by').notNull().references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('exchanges_store_operation_uq').on(t.storeId, t.operationId),
    index('exchanges_store_created_idx').on(t.storeId, t.createdAt),
    index('exchanges_original_sale_idx').on(t.originalSaleId),
    check('exchanges_quantities_positive', sql`${t.returnedQuantity} > 0 AND ${t.issuedQuantity} > 0`),
    check(
      'exchanges_issued_price_le_mrp',
      sql`${t.issuedUnitPricePaise} > 0 AND ${t.issuedUnitPricePaise} <= ${t.issuedMrpPaise}`,
    ),
  ],
);

/** Raw image bytes (Postgres bytea). PGlite returns Uint8Array, postgres.js returns Buffer. */
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
});

/**
 * Product photos. Bytes live in `data` (works everywhere); `url` is for an
 * external store (e.g. Vercel Blob) when configured. Lowest sort = main photo.
 */
export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    productId: uuid('product_id').notNull().references(() => products.id),
    contentType: text('content_type').notNull(),
    data: bytea('data'),
    url: text('url'),
    byteSize: integer('byte_size').notNull(),
    width: integer('width'),
    height: integer('height'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdBy: uuid('created_by').references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('product_images_product_idx').on(t.productId, t.sortOrder)],
);

export type Staff = typeof staff.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type StockReceipt = typeof stockReceipts.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type Exchange = typeof exchanges.$inferSelect;
