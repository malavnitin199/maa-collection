# Maa Collection — technical reference

*Code and project context as of 16 Nov 2026.*

Audience: a developer or AI agent picking up the code. For the business brief see `docs/CONTEXT_BRIEF.md`; for how staff use the app see `docs/USER_GUIDE.md`. No credentials appear in this document.

---

## Contents

1. [Project context and history](#1-project-context-and-history)
2. [Architecture](#2-architecture)
3. [Repository map](#3-repository-map)
4. [Data model and migrations](#4-data-model-and-migrations)
5. [Authentication, roles and permissions](#5-authentication-roles-and-permissions)
6. [Core flows, step by step](#6-core-flows-step-by-step)
7. [Barcodes, SKUs, labels and the code price](#7-barcodes-skus-labels-and-the-code-price)
8. [Scanning subsystem](#8-scanning-subsystem)
9. [Server actions reference](#9-server-actions-reference)
10. [Route handlers (HTTP endpoints)](#10-route-handlers-http-endpoints)
11. [Testing](#11-testing)
12. [Environments, deployment and operations](#12-environments-deployment-and-operations)
13. [Conventions and gotchas](#13-conventions-and-gotchas)
14. [Known limitations and open items](#14-known-limitations-and-open-items)
15. [Languages (Hindi / English)](#15-languages-hindi--english)
16. [Scan and sale feedback (sound, vibration, animation)](#16-scan-and-sale-feedback-sound-vibration-animation)

---

## 1. Project context and history

**Product.** A mobile-first inventory + point-of-sale web app for **Maa Collection**, an Indian clothing shop.
- Staff use phones only.
- Customers bargain, so each sale stores its own agreed price, capped at MRP.
- The owner intends to offer the app to other retailers later, so every record carries `store_id`.

**Live:** https://maa-collection-pi.vercel.app · **Repo:** https://github.com/malavnitin199/maa-collection (`main`).

**History** (each step committed, tested, and usually deployed):

| # | Milestone | Key outcome |
|---|---|---|
| 1 | P1-01 / P1-02 bootstrap | Next.js 16 + TS + Tailwind 4 + Vitest + Playwright, route shells |
| 2 | Demo scan-to-sell | Browser-only demo store; camera scanning (zxing); QR labels → **barcode-only** (owner) |
| 3 | Scanner fixes | Focus after hydration, keystroke-burst capture, valid EAN-13 demo codes, camera HD + BarcodeDetector + zxing fallback with own rotate/zoom views |
| 4 | **Plan v2** (`docs/PLAN_V2_SHOP_OPERATIONS.md`) | Neon Postgres + Drizzle, PGlite for dev/tests, PIN login, admin/salesman, server-side sales with `operation_id`, sale on behalf (`sold_by`/`recorded_by`), exchanges, dashboards |
| 5 | Owner stock workflow | Suppliers, categories (SKU codes), `stock_receipts`, sizes × colours entry, labels per piece, restock, design-wide rates, phone tab bar |
| 6 | Quick add + code price | Batch products per company/category, `stores.price_code_word`, sample suppliers/categories |
| 7 | **Plan v3** (`docs/PLAN_V3_CATALOG_TEAM.md`) | Owner-granted permissions (catalog / prices / stock / costs), product photos, Tag old stock, in-app Help |
| 8 | Catalog extras | 50×25 mm sticker labels, reuse of manufacturer barcode when tagging, "Needs attention" QC list |
| 9 | Owner tools | Installable PWA (manifest/icons), Reports, CSV export |

Decisions: `docs/DECISION_LOG.md` (ADR-001 … ADR-012). Open questions: `docs/DECISIONS.md`. Detailed day log: `docs/PROGRESS.md`. Original requirements: `docs/SOURCE_PRD.pdf`.

---

## 2. Architecture

```
Phone / laptop browser (installable PWA)
 │  pages = server components (data) + client components (scan, forms)
 ▼
Next.js 16 App Router (Vercel functions, region sin1)
 ├─ src/proxy.ts                 logged-out → /login (optimistic only)
 ├─ src/app/**/page.tsx          sync page shell + <Suspense> data part
 │     └─ requireStaff / requireAdmin / requirePermission  (authoritative)
 ├─ src/server/actions/*.ts      'use server' — auth check, input parsing (Zod / FormData)
 │     └─ src/server/services/*.ts   ALL money & stock rules, DB transactions
 │           └─ Drizzle ORM ─▶ Neon Postgres (prod, pooled URL, prepare:false)
 │                          └▶ PGlite embedded Postgres (local dev, tests)
 └─ src/app/**/route.ts          image bytes, app icons, CSV exports
```

**Rendering model** (Next 16 with `cacheComponents: true`):
- Each page exports a synchronous component that renders a static shell plus `<Suspense>` around an async child.
- The async child reads the session and data.
- Data access goes through `requestDb()` (`src/server/request-db.ts`). It calls `connection()` first, so Next never prerenders live data and doesn't flag clock reads (`Date.now()`) during prerender.
- `getCurrentStaff()` is wrapped in React `cache()`, so the header, tab bar and page share one lookup per request.

**Layering rule:** business rules live only in `src/server/services/`. Actions do auth and parsing; components do presentation. Services take a `Db` and a `storeId` and are tested directly against a real Postgres engine (PGlite).

---

## 3. Repository map

```
maa-collection/
├── src/
│   ├── app/                      routes (App Router)
│   ├── components/               layout (header, bottom nav, first-time tip), ui/styles.ts
│   ├── features/                 screens & browser logic by domain
│   ├── server/                   actions, services, security, auth, request-db, export-auth
│   ├── db/                       schema, client (Neon / PGlite), seed
│   ├── lib/                      pure helpers (money, permissions, price code, csv, config, icon)
│   └── proxy.ts                  route guard (Next 16 "middleware")
├── drizzle/                      SQL migrations 0000–0004 + meta
├── e2e/                          Playwright specs
├── scripts/                      db-seed.ts, db-sample-catalog.ts
├── docs/                         plans, decisions, guides, this file
├── next.config.ts                cacheComponents, PGlite external, server action body 4 MB
├── vercel.json                   regions: sin1
├── drizzle.config.ts             schema path, migrations out, DATABASE_URL
└── playwright.config.ts          desktop + Pixel 7 projects, dev server with pglite:memory
```

### 3.1 Routes (`src/app`)

| URL | File | Access | Purpose |
|---|---|---|---|
| `/` | `page.tsx` | public | Landing, link to login |
| `/login` | `(auth)/login/page.tsx` | public | Tap name + PIN; logged-in users redirected to their screen |
| `/guide` | `(pos)/guide/page.tsx` | public | **Guide**: 13 lessons by role with animated illustrations (`src/features/guide/`), steps, "Open" links, tag anatomy, inventory routine; lesson ticks in localStorage |
| `/help` | `(pos)/help/page.tsx` | public | Quick reference & FAQ (required/optional fields, problems & fixes) |
| `/i/[code]` | `i/[code]/route.ts` | staff (else → /login) | Tag QR link: catalog/prices/stock rights → product page; others → `/pos?code=<barcode>` (item preloaded) |
| `/pos` | `(pos)/pos/page.tsx` | staff | Counter sale (`PosScreen`) |
| `/pos/exchange` | `(pos)/pos/exchange/page.tsx` | staff | Exchange (`ExchangeScreen`) |
| `/pos/my-sales` | `(pos)/pos/my-sales/page.tsx` | staff | Own today/month totals + activity |
| `/admin/dashboard` | `(admin)/admin/dashboard/page.tsx` | admin | Shop dashboard + quick actions |
| `/admin/reports` | `…/reports/page.tsx` | admin | Period reports + CSV download buttons |
| `/admin/team` | `…/team/page.tsx` | admin | Sales team: salesmen count, share bars, daily columns per seller (shared scale), table; `?period=today\|7d\|30d\|month` (default 7d) |
| `/admin/activity` | `…/activity/page.tsx` | admin | Last 150 sales + exchanges |
| `/admin/staff` | `…/staff/page.tsx` | admin | Add staff, PINs, activate, **permissions** |
| `/admin/settings` | `…/settings/page.tsx` | admin | Code-price word, print switch, decoder |
| `/admin/more` | `…/more/page.tsx` | any right | Menu filtered by role/permissions |
| `/admin/products` | `…/products/page.tsx` | catalog / prices / stock | Card list, search, supplier/category filters, photo thumbnails |
| `/admin/products/new` | `…/products/new/page.tsx` | catalog | Single product (manufacturer barcode option) |
| `/admin/products/[id]` | `…/products/[id]/page.tsx` | catalog / prices / stock | Label, photos, design variants, rates, stock-in, edit, history (sections by right) |
| `/admin/stock` | `…/stock/page.tsx` | catalog / stock | Hub: Tag old stock · Quick add · Sizes × colours · Restock |
| `/admin/stock/old` | `…/stock/old/page.tsx` | catalog | Tag old stock (`OldStockForm`) |
| `/admin/stock/quick` | `…/stock/quick/page.tsx` | catalog | Quick add (`QuickAddForm`) |
| `/admin/stock/new` | `…/stock/new/page.tsx` | catalog | Design in sizes × colours (`DesignForm`) |
| `/admin/stock/receive` | `…/stock/receive/page.tsx` | stock | Restock by scanning (`RestockForm`) |
| `/admin/suppliers`, `/admin/suppliers/[id]` | `…/suppliers/**` | catalog | Companies list/detail, deliveries, entry links |
| `/admin/categories` | `…/categories/page.tsx` | catalog | Categories + SKU codes |
| `/admin/catalog/check` | `…/catalog/check/page.tsx` | catalog | "Needs attention" QC list |
| `/admin/labels` | `…/labels/page.tsx` | catalog / stock | **All tags** (plan v13, §23): grouped by date / company / category / delivery, filters in the address, Grid or Rows; combined design cards by default, `show=tags` for every tag (§24) |
| `/admin/labels/print` | `…/labels/print/page.tsx` | catalog / stock | `?receipt=<id>`, `?mine=today` or `?list=1&…All tags filters…[&group=&key=]` (one tag per piece in stock); `&each=item`; `&format=tag` (tag printer 40×60) / `sticker` (50×25); default hang tags on A4 |

Route handlers: see [§10](#10-route-handlers-http-endpoints). Layouts `(pos)/layout.tsx` and `(admin)/layout.tsx` render `RoleHeader` and pad for the bottom tab bar. `manifest.ts`, `apple-icon.tsx` and `layout.tsx` hold the PWA metadata and theme colour.

### 3.2 Features (`src/features`) — client/server UI

| Folder / file | Exports | Notes |
|---|---|---|
| `auth/login-form.tsx` | `LoginForm` | Name tiles (radio) + PIN; `useActionState(loginAction)` |
| `pos/pos-screen.tsx` | `PosScreen` | Scan → `ProductCard` → sell step; client validation via `validateSaleDraft`; one `operationId` per item; first-time tip |
| `pos/exchange-screen.tsx` | `ExchangeScreen` | 4 steps: scan returned → pick sale → scan new → confirm |
| `pos/product-card.tsx` | `ProductCard`, `ProductDetails` | Counter view incl. main photo; never cost |
| `pos/staff-select.tsx` | `StaffSelect` | "Credit sale to" |
| `pos/load-counter.ts` | `loadCounter` | Current staff + active staff list for counter pages |
| `scanning/camera-scanner.tsx` | `CameraScanner` | HD stream, continuous focus, `BarcodeDetector` or zxing with full/zoom/sideways views; opens in a fixed dialog overlay so the scan screen does not reflow |
| `scanning/scan-input.tsx` | `ScanInput`, `useHydrated` | Box + Find + camera; focuses after hydration; registers keystroke capture |
| `scanning/scanner-keystrokes.ts` | `createScanBuffer`, `useScannerKeystrokes` | Detects fast HID bursts outside text fields |
| `scanning/ean13.ts` | `isValidEan13`, `ean13CheckDigit`, `inStoreEan13`, `ean13Modules`, `ean13Svg` | Pure; SVG with configurable bar height |
| `catalog/barcode-label.tsx` | `BarcodeLabel`, `StickerLabel` | A4 label (normal/compact) and exact 50×25 mm sticker |
| `catalog/design-form.tsx` | `DesignForm` | Size chips, colour chips, price by size, preview, retry-safe save |
| `catalog/size-rates-editor.tsx` | `SizeRatesEditor` | "Price by size" fold-out (default in grey, size's own in green); used by `DesignForm` and `DesignRatesForm` |
| `catalog/quick-add-form.tsx` | `QuickAddForm` | Product cards with Copy/Remove, labelled price fields, totals |
| `catalog/old-stock-form.tsx` | `OldStockForm` | Tag-barcode check (outside the form), photos, details, save → label → Next item |
| `catalog/restock-form.tsx` | `RestockForm` | Scan each piece = +1, name search picker, ± per line |
| `catalog/photo-manager.tsx` | `PhotoManager`, `PhotoPickers` | Camera (`capture=environment`) / gallery; uploads one photo per action call |
| `catalog/resize-photo.ts` | `resizePhoto` | ≤1280 px JPEG, quality steps until ≤1.4 MB, EXIF orientation |
| `catalog/product-form.tsx` | `ProductForm` | Single product create/edit; category/supplier selects; `showCost` |
| `catalog/setup-forms.tsx` | `SupplierForm`, `CategoryForm` | |
| `catalog/small-forms.tsx` | `StockInForm`, `DesignRatesForm`, `AddStaffForm`, `ResetPinForm`, `ToggleActiveForm`, `PermissionsForm`, `useOperationId` | |
| `catalog/price-code-forms.tsx` | `PriceCodeForm`, `PriceCodeDecoder` | |
| `catalog/print-button.tsx` | `PrintButton` | `window.print()` |
| `catalog/dummy-catalog.ts` | `DUMMY_CATALOG`, `findByBarcodeOrSku` | Seed data source (8 demo items) |
| `inventory/inventory.ts` | `rupeesToPaise`, `validateSaleDraft`, `saleTotalPaise`, `LOW_STOCK_THRESHOLD` | Pure client+server helpers |
| `reports/widgets.tsx` | `StatTile`, `ActivityList` | |

### 3.3 Server (`src/server`)

| File | Exports | Role |
|---|---|---|
| `auth.ts` | `getCurrentStaff` (cached), `requireStaff`, `requireAdmin`, `requirePermission`, `requireAnyPermission`, `startSession`, `endSession` | Session cookie → staff row (must be active) |
| `request-db.ts` | `requestDb` | `connection()` then `getDb()` for pages/route handlers |
| `export-auth.ts` | `exportAllowed`, `csvResponse` | Admin-only CSV responses |
| `security/pin.ts` | `hashPin`, `verifyPin`, `isValidPin`, `randomPin` | scrypt `scrypt$salt$hash` |
| `security/session.ts` | `signSession`, `verifySession`, `sessionSecret`, `SESSION_COOKIE` | HMAC-SHA256 token `{sid,name,role,exp}`, 12 h |
| `actions/auth.ts` | `loginAction`, `logoutAction` | |
| `actions/pos.ts` | `lookupProductAction`, `recordSaleAction`, `returnableSalesAction`, `recordExchangeAction` | Counter; Zod-validated |
| `actions/admin.ts` | 22 actions — see [§9](#9-server-actions-reference) | Catalog, stock, staff, settings, photos |
| `services/products.ts` | `findProductByCode`, `toCounterProduct`, `getProduct`, `listProducts`, `createProduct`, `createDesign`, `createProductsBatch`, `updateProduct`, `receiveStock`, `stockIn`, `getReceiptForLabels`, `getMyLabelsToday`, `listMovements`, `listDesignVariants`, `updateDesignRates`, `skuPrefix` | Catalog + stock arrivals |
| `services/sales.ts` | `recordSale`, `assertActiveStaff` | Atomic, idempotent sale |
| `services/exchanges.ts` | `findReturnableSales`, `recordExchange` | Row lock on original sale |
| `services/catalog.ts` | `listCategories`, `createCategory`, `updateCategory`, `suggestCategoryCode`, `listSuppliers`, `getSupplier`, `createSupplier`, `updateSupplier`, `listReceipts`, `catalogAttention` | |
| `services/images.ts` | `addProductImage`, `addPhotoToProducts` (one photo, many items: bytes once + pointer rows), `listProductImages`, `mainImages`, `getImageData`, `makeMainImage`, `deleteImage` (hands bytes to a sharer), `sniffImageType`, `imageSrc` | Limits: 8 photos, 1.5 MB, JPEG/PNG/WebP |
| `services/reports.ts` | `staffDashboard`, `shopDashboard`, `shopActivity`, `salesReport`, `salesExportRows`, `REPORT_PERIODS` | All periods in `Asia/Kolkata` |
| `services/staff.ts` | `listStaff`, `verifyLogin`, `createStaff`, `setStaffPin`, `setStaffActive`, `setStaffPermissions` | Last active admin protected |
| `services/settings.ts` | `getStoreSettings`, `updatePriceCode`, `labelPriceCode` | |
| `services/errors.ts` | `DomainError`, `isUniqueViolation` | Domain errors are safe to show staff |

### 3.4 Database, lib, scripts

| File | Contents |
|---|---|
| `src/db/schema/index.ts` | All tables (§4) and inferred types |
| `src/db/client.ts` | `getDb()` (Neon when `DATABASE_URL` is `postgres://…`, else PGlite at `./.pglite` or `pglite:memory`), `createPgliteDb()` (migrate + seed) |
| `src/db/seed.ts` | `seedDemoData` (store, 5 staff, 6 categories, 8 products, opening movements; dev PIN or random PINs), `addSampleCatalog` (5 suppliers, 5 categories; idempotent) |
| `src/lib/money.ts` | `formatPaise` (INR, throws on non-integers) |
| `src/lib/permissions.ts` | `PERMISSIONS`, `PERMISSION_INFO`, `can`, `canAny`, `cleanPermissions` |
| `src/lib/price-code.ts` | `encodePriceCode`, `decodePriceCode`, `codeWordProblem` |
| `src/lib/csv.ts` | `toCsv` (BOM, CRLF), `csvCell` (quoting, formula neutralising), `rupees` |
| `src/lib/app-config.ts` | `STORE_ID`, `STORE_NAME`, `STORE_TIMEZONE`, `LOW_STOCK_THRESHOLD` |
| `src/lib/app-icon.tsx` | `appIcon(size)` via `next/og`, `BRAND_GREEN` |
| `scripts/db-seed.ts` | `pnpm db:seed` — seeds an empty Postgres, prints random PINs once |
| `scripts/db-sample-catalog.ts` | `pnpm db:sample` — adds sample suppliers/categories |

---

## 4. Data model and migrations

All tables carry `store_id` (FK `stores.id`, currently the single store `maa-collection`). Money columns are **integer paise**. `sales`, `exchanges`, `stock_movements` and `stock_receipts` are **append-only**: never updated or deleted by the app.

| Table | Key columns | Constraints / notes |
|---|---|---|
| `stores` | `id` (text), `name`, `timezone`, `price_code_word`, `print_price_code` | One row today |
| `staff` | `id`, `name`, `role` (`admin`/`salesman`), `permissions text[]`, `pin_hash`, `language` (`en`/`hi`, null = phone's choice), `active` | unique (store, name) |
| `suppliers` | `name`, `contact_name`, `phone`, `gstin`, `notes`, `location` (city / market, 2026-11-20), `active` | unique (store, name) |
| `supplier_payments` | `operation_id`, `supplier_id`, `bill_number` (null = running account), `amount_paise` (> 0), `paid_on` (date), `note`, `staff_id` | Company accounts (2026-11-20). Append-only; unique (store, operation_id); index (supplier_id, paid_on) |
| `sections` | `name`, `name_hi`, `icon`, `sort`, `active` | Plan v19: who an item is for (Men / Women / Boys / Girls + the owner's). unique (store, name) |
| `categories` | `section_id` (→ sections; null = *Needs sorting*), `name`, `name_hi`, `code` (2–3 letters), `sizes text[]` (shop order, owner-editable), `active` | unique (store, section_id, name), (store, code). A **new** item needs a category with an active section (`resolveCategoryForNewItem`) |
| `products` | `sku`, `barcode`, `name`, `brand`, `category` (name snapshot), `category_id`, `supplier_id`, `size`, `color`, `mrp_paise`, `price_paise`, `cost_paise` (admin/costs only), `stock`, `active`, `created_by` | unique (store, sku), (store, barcode); `stock >= 0`; `0 < price ≤ mrp` |
| `product_images` | `product_id`, `content_type`, `data bytea`, `url`, `byte_size`, `width`, `height`, `sort_order` | lowest `sort_order` = main photo |
| `stock_receipts` | `operation_id`, `supplier_id` (nullable), `bill_number`, `stock_date` (plan v19; null = the day entered), `note`, `staff_id` | unique (store, operation_id); one per delivery / restock / old-stock entry |
| `stock_movements` | `product_id`, `quantity_change` (±), `reason` (`opening`/`stock_in`/`sale`/`exchange_return`/`exchange_issue`), `ref_id`, `staff_id`, `note`, `unit_cost_paise` (purchase price per piece on arrival, null before 2026-11-20) | `ref_id` → receipt / sale / exchange |
| `sales` | `operation_id`, `product_id`, snapshots (`sku`, `product_name`, `size`, `color`, `mrp_paise`, `cost_paise`), `quantity`, `unit_price_paise`, `total_paise`, `sold_by`, `recorded_by` | unique (store, operation_id); `qty > 0`; `0 < price ≤ mrp` |
| `exchanges` | `operation_id`, `original_sale_id`, returned product/qty/unit price (price paid), issued product snapshot/qty/unit price/mrp, `difference_paise`, `credited_to`, `recorded_by` | unique (store, operation_id); quantities > 0; issued price ≤ MRP |

**Migrations** (`drizzle/`, applied in production with `pnpm db:migrate`; applied automatically to PGlite at start):

| File | Change |
|---|---|
| `0000_init.sql` | stores, staff, products, stock_movements, sales, exchanges |
| `0001_suppliers_categories_receipts.sql` | suppliers, categories, stock_receipts, products.supplier_id/category_id + **backfill** of categories from existing products |
| `0002_store_price_code.sql` | stores.price_code_word, print_price_code |
| `0003_staff_permissions.sql` | staff.permissions `text[] default '{}'` |
| `0004_product_images.sql` | product_images |
| `0006_staff_language.sql` | staff.language `text` (nullable) — each person's screen language |
| `0005_category_sizes.sql` | categories.sizes `text[] default '{}'` + default lists for known codes (only where empty) + Ladies Jeans (LJ) / Gents Jeans (GJ), skipped if present |
| `0007` … `0009` | approvals / manual sales (0007), product tags (0008), offline sales (0009: drop `products_stock_nonnegative`, `sales.offline_at`) |
| `0011_company_accounts.sql` | company accounts (2026-11-20, V19-06 in part): `supplier_payments`; `suppliers.location`; `stock_movements.unit_cost_paise` (filled for new arrivals only; old rows estimated from today's price). Additive. |
| `0010_sections.sql` | plan v19 (V19-02a): `sections`; `categories.section_id`, `categories.name_hi`; unique (store, section_id, name) **replaces** (store, name); `stock_receipts.stock_date`. **Data is set up separately** by `node scripts/backfill-sections.ts` (never from a page read) |

---

## 5. Authentication, roles and permissions

**Login** (`loginAction`):
1. The person picks their staff id and enters a PIN.
2. `verifyLogin` checks the scrypt hash and that the account is active.
3. `startSession` sets the http-only, SameSite=Lax, 12-hour `maa_session` cookie, signed with `SESSION_SECRET` (required in production).
4. Admins are redirected to `/admin/dashboard`, salesmen to `/pos`.

**Per request:** `getCurrentStaff()` verifies the token, then loads the staff row and requires it to be active. Deactivating someone logs them out on their next request.

**Permissions** (`src/lib/permissions.ts`). Admins implicitly have all of them.

| Right | Grants | Enforced by |
|---|---|---|
| `catalog` | products, photos, categories, companies, barcodes, labels, tag old stock, quick add, designs, Needs attention | `requirePermission('catalog')` in pages + actions |
| `prices` | change MRP / selling price; design-wide rates | `updateDesignRatesAction`; `updateProductAction` keeps current prices without it |
| `stock` | receive / restock / per-product stock-in | `requirePermission('stock')` |
| `costs` | see and submit purchase (code) price | pages don't render it; actions drop it (`withoutCost`, `can(me,'costs')`) |
| *(admin only)* | dashboard, reports, exports, activity, staff & permissions, settings | `requireAdmin()`, `exportAllowed()` |

`src/proxy.ts` only sends logged-out visitors to `/login`. All authorisation happens on the server, in pages and actions. Page shells contain no forms or data before the permission check; this was fixed and verified on live HTML.

---

## 6. Core flows, step by step

### 6.1 Counter sale
1. `ScanInput` (box / camera / HID burst) → `lookupProductAction(code)` → `findProductByCode` by barcode or SKU (case-insensitive) → `toCounterProduct` (no cost) + main photo.
2. The client generates `operationId = crypto.randomUUID()` per item.
3. "Record sale" → `recordSaleAction` (Zod) → `recordSale`. That function:
   1. Returns the existing sale if the `operation_id` was already used.
   2. Checks the credited staff member is active.
   3. Inside a transaction: loads the product; price ≤ MRP; `UPDATE products SET stock = stock - q WHERE stock >= q`; inserts the sale with snapshots, `sold_by` and `recorded_by`; inserts a `sale` movement.
   4. On a unique-key conflict, re-reads the sale.

### 6.2 Exchange
1. `returnableSalesAction(code)` → `findReturnableSales`: sales of that product in the last 120 days, minus units already returned.
2. Confirm → `recordExchange`. Inside a transaction:
   1. Lock the original sale (`FOR UPDATE`) and re-check the returnable quantity.
   2. Returned stock goes back first; the new item's stock is reduced with a guard.
   3. Insert the exchange: `difference = issued total − returned × price paid`.
   4. Insert two movements.

### 6.3 Creating products (all share `insertNewProducts`)
- **Design in sizes × colours:** `createDesignAction` → `createDesign`. Validates the size/colour lists (≤60 combinations) and refuses combinations that already exist. Prices: defaults + optional `sizeRates` (a size's own MRP / selling / purchase), resolved by `src/lib/size-prices.ts` and checked per size on the server; every colour of a size gets the same rates (ADR-013). `updateDesignRates` does the same for an existing design.
- **Quick add:** `createQuickAction` → `createProductsBatch` (≤50 rows; size defaults to `Free`, colour to `Assorted`, brand to the supplier name or `Unbranded`).
- **Tag old stock:** `tagOldStockAction` → `createProductsBatch` (one row; optional manufacturer barcode; supplier optional), then the photos.
- **Single product:** `createProductAction` → `createProduct` (own path; generated or manufacturer barcode).

`insertNewProducts` runs in one transaction:
1. Next SKU number for the category code, and the next in-store barcode number.
2. Insert the receipt.
3. Insert the products.
4. One `opening` movement per product (0 allowed, which links the product to its receipt).

Idempotent by `operation_id`; a SKU/barcode race retries up to 3 times.

### 6.4 Stock arrivals
`receiveStockAction` / `stockInAction` → `receiveStock`: one receipt plus a `stock_in` movement per line, atomically and idempotently. The client keeps one operation id until the form changes (`useOperationId`, refs in the forms).

### 6.5 Photos
1. Client: `resizePhoto` → `uploadProductImageAction(productId, FormData{photo,width,height})`, one photo per call.
2. Server: `addProductImage` sniffs the magic bytes and checks size and count.
3. Images are served by `/api/product-images/[id]`.
4. While creating tags: New design keeps one `PickedPhoto` per colour, Quick add one per card (`PhotoSlot`). After `createDesignAction` / `createQuickAction` return `items` (id + colour, entry order), the client calls `addPhotoToItemsAction(ids, FormData)` per photo — one small request each, so a failed photo never loses the items (the labels page then shows `?photos=failed`).
5. Shared photos: `addPhotoToProducts` stores the bytes on the first item and adds rows with `url = /api/product-images/<first id>`, `data = null`, `byte_size = 0` for the others; `imageSrc` returns that url, so every view loads the one photo. `deleteImage` moves the bytes to the oldest sharer and repoints the rest.

### 6.6 Labels
`getReceiptForLabels` (a delivery) or `getMyLabelsToday` (everything the person entered today, IST) → `LabelSheet` in the print page. It shows one label per piece (or per item) as hang tags (`HangTag`, 40 × 60 mm: 16 per A4 page with `@page A4`, or one per page with `@page 40mm 60mm` for a tag printer) or stickers (`StickerLabel` + `@page 50mm 25mm`, barcode only). Each tag gets its size row from `tagSizesFor` (the category's `sizes`, else the design's sizes via `designSizesFor`, plus the piece's own size — `tagSizeRange`) and a QR item link (`itemLink(appOrigin(), barcode)`). The code price is added by `labelPriceCode` when enabled.

### 6.7 Reports and exports
`salesReport(period)` returns totals, by category / company / salesperson, top 10 and slow movers (in stock, no sale in 30 days). `salesExportRows` feeds the CSV route; the stock CSV uses `listProducts`.

### 6.8 Dashboards
`shopDashboard` (admin) and `staffDashboard` (own and on-behalf totals) compute today/month with `date_trunc(… AT TIME ZONE 'Asia/Kolkata')`.

---

## 7. Barcodes, SKUs, labels and the code price

- **Generated barcode:** EAN-13 `200` + 9-digit sequence + check digit (`inStoreEan13`). GS1 prefix 20–29 is reserved for in-store use.
- **Manufacturer barcode:** accepted if `isValidEan13` passes and it's unique in the store.
- **SKU:** `MAA-<category code>-<3+ digit sequence>` (`skuPrefix`, `highestSkuNumber`).
- **Category codes:** `suggestCategoryCode` (Kurta → KU, Kurti → KR …), editable.
- **SVG:** `ean13Svg(code, moduleWidth, barHeight)`. Our own encoder, unit-tested against a published encoding. The SVG is `aria-hidden`; the wrapper has `role="img"` and an `aria-label`.
- **Sticker:** 50×25 mm with bar height 24 modules, about 0.4 mm per bar across ~47 mm. Rendered at 203 dpi it decodes with `BarcodeDetector`.
- **Hang tag (ADR-014/015):** 40 × 60 mm, 1.5 mm padding; QR 12 mm (`qrcode` → own SVG squares, error correction M, version 4 for a ~50-character link); size row = every size of the category with a 2 mm tick box (this piece's filled); EAN-13 37 mm wide with 30-module bars (0.33 mm per module, 100 %). From a ~190 dpi render both decode with ZXing (QR → item link, EAN-13 → digits).
- **QR item link:** `itemLink(origin, barcode)` = `<origin>/i/<barcode>`; `appOrigin()` uses `APP_URL` if set, else the request host. `codeFromScan()` turns a scanned link from any domain back into the code — used by `findProductByCode` (counter, exchange), restock search and tag-old-stock checks.
- **Code price:** a 10 different-letter word maps to digits 1…9,0. `encodePriceCode(paise)` uses whole rupees (BLACKHORSE: ₹450 = CKE). Printed only if `print_price_code`. The decoder is on `/admin/settings`.

---

## 8. Scanning subsystem

| Input | Implementation |
|---|---|
| Typed / pasted | `ScanInput` form submit |
| USB/Bluetooth (HID keyboard) | Focused box, or `useScannerKeystrokes`: keys under 100 ms apart ending in Enter, ≥3 chars, ignored inside text inputs; prevents the Enter from pressing a focused button |
| Camera | `CameraScanner`: `getUserMedia` (rear, ideal 1920×1080, continuous focus). The **native `BarcodeDetector`** is used when it supports EAN-13 + QR (Chrome Android). Otherwise **zxing** `decodeFromCanvas` on our own frames, cycling *full*, *zoomed guide band ×2* and *rotated 90°*, because @zxing/browser 0.2.1's TRY_HARDER rotation is broken. First read wins; the stream is released. The scanner opens as a fixed dialog overlay via a portal, so the scan screen stays in place. |

Hard-image benchmark (`docs/PROGRESS.md`): both paths read 5 of 6 deliberately degraded images, against 3 of 6 before.

---

## 9. Server actions reference

`src/server/actions/admin.ts` (all re-check permissions server-side):

| Action | Right | Input → result |
|---|---|---|
| `createProductAction` | catalog | FormData → redirect to product page |
| `updateProductAction(id)` | catalog (+prices / costs to change those) | FormData → `{message}` |
| `stockInAction(id)` | stock | FormData incl. `operationId` → message |
| `createSupplierAction`, `updateSupplierAction(id)` | catalog | FormData |
| `createCategoryAction`, `updateCategoryAction(id)` | catalog | FormData |
| `createDesignAction` | catalog (cost only with costs) | JSON → `{ok, receiptId, created}` |
| `createQuickAction` | catalog | JSON rows → `{ok, receiptId, created}` |
| `tagOldStockAction` | catalog | FormData incl. photos, optional barcode → `{ok, product, photoError?}` |
| `checkTagBarcodeAction` | catalog | code → `new` / `exists` / `invalid` |
| `findRestockItemsAction` | stock | term → up to 10 items |
| `receiveStockAction` | stock | JSON lines → `{ok, receiptId}` |
| `updateDesignRatesAction(id)` | prices (cost only with costs) | FormData → message |
| `uploadProductImageAction(id)`, `makeMainImageAction(imgId)`, `deleteImageAction(imgId)` | catalog | |
| `addPhotoToItemsAction(ids, FormData)` | catalog | one photo for several items (colour of a new design, or one quick-add product) |
| `createStaffAction`, `resetPinAction(id)`, `setStaffActiveAction(id, active)`, `setStaffPermissionsAction(id)` | admin | |
| `updatePriceCodeAction` | admin | FormData |

`src/server/actions/pos.ts` (any logged-in staff): `lookupProductAction`, `recordSaleAction`, `returnableSalesAction`, `recordExchangeAction`. All return `{ok:true,data} | {ok:false,error}`; Zod errors become a friendly message.

---

## 10. Route handlers (HTTP endpoints)

| Endpoint | Auth | Returns |
|---|---|---|
| `GET /i/[code]` | logged-in staff (else redirect /login) | redirect to the product page or `/pos?code=` |
| `GET /api/product-images/[id]` | logged-in staff | image bytes, `Cache-Control: private, max-age=31536000, immutable`, `nosniff`; redirect if `url` set |
| `GET /app-icon/192`, `/app-icon/512` | public | PNG icon (next/og) |
| `GET /apple-icon` | public | 180 px PNG |
| `GET /manifest.webmanifest` | public | PWA manifest (start_url `/login`) |
| `GET /admin/export/sales?period=today\|7d\|30d\|month` | admin (403) | CSV of sales + exchanges with purchase, profit, credited/recorded |
| `GET /admin/export/stock` | admin (403) | CSV of products with values at MRP and purchase price |

---

## 11. Testing

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e   # the quality gate
```

**Unit (Vitest, 72 tests in 12 files).** Service tests run in the node environment on a fresh in-memory PGlite (`createPgliteDb(undefined, { seed: 'demo' })`), so they exercise real SQL, constraints and transactions.

| File | Covers |
|---|---|
| `server/services/services.test.ts` (16) | seed, login, last admin, permissions, product creation/barcodes, sales (deduct, idempotent, oversell, MRP), exchanges, dashboards (IST boundary), reports |
| `server/services/catalog.test.ts` (15) | categories, suppliers, designs, quick add, restock, rates, photos, code-price setting, old stock + today's labels, manufacturer barcodes, QC list |
| `server/security/session.test.ts` (4) | token tamper/expiry/secret, PIN hashing |
| `features/scanning/ean13.test.ts` (9) | modules, published encoding, SVG, check digit, in-store codes |
| `features/scanning/scanner-keystrokes.test.ts` (5) | burst detection |
| `features/inventory/inventory.test.ts` (7), `catalog/dummy-catalog.test.ts` (6) | sale validation, rupee parsing, demo catalog |
| `lib/*.test.ts` (10) | money, permissions, price code, CSV, config |

**End-to-end (Playwright, 19 tests × 2 projects: Desktop Chrome + Pixel 7; 37 run, 1 phone-only test skipped on desktop).** Specs are in `e2e/pos.spec.ts` and `e2e/admin-setup.spec.ts`. They cover:
- login and guards
- product creation and on-behalf sale
- exchange
- suppliers/categories, phone tab bar, sizes × colours + labels, restock, salesman denial, code price, quick add
- permissions, tag old stock with photo (real JPEG), tag barcode reuse, Needs attention
- help/tips, installability, reports/exports

Conventions:
- Tests create their own uniquely named data (`run` suffix), so they can share a database.
- Switching user starts with `clearCookies()`.
- Playwright reuses a dev server on :3000 locally; otherwise it starts one with `DATABASE_URL=pglite:memory`.

---

## 12. Environments, deployment and operations

| Environment | Database | Notes |
|---|---|---|
| Local dev | PGlite in `./.pglite` (git-ignored), auto-migrated, seeded with demo data + samples, all PINs `1234` | `pnpm dev`; **restart after adding a migration** (the dev process caches its DB connection) |
| Tests | PGlite in memory | |
| Production | Neon Postgres (free plan, `sin1`), via Vercel Marketplace | Vercel functions also `sin1` |
| Preview deploys | **same Neon DB as production** | use with care |

**Environment variables (Vercel):**
- `DATABASE_URL` (pooled; set by the Neon integration)
- `DATABASE_URL_UNPOOLED` (used for migrations)
- `SESSION_SECRET` (production + preview)

**Never put the Neon URL in `.env.local`**: dev and tests would write to production. It's kept in the git-ignored `.env.neon` and loaded only for migrate/seed.

**Release runbook:**
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
# if the schema changed:
pnpm db:generate                                   # commit the new drizzle/000N_*.sql
set -a; source .env.neon; set +a
DATABASE_URL="$DATABASE_URL_UNPOOLED" pnpm db:migrate   # BEFORE deploying code that needs it
vercel deploy --prod
```
Migrations so far were backward-compatible (added tables or nullable/defaulted columns), so migrating before the deploy never broke the running version.

**Build gotcha:** pnpm 12 fails CI installs on unapproved build scripts. `pnpm-workspace.yaml` `allowBuilds` declines `sharp`, `unrs-resolver` and `esbuild`.

**Not wired yet:**
- GitHub ↔ Vercel auto-deploy (deploys are done with the CLI).
- GitHub Actions CI: the workflow exists on branch `ci-workflow`, but pushing it needs the `gh` token's `workflow` scope.

---

## 13. Conventions and gotchas

- **Money:** integer paise everywhere; `rupeesToPaise` parses user input; `formatPaise` formats.
- **Idempotency:** every write that changes stock/money takes an `operation_id`; clients reuse it until the input changes.
- **Purchase price:** never put `costPaise` into a client component unless `can(me,'costs')`; never accept it from people without that right.
- **Next 16:**
  - Read data only inside `<Suspense>` children.
  - Call `requestDb()` (which runs `connection()`) before any clock read.
  - `PageProps<'/route'>` / `RouteContext<'/route'>` types come from `next typegen`, so `pnpm typecheck` runs it first.
- **Forms:**
  - Never nest forms (the tag scanner sits outside the old-stock form).
  - Keep hint text outside `<label>`, so field names stay clean for accessibility and tests.
- **Tests:**
  - Next's route announcer is also `role="alert"`, so assert on the message text.
  - Short `<details>` lists may start open.
  - Dropdown accessible names include the selected option.
- **Mobile:** fixed bottom nav must not be inside an element with `backdrop-filter`; layouts reserve `pb-24`.
- **Images:** resize on the client; one photo per server action call; body limit 4 MB.
- **Text on salesman screens:** never hard-code it — add a key to `src/lib/i18n/en.ts` and the Hindi line to `hi.ts` (see §15). E2E tests assert English (the default).

---

## 14. Known limitations and open items

- **Not built:** GST (per-item slabs, invoices), payment method, receipts, refunds without replacement, day-close, offline billing, Tally export, real multi-shop tenancy (only `store_id` is in place).
- **Photos** are stored in Postgres; move them to Vercel Blob (D-IMG-1, needs the owner's approval to create the store) before roughly 5k photos.
- **Preview deployments** share the production database.
- **Old automated test data:** the production database contains a few automated live-check entries from 15 Nov (one A-Line Dress sale and one exchange) and now real or test entries by the owner.
- **Open owner decisions** (`docs/DECISIONS.md`):
  - exchange refunds and time limit (D-EX-1)
  - other staff (D-ST-1)
  - bargaining floor (D-PR-1)
  - refunds (D-RF-1)
  - price-setting for catalog people without *Prices* (D-PERM-1)
  - Blob (D-IMG-1)
  - P0 policy items (GST, payments, hardware)
- **Security housekeeping:** production PINs have been shared in chat; change them in Staff & permissions.

---

## 15. Languages (Hindi / English)

Plan v7, ADR-017. Round 1 (salesman screens: login, header/menus/tabs, Sell, Exchange, My sales, scanning, sale/exchange errors, tips) and round 2 (owner and catalog screens, server-action and service messages, Help page, all Guide lessons) — the whole app follows the person's language. Stays English on purpose: printed tags, CSV exports, page titles in the browser tab, and shop data.

| Piece | Where | What it does |
|---|---|---|
| Dictionaries | `src/lib/i18n/en.ts`, `hi.ts` | Flat keys (`sell.record`). `en` is the source; `hi` is typed `Record<MessageKey, string>`, so a missing Hindi line fails `pnpm typecheck`. `{name}` placeholders; `.one` / `.other` plurals. |
| Helpers | `src/lib/i18n/index.ts` | `LOCALES`, `isLocale`, `makeT(messages)`, `fill`, `plural`, `tEnglish` |
| Which language | `src/server/i18n.ts` → `getLocale()` (React `cache`) | `staff.language` of the logged-in person → cookie `maa-lang` (this phone) → `en` |
| Server components / actions | `await getT()` | e.g. My sales, login page, Guide, header; `errorText(domainError, t)` for errors |
| Client components | `useT()` / `useLocale()` from `src/features/i18n/i18n-provider.tsx` | `LocaleRoot` in the root layout (inside one `<Suspense>`) passes the person's dictionary and wraps pages in `<div lang>` |
| Switching | `LanguageSwitch` (header + login page) → `setLanguageAction` (`src/server/actions/i18n.ts`) | Saves `staff.language` when logged in and always the cookie; then `router.refresh()` re-renders in place |
| Server errors | `DomainError(message, { key, vars })` (`services/errors.ts`) | Sale/exchange errors carry keys; `pos.ts` `run()` and `loginAction` translate. The English message remains for logs and untranslated screens. |
| Guide lessons | `src/features/guide/lessons.hi.tsx` | Hindi versions by lesson id; lessons without one show in English with a note |

**Modules (round 2):** owner/catalog text lives in `src/lib/i18n/modules/` — `stock.ts` (`stk.*`: stock entry, labels), `catalog.ts` (`cat.*`: products, suppliers, categories, small forms, menu), `owner.ts` (`own.*`: dashboard, reports, team, staff, settings, activity), `help.ts` (`help.*`: Help page, Guide routine), `actions.ts` (`act.*`: owner/catalog server-action messages). Each exports `<area>En` (English, exactly as on screen) and `<area>Hi` (typed to the same keys); `en.ts` / `hi.ts` merge them.

**Shared Hindi word list** (use these everywhere so the same thing always has the same name):

| English | Hindi | English | Hindi |
|---|---|---|---|
| Product / Item / Piece(s) | प्रोडक्ट / आइटम / पीस | Stock / Add stock | स्टॉक / स्टॉक जोड़ें |
| Supplier / Company | सप्लायर / कंपनी | Category / Brand | कैटेगरी / ब्रांड |
| Design / Size / Colour | डिज़ाइन / साइज़ / रंग | Price / Rates | दाम / रेट |
| MRP | MRP | Selling price | बिक्री दाम |
| Purchase price / Code price | खरीद दाम / कोड दाम | Barcode / QR code | बारकोड / QR कोड |
| Label / Tag / Sticker | लेबल / टैग / स्टिकर | Print | प्रिंट करें |
| Photo / Camera / Gallery | फ़ोटो / कैमरा / गैलरी | Save / Saving… / Saved. | सेव करें / सेव हो रहा है… / सेव हो गया। |
| Cancel / Delete / Edit / Add | रद्द करें / हटाएँ / बदलें / जोड़ें | Staff / Owner / Salesman | स्टाफ़ / मालिक / सेल्समैन |
| Permissions / Rights | अधिकार | Active / Inactive | चालू / बंद |
| Sales / Exchange | बिक्री / एक्सचेंज | Report / Dashboard / Activity / Settings | रिपोर्ट / डैशबोर्ड / गतिविधि / सेटिंग |
| Today / This month | आज / इस महीने | Last 7 days / Last 30 days | पिछले 7 दिन / पिछले 30 दिन |
| Bill no. / Total / Profit / Share | बिल नंबर / कुल / मुनाफ़ा / हिस्सा | Needs attention | ध्यान दें |
| Receive (stock) | प्राप्त करें | Quantity | मात्रा |

**Add a sentence:** add the key + English to `en.ts`, the Hindi to `hi.ts`, use `t('key')`. The unit test `src/lib/i18n/i18n.test.ts` checks every key, that placeholders match, and that Hindi lines are in Devanagari.
**Add a language:** add its code to `LOCALES`, a dictionary file typed `Messages`, and its entry in `MESSAGES`; give `LanguageSwitch` a picker instead of a toggle.
**Not translated (by design):** shop data — product names, sizes, colours, brands, staff names, SKUs, barcodes; money stays `₹1,299.00`; dates use the Indian English format.

## 16. Scan and sale feedback (sound, vibration, animation)

| Piece | Where | Behaviour |
|---|---|---|
| Sounds | `src/features/feedback/sounds.ts` | Web Audio API tones (no audio files): `feedback('scan')` = short 1568 Hz "ting" + 35 ms vibration; `'done'` = rising C6→G6 chime + vibration pattern; `'error'` = two low triangle-wave buzzes + longer vibration. Silent no-op where audio/vibration isn't available. |
| Setting | `soundEnabled()` / `setSoundEnabled()` — `localStorage` `maa-sound`, default on | `SoundToggle` (🔊/🔇) in the header; also unlocks audio on the first tap/key (phones block sound until a gesture). The camera button unlocks it too, because camera scans aren't a gesture. |
| Good scan | `ScanInput` prop `result={{ kind: 'ok', id }}` → `ScanTick` | Green tick pops with a ripple at the end of the text box; the item card rises in (`fb-card`). `data-last-scan="ok"` for tests. |
| Failed scan | `result={{ kind: 'error', id }}` | The box shakes and flashes red via the Web Animations API (keeps the text box focused); buzz. |
| Sale / exchange done | `DoneOverlay` (`effects.tsx`) | Card with a self-drawing tick, title, amount, detail; closes after 1.6 s, on a tap, or on the next key press (scanner). Not `role=status` (the page's own message keeps that role). |
| Reduced motion | `feedback.css` media query; JS checks `prefers-reduced-motion` | No pops, ripples or shakes; the tick and card just appear, the box only flashes. |
| Used on | Sell (`pos-screen.tsx`), Exchange (`exchange-screen.tsx`), More of existing items (`restock-form.tsx`) | |

## 17. Look and feel: themes, day/night (plan v8, ADR-018)

| Piece | Where | Notes |
|---|---|---|
| Theme colours | `src/app/globals.css` | Each theme defines `--b-50 … --b-950` and `--zari` under `[data-theme="…"]`; `@theme inline` maps them to Tailwind `brand-*`, `zari`, `surface`, `background`. **Use `brand-*` for anything that should follow the theme** (never a fixed hue like `emerald-*`). The 600 step keeps white text ≥ 4.5:1 in every theme. |
| Day / night | `@custom-variant dark` on `[data-mode="dark"]` | `dark:` follows the app's switch, not the OS directly. "Same as phone" is resolved to light/dark by the script and kept in sync by `AppearanceSync`. Night overrides: `--background`, `--surface`, `--foreground`; Marigold's zari is lightened at night. |
| No flash | `APPEARANCE_SCRIPT` in `src/features/appearance/appearance.ts`, inlined in `<head>` by the root layout | Reads `localStorage` `maa-theme` / `maa-mode` and sets `data-theme` / `data-mode` before the first paint; `<html suppressHydrationWarning>`. |
| Picker | `src/features/appearance/appearance-menu.tsx` | Radio groups (theme swatches, Day/Night/Same as phone). Rendered with `createPortal` on `<body>` (the sticky header is its own stacking layer below the dock); bottom sheet on phones, pop-over under the button from `sm`. Escape / outside tap closes. `applyAppearance()` saves + fires `maa-appearance-change`. |
| Base styles | `@layer base` in globals.css | `h1` uses the display face (Rozha One) in the theme's dark step. Kept in the base layer so utilities (`text-white` on bands) win. |
| Fonts | `src/app/layout.tsx` (`next/font/google`) | Mukta 400–800 (`--font-mukta`, body), Rozha One (`--font-rozha`, `font-display`), Geist Mono; Latin + Devanagari subsets. |
| Signature + shapes | `.zari` (masked SVG band), `.tag-shape` (notched clip-path), `TagTile` (`src/components/ui/tag-tile.tsx`), `HeroStat` (`src/features/reports/widgets.tsx`) | Zari only on the header band, login band, hero card; hang-tag tiles only for main actions (Home quick actions, Stock hub) so the shape keeps its meaning. |
| Shared classes | `src/components/ui/styles.ts` | Pill buttons with press feedback, `card` / `cardMuted`, `headerIconButton`. Icons: `src/components/ui/icons.tsx` (24 px line icons, decorative). |
| Navigation | `src/components/layout/bottom-nav.tsx` | Floating dock, raised round Sell link (`/pos`) in the middle; tab names unchanged. Page content has `pb-32` on phones. |
| Motion | `.page-in` (route templates), `.pop-in`, `.look-panel` | All off under `prefers-reduced-motion`. |
| Print | `@media print` | Paper stays white; tags and labels use fixed white/black and never take the theme. |

Gotcha: Playwright's `getByLabel('X')` matches any accessible name *containing* X — keep new button labels from containing words used by form labels (that is why the picker is "Theme and day/night", not "Colours…", and the keypad is "Number keys", not "PIN keypad").

## 18. Guide voice, practice sale, edit after tagging (plan v9, ADR-019)

> Plan v10 (§19) replaced the per-lesson player: the rows "What is read" (`data-voice` marks) and "Player" (`voice-player.tsx`, the Listen-to-all queue) below no longer exist. The speech helper, practice sale and edit after tagging are unchanged.

| Piece | Where | Notes |
|---|---|---|
| Speech helper | `src/features/guide/voice.ts` | `say(text, { locale, slow, onEnd })` over `speechSynthesis` with `lang` en-IN / hi-IN and the best matching voice (`voiceFor`); keeps the utterance in a module variable (Chrome drops `onend` otherwise); `stopSpeaking()`. `forSpeech()` cleans screen text (emoji, arrows, ✓ ✎ dropped; `×` → "by" / "और"). `missingVoice()` once voices have loaded. |
| What is read | `data-voice` on an element = one thing read (and lit up); inside it only `data-voice-text` parts are spoken | Guide page marks: lesson head (title + intro, not the "Lesson n · min" line), each step (not its number), the tip, each tag part. New lesson content is read automatically — no second script to maintain. |
| Player | `voice-player.tsx`: `LessonVoice`, `ListenAll`, `HearButton` | One reader at a time via window events (`guide-voice-start` stops others; `guide-voice-play` starts a lesson from the "Listen to all" queue; `guide-voice-ended` moves the queue on). Highlight = `.voice-now` + `aria-current="step"` (guide.css). Pause = cancel + resume from the same step (Android has no reliable `pause()`). Hidden when the browser can't speak. |
| Practice sale | `practice-sale.tsx` (in lesson `sell`, `extra: 'practice-sale'`) | Pure client: sample item (MRP ₹1,499, 4 in stock), real Sell labels (`sell.*`), `feedback()` sounds, WAAPI shake, `DoneOverlay`; voice prompts `prac.say.*`. Never calls the server. |
| Edit after tagging | `old-stock-form.tsx` (`editing` state) → `editTaggedItemAction` → `correctTaggedItem` | Updates the product row only (no stock movement). Prices allowed when `can(me,'prices')` or `product.createdBy === me` and no `sale` / `exchange_*` movement exists; purchase price only with `costs`; returns `pricesKept`. |
| Tests | `e2e/guide-voice.spec.ts` | Replaces `window.speechSynthesis` with a recorder (`addInitScript`); `__finishSpeech()` ends the current sentence. Real voices are only checked on phones. |

## 19. The Guide as stories (plan v10, ADR-020)

| Piece | Where | Notes |
|---|---|---|
| Lessons | `src/features/guide/stories.ts` | `STORIES`: id, audience, title, goal, 2–5 `steps` ({ `text`, `say`, `scene` }), optional `tip`, `open` link, `practice`. Every string is `{ en, hi }`. `**bold**` in `text` marks the control to press. **Limits (unit test `stories.test.ts`)**: step text ≤ 7 words, spoken line ≤ 26, title ≤ 4, goal ≤ 9, tip ≤ 12, whole guide < 450 words, Hindi on every line. |
| Scenes | `scenes.tsx` → `PhoneScene({ scene, locale })` | A 208 × 330 px phone in theme colours (`brand-*`, zari band) or, for `kind: 'tag'`, the real `HangTag` with a ring over one part (`TAG_BOX`, % of the tag, calibrated from screenshots). `Tap x y` (% of the scene) is the finger. To add a scene: a new `kind` in the `Scene` union + a `case`. |
| Animations | `guide.css` (`st-*`) | One loop = `--st` 2.8 s; delays through `--d`. Rules outside the motion media query are the still end state (reduced motion). `.st-stage` scales the scene up on tall screens. |
| Player | `story-player.tsx` | `GuideBrowser`: part chips, tiles; the open lesson is the address hash (`#sell`), read with `useSyncExternalStore`; tiles `pushState` (Back closes), links open directly, `#for-<part>` selects a part. `StoryPlayer` (portal, `role="dialog"`): progress bars, Next/Back, swipe (60 px), arrow keys, Escape; voice = `say(step.say)` then auto-advance after 0.9 s; voice on/off in `localStorage` `maa-guide-voice`; final card; `Got it` → `useDone().toggle`. |
| Page | `src/app/(pos)/guide/page.tsx` | Server: title, progress, default part from `getCurrentStaff()` (logged out → Everyone, salesman → Selling, catalog/stock right → Stock & tags, admin → Owner). |

## 20. Clear stock (plan v11, ADR-021)

| Piece | Where | Notes |
|---|---|---|
| Rule | `clearAllStock(db, storeId, { staffId, note? })`, `stockTotals` in `src/server/services/products.ts` | One transaction: lock the products with stock > 0, insert a `stock_movements` row per product (`quantity_change = -stock`, `reason = 'cleared'`, staff), set `stock = 0`. Returns `{ items, pieces }`; a second run returns zeros. Never deletes. |
| Reason | `stockMovements.reason` enum gains `'cleared'` | The column is plain `text` (no CHECK), so no migration. Label `cat.reason.cleared` on the product page's stock history. |
| Action | `clearStockAction` in `src/server/actions/admin.ts` | `requireAdmin()` + `verifyLogin(db, STORE_ID, me.id, pin)` (the owner's own PIN); message key `own.clear.*`. |
| UI | `src/features/catalog/clear-stock-form.tsx` in `/admin/settings#clear-stock`; link in More | Two steps (open → PIN → confirm). |
| Tests | `catalog.test.ts` (rule), `e2e/admin-setup.spec.ts` (safe paths only — the e2e database is shared by parallel tests, so the real clear is not run there) | |

Removing data for real (as in the 2026-11-16 fresh start) is deliberately **not** in the app: back up all tables, then delete exchanges → sales → stock_movements → stock_receipts → product_images → products in one transaction with a one-off script run with `.env.neon`, and only on the owner's explicit request.


## 21. Sell without scanning, owner approvals (plan v12, ADR-022)

| Piece | Where | Notes |
|---|---|---|
| Hand-entered sale | `recordSale(db, storeId, { manual: { name, size?, note? }, … })` in `src/server/services/sales.ts` | `productId` omitted; the row has `manual = true`, `product_id` / `mrp_paise` / `cost_paise` NULL, `sku = ''`, `color = ''`, size as typed. **No stock movement, no MRP cap.** Same `operation_id` idempotency as a scanned sale. Name ≤ 80, size ≤ 20 (`MANUAL_NAME_MAX`, `MANUAL_SIZE_MAX`). |
| Who waits | `isOwner` + `autoApproveOwnEntry` inside the sale / exchange transaction | The recorder's role decides: an admin's entry gets an `approval_decisions` row with `auto = true` at once; anyone else's has no row (= waiting). |
| Decisions | `approval_decisions` (migration `0007`): `sale_id` xor `exchange_id`, `decision`, `reason`, `note`, `decided_by`, `auto`, `batch_id` | **Append-only, one per sale / exchange** (unique indexes). `insertDecision` uses `onConflictDoNothing`, so a double tap or a second phone never decides — or returns stock — twice. |
| Approve | `approveSale`, `approveExchange`, `approveAll({ range?: { day \| from/to } })` in `src/server/services/approvals.ts` | Nothing moves; the entry starts matching `saleApproved` / `exchangeApproved`. `approveAll` writes every row under one `batch_id`; rerunning approves 0. |
| Reject | `rejectSale`, `rejectExchange` (reason from `REJECT_REASONS`, note ≤ 200) | Sale: lock the row, refuse if a non-rejected exchange hangs on it (`appr.err.hasExchange`), insert the decision, then `stock + quantity` and a `sale_rejected` movement — **skipped** when the sale has no item or a `cleared` movement came after it. Exchange: returned piece goes out again (must still be there, else `appr.err.returnedGone`), issued piece comes back, two `exchange_rejected` movements. |
| What counts | `saleApproved`, `exchangeApproved`, `saleWaiting`, `exchangeWaiting`, `saleRejected`, `saleStatus`, `exchangeStatus` (SQL fragments) | Every total in `reports.ts` (`saleTotals`, `exchangeTotals`, `shopDashboard`, `salesReport`, `teamReport`, `salesExportRows`) filters on approved. `recentActivity` rows carry `status` + `manual` instead of being filtered. `staffDashboard` returns `waiting` / `waitingExchanges` totals for My sales. `findReturnableSales` / `recordExchange` refuse rejected or hand-entered sales. |
| Queue | `pendingForOwner` (by shop day, IST, newest first; MRP + the item's usual `price_paise` for scanned sales), `pendingCount`, `recentDecisions` (non-auto), `statusesForSales` / `statusesForExchanges` | Never includes purchase prices. |
| Actions | `src/server/actions/approvals.ts`: `approveSaleAction`, `rejectSaleAction`, `approveExchangeAction`, `rejectExchangeAction`, `approveAllAction` | `requireAdmin()`, Zod, `revalidatePath('/', 'layout')`; errors in the owner's language. `recordSaleAction` (`pos.ts`) accepts `manual` and returns the sale's `status`. |
| UI | `src/features/approvals/approvals-screen.tsx` on `/admin/approvals`; Home tile (`approvals-waiting`); More + header links; `pos-screen.tsx` **Enter by hand** form (`by-hand`, `by-hand-form`); `ActivityList` chips `status-waiting` / `status-rejected` / By hand; My sales `my-waiting`; CSV columns **Status**, **By hand** | Dictionaries: `src/lib/i18n/modules/approvals.ts` (`appr.*`), core `sell.byHand*`, `sell.sentToOwner`, `my.waiting`, `my.status.*`, `my.byHand`, `error.manual*`, `error.saleRejected`. Guide: 5th step of `sell`, owner lesson `approve`. |
| Tests | `approvals.test.ts` (13: hand entry, who waits, approve / approve-all idempotency, reject with stock back, cleared guard, exchange ordering, sold-again guard, what counts + export), `services.test.ts` (dashboards approve first), `e2e/pos.spec.ts` (by hand → waiting → owner approves one, rejects one → stock and totals) | |

Schema notes: `sales_item_or_manual` CHECK (an item and MRP, or `manual`), `sales_price_le_mrp` now allows a NULL MRP; `exchanges.original_sale_id` is nullable for a future "exchange without a bill" (D-EX-2) — nothing writes it yet. Movement reasons gained `sale_rejected`, `exchange_rejected`.

## 22. Camera scanner overlay

`CameraScanner` is rendered into `document.body` as a fixed, responsive dialog overlay positioned at the camera button, normally above it (below only when there is insufficient room above). Opening it does not add content to the scan form or move the screen; the existing page remains visible behind a dim backdrop. The close button is centered below the title, and the camera/close buttons have at least 44px tap targets with visible keyboard focus. Close with the button, outside click, or Escape. Keyboard focus stays inside the dialog and returns to the camera button on close. Unmounting the scanner stops its camera stream and decoder.

## 23. All tags: grouped, filtered, grid or rows (plan v13, ADR-023)

| Piece | Where | Notes |
|---|---|---|
| Query | `listTagLibrary(db, storeId, filter, { now, timezone })` in `src/server/services/tag-library.ts` | Active items, newest first, with `supplierName`, `createdByName` (`products.created_by`) and the stock entry the item was created in (`opening` movement → `stock_receipts`: `receiptId`, `receiptBill`, `receiptAt`; one row per item). Filters in SQL: search (name / SKU / brand / category / colour / exact barcode), company id or `'none'`, category, maker, in stock (`stock > 0`), when made (`today` / `7d` / `30d` from the shop day, like Reports). |
| Rules | `src/lib/tag-library.ts` (pure, `tag-library.test.ts`) | `parseTagParams` (address → `TagParams`, bad values dropped, `limit` 120…1200), `tagFilter`, `hasTagFilters`, `tagLibraryHref` (defaults left out), `tagPrintHref` (`list=1`, `group`, `key`), `shopDay`, `groupTags` (date: newest day first; company / category: A–Z, `none` last; delivery: newest first, `none` = items added one by one, last), `capGroups` (draws the first N tags, keeps full counts). |
| Page | `src/app/(admin)/admin/labels/page.tsx` | `requireAnyPermission(['catalog','stock'])`. Filter form (`TagFilterForm`, `next/form` GET, selects / checkbox submit on change, remounted per address), chip rows (Group by, When made), summary + Show more, groups (`section[data-testid=tag-group]`, heading from `groupTitle`, note from `groupNote`, Print this group), each tag a `Link.tag-open` to the product page with the pieces in stock under it. Delivery groups print through `?receipt=`. |
| Views | `src/features/tag-library/tag-views.tsx`, `tag-library.css` | Client switch Grid / Rows (`aria-pressed`), `localStorage` `maa-tag-view` via `useSyncExternalStore` (server snapshot = grid). `[data-view="rows"] .tag-row` = `flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x mandatory`. Tags are server-rendered children: no product data crosses to the client. |
| Print | `src/app/(admin)/admin/labels/print/page.tsx` → `LibraryLabels` | `list=1` + the same filters (+ `group`/`key` for one group) → `ReceiptLabelLine` with `quantity = stock`; up to `TAG_PRINT_MAX` (400) items; heading = the group's title; *← All tags* back link. Every print page has *See all tags →*. |
| Links | supplier page (*See this company's tags* → `?supplier=<id>&group=delivery`), More hint `cat.menu.labelsHint`, Guide lesson `print` step 1 | |
| Words | `stk.lib.*` in `src/lib/i18n/modules/stock.ts` (en + hi); `stk.labels.title` is now "All tags" | |
| Tests | `src/lib/tag-library.test.ts` (6), `src/server/services/tag-library.test.ts` (3), `e2e/admin-setup.spec.ts` "all tags: …" (desktop + phone), `e2e/pos.spec.ts` labels check uses `?q=MAA-TS-001` | |

## 24. Combined view: one card per design (plan v14, ADR-024)

| Piece | Where | Notes |
|---|---|---|
| Rule | `src/lib/design-groups.ts` (`design-groups.test.ts`) | `designKey(row)` = `<supplierId or none>~<mrpPaise>~<name, trimmed, single spaces, lower case>`; `parseDesignKey` validates it from an address; `groupDesigns(rows)` keeps first-seen design order, aggregates `sizes` (shop order via `sortSizes`) and `colors` (first seen) with pieces in stock, `pieces`, `min/maxPricePaise`, and sorts each design's `items` by colour then size. |
| Card | `src/features/catalog/design-card.tsx` | Server component (`data-testid="design-card"`): up to 3 photos overlapped, name → `href`, company · MRP · selling (range), items · pieces, design QR (`QrCode`, label "Design QR for …", value `<origin>/admin/products/<first item>` — on screen only, never printed), size and colour chips (`design-sizes`, `design-colours`; 0 pieces struck through), a footer line with `<details>` *Show N items / tags* (children) and *Print tags*. |
| Products | `src/app/(admin)/admin/products/page.tsx` | Default combined (`data-testid="design-list"`, children = `ProductRow`s in `design-items`); `?show=items` = the one-row-per-item list (`product-list`, as before). Print link only with *catalog* or *stock*. |
| All tags | `src/app/(admin)/admin/labels/page.tsx`, `TagParams.show` (`designs` default, `tags`) | Groups render `groupDesigns(g.shown)` as `li.design-cell` cards whose children are the real hang tags (`ul.tag-grid`); `show=tags` renders the v13 view. Summary `stk.lib.summaryDesigns`. Photos via `mainImages` for the shown items. |
| Print | `LibraryLabels` in the print page | `design=<key>` filters the (group's) rows by `designKey`; heading = the design's name, note = company · MRP. |
| Tests | unit above + `tag-library.test.ts`; `e2e/admin-setup.spec.ts` "combined view: …"; tests that need one row per item use `&show=items`, tag-visibility checks use `show=tags` | |

## 25. Cleaner UI: icon header, pictures, motion (plan v15, ADR-025)

| Piece | Where | Notes |
|---|---|---|
| Header | `src/components/layout/role-header.tsx` | One row: brand link + `current-user` line ("Name · Role", 11 px), then `header-buttons`: `AppearanceMenu`, `SoundToggle`, `LanguageSwitch onBand`, Guide link, log-out form. All use `headerIcon` (`styles.ts`: 36 px, 40 px from 390 px; lift on hover, scale on press). Keep `aria-label` + `title` on every symbol; tests and screen readers use the names. `headerChip` / `headerChipOn` are no longer used by the header. |
| Theme symbol | `appearance-menu.tsx` | Snapshot now `theme|mode|shown` (`shown` = `html[data-mode]`), so the symbol is a sun or a moon for what the screen shows; a dot in `THEME_SWATCH[theme].accent`. |
| Language symbol | `language-switch.tsx` | On the band: `अ` while English, `A` while Hindi; off the band (unchanged): the target language as text. |
| Pictures | `src/components/ui/art.tsx` | `ScanTagArt`, `AllDoneArt`: inline SVG, `aria-hidden`, colours from `currentColor` (set `text-brand-600 dark:text-brand-300`, or `text-zari` on the band) and `var(--zari)`. Add `art-tap` for a press nudge. |
| Motion | `src/app/globals.css` | `.rise-in` (children rise in, 45 ms apart, max 270 ms) on tile / card containers; `.art-swing`, `.art-scan`, `.art-pop`, `.art-twinkle`; all off under `prefers-reduced-motion`. Don't put `.rise-in` around the scan zone (the camera test measures its position). |
| Scroll padding | `globals.css` | `html { scroll-padding-top: 4.75rem }`, and `scroll-padding-bottom: 7rem` under 640 px (the floating dock). |
| Counter card | `src/features/pos/product-card.tsx` | `ProductCard`: photo or tag symbol, name, size chip (filled) + colour chip, `ProductDetails`: selling price (28 px), MRP, `StockBadge` (`details-stock` holds only the number), codes line. Never a purchase price. |
| Sell | `pos-screen.tsx` | Ready card (`ScanTagArt`, `sell.ready.*`, `by-hand` button with a pencil) when nothing is scanned; *My sales today* pill with ₹. |
| Home | `dashboard/page.tsx` | `Title` (section title with a symbol), `StatTile icon`, `LOW_STOCK_SHOWN = 6` with a `<details>` *Show all N*, `ActivityList limit={6} more={…}`. |
| Widgets | `src/features/reports/widgets.tsx` | `StatTile` takes `icon`; `ActivityList` takes `limit`, `more` (`href`, `label`) and `icon`. |
| Test settings | `playwright.config.ts` (`E2E=1`), `next.config.ts` (`devIndicators` off when `E2E=1`), `guide-voice.spec.ts` (hides `nextjs-portal`), `pos.spec.ts` camera test (waits for a still layout) | On a busy Mac run `pnpm test:e2e --workers=3`. |

## 26. Bahi theme — the default look (plan v16, ADR-026)

| Piece | Where | Notes |
|---|---|---|
| Theme list | `src/features/appearance/appearance.ts` | `THEMES = [peacock, marigold, rani, neel, mehendi, bahi]`; `DEFAULT_THEME = 'bahi'` (used by `APPEARANCE_SCRIPT` when a phone has no valid choice, and as the server snapshot); swatch `#4c3cce` / `#db631a`. |
| Colours | `globals.css` `[data-theme="bahi"]` | `--b-50…950` indigo (600 = #4c3cce), `--zari` #db631a (night #f08a4b); by day `--background` #f5f6f8, `--foreground` #292d35. |
| Type | `layout.tsx` (`Poppins`, `--font-poppins`, Latin + Devanagari), `globals.css` | `[data-theme="bahi"] body` and `h1, .font-display` use Poppins (headings 600). These rules are unlayered on purpose (they must beat the base layer and the `font-display` utility). |
| Header name | `role-header.tsx` `.header-brand` (+ `truncate`) | Smaller in Bahi (1rem, 1.12rem from 390 px) so the five symbols fit. |
| Zari | `globals.css` | `[data-theme="bahi"] .zari` = 3 px flat line (no mask). |
| Picker | `appearance-menu.tsx` | 3 × 2 swatches. The Guide's picker picture shows `THEMES.slice(0, 5)`. |
| Tests | `e2e/look.spec.ts` | Default `data-theme` is `bahi`. |

## 27. Essential Home and the minimal item layout (plan v17, ADR-027)

| Piece | Where | Notes |
|---|---|---|
| Home | `src/app/(admin)/admin/dashboard/page.tsx` | Four `TagTile`s (New stock → `/admin/stock`, Suppliers, Reports, Approvals with `approvals-waiting`) and one `HeroStat` (`today-revenue`, `today-units`). Data: `shopToday()` + `pendingCount()`. `shopDashboard()` stays (tested) but no screen uses it. |
| `shopToday` | `src/server/services/reports.ts` | `saleTotals` + `exchangeTotals` → `{ sales: today, netRevenuePaise }`; approved entries only, IST day. |
| Add stock | `src/app/(admin)/admin/stock/page.tsx` | `NEW_ITEM` (primary tile, `catalog`) + `OTHER_WAYS` (receive `stock`, old stock `catalog`). |
| New item | `src/features/catalog/new-item-form.tsx` (`NewItemForm`, `PhotoSquare`) on `/admin/stock/new` | Header card (name `aria-label` "Product name", category pill-select "Category", size pills `item-size-pills`, `TagChooser`) + photo square (`item-photo`, inputs "Camera / Gallery for this item"); must-haves: Company, "Sale price (MRP) ₹", "Purchase price ₹" (both `required`; purchase only with `costs`); `ItemTabs` Details (Pieces / Pieces each, "Counter price, if lower (₹)", bill) · Colours (chips, `combo-grid`, `colour-photos`, price by size + `size-rates-preview`) · Other details (Brand). Summary `design-preview`. Saves with `createDesignAction` (empty sizes → `Free`, colours → `Assorted`; brand → company; `forGender` / `ageGroup`). `clearItem()` after success (Activity). |
| Product page | `src/app/(admin)/admin/products/[id]/page.tsx` | Header (`item-pills`: design sizes, category, For, Age, inactive; main photo `photos[0]` or `role="img"` "No photo"), must-haves card (`product-stock`, Print label, Restock), `ItemTabs` Details (`print: true` — the `HangTag` prints from any tab; rates, receive, `stock-history`) · Colours (`design-variants` table: colour rows × size columns, one link per item, `aria-label` "{color} {size}: {n} in stock"; `PhotoManager`) · Other details (`DesignTagsForm`, `ProductForm` edit). |
| Tabs | `ItemTabs` in `src/features/catalog/item-parts.tsx` | `role="tablist"` / `tab` (`{prefix}-tab-{id}`) / `tabpanel`; closed panels get the `hidden` class (`hidden print:block` when `print`); ←/→ keys. Content can be server-rendered (passed as props). |
| Tags | `src/lib/product-tags.ts` | `FOR_GENDERS` (girls, boys, both), `AGE_GROUPS` (adult, child), `FOR_LABEL` / `AGE_LABEL` (`cat.tag.*`), `parseTag` ('' = not set, unknown = `'invalid'`), `asForGender` / `asAgeGroup`. Keep label maps here, not in the client file (server pages read them). |
| Tag storage | `products.for_gender`, `products.age_group` (migration 0008, checks `products_for_gender_valid`, `products_age_group_valid`) | `createDesign` → every row; `setDesignTags(db, storeId, productId, tags)` → every item of the design (same name, brand, category; as `listDesignVariants`); `updateDesignTagsAction` (`catalog`). Error key `stk.err.tagInvalid`. Tag old stock sets them on its one item (`createProductsBatch(… forGender, ageGroup)` → every row) and its Edit changes them (`correctTaggedItem`: undefined = keep, '' = clear; checked before anything changes); the form keeps them for the next item. *Add a single product* (`ProductForm` `mode="new"`, hidden `forGender` / `ageGroup` inputs) → `createProduct(… forGender, ageGroup)`; in edit mode the form has no tags (the product page's `DesignTagsForm` sits above it). |
| Company box | `src/features/catalog/company-picker.tsx` (`CompanyPicker`) on New item (required), Tag old stock and Add a single product (optional, `name="supplierId"` hidden input; edit mode keeps the plain select) | Options: companies in use, `<optgroup label="Previous companies">` (value `previous:<id>` → `restoreCompanyAction` → `restoreSupplier`), `+ New company…` (`__new` → inline name + Add → `addCompanyAction` → `addOrRestoreSupplier`: same name in any case = reuse / restore, else create). Pages pass `suppliers` (active) + `previousSuppliers` (inactive) from `listSuppliers(db, STORE_ID)`. Owner hid all live companies on 2026-11-19 (ADR-028). |
| Staff | `src/app/(admin)/admin/staff/page.tsx`; `ToggleActiveForm` (small-forms.tsx) | Active people in `staff-list`, removed in `removed-staff`. **Remove** = `setStaffActive(…, false)` after one confirm; **Bring back** = `true`. Self-removal and removing the last admin are refused (existing rules). |
| Profit / loss | `src/lib/deal.ts` (`saleDeal(total, cost, qty)` → profit / loss / even / unknown); `PendingEntry.costPaise` (sales' `cost_paise` snapshot) in `pendingForOwner`; `pendingCount().losses`; `approvals-screen.tsx` (`data-deal`, `deal-tag`, `day-net`, `DEAL_CARD`) | Owner-only pages (`requireAdmin`). Exchanges and hand-entered sales show no profit (unknown). Never pass `costPaise` to salesman screens. |
| Tab colours | `ItemTabs` `tone`: `brand` / `accent` / `neutral` (`TONE_PANEL`, `TONE_DOT`), `data-testid="{prefix}-tabs"`, `data-tone` on panels | Band `bg-brand-700`; open tab `border-zari`. Print: tints and band removed. |
| Header | `role-header.tsx` (`.header-band` gradient in globals.css, MC badge, `current-user`, `header-buttons` = `LanguageSwitch` + `HeaderMenu`); `src/components/layout/header-menu.tsx` (`HeaderMenu`, `menuRow`; portal sheet `role="dialog"` "Menu"; closes on Escape / outside / pathname change); `AppearanceOptions` (shared with the login page's `AppearanceMenu`); `SoundToggle row` | Guide scene `header` taps `lang` / `menu`. |
| Item tab palette | `ItemTabs` tones `sky` / `amber` / `slate` (fixed Tailwind hues — owner's exception to the brand-only rule; ADR-030) | Band `bg-slate-900`, open tab `border-amber-400`. |
| Selection (v2, phone-app style) | `src/components/ui/selection.tsx`: `SelectionProvider allIds` (+ `notify` toast, `toggleAll`, `start(ids?)`, `html[data-selecting]` hides the dock `nav[data-dock]`, Escape leaves unless a sheet is open), `SelectToggle` (hidden while selecting), `SelectableItem ids label [inside]` (long-press 450 ms / right-click / Android context-menu starts selection with that card; the click after a long-press is swallowed; `select-none` + no touch callout), `SelectCheck` (`role="checkbox"`, `aria-checked` true / mixed / false, `.sel-check` CSS: 32 px ring, tick draws itself, pop), `SelectionBar` (fixed top toolbar `selection-top`: ✕ "Done selecting", `selected-count`, "Select all" tri-state checkbox; fixed bottom `selection-bar` with `ActionGrid` / `ActionTile`; spacer + `--selection-bar`), `ActionSheet` (portal, `role="dialog"` titled "{action} · {n} selected", `data-action-sheet`), `sheetPrimary` / `sheetDanger` / `sheetSecondary`; toast `selection-toast` | **Fixed bars need no transformed ancestor**: `.page-in` uses `animation-fill-mode: backwards` (a filled `transform` made the page the frame of every fixed child, so on long lists the bars were off-screen). Bold icons `IconSelect`, `IconClose`, `IconEyeOff`, `IconEye`, `IconRename`, `IconBuilding`, `IconLayers`, `IconPeople`, `IconPriceTag`, `IconPrint`, `IconTick`, `IconReject`; `haptic()` in `feedback/sounds.ts`. |
| Bulk products | `bulkProductsAction` → `bulkUpdateProducts(db, storeId, ids, change)` (hide / show / rename / company / category / tags / prices; max 500; prices checked for every item first, then one transaction); `listProducts({ active })`; Products `?show=hidden`; `ProductBulkActions` (`canCatalog`, `canPrices`, `canPrint`) | Hide = `active = false`: off the counter (`findProductByCode`), Products and All tags (`productsByIds` skips hidden). |
| Print selected | `/admin/labels/print?items=<ids>` (`SelectedLabels`, `productsByIds`, `PRINT_MAX` = 120 in `src/lib/selection-limits.ts` — shared by client and server) | `PrintSelected` (All tags), Products' *Print tags*. |
| Approvals selected | `decideSelectedAction({ items, decision, reason?, note? })` → `SelectedResult` (approved / rejected / stockReturned / already / failed); `SelectedActions` in `approvals-screen.tsx` | Keys `sale:<id>` / `exchange:<id>`; rejecting sorts exchanges first. |
| Companies selected | `setCompaniesActiveAction` → `setSuppliersActive`; `CompanyBulkActions` | |
| Add next item | `nextItemHref()` in `labels/print/page.tsx` | Shown with `?created=`; `/admin/stock/new?supplier=<receipt.supplierId>&category=<first line's categoryId>`. |
| Activity resets | `new-item-form.tsx` `clearItem()`, `restock-form.tsx` after `receiveStockAction` | Next 16 keeps visited routes in `<Activity hidden>` (state kept). Any form that saves and navigates away must clear its fields and `operationId` itself. |
| Redirect | `next.config.ts` `redirects()` | `/admin/stock/quick` → `/admin/stock/new` (temporary; query kept). |
| Removed | `quick-add-form.tsx`, `design-form.tsx`, `createQuickAction`, retired dictionary keys | `createProductsBatch` (service) is still used by Tag old stock. |
| Tests | `e2e/admin-setup.spec.ts` helpers `tab`, `showVariants`, `companyBox`, `salePrice`, `purchasePrice` | Use `exact: true` for "Details" (it is inside "Other details") and "Colour" (inside "Colours"). |

## 28. Selling without internet, and the bigger header (plan v18, ADR-032)

| Piece | Where | Notes |
|---|---|---|
| Offline sale (server) | `recordSale(…, { offline: { at, mrpPaise? } })` in `src/server/services/sales.ts` | Skips the stock (`gte`), hidden-item and MRP refusals; unguarded `stock - qty` (may go negative); `assertActiveStaff(…, { evenRemoved: true })`; `offlineAt` = phone time, pulled back to now if ahead (`offlineTime`); MRP snapshot = the phone's (`offlineMrp`, never below the price — DB check `sales_price_le_mrp`). Same idempotency (`operationId`), movement and owner auto-approval as online. |
| Send endpoint | `POST /api/offline-sales` (`src/app/api/offline-sales/route.ts`) | JSON only, same-site `Origin`, session required (401), `recordedBy` must equal the session (403), Zod (400), `DomainError` → 422 with the translated text, else 500. Body = `offlineSaleBody(sale)`. |
| Phone's copy | `GET /api/counter-catalogue` → `counterCatalogue()` (products.ts; picked columns, active only) + active staff + `me` | `Cache-Control: private, no-store`. Stored under `kv/catalogue`; `refreshCatalogue(staffId, { maxAgeMs })`, `findOnPhone` (same matching as `findProductByCode` via `codeFromScan`), `setPhoneStock` after each sale. |
| Ping | `GET`/`HEAD /api/ping` (`connection()` — never prerendered) | Probed every 5 s after a failure (`markUnreachable`). |
| Storage | `src/offline/store.ts` | IndexedDB `maa-offline`: `outbox` (keyPath `operationId`), `kv`. Opens any version and upgrades once if stores are missing. `phoneStore` reads IndexedDB + localStorage (`maa-offline-sale:<id>`), writes IndexedDB first. `memoryStore` for tests. |
| Saved sales | `src/offline/outbox.ts` (`queueSale`, `removeQueued`, `subscribeOutbox` / `outboxSnapshot`, BroadcastChannel `maa-offline`) | `QueuedSale` (`src/offline/types.ts`): `state` `waiting` / `problem` (+ `problem` text), `tries`. |
| Sending | `src/offline/sync.ts` | `sendWaiting(store, staffId, send, { retryProblems, only })` (pure, tested); `sendToShop` maps 200 → sent, 401/403 → login, 400/422 → refused, else/network → offline; `syncNow` (one run, `navigator.locks` `maa-offline-send`) sets signals `sending`, `needsLogin`, `lastSent`. |
| Reachability | `src/offline/network.ts` | `isOnline()` = `navigator.onLine` && reachable; `withTimeout` (`TookTooLong`). Counter waits 6 s (look-up) / 12 s (sale), ×8 under `next dev`. |
| Offline helper | `public/sw.js`; `src/offline/helper.ts` (`startOfflineHelper`, `keepForOffline`, `forgetSavedPages`) | Production only. Caches `maa-pages-v1` (`/pos` only, plain URL, 200, not redirected; `x-maa-saved`), `maa-files-v1` (`/_next/static/*` cache-first, `ignoreSearch`, max 800). Counter: network first, saved copy after 6 s or offline. Offline `/` or `/login` → 302 `/pos`; `/i/<code>` → `/pos?code=<code>`; other pages → 503 "No internet" page. Message `keep` (files + refresh the saved counter when > 6 h old), `forget`. Saved pages are deleted at login and logout. |
| Screens | `src/features/offline/`: `OfflineStrip` (header; strip `offline-strip`, count `offline-count`, sheet, toast `offline-sent`), `SavedSales` (`saved-sales`, rows `saved-sale` `data-state`, `send-now`), `SavedSalesSection` (My sales, `my-saved`), `LogoutRow` (`logout-warning`), hooks `useOnline` / `useOutbox` / `useSending` / `useNeedsLogin` | Counter (`pos-screen.tsx`): `lookUp` (server, then phone), `saveOnPhone`, `PhoneCopyNote` (`phone-copy`), `?code=` looked up on the client when the page came from the helper. Exchange: `exchange-offline`. Approvals: `made-offline` chip (`PendingEntry.offlineAt`). |
| Words | `src/lib/i18n/modules/offline.ts` (`off.*`); `plural` takes any `<base>` with `.one` / `.other`; `formatWhen` ("4:12 pm" today, "18 Nov, 4:12 pm" before) | |
| Header | `role-header.tsx`, `headerIcon` (44 px, 48 px from 390 px wide) | Badge 48/52 px, name 1.4/1.55 rem, user line `text-sm`, `min-h-[5rem]`, `pt-4 pb-4`; `scroll-padding-top: 6.5rem`. Still exactly two `header-buttons`. |
| Database | migration `0009_offline_sales` | Drops `products_stock_nonnegative`; adds `sales.offline_at`. Run on Neon **before** deploying. |
| Below-zero counts | services | Every online decrement keeps its own guard (`gte(products.stock, qty)`: counter sale, exchange's new item, undoing an exchange). `clearAllStock` now resets every count that is not 0 (also below zero); its `pieces` counts only positive stock. |
| Do not enable | `experimental.useOffline` (Next 16) | It keeps a failed Server Action pending in memory until the network returns instead of rejecting — the counter would never save the sale on the phone, and a closed app would lose it. The counter relies on the rejection (or its own timeout) to queue the sale. |
| Tests | `src/server/services/offline-sales.test.ts`, `src/offline/offline.test.ts`, `e2e/offline.spec.ts` | E2E needs the built app for the helper test (it skips under `next dev`); `context.setOffline` also cuts the service worker off. Wait for the scan box focus before typing a scan. |

## 29. Sections: Men / Women / Boys / Girls (plan v19, ADR-033) — V19-02a, 02b

| Piece | Where | Notes |
|---|---|---|
| Values | `src/lib/sections.ts` | `DEFAULT_SECTIONS` (Men, Women, Boys, Girls with `nameHi`, icons), `STARTER_TYPES` per section (name, Hindi, usual code, sizes, other spellings), `SECTION_ICONS`, `typeKey`, `localName(row, locale)` (Hindi name when set), `typeLabel`. |
| Service | `src/server/services/sections.ts` | `moveType(db, storeId, categoryId, sectionId)` (02b: *Move under…* — code, sizes, items stay; hidden section / taken name refused; same place = no-op). `backfillSections(db, storeId, { dryRun })` — the **one-time** set-up: four sections; every existing category stays in *Needs sorting* (`section_id null`); a starter type is added only when no category in the shop has that name (any spelling in `also`); its usual code when free. Returns a report; a shop with sections is never changed. `listSections` (sections in `sort` order with types A–Z, plus `unsorted`), `unsortedCount`, `createSection` / `updateSection` (name, Hindi, picture, hide), `moveSection(id, 'up' \| 'down')`, `createType`, `addTypeSize`, `sectionOfType`. |
| Categories | `src/server/services/catalog.ts` | `createCategory` / `updateCategory` take `sectionId` and `nameHi`; one name once per section (`assertFreeTypeName`); codes by `suggestSectionCode` — the type's own letters when free (`DU`), else section + type (`GJ`, `GJE`). `listCategories` adds `sectionName`, `sectionNameHi`, `nameHi`, ordered by section then name. |
| New items | `src/server/services/products.ts` `resolveCategoryForNewItem` | Used by `createDesign`, `createProductsBatch` (Tag old stock) and `createProduct`: the category must be active **and** sit under an active section — errors `sec.err.needsSection` / `sec.err.hidden`. Editing, restocking or moving existing items still uses `resolveCategory` (a *Needs sorting* category keeps working for them). |
| Script | `scripts/backfill-sections.ts` | `DATABASE_URL=… node scripts/backfill-sections.ts [--dry-run]` (Postgres or `pglite:<folder>`). Backup first. |
| Seed | `src/db/seed.ts` | Dev / test data only: the four sections are created with the shop and every demo / sample category is placed (`SEED_SECTION`). The live shop is never sorted by a rule (D-V19-2). |
| Words | `src/lib/i18n/modules/sections.ts` (`sec.*`) | Errors and *Needs sorting*. |
| Tests | `src/server/services/sections.test.ts` (10) | Backfill on a live-shop shape (dry run, report, codes, Hindi), runs once, seed sorted, sections CRUD + reorder, types per section, codes, add size, **a new item needs both levels** on all three creation paths, hidden section refused, old items keep working. |
| Screen (02b) | `src/app/(admin)/admin/categories/page.tsx` | Server-rendered. Section tiles (`data-testid="section-tiles"`, `aria-current` on the chosen one; `?s=<id>` or `?s=unsorted`, default = first section, or *Needs sorting* when the shop has no sections yet), section card (`section-head`: ▲ / ▼ via `moveSectionAction.bind(...)` as form actions, `SectionForm`), `+ Add category` (`CategoryForm` with `sections` + `defaultSectionId`), the list (`category-list`, `category-sizes`), *Needs sorting* rows with `MoveTypeForm`. Forms in `src/features/catalog/setup-forms.tsx`; pictures `section-art.tsx` (`SectionArt`, `TypeArt`). **Lesson:** key the *client forms* (`key={section.id}` / `${id}:${active}`), never a server component that is a direct child of the page fragment — on a `?s=` navigation React kept both the old and the new keyed card on screen. |
| Actions | `src/server/actions/admin.ts` | `createSectionAction`, `updateSectionAction(id)`, `moveSectionAction(id, dir)`, `moveTypeAction(id)`; `createCategoryAction` / `updateCategoryAction` read `sectionId`, `nameHi`. 03a: `addSectionAction({ name, icon })`, `addTypeAction({ sectionId, name, sizes })`, `addTypeSizeAction(categoryId, size)` return `{ ok, … } \| { ok: false, error }` for the wizard's sheets; `createDesignAction` takes `quantities` (size → pieces) and `stockDate`. All `requirePermission('catalog')`. |
| New item steps (03a, the New item screen since 04b) | `src/features/catalog/new-item-wizard.tsx`, route `src/app/(admin)/admin/stock/new/page.tsx` (the earlier form: `src/app/(admin)/admin/stock/form/page.tsx`, *Old form* tile; `/admin/stock/quick` redirects there) | Client wizard: steps `start → who → what → details → sizes → review` (`FLOW` = the five after the start choice), mode `one \| many`, all values in component state (the details `<form>` stays mounted once reached, `hidden` otherwise, so the company picker's own list survives). `operationId` is made when entering the review and reused by a retried Save; after a save the next item starts at *What is it?* with the section, company, bill no. and stock date kept. Saves through `createDesignAction` with `colors: []`, `quantityEach: '1'`, `quantities`, then pushes `/admin/labels/print?receipt=&created=&mode=`; the tags page's *+ Add next item* = `nextItemHref(receipt, sectionOfType(first line's category), mode)` → `/admin/stock/new?supplier=&section=&bill=&date=&mode=&n=<receipt id>`; a `section` in the address skips the start choice and opens *What is it?*. The page passes names through `localName(row, locale)` and keys the wizard by the query string so a new address is a fresh entry. No sections yet → the first screen points to Categories, where `SetUpSectionsForm` → `setUpSectionsAction` (owner only) runs `backfillSections` once. Test ids: `wizard-path`, `size-cards`, `size-summary`, `review-card`, `review-sizes`, `review-total`, `review-cost`, `details-form`. Words `ni.*` (`modules/newitem.ts`). |
| Design save (03a) | `src/server/services/products.ts` `createDesign` | `quantities?: Record<size, number>` (sizes left out get `quantityEach`), `stockDate?` via `cleanStockDate(raw, today)` (YYYY-MM-DD, real day, 2000 → today in `STORE_TIMEZONE`; errors `ni.err.stockDate*`), no colour given → `['']` (D-V19-3), empty brand allowed (D-V19-5). `insertNewProducts` writes `stock_receipts.stock_date`. Tests `design.test.ts`. |
| Not yet | screens | New item steps = V19-03 (owner's clarified flow in the plan §5.1; D-V19-6 confirmed, ADR-034: *One item* = one size + pieces, *Many items* = the size grid + *Save & add next*). **`main` now needs migration 0010 on Neon before its next deploy**, then the backfill script (planned for V19-04e, owner present); production serves branch `prod-v18` until then. |

## 30. Company accounts: the company page (2026-11-20, ADR-035; plan v19 V19-06 in part)

| Part | Where | Notes |
|---|---|---|
| Service | `src/server/services/company.ts` | `companyReport(db, storeId, supplierId, { amounts, period })` → `totals` (period: bills, openBills, closedBills, items, designs, pieces, amountPaise, paidPaise, estimated, types), `account` (all-time: purchases, paid, **due**, bills, openBills, first / last date), `bills[]` (`key`, `billNumber`, `date`, `receiptIds`, `items`, `pieces`, `amountPaise`, `estimated`, `paidPaise`, `duePaise`, `status` open / closed / noPrice, `lines[]`), `months[]`, `types[]`, `payments[]`. `billKey(receiptId, billNumber)` = `no:<lower>` or `r:<id>`. Amount per line = pieces × `coalesce(stock_movements.unit_cost_paise, products.cost_paise)`; `estimated` when a line has no snapshot but a price today. Payments naming a bill (`billKey('', number)`) close it when they cover its amount. `amounts: false` nulls every money field. `addPayment` (operation id, amount ₹1–₹1 crore, `paidOn` via `cleanStockDate` else today, bill number ≤ 40, note ≤ 200; duplicate op id → the first row with `duplicate: true`), `listPayments`, `companySummaries` (list rows: bills, pieces, purchases, dues). |
| Period | `src/lib/company-period.ts` | `COMPANY_PERIODS` all · month · 30d · year · custom; `companyPeriod(params, today)` → `{ key, from, to }` (custom with no days = all; swapped days corrected); `inRange(day, range)`. |
| Snapshot | `src/server/services/products.ts` | `createProduct`, `insertNewProducts` and `receiveStock` write `unit_cost_paise` on their `opening` / `stock_in` movements. `shopToday()` exported. |
| Screen | `src/app/(admin)/admin/suppliers/[id]/page.tsx` | `requirePermission('catalog')`; money with `can(me, 'costs')`. Header (name; location · contact · *Call*), period chips (`aria-current`) + From / To form on `custom`, `StatTile`s (`company-bills-count`, `company-purchases`, `company-dues`, `company-pieces`, `company-collections`), the two small buttons, `ItemTabs` (`idPrefix="company"`): Bills (`company-bills`, status chip, *Items on this bill*, `MarkPaidForm`), Payments (`PaymentForm` in `payment-form`, list `company-payments`), Products (`groupDesigns` → `company-designs`), By type (`company-types`), Details (dl + `SupplierForm` with location). |
| Client parts | `src/features/catalog/company-parts.tsx` | `PaymentForm` (amount, date ≤ today, select of open bills *INV-1 · ₹2400* or *Running account*, note; `useOperationId`), `MarkPaidForm` (hidden amount = due, today, bill number). |
| Action | `src/server/actions/admin.ts` `addSupplierPaymentAction(supplierId)` | `requirePermission('costs')`; rupees → paise via `money(...)`; `revalidatePath('/admin', 'layout')`. `supplierInput` reads `location`. |
| List | `src/app/(admin)/admin/suppliers/page.tsx` | *n bills · dues ₹x* (amber when due) from `companySummaries`; without *costs* just *n bills*. |
| Words | `src/lib/i18n/modules/catalog.ts` `cat.acc.*`, `cat.sup.bills*`, `cat.supf.location`, `cat.err.payment*` | English + Hindi. `formatDate(..., 'month')` added. |
| Tests | `src/server/services/company.test.ts` (8), `e2e/company.spec.ts` (desktop + phone) | See PROGRESS 2026-11-20. The old company e2e (hide a company) now opens the **Details** tab first. |
| Rules | | Payments are append-only (no edit / delete): a mistake needs a correcting entry (not in the UI yet). Bill amounts are never typed; they come from purchase prices (open question D-V19-7). |

## 31. Typing in Hindi or English, voice, fresh forms (2026-11-20, ADR-036)

| Part | Where | Notes |
|---|---|---|
| Transliteration | `src/lib/transliterate.ts` | `toHindi(text)` (word list → letter rules; keeps digits, marks, Devanagari, 1–4 capital letters), `toEnglish(text)`, `convertLastWord(text)` (last English word + a following space / mark → Devanagari), `convertTrailingWord(text)` (blur), `hasDevanagari`. Pure; tests `transliterate.test.ts`. Add shop words to `WORD_LIST` (lower-case English → Hindi; the first Hindi spelling wins for the way back). |
| Box | `src/features/i18n/lang-text.tsx` `LangText` | Props of an `<input>` minus `value` / `onChange` / `defaultValue`, plus `value` + `onValueChange` (controlled) or `name` + `defaultValue` (plain form field), `inputClassName`, `force: 'hi'` (Hindi-name fields, no toggle), `noVoice`, `testId`. Renders input + अ/A + ⇄ (when text) + `SpeakButton`. `useTypingScript()` = the phone-wide script (`localStorage` `maa-type-lang`, falls back to the person's language). `scriptButton` style shared with the mic. |
| Voice | `src/features/i18n/speech-input.ts`, `speak-button.tsx` | `useSpeechInput({ lang, onFinal, onInterim })` → `{ listening, error, start, stop }`; `speechInputSupported()`. `SpeakButton({ script, text, onText })` joins the phrase after the current text. Errors `denied` / `nothing` / `failed` → `type.micDenied` / `type.noSpeech` / `type.micError`. |
| Fresh forms | `src/features/forms/fresh-on-return.ts`, `start-over.tsx` | `useFreshOnReturn(reset)`: second effect run (Activity re-show) or `pageshow.persisted` → `reset()`. `StartOver({ onStartOver, dirty })` chip. Used in `new-item-wizard.tsx` (`startOver`), `new-item-form.tsx` (`startOver`), `old-stock-form.tsx` (`startOver`, after `nextItem`). React Strict Mode runs the effect twice on mount in dev: a harmless reset of an empty form. |
| Where the box is used | New item steps (name, brand, add-section / add-type sheets), `/admin/stock/form` (name, brand), Tag old stock (name), `setup-forms.tsx` `Text` (every text field unless `plain` or a non-text `type`; `lang="hi"` → forced Hindi), `company-picker.tsx` (*+ New company…*), `pos-screen.tsx` (*Enter by hand* name) | Numbers, sizes, codes, phone, GSTIN stay plain. |
| Words | `src/lib/i18n/modules/typing.ts` (`type.*`) | en + hi. |
| Tests | `e2e/typing.spec.ts` (3 × desktop + phone) | Hindi from English letters, ⇄ back, phone-wide choice; microphone + message; fresh on return + Start again (New item and the old form). |

## 32. Product page: figures, Sales and Purchases tabs (2026-11-20, ADR-037; plan v19 V19-05 in part)

| Part | Where | Notes |
|---|---|---|
| Service | `src/server/services/product-report.ts` | `productReport(db, storeId, productIds, { amounts, period })`. Sales: `sales` × `staff` (sold_by) with `saleStatus`; totals from **approved** rows only; `profitPaise` per sale = total − sale's own `cost_paise` × qty (null when no cost); `offline` from `offline_at`. Arrivals: `stock_movements` (`opening` / `stock_in`, qty > 0) grouped by `ref_id` (receipt) or the movement itself; amount = qty × `coalesce(unit_cost_paise, products.cost_paise)`, `estimated` when a line has no snapshot. `period` = `DayRange` from `src/lib/company-period.ts` (sale day in shop time; arrival day = stock date else entry day). `lastSale` = newest approved sale (any period); `lastArrival` = newest arrival (any period). Tests `product-report.test.ts`. |
| Page | `src/app/(admin)/admin/products/[id]/page.tsx` | `Search = { created, period, from, to }`; period chips + From / To form as on the company page; `StatTile`s (`product-stock`, `product-sold`, `product-bought`, `product-profit`); row `product-must-haves`; `ItemTabs` ids `details` · `colours` · `sales` · `purchases` · `other`. `stock-history` list now lives in the Purchases tab. |
| Form | `src/features/catalog/product-form.tsx` `Field` | `words` prop → `LangText` (name, brand, colour); numbers stay plain. |
| Tests | `e2e/product-page.spec.ts` | Figures after a bill through the old form, the row, Sales empty, Purchases arrival + history, Hindi / English box in Other details, an empty period. |

## 33. Done card and ask-or-reset on return (2026-11-20, ADR-038)

| Part | Where | Notes |
|---|---|---|
| Card | `src/features/feedback/effects.tsx` `DoneOverlay(DoneInput & { onClose })` | `DoneInput = { kind?, title, amount?, detail?, lines?: { label, value }[], stay? }`. Portal to `document.body` (client only via `useSyncExternalStore`), `data-testid="done-overlay"`, `data-kind`, `done-lines` list, closes on timer / pointerdown / keydown. No `role="alert"` (the form's inline message is the alert). Styles in `feedback.css` (`fb-card`, `fb-shake` for errors). |
| Hooks | same file | `useDone()` → `{ show(input), node, close }` (plays `feedback('done' \| 'error')`). `useFormDone(action, { notSaved, describe(formData, result) })` → `{ action, node }` for `useActionState` forms. |
| Users | `setup-forms.tsx` (Supplier / Category / Section forms), `company-parts.tsx` (`usePaymentDone`), `company-picker.tsx`, `new-item-wizard.tsx` (saves, sheets; replaced the green toast — `saved-toast` is gone), `old-stock-form.tsx`, `created-done.tsx` (tags page, mounted with `open` state, no setState in effect), `pos-screen.tsx` (`saleLines`, `done.saleWaiting`, red card on a refused sale) | Numbers in lines are formatted on the client from what was typed or returned. |
| Ask-or-reset | `src/features/forms/fresh-on-return.ts`, `resume-sheet.tsx` | `useFreshOnReturn(reset, { ask? })` → `{ asking, keep, fresh }`; `ResumeSheet({ asking, what: 'collection' \| 'item', onKeep, onFresh })` (`data-testid="resume-sheet"`). Rules: wizard `reached >= 2 && (name \|\| mrp \|\| sizes)`; old form `name && (mrp \|\| sizes)`; Tag old stock `name && mrp`. |
| Tests | `e2e/done-card.spec.ts`, `e2e/typing.spec.ts` (resume rule), `e2e/new-item-wizard.spec.ts` (card instead of toast), `e2e/pos.spec.ts` / `offline.spec.ts` (unchanged: title + amount) | Close the card with `page.keyboard.press('Escape')`, never `click()` (it vanishes under the pointer). After a save inside a `<details>`, `goto` the page again before reopening the panel. |

## 34. Companies overview on Home, working since, bills ten a page (2026-11-20, ADR-039)

| Part | Where | Notes |
|---|---|---|
| Schema | `suppliers.working_since date` (migration **0012_company_since**) | The day the shop started with the company, as the owner gives it (1990 … today, backdating allowed; `cleanWorkingSince` in `catalog.ts`, error `cat.err.workingSince`). Separate from `created_at` = the day it was added here. Both in the company page's Details (*Working since*, *Added on*). Form field `workingSince` (`SupplierForm`, `supplierInput`), Done card line `done.line.since`. |
| Service | `companySummaries` (`src/server/services/company.ts`) | One SQL row per (company, bill key) with pieces, amount (cost snapshot, else today's cost), first / last day; payments grouped by (company, lower bill no.); collections = `count(distinct squeezed lower name ~ mrp)` over `products` per company (same key as `designKey`). Returns `bills, openBills, pieces, collections, amountPaise, paidPaise, duePaise, firstDate, lastDate`; amounts null without `costs`. A company with only a payment or only products still gets a row. |
| Overview | `companiesOverview(db, storeId, { amounts })` | Every company (hidden ones too, last) with `location`, `workingSince`, `addedOn` (shop time) + its summary; sort: active, latest bill day, name. `totals` = sums + company count. Tested in `company.test.ts`. |
| Home | `src/app/(admin)/admin/dashboard/companies.tsx` (`CompaniesOverview`, under Today) | `home-companies` section: tiles `home-companies-count`, `home-bills-count` (sub: open), `home-collections-count` (sub: pieces), `home-spend`, `home-dues` (money tiles only with `costs`); rows `home-company-rows` (`Paged`, 10 a page): name (+ *hidden*), location · *since* working-since or *added* day, `bills · collections · pcs` or *no bills yet*, spent / due. *All companies* → `/admin/suppliers`, *+ Add company* → `/admin/suppliers#add` (the add panel has `id="add"`). |
| Pager | `src/components/ui/paged.tsx` `Paged({ items, size = 10, testId, as, className })` | Client; the caller renders the rows (server nodes are fine), it slices them and shows ‹ Previous · `from–to of total` (`<testId>-range`) · Next ›. No pager when one page. Words `cat.pager.*`. |
| Company page | `suppliers/[id]/page.tsx` | Bills tab: `report.bills.slice(0, MAX_BILLS = 100)` through `Paged` (`company-bills`), note `cat.acc.newest100` beyond that; totals and months still count every bill. The *No contact details* line is gone (Added on always shows). |
| Tests | `company.test.ts` (working since: backdated, bad day, future, before 1990, blank; overview totals / lines / order / empty company), `e2e/company.spec.ts` (Working since on add, Details shows both days, Home overview line + totals, tap opens the company) | |
| Postponed | Returns (GR) | Owner's answer (D-V19-8): a return must also reduce stock — pick items + quantities, amount from purchase price, dues down. Needs a new append-only ledger + `stock_movements` reason; not in this round. |

## 35. Login, Companies page, full-screen camera, bill at the counter (2026-11-21, ADR-040)

| Part | Where | Notes |
|---|---|---|
| Login | `src/features/auth/login-form.tsx` | Last person on this phone: `localStorage` `maa-last-staff` (written in the action wrapper, read with `useSyncExternalStore`; `staffId` state null = use it). PIN dots (`max(4, length)`) over a transparent `name="pin"` input (still `getByLabel('PIN')`); *Log in* `aria-disabled` until name + ≥ 4 digits (click prevented, not `disabled`). Wrong PIN: the wrapper clears the PIN and bumps `wrong` → keyed `login-shake`. Name search from 7 people. `login-pop` / `login-shake` keyframes in `globals.css` (the login page does not load `feedback.css`). |
| Companies page | `suppliers/page.tsx` → `src/features/catalog/company-browser.tsx` | Data from `companiesOverview` (now with `contactName`, `phone`). Client filtering: search over name / location / contact / phone, matched as typed and through `toHindi` / `toEnglish`; `SpeakButton` fills it; place `<select>` (aria-label *Filter by place*) from distinct locations; *Summary* toggle (`company-summary` panel only when open); `Paged` keyed by the filter (`supplier-list`); Select / hide unchanged. *+ Add supplier* is a `<details id="add">` chip that takes the full width when open. Order: `companiesOverview` sorts by latest activity = max(last bill day, added day), ties newest added first, hidden last. |
| Home | `dashboard/companies.tsx` | One `home-companies` link (`home-companies-line`: companies · bills · due). |
| Camera | `src/features/scanning/camera-scanner.tsx` | Full screen (`camera-screen`, `role="dialog"` *Camera scan*), body scroll locked, Tab cycles inside, Escape / *Close*. `keepOpen`: every new read reported (ignores reads within 0.9 s and the same code within 2.5 s), green `cam-hit` pulse; `footer` slot. `ScanInput` takes `camera={{ open, setOpen, keepOpen, footer }}` and calls `onScan(code, 'keys' \| 'camera')`. |
| Bill | `src/features/pos/bill.tsx` (`BillPanel`, `CameraBillFooter`, `billTotal`, `linePrice`), `pos-screen.tsx` | `bill: BillLine[] \| null` (null = one item as before). Item card: *Add more items* (`add-more`) starts the bill (camera reopens if the scan came from it); while a bill is open every scan goes onto it (`found` → `addToBill`; same product = qty + 1, capped by the shop's stock unless from the phone's copy). Price mode `scan` (price box in the camera footer) / `end`. Table: photo, item + − / +, MRP (struck when lower price), price (`bill-price`, Enter → next empty). `saveBill` validates each line (`validateSaleDraft`), then `sendSale` per line sequentially — the same online → phone fallback as one item, its own `operationId`; failures stay with the reason. Done card: per-line amounts, credited to, status. No schema change. Words `modules/bill.ts`. |
| Tests | `e2e/pos.spec.ts` (full-screen camera; bill: add more, same tag +1, one-by-one prices, above-MRP refusal, total, save, My sales; stock cap + clear), `e2e/company.spec.ts` (search, place filter, Summary, Home line), `e2e/admin-setup.spec.ts` (hidden companies found by search) | |

## 36. New item: details & sizes in one step, stay after adding, size chips, optional name (2026-11-21, ADR-041)

| Part | Where | Notes |
|---|---|---|
| Steps | `new-item-wizard.tsx` | `FLOW = who · what · details · review` (*Step n of 4*). The `details` step is **one card**, the form `ni-details` (`details-form`, `noValidate`): company, name, MRP / purchase, then `SizeStep` (`#ni-sizes`: small chips `size-cards`, a `size-pieces` row of − n + per chosen size, *+ Add size*), then *More*. (Owner, 2026-11-21, after first seeing two collapsible panels: one card, small chips.) The sticky bar's *Next* is `form="ni-details"`, enabled when `detailsOk && sizesOk`; `finishDetails` scrolls to what is missing. `reached >= 2` still drives ask-or-reset. |
| Stay after adding | same | *+ Add* section / category: added to the list, chosen (`chooseType` / `setSectionId`) but **no `go`**; `fresh` id → `data-new`, `NewBadge`, `.new-glow` (globals.css), scrolled into view; cleared on the next step change. A tap on the tile continues. |
| Size chips | `SizeChips` in `new-item-wizard.tsx`; `SIZE_CHOICES`, `SIZE_RANGES`, `orderSizes` in `src/lib/size-lists.ts` | Groups letters / waist / kids (age) / other; quick ranges set the selection; typed others appended; kept in shop order; warns above `MAX_SIZES`. Sent to `addTypeAction` as a comma list (unchanged). Chips `aria-label` *Size X*; `size-chips-picked`. |
| Optional name | `createDesign` (`products.ts`), `defaultDesignName` | Blank name → `"<category name> <next SKU number, 3 digits>"` (the first SKU it gets: *Pajama 013* ↔ MAA-PJ-013). Over 120 characters still refused. `createDesignAction` returns each item's `name`, so the Done card shows the final name. Wizard: label *Product name (optional)*, placeholder *<category> + number*. The old form still requires a name on the client. |
| Tests | `design.test.ts` (default name and the next one), `e2e/new-item-wizard.spec.ts` (panels, collapse / expand, back keeps all; new category stays with *New*; chips + range; blank name → `Shorts … 001`), `e2e/admin-setup.spec.ts` (one Next for a Free-size item) | |

## 37. Compact dropdown, compact New item top, Next in the card, back one step (2026-11-21, ADR-042)

| Part | Where | Notes |
|---|---|---|
| Dropdown | `src/components/ui/dropdown.tsx` `Dropdown({ label, value, options, placeholder, onChange, required, searchPlaceholder })` | A `role="combobox"` button (name = label + value) opening a `listbox` under it, `max-h-[min(45vh,18rem)]`, search line above 8 options, group headings (`option.group`, also `data-group` on the option), action options (`tone: 'action'`). Keys: ↑ ↓ Enter Escape; closes on an outside tap. `required` adds an invisible required input so posting forms still refuse an empty choice. Used by `CompanyPicker` (New item, old form, Tag old stock, Add product). Other `<select>`s are unchanged. Tests: helper `choose(box, label)`; `toHaveText` on the combobox for the chosen name. |
| Top | `new-item-wizard.tsx` (the page no longer draws its own title) | One row: ← (start: link to Add stock; else `stepBack`) · h1 *New item* + *Step n of 4* · *Start again*; a 1px-tall progress bar with 10px labels; h2 + choice chips on one wrapping row. The empty step wrapper is `hidden` on the details step. |
| Next | same | Inside the details card's last row (`size-summary` + submit); no sticky bar. |
| Back | same | `stepBack` = one step back. Phone / browser back: past the start screen one guard entry (`history.pushState(history.state, '')`) is kept; `popstate` pops it and calls `stepBack`, and the guard is pushed again while not at the start; back at the start with the arrow, the guard is consumed (`skipPop`). Test: `goBack()` four times → What is it? → Who is it for? → start → `/admin/stock`. |

## 38. Companies: Delete instead of Hide, ticks beside rows, two-line search (2026-11-21, ADR-043)

| Part | Where | Notes |
|---|---|---|
| Delete | `deleteUnusedSuppliers` (`catalog.ts`), `deleteCompaniesAction` (`admin.ts`, *catalog* right), `CompanyBulkActions` (`bulk-actions.tsx`) | In one transaction: counts `products`, `stock_receipts`, `supplier_payments` per chosen company (the only tables pointing at `suppliers`); deletes those with none; returns `{ deleted, kept: [{ name, items, bills, payments }] }`. The bar has **Delete** only; an `ActionSheet` asks (*Delete n companies?*, `confirm-delete`); the toast lists deleted and kept (`bulk.deleted.*`, `bulk.cantDelete`). `setCompaniesActiveAction` / `setSuppliersActive` stay for code use; hiding one company is still the *Active* box in its edit form. Unit test in `company.test.ts`. |
| Ticks | `SelectableItem gutter` (`selection.tsx`), `.sel-check-sm` (globals.css) | List rows (Companies, Products item list) slide right `pl-10` while selecting; a 1.6rem tick sits centred in the gap; the tap layer covers the card only. Grid tiles keep the corner tick. |
| Search | `company-browser.tsx` | Line 1: search + mic. Line 2 (h-8 controls): place select (≤ 10rem) · Summary … count (only while filtering) · Select. |

## 39. Bills section: bills, bill companies, bill collections; dues from bills (2026-11-21, ADR-044)

| Part | Where | Notes |
|---|---|---|
| Schema | migration **0013_bills** | `bills` (store, `operation_id` unique per store, `bill_number`, `bill_date` date, `note`, `staff_id`, `created_at`); `bill_companies` (bill, supplier unique per bill, `amount_paise >= 0`; cascade on bill delete); `bill_collections` (bill, `receipt_id` **unique** — a collection is on at most one bill; cascade); `supplier_payments.bill_id` (nullable FK). A bill's total = sum of its company parts (not stored). |
| Service | `src/server/services/bills.ts` | `listCollections({ receiptIds?, unbilled? })` (one per stock receipt: names, sizes in shop order, items, pieces, value from the cost snapshot else today's cost, `billId`); `createBill` (idempotent; ≥ 1 company, total > 0, `bill_date` via `cleanStockDate` default today, collections must be free → `bill.err.taken`); `updateBill` (replaces companies; refuses taking off a company with payments on the bill); `setBillCollections({ add, remove })`; `deleteBill` (refused with payments); `listBills({ supplierId?, ids? })` (companies with amount / paid / due, totals, status, collections / pieces / value); `getBill`; `billsSummary`. Tests `bills.test.ts` (5). |
| Company accounts | `company.ts` | A delivery is a **collection** now (`deliveries`, one per receipt, `refNumber`, `billId`); `bills` = this company's parts (`CompanyBillPart`: amount, whole total, paid, due, status, `others`); totals `billedPaise`; account `billedPaise / paidPaise / duePaise = billed − paid`, `lastBillDate`. `companySummaries` counts bills / open from `bill_companies`, `amountPaise` = billed. `addPayment({ billId })` checks the bill names this company and copies its number. `billKey` is gone. `deleteUnusedSuppliers` also keeps companies on a bill (`collections` count added). |
| Actions | `src/server/actions/bills.ts` (`costs` right) | `createBillAction`, `updateBillAction`, `setBillCollectionsAction`, `deleteBillAction`; amounts typed in rupees per company. `addSupplierPaymentAction` reads `billId`. |
| Screens | `/admin/bills` (list, `Paged`), `/admin/bills/new` (`?supplier=` preselects), `/admin/bills/[id]`; `src/features/bills/bill-form.tsx` (`BillForm`, `CollectionRow`), `bill-parts.tsx` (`RemoveCollection`, `AddCollections`, `DeleteBill`); Home `BillsLine` (`home-bills`) under the Companies line (which no longer counts bills). Company page tabs **Bills · Collections · Payments · Products · By type · Details**; figures Bills · Billed · Dues now · Pieces · Collections (value) · Last bill. `PaymentForm` / `MarkPaidForm` post `billId` (+ `billLabel` for the Done card). Words `modules/bills.ts`. |
| Tests | `bills.test.ts`, `company.test.ts` (rewritten), `e2e/bills.spec.ts` (two companies, two collections, take off / add back, list, delete), `e2e/company.spec.ts` (collection ≠ bill; bill from Home → Bills; payment + Mark paid) | |

### 39a. Bills: amounts worked out, companies one under the other (2026-11-21, ADR-045)

| Part | Notes |
|---|---|
| Service | `BillInput.companies` is a list of supplier ids; `receiptIds` required (`bill.err.noCollection`); each collection must be one of the bill's companies' (`bill.err.otherCompany`). `recompute(billId)` sets each `bill_companies.amount_paise` = value of that company's collections on the bill (`listCollections`: cost snapshot else today's cost) after create, `setBillCollections` and `updateBill`. `updateBill({ companies: string[] })` removes a dropped company and its collections (refused if it has payments on the bill), adds new ones at ₹0. No schema change. |
| Form | `bill-form.tsx`: chosen companies as numbered rows (`bill-company`: name, *n collections ticked · ₹*, ✕) above the `CompanyPicker` (*Add another company*); `CompanyCollections` per company (`company-collections-group`, *Select all*); `CollectionRow` is one `role="checkbox"` button with a round tick (no native checkbox, no inner scroll). Footer: *n collections · pcs* + **Bill total** (auto). Edit mode: companies only, no collections, no amounts. `AddCollections` on the bill page is grouped by the bill's companies. |

### 39b. Bills: check with the paper bill (2026-11-21, ADR-046)

| Part | Notes |
|---|---|
| Lines | `Collection.lines: BillLine[]` (`listCollections`): one per product name + unit rate (cost snapshot, else today's cost) — `{ name, sizes, pieces, ratePaise, amountPaise }`; movements read in `createdAt`, SKU order. `sheetParts(companies, collections)` (`src/features/bills/sheet-parts.ts`, plain module so server pages can call it) groups per company, oldest collection first, merging the same name + rate. |
| Sheet | `BillSheet` (`bill-sheet.tsx`, `bill-sheet` / `bill-sheet-part` / `bill-sheet-line` / `bill-sheet-units` / `bill-sheet-total`): S.N · Description (sizes below) · Qty · Rate · Amount (₹), numbers as `6,120.00` (no ₹ in cells), a company heading + subtotal only with 2+ companies, Total row + *Totals: n units*. Used on New bill step 2 and the bill page (*As on the paper bill*). |
| Form | New bill `data-step` = `pick` → `check` (*Next: check bill*; Enter on step 1 moves on). Bill no. / date / note are on step 2 with Party. Back button + the phone's back (history guard like New item). After a save the form clears itself (Activity keeps the page) and drops the guard without `history.back()`. Edit bill unchanged (`data-step="edit"`). |

## 40. Box packs (2026-11-21, ADR-047) and New bill's new-company fix (2026-11-22, ADR-048)

| Part | Notes |
|---|---|
| Schema | Migration **0014_packs**: `products.pack_size` (null = loose; check 2…1000), `pack_mrp_paise` (> 0, null = MRP × size), `pack_cost_paise` (≥ 0, admin-only, never in counter DTOs). Stock / MRP / price / cost stay per piece. |
| Helpers | `src/lib/packs.ts`: `packOf`, `perPiecePaise` (round), `boxPaise`, `tagsFor` (ceil per box), `boxSale(boxes, size, boxPrice)` → `{ quantity, unitPricePaise (rounded), totalPaise (exact) }`. Tests `src/lib/packs.test.ts`, `src/server/services/packs.test.ts`. |
| New item | `new-item-wizard.tsx`: `boxed`, `packText`, `packMrp`, `costAs` ('piece' / 'box'); counts per size are boxes (`piecesOf` = boxes × size is what is sent); `createDesignAction({ pack: { size, mrp, cost } })` → `createDesign({ pack })` → `resolvePack` (`pack.err.size`, `pack.err.mrp` when box MRP > MRP × size, `pack.err.cost`); a box cost sets `cost_paise` = box ÷ size. `Segmented` switch; `SizeStep boxes`. |
| Tags | `labels/print`: `tagsFor(quantity, packSize)` tags per line (All tags / Select prints too, from `stock`); `HangTag` shows `tag-pack` *BOX OF n* and *per piece · Box ₹…*; sticker adds *Box of n*. |
| Counter | `CounterProduct.packSize / packMrpPaise` (lookup + phone copy). Single sale: *Sell: Pieces / Whole boxes* (`byBox`): Boxes + *Price of one box*, refused above the box MRP (`pack.err.boxPrice`). Bill: `BillLine.box`, `lineUnit` / `lineMrp` / `lineSale`; *pcs / box* switch per line, `bill-box-pieces`. `recordSale({ totalPaise? })` → `saleTotal` (|total − qty × unit| × 2 ≤ qty); passed through `recordSaleAction`, `QueuedSale.totalPaise`, `offlineSaleBody`, `/api/offline-sales`. |
| Bills | `listCollections` lines carry `qty` and `pack`: box items are `qty` boxes at `ratePaise` = `pack_cost_paise` (else piece cost × size), amount = round(pieces × rate ÷ size); the collection value uses the same. `sheetParts` merges by name + rate + pack; `SheetPart.units` = the Qty column summed; `BillSheet` writes *name (box of n)*. |
| New bill fix | `CompanyPicker exclude` (the bill keeps one picker; it is no longer keyed by the company count, so its *Company added* card stays). `CompanyCollections id` → empty state `company-collections-empty` with **+ New item from <company>** → `/admin/stock/new?supplier=<id>`. e2e: `bills.spec.ts` (new company), `packs.spec.ts`. |

## 41. Colour only on the product page (2026-11-22, ADR-049)

| Part | Notes |
|---|---|
| Rule | Never render `color` outside `src/app/(admin)/admin/products/[id]/page.tsx` (and the `ProductForm` there, `mode !== 'new'`). Data stays: `products.color` / `sales.color` columns, `CounterProduct.color`, `QueuedSale.color`, CSV exports. |
| Server | `validateProductInput` no longer requires colour; `createProductsBatch` blank colour = `''` (was *Assorted*); clash messages, `reports` activity / top sellers / slow movers labels and `approvals` detail drop colour. |
| Screens | Counter (`product-card` size chip only, `pos-screen` texts, `bill.tsx`), `exchange-screen`, `saved-sales`, `hang-tag` (Size box only), `barcode-label`, `labels/print` receipt lines, `labels` / `products` lists, `restock-form`, `catalog/check`, `design-card` (no `design-colours`), `suppliers/[id]` deliveries. |
| Forms | `old-stock-form` sends `color: ''`; `new-item-form` (Old form) has no colours block or `colour-photos`, its tab is *Sizes*, `sendColors = ['']`; the wizard already sent `colors: []`. |
| Texts | i18n messages without `{color}` (sell / offline / stock / help / hints), Guide stories 1.3, 2.x, New item lesson; `/help`. e2e updated (old-form designs use sizes only). |

## 42. Delete items (2026-11-22, ADR-050)

| Part | Notes |
|---|---|
| Schema | Migration **0015_item_deleted**: `sales.item_deleted` (bool, default false); check `sales_item_or_manual` = item + MRP, or manual, or item_deleted. |
| Service | `src/server/services/delete-products.ts` `deleteProducts(db, storeId, ids)` → `{ deleted, kept }` (kept = in an exchange). Order inside the transaction: find receipts (via `stock_movements.ref_id`) and their bills → `sales` set `product_id = null, item_deleted = true` → delete movements → `dropImagesOf` (`images.ts`; hands a shared photo's bytes to the first remaining user) → delete products → empty receipts: delete `bill_collections` + `stock_receipts` → `recompute` (now exported from `bills.ts`) each bill. Tests `delete-products.test.ts`. |
| Action / UI | `deleteProductsAction` (`requireAdmin`, ≤ 500 ids, revalidates `/admin` + `/pos`). `src/features/catalog/delete-products.tsx`: `DeleteProductsSheet` (`confirm-delete-items`, `confirm-delete-design`), `DeleteItemButton` (`delete-item`, product page, `me.role === 'admin'`) → `/admin/products?deleted=<message>` (`deleted-note`). `ProductBulkActions canDelete` (Products page, owner) → Delete tile. e2e `delete-products.spec.ts`. |
| Reports | `salesReport` byCategory / bySupplier: left join `products`, `manual = false`; labels `Other` / `No company`. |

## 43. Companies (not suppliers), company delete, optional company, Collections (2026-11-22, ADR-051)

| Part | Notes |
|---|---|
| Words | i18n: every *supplier* text says *company* (keys unchanged: `nav.suppliers`, `cat.sup.*`, …); *section* texts say *collection* (`sec.*`, `ni.step.who` *Which collection?*, `done.line.section`); bills' receipts say *stock entries* (`bills.*`, `cat.acc.*collections`, `cat.find.collections`, `own.co.collections`). Code names (`suppliers`, `sections`, `Collection` type in bills) are unchanged. |
| Company delete | Migration **0016_company_deleted**: `suppliers.deleted_at`; unique (store, name) only where `deleted_at IS NULL`. `src/server/services/delete-companies.ts` `deleteCompanies` → `{ deleted, unlinked: { items } }`: sets `deleted_at` + `active = false`, `products.supplier_id = null`; never touches bills, payments or receipts. Filters: `listSuppliers`, `getSupplier` (company page 404), `addOrRestoreSupplier`, `companiesOverview`, `resolveSupplier`. `BillCompany.deleted` → bill page shows *name (deleted)* without a link. `deleteProducts` keeps emptied receipts that are on a bill and no longer recomputes bills. `deleteCompaniesAction` = `requireAdmin`. UI: `CompanyBulkActions` (Select only for the owner, `CompanyBrowser canDelete`), `DeleteCompanyButton` (`delete-company`) → `/admin/suppliers?deleted=` (`deleted-note`). |
| Optional company | `DesignInput.supplierId: string \| null`; `createDesignAction` sends null for empty; wizard `detailsOk` no longer needs it; `CompanyPicker` not `required` there and in the Old form, and offers *No company* (`__none`) when a company is chosen and the box is optional. |
| Collections | `sections.ts`: `collectionsOverview` (categories, items, pieces per collection), `renameSection`, `deleteSection` (refuses with items: `sec.err.hasItems`; deletes its categories). Actions `renameCollectionAction`, `deleteCollectionAction` (owner). Home: `CollectionsLine` → `src/features/catalog/collections-panel.tsx` (`home-collections`, `collection-row`, `collection-count`, `confirm-delete-collection`). e2e `companies-collections.spec.ts`; unit `collections.test.ts`, `company.test.ts` (deleteCompanies). |

## 44. New item with no size (2026-11-22, ADR-052)

| Part | Notes |
|---|---|
| Server | `DesignInput.noSize` (and `DesignActionInput.noSize`) → sizes = `['']`; pieces from `quantities['']`. Without it an empty size list is still refused (`stk.err.pickSize`). |
| Wizard | `noSize = ordered.length === 0`; its count lives in `pieces['']` (default 1); `sizesOk = totalPieces > 0`; `SizeStep` shows `no-size-pieces` (aria *Pieces with no size* / *Boxes with no size*, *One less* / *One more*); `size-summary` *No size · n pcs*; `review-sizes` *No size × n*. |
| Counter | `product-card` hides the size chip when empty; `pos-screen` messages use *No size* (`ni.noSize`). |

## 45. Sale price from the purchase price (2026-11-22, ADR-053)

| Part | Notes |
|---|---|
| Wizard | `new-item-wizard.tsx`: purchase block first in the price grid; `#ni-mrp` optional. `markupText` = typed ?? `readMarkup()` (`useSyncExternalStore`, `localStorage maa-markup`) ?? 50; `derivedMrp = round(costPaise × (100 + markup) / 10000) × 100`; `mrpPaise = typed MRP ?? derivedMrp`; save sends the derived rupees when the box is empty. `mrp-from-cost` hint with the % box (aria *Markup % on the purchase price*). `ni.panel.needDetails` = *Type the purchase price or the MRP*. e2e *purchase price first; an empty sale price is purchase + 50%*. |

## 46. Edit items, + Add sizes, bills keep their own copy (2026-11-22, ADR-054)

| Part | Notes |
|---|---|
| Edit | `validateProductInput` needs only name + category; `ProductForm` brand / size / colour `required={false}`. Product page Details: `edit-item` (`<details>`, *✎ Edit this item*) and `add-sizes-card` (`AddSizesForm`, `src/features/catalog/add-sizes-form.tsx`) at the top; *Other details* keeps the For / Age tags. |
| + Add sizes | `addDesignSizes(db, storeId, productId, { operationId, sizes, quantities, staffId })` → `createDesign` with the item's values (company only if active and not deleted; box kept); `addDesignSizesAction` (catalog). |
| Bill copy | Migration **0017_bill_copy**: `bill_collections.snapshot jsonb` (a `Collection`), `bill_companies.company_name` (+ backfill UPDATE). `attach` stores the copy; `companyParts` copies names; `billCopies` reads copies (live only for rows without one); `recompute`, `listBills`, `getBill` use copies. One-off: `node --import ./scripts/register.mjs scripts/backfill-bill-copies.ts` (`backfillBillCopies`). Tests `bill-copy.test.ts`, e2e `edit-items.spec.ts`. |

## 47. Companies at /admin/companies; delete with the Catalog right (2026-11-22, ADR-055)

| Part | Notes |
|---|---|
| Route | `src/app/(admin)/admin/companies` (+ `[id]`); `next.config.ts` redirects `/admin/suppliers` and `/admin/suppliers/:path*`. All links, `revalidatePath`s and tests use `/admin/companies`. |
| Delete | `deleteCompaniesAction` = `requirePermission('catalog')`; `CompanyBrowser canDelete = can(me, 'catalog')`; `DeleteCompanyButton` shown with Catalog. |


## 48. Laptop database = a copy of live (2026-11-22, ADR-056)

| Part | Notes |
|---|---|
| Command | `pnpm db:copy-live` = `node scripts/db-copy-live.ts`, run from `maa-collection/` with `pnpm dev` stopped (`lsof +D .pglite` refuses while a program holds it). Neon address from `LIVE_DATABASE_URL`, else `.env.neon` (`DATABASE_URL_UNPOOLED`); never printed. |
| Read | One `repeatable read read only` transaction on Neon with fixed text formats (UTC, ISO dates, `extra_float_digits = 3`, hex bytea); per public table (generated columns left out): row count, fingerprint `md5(string_agg(md5(row(cols)::text) order by …))`, `COPY … TO STDOUT`; sequences' `last_value`. |
| Build | `createPgliteDb('.pglite-new', { seed: 'none' })` (this code's migrations). Stops when live has more migrations, or a live column the laptop lacks ("git pull"). `session_replication_role = replica` during `COPY … FROM '/dev/blob'`; `setval` per sequence. Every table's count + fingerprint must equal live's, else the new folder is thrown away and `.pglite/` is untouched. |
| Swap | Writes `.pglite-new/maa-live-copy.json` (live time, tables, rows). An existing `.pglite/` with that marker is replaced; one without it goes to `../backups/laptop-database-before-live-copy-<YYYY-MM-DD-HHMM>/`. |
| Start-up | `createPgliteDb` runs `addSampleCatalog` only when `seedDemoData` just created the shop (`seeded`); before, it re-added the 5 sample companies on every start. Tests `src/db/client.test.ts` (×2). |
| Tests | Playwright reuses a running `:3000` server (`reuseExistingServer`); on a copy its PIN `1234` logins fail — stop `pnpm dev` first, or run e2e on a fresh `next start -p 3217` with `DATABASE_URL=pglite:memory`. |

## 49. Selection bar at the bottom; Products = Delete only; pieces × purchase price (2026-11-22, ADR-057)

| Part | Notes |
|---|---|
| Selection bar | `src/components/ui/selection.tsx` `SelectionBar`: no top bar (`selection-top`, `.sel-top`, `sel-down` and the words `sel.bar` / `sel.close` / `sel.allCount` / `sel.hint` are gone). One fixed bottom bar (`selection-bar`): `selected-count` line (`sel.none` / `sel.count.*`), then `grid auto-cols-fr grid-flow-col`: **Select all** (`role=checkbox`, `aria-checked` all / mixed / false, name *Select all*) · **Cancel** (`sel.cancel`, = `stop`) · the screen's `ActionTile`s as direct children (sheets are portals). `ActionGrid` and `ActionTile wide` were removed — keep a screen to ≤ 2 tiles so the row fits a phone. |
| Products → Select | `ProductDeleteAction` (`bulk-actions.tsx`) = the Delete tile + `DeleteProductsSheet`. `canSelect = me.role === 'admin'`: `SelectionProvider allIds` empty for others, design cards wrapped in `SelectableItem` only then (`Selectable` in the page), rows `selectable={canSelect}`. Retired words `bulk.hide` … `bulk.pricesHint` (15 keys); `bulkProductsAction` / the bulk service remain but no screen calls them. |
| Pieces × purchase price | `src/lib/stock-value.ts` `stockValue(items)` → `{ pieces (each item ≥ 0), perPiece {min,max} of priced items with pieces (else of all priced items) \| null, totalPaise, piecesWithoutPrice }`, integer paise. `src/features/catalog/stock-value.tsx`: `StockValueStrip` (card; test ids `stock-value`, `value-pieces`, `value-per-piece`, `value-total`; without Costs `N pcs in stock` only) and `StockValueLine` (row; `row-value`; real stock with the red / amber tone, total from `stockValue`). `DesignCard value=` replaces its MRP / selling / count lines with `company · Items: N` + the strip; the All tags page passes none. Words `cat.design.items`, `cat.value.*`; `cat.pcs` retired. Tests `stock-value.test.ts` (7), `stock-value.test.tsx` (5; first component test — call `afterEach(cleanup)`, there is no global cleanup). |
