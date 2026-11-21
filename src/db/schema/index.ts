import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  date,
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
    /** Where the company is (city / market), as the owner types it — e.g. "Surat" (company accounts, 2026-11-20). */
    location: text('location'),
    /**
     * The day the shop started buying from this company, as the owner gives it
     * (may be years before the app). Separate from `created_at`, the day it was
     * added here (companies overview, 2026-11-20). Null = not given.
     */
    workingSince: date('working_since', { mode: 'string' }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('suppliers_store_name_uq').on(t.storeId, t.name)],
);

/**
 * Money paid to a company (company accounts, 2026-11-20). Append-only, like
 * stock_receipts. A payment may name the bill it is for (`bill_number`, matched
 * to deliveries by number, any letter case); without one it goes to the
 * company's running account. Dues = purchases − payments.
 */
export const supplierPayments = pgTable(
  'supplier_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    /** Idempotency key from the form: a double tap records one payment. */
    operationId: text('operation_id').notNull(),
    supplierId: uuid('supplier_id').notNull().references(() => suppliers.id),
    billNumber: text('bill_number'),
    /** Bills section (2026-11-21): the bill this payment is for (that company's part of it); null = running account. */
    billId: uuid('bill_id').references(() => bills.id),
    amountPaise: integer('amount_paise').notNull(),
    /** The day the money was paid, as the owner gave it. */
    paidOn: date('paid_on', { mode: 'string' }).notNull(),
    note: text('note'),
    staffId: uuid('staff_id').notNull().references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('supplier_payments_store_operation_uq').on(t.storeId, t.operationId),
    index('supplier_payments_supplier_idx').on(t.supplierId, t.paidOn),
    check('supplier_payments_amount_positive', sql`${t.amountPaise} > 0`),
  ],
);

/**
 * Plan v19 (ADR-033): who an item is for — Men, Women, Boys, Girls, and any
 * section the owner adds. Every item type (category) sits under one section;
 * a new item needs both. `name_hi` = the Hindi name (null = show `name`).
 */
export const sections = pgTable(
  'sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    name: text('name').notNull(),
    nameHi: text('name_hi'),
    /** Picture key, one of `SECTION_ICONS` (src/lib/sections.ts). */
    icon: text('icon').notNull().default('hanger'),
    /** Shop order on the New item screen. */
    sort: integer('sort').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sections_store_name_uq').on(t.storeId, t.name)],
);

/** Shop-defined categories (item types); `code` (2–3 letters) goes into generated SKUs. */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    /** Plan v19: the section (Men / Women / Boys / Girls …); null = not sorted yet (made before sections). */
    sectionId: uuid('section_id').references(() => sections.id),
    name: text('name').notNull(),
    /** Hindi name; null = show `name`. */
    nameHi: text('name_hi'),
    code: text('code').notNull(),
    /** Sizes this category comes in, shop order (tags print them all; stock entry offers them first). */
    sizes: text('sizes').array().notNull().default(sql`'{}'::text[]`),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Plan v19: the same name may sit under two sections (Boys › Jeans, Girls › Jeans).
    uniqueIndex('categories_store_section_name_uq').on(t.storeId, t.sectionId, t.name),
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
    /** Who it is for (plan v17): girls | boys | both; null = not set. Same for a whole design. */
    forGender: text('for_gender'),
    /** adult | child; null = not set. */
    ageGroup: text('age_group'),
    /**
     * Box packs (owner, 2026-11-21, ADR-047): pieces in one box (null = sold loose). Stock,
     * MRP, price and cost stay per piece; one tag is printed per box; the counter sells
     * pieces or whole boxes.
     */
    packSize: integer('pack_size'),
    /** Selling price of a whole box (null = MRP × pieces in the box). */
    packMrpPaise: integer('pack_mrp_paise'),
    /** Admin-only. Purchase price of a whole box as on the company's bill (cost_paise = this ÷ pack_size). */
    packCostPaise: integer('pack_cost_paise'),
    createdBy: uuid('created_by').references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('products_store_sku_uq').on(t.storeId, t.sku),
    uniqueIndex('products_store_barcode_uq').on(t.storeId, t.barcode),
    // No "stock >= 0" rule since plan v18 (owner's decision): a sale made offline is always
    // recorded when the phone is back online, even if that takes the count below zero.
    // Online sales, exchanges and corrections still refuse to go below zero in the services.
    check('products_price_le_mrp', sql`${t.pricePaise} > 0 AND ${t.pricePaise} <= ${t.mrpPaise}`),
    check('products_for_gender_valid', sql`${t.forGender} IS NULL OR ${t.forGender} IN ('girls', 'boys', 'both')`),
    check('products_age_group_valid', sql`${t.ageGroup} IS NULL OR ${t.ageGroup} IN ('adult', 'child')`),
    check('products_pack_valid', sql`${t.packSize} IS NULL OR (${t.packSize} BETWEEN 2 AND 1000)`),
    check('products_pack_prices_positive', sql`(${t.packMrpPaise} IS NULL OR ${t.packMrpPaise} > 0) AND (${t.packCostPaise} IS NULL OR ${t.packCostPaise} >= 0)`),
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
    /** Plan v19: the day the stock (bill) is dated, as the owner gave it; null = the day it was entered. */
    stockDate: date('stock_date', { mode: 'string' }),
    note: text('note'),
    staffId: uuid('staff_id').notNull().references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('stock_receipts_store_operation_uq').on(t.storeId, t.operationId),
    index('stock_receipts_supplier_idx').on(t.supplierId, t.createdAt),
  ],
);

/**
 * Bills section (owner's feedback 2026-11-21): a company's paper bill, entered by
 * the owner. A bill has one or more companies, each with its part of the amount
 * (dues come from these), and the collections (stock receipts, one per New item
 * save) it covers. A delivery is no longer called a bill.
 */
export const bills = pgTable(
  'bills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    /** Idempotency key from the form: a double tap makes one bill. */
    operationId: text('operation_id').notNull(),
    billNumber: text('bill_number'),
    /** The day printed on the bill, as the owner gave it (may be earlier than created_at). */
    billDate: date('bill_date', { mode: 'string' }).notNull(),
    note: text('note'),
    staffId: uuid('staff_id').notNull().references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('bills_store_operation_uq').on(t.storeId, t.operationId), index('bills_store_date_idx').on(t.storeId, t.billDate)],
);

/** A company on a bill and its part of the amount. The bill's total is the sum of its parts. */
export const billCompanies = pgTable(
  'bill_companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    billId: uuid('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    amountPaise: integer('amount_paise').notNull(),
  },
  (t) => [
    uniqueIndex('bill_companies_bill_supplier_uq').on(t.billId, t.supplierId),
    index('bill_companies_supplier_idx').on(t.supplierId),
    check('bill_companies_amount_nonnegative', sql`${t.amountPaise} >= 0`),
  ],
);

/** A collection (stock receipt) on a bill. A collection is on at most one bill. */
export const billCollections = pgTable(
  'bill_collections',
  {
    billId: uuid('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    receiptId: uuid('receipt_id')
      .notNull()
      .references(() => stockReceipts.id),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('bill_collections_receipt_uq').on(t.receiptId), index('bill_collections_bill_idx').on(t.billId)],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    productId: uuid('product_id').notNull().references(() => products.id),
    quantityChange: integer('quantity_change').notNull(),
    reason: text('reason', {
      // 'cleared' = the owner set this item's count to 0 (Settings → Clear stock).
      // 'sale_rejected' / 'exchange_rejected' = the owner rejected an entry, so its stock change is undone by a new row.
      enum: ['opening', 'stock_in', 'sale', 'exchange_return', 'exchange_issue', 'cleared', 'sale_rejected', 'exchange_rejected'],
    }).notNull(),
    refId: uuid('ref_id'),
    staffId: uuid('staff_id').references(() => staff.id),
    note: text('note'),
    /**
     * Purchase price per piece when the stock arrived (plan v19 V19-06), so a
     * company's bills keep their amount even if the item's price changes later.
     * Null on rows from before 2026-11-20: their amount is estimated from today's price.
     */
    unitCostPaise: integer('unit_cost_paise'),
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
    /** The item sold. Empty only for a manual sale of something that is not in the app. */
    productId: uuid('product_id').references(() => products.id),
    sku: text('sku').notNull(),
    productName: text('product_name').notNull(),
    size: text('size').notNull(),
    color: text('color').notNull(),
    /** MRP at sale time; empty when the item is not in the app (no MRP known). */
    mrpPaise: integer('mrp_paise'),
    /** Entered without scanning (tag would not scan): the owner looks at each of these himself. */
    manual: boolean('manual').notNull().default(false),
    manualNote: text('manual_note'),
    /**
     * The item was deleted later (owner, 2026-11-22, ADR-050): the sale keeps its name,
     * size, MRP, price, cost and amount, but `product_id` is empty.
     */
    itemDeleted: boolean('item_deleted').notNull().default(false),
    quantity: integer('quantity').notNull(),
    unitPricePaise: integer('unit_price_paise').notNull(),
    totalPaise: integer('total_paise').notNull(),
    /** Admin-only cost snapshot for profit reports; never sent to salesman screens. */
    costPaise: integer('cost_paise'),
    /** Plan v18: made on a phone without internet, at this (phone) time; sent later. Null = online. */
    offlineAt: timestamp('offline_at', { withTimezone: true }),
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
    check('sales_price_le_mrp', sql`${t.unitPricePaise} > 0 AND (${t.mrpPaise} IS NULL OR ${t.unitPricePaise} <= ${t.mrpPaise})`),
    // A sale without an item is a manual sale, or one whose item was deleted later; a scanned sale has its item and MRP.
    check('sales_item_or_manual', sql`(${t.productId} IS NOT NULL AND ${t.mrpPaise} IS NOT NULL) OR ${t.manual} OR ${t.itemDeleted}`),
  ],
);

export const exchanges = pgTable(
  'exchanges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    operationId: text('operation_id').notNull(),
    /** The sale the returned piece came from. Empty when the app has no bill for it (sold before the app). */
    originalSaleId: uuid('original_sale_id').references(() => sales.id),
    returnedProductId: uuid('returned_product_id').notNull().references(() => products.id),
    returnedQuantity: integer('returned_quantity').notNull(),
    /** Price the customer actually paid per unit: from the original sale, or typed by the salesman when there is no bill. */
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

/**
 * The owner's decision on a sale or an exchange (plan v12). Append-only: one
 * row per sale / exchange at most (unique indexes), never updated or deleted.
 * No row = waiting for the owner. Sales and exchanges themselves are never
 * edited; only approved ones count in totals. `auto` = the owner's own entry
 * (approved as it is recorded) or a row that existed before approvals.
 */
export const approvalDecisions = pgTable(
  'approval_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    saleId: uuid('sale_id').references(() => sales.id),
    exchangeId: uuid('exchange_id').references(() => exchanges.id),
    decision: text('decision', { enum: ['approved', 'rejected'] }).notNull(),
    /** Why it was rejected. */
    reason: text('reason', { enum: ['wrong_price', 'wrong_item', 'duplicate', 'not_sold', 'other'] }),
    note: text('note'),
    decidedBy: uuid('decided_by').notNull().references(() => staff.id),
    auto: boolean('auto').notNull().default(false),
    /** One id per "Approve all" tap, for the audit trail. */
    batchId: text('batch_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // At most one decision per sale / exchange: a double tap or a second phone can never decide twice.
    uniqueIndex('approval_decisions_sale_uq').on(t.saleId),
    uniqueIndex('approval_decisions_exchange_uq').on(t.exchangeId),
    index('approval_decisions_store_created_idx').on(t.storeId, t.createdAt),
    check('approval_decisions_one_target', sql`(${t.saleId} IS NULL) <> (${t.exchangeId} IS NULL)`),
    check('approval_decisions_valid', sql`${t.decision} IN ('approved', 'rejected')`),
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
export type Section = typeof sections.$inferSelect;
export type StockReceipt = typeof stockReceipts.$inferSelect;
export type SupplierPayment = typeof supplierPayments.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type Exchange = typeof exchanges.$inferSelect;
