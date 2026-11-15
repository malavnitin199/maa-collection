# Maa Collection — technical reference

*Code and project context as of 15 Nov 2026, commit history of 48 commits on `main`.*

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
| `/admin/labels` | `…/labels/page.tsx` | catalog / stock | All active product labels |
| `/admin/labels/print` | `…/labels/print/page.tsx` | catalog / stock | `?receipt=<id>` or `?mine=today`; `&each=item`; `&format=tag` (tag printer 40×60) / `sticker` (50×25); default hang tags on A4 |

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
| `scanning/camera-scanner.tsx` | `CameraScanner` | HD stream, continuous focus, `BarcodeDetector` or zxing with full/zoom/sideways views |
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
| `staff` | `id`, `name`, `role` (`admin`/`salesman`), `permissions text[]`, `pin_hash`, `active` | unique (store, name) |
| `suppliers` | `name`, `contact_name`, `phone`, `gstin`, `notes`, `active` | unique (store, name) |
| `categories` | `name`, `code` (2–3 letters), `sizes text[]` (shop order, owner-editable), `active` | unique (store, name), (store, code) |
| `products` | `sku`, `barcode`, `name`, `brand`, `category` (name snapshot), `category_id`, `supplier_id`, `size`, `color`, `mrp_paise`, `price_paise`, `cost_paise` (admin/costs only), `stock`, `active`, `created_by` | unique (store, sku), (store, barcode); `stock >= 0`; `0 < price ≤ mrp` |
| `product_images` | `product_id`, `content_type`, `data bytea`, `url`, `byte_size`, `width`, `height`, `sort_order` | lowest `sort_order` = main photo |
| `stock_receipts` | `operation_id`, `supplier_id` (nullable), `bill_number`, `note`, `staff_id` | unique (store, operation_id); one per delivery / restock / old-stock entry |
| `stock_movements` | `product_id`, `quantity_change` (±), `reason` (`opening`/`stock_in`/`sale`/`exchange_return`/`exchange_issue`), `ref_id`, `staff_id`, `note` | `ref_id` → receipt / sale / exchange |
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
| `0005_category_sizes.sql` | categories.sizes `text[] default '{}'` + default lists for known codes (only where empty) + Ladies Jeans (LJ) / Gents Jeans (GJ), skipped if present |

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
| Camera | `CameraScanner`: `getUserMedia` (rear, ideal 1920×1080, continuous focus). The **native `BarcodeDetector`** is used when it supports EAN-13 + QR (Chrome Android). Otherwise **zxing** `decodeFromCanvas` on our own frames, cycling *full*, *zoomed guide band ×2* and *rotated 90°*, because @zxing/browser 0.2.1's TRY_HARDER rotation is broken. First read wins; the stream is released |

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
