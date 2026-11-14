import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: text('store_id').notNull().references(() => stores.id),
    name: text('name').notNull(),
    role: text('role', { enum: ['admin', 'salesman'] }).notNull(),
    pinHash: text('pin_hash').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('staff_store_name_uq').on(t.storeId, t.name)],
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
    category: text('category').notNull(),
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

export type Staff = typeof staff.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type Exchange = typeof exchanges.$inferSelect;
