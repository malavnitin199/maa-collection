# Maa Collection — Single Source of Truth

Mobile-first retail clothing **inventory + POS + billing** web app (installable PWA) with two roles: **Owner/Admin** (catalog, stock-in, barcodes, pricing/cost, reports, staff, approvals) and **Cashier** (scan/search, cart, checkout, receipts, returns/exchanges, offline-capable billing).

Business intent: start with one shop, later expand into a product usable by many retailers. Build single-store now, but keep `store_id` on every record and keep tax/receipt/shop settings data-driven — never hardcoded.

Sales flow (owner decision 2026-11-15, ADR-004/008): **scan → see stock → salesperson enters quantity and the bargained per-customer price (≤ MRP) and who the sale is credited to (themselves or a colleague) → stock deducts → sale stored with `sold_by` and `recorded_by`.** No multi-item cart in the MVP. Every customer pays a different negotiated price, so the entered price is the record of truth, with MRP snapshotted alongside.

## Documents (read in this order per session)

1. `docs/PROJECT_CONTEXT.md` — short living product reference
2. `docs/PROGRESS.md` — live task status and verification log
3. `docs/TASK_BACKLOG.md` — phased tasks P0–P8 with stable IDs; one task at a time
4. `docs/PROJECT_BLUEPRINT.md` — full proposed architecture (recommendations, not settled requirements)
5. `docs/DECISIONS.md` — open business/policy questions; `docs/DECISION_LOG.md` — approved decisions
6. `docs/SOURCE_PRD.pdf` — the 12-page PRD, the business source of truth
7. `.cursor/rules/*.mdc` — agent rules (also apply when working outside Cursor)
8. `docs/STARTER_PACK_HISTORY.md` — the original 2026-11-14 starter pack, what it planned and what changed (originals untouched in `docs/archive/starter-pack-2026-11-14/`)

## Stack (pinned by P1-01 bootstrap)

- Node 26 (`.nvmrc`), **pnpm** only (one lockfile, never mix npm/yarn/bun)
- **Next.js 16 App Router** (16.4.6), React 19, TypeScript strict, Tailwind CSS 4
- Tests: **Vitest** (`pnpm test`, jsdom, `src/**/*.{test,spec}.{ts,tsx}`) + **Playwright** (`pnpm test:e2e`, `e2e/`, Chromium, auto-starts dev server)
- Quality gate for every task: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
- Scanning: `@zxing/browser` (installed) + native `BarcodeDetector` when available; labels are EAN-13 barcodes only (owner decision: one code per item), drawn by our own `src/features/scanning/ean13.ts`
- Data: **PostgreSQL** via **Drizzle ORM** (`src/db/`), Neon in production (`DATABASE_URL`), PGlite embedded Postgres when unset (local dev, tests; `pglite:memory` for e2e). Migrations in `drizzle/` (`pnpm db:generate`, `pnpm db:migrate`), seed `pnpm db:seed`. **Never put the Neon URL in `.env.local`** (dev/tests would write to production); keep it in `.env.neon` for migrate/seed only.
- Auth: name + PIN (scrypt), HMAC-signed session cookie (`SESSION_SECRET`); roles admin/salesman + owner-granted permissions (catalog, prices, stock, costs). Use `requireAdmin` (owner-only), `requirePermission` / `requireAnyPermission` (catalog/stock/price screens) in every page and action; `src/proxy.ts` only checks login. Without `costs`, never render or accept purchase prices. Zod validates action input. Pages read data through `requestDb()` (request-time).
- Planned, NOT yet installed (add only in the phase that needs them): Better Auth (if email/multi-shop accounts are needed), React Hook Form, shadcn/ui, TanStack Query, Zustand, Dexie
- Next.js 16 has breaking changes vs older training data — consult `node_modules/next/dist/docs/` before writing framework code (see `AGENTS.md`)

## Project structure

```
src/app/            routes, layouts, route handlers only (auth/validate/respond)
src/components/     ui/ (shadcn later), layout/ (navigation, headers)
src/features/       feature UI + browser hooks (pos, catalog, returns, scanning, printing…)
src/server/         services/ (ALL money/stock business logic), repositories/ (SQL), access/ (authz)
src/db/             Postgres client + schema/ (Phase 2)
src/offline/        Dexie tables, queue, sync engine (Phase 6)
src/lib/            shared utils, validators/ (Zod schemas), app-config.ts
src/test/           setup.ts, factories/
e2e/                Playwright specs
docs/               project documentation (this pack)
```

Empty folders hold `.gitkeep`; they are the agreed blueprint skeleton — fill them in their phase, don't reorganize.

## Non-negotiable domain invariants

1. **Money is integer paise** (minor units) — never floats.
2. **Append-only ledger**: completed sales, payments, stock movements are immutable; corrections are new linked reversal/adjustment documents.
3. **Server is the authority** for inventory and totals: DB transactions + unique `operation_id` idempotency keys; a retried request must never double-sell or double-deduct.
4. **Cashiers never receive cost/profit/supplier figures** — excluded from their API DTOs server-side; hiding in UI is not enough.
5. **Offline sales are provisional** until server-acknowledged; explicit conflict review, never last-write-wins on financial/stock data.
6. Tax rate can vary **per line item by price** (Indian apparel GST is slab-based) — never assume one flat rate.
7. Support **both** generated Code 128 labels and existing manufacturer EAN-13 barcodes mapped to SKUs.

## Workflow rules

- Implement **exactly one task ID** per session; inspect existing files first; smallest viable change.
- Tests ship with the feature (money/stock logic especially), not at the end.
- Never claim a command passed without running it. Record results in `docs/PROGRESS.md`; check a backlog box only when acceptance criteria actually pass.
- Unresolved policy (GST, offline oversell, discounts, returns, hardware) → record in `docs/DECISIONS.md` and ask; **do not invent financial policy**.
- No new dependencies until a task needs them. No secrets in tracked files.

## Known backlog gaps (from review, to be added as tasks)

- Day-close / cash-drawer reconciliation (register open/close, expected vs counted cash)
- Manufacturer EAN-13 barcode mapping on variants (P3)
- Physical stock-take / cycle-count workflow
- Price override (below-MRP bargaining) flow with permission limits
- GST slab-based per-line tax + HSN codes on variants (pending D-05)
- Accountant export (Tally/Excel/CSV of sales + GST data)
- D-15 (to record): multi-tenant expansion ambition — keep tenancy retrofit cheap

## Status

**Sell without scanning + owner approvals (2026-11-16, ADR-022, v0.2.0):** `recordSale({ manual: { name, size? } })` records a sale with no item, no stock movement and no MRP cap (`sales.manual`, nullable `product_id` / `mrp_paise`, migration 0007). **Every salesman sale / exchange waits for the owner**: one append-only `approval_decisions` row per entry (unique), `autoApproveOwnEntry` for an admin's own entries; `approveSale` / `rejectSale` (reason, stock back via `sale_rejected`) / `approveAll`; **every total uses `saleApproved` / `exchangeApproved`** — add the predicate to any new sales query, and carry `status` + `manual` on list rows. Owner screen `/admin/approvals` (`src/features/approvals`), Home tile, POS **Enter by hand** form, dictionaries `modules/approvals.ts` (`appr.*`); reference §21. Exchange without a bill: schema only (D-EX-2). **Fresh start + Clear stock (2026-11-16, ADR-021):** live test data (products, stock history, sales) was removed once at the owner's request; staff, categories, companies kept. Owner-only **Clear stock** (`clearAllStock`, Settings → Clear stock, owner's PIN) sets all counts to 0 with a `cleared` movement per item — never deletes (reference §20). Deleting live data is never an app feature: backup first, one-off script, explicit owner request. **Short Guide (2026-11-16, ADR-020):** `/guide` = story lessons (`src/features/guide/stories.ts`, en + hi side by side; step text ≤ 7 words, test-enforced), one animated `PhoneScene` per step, voice auto-advance, part chips, `/guide#<id>` opens a lesson (reference §19). When a screen changes, update its story step and scene. **Edit after tagging + Guide voice (2026-11-16, ADR-019):** Tag old stock → ✎ Edit this item (`correctTaggedItem`: same barcode/SKU/pieces; prices by *Prices* right or the creator before first sale). Phone's voice for the Guide (Web Speech, en-IN/hi-IN, `voice.ts`) and the practice sale (no server call) — reference §18. Keep `docs/PROJECT_CONTEXT.md` current; after any docs change refresh the parent folder's copy with `rsync -a docs/ ../docs/` (never `--delete`: `../docs/README.md` and the archive's PDFs live only there). **Look and feel v8 (2026-11-16, ADR-018):** five dye themes (Peacock default, Marigold, Rani, Neel, Mehendi) + Day / Night / Same as phone, per phone (`src/features/appearance`, `data-theme` / `data-mode` on `<html>`, set before first paint). **Use `brand-*` colours, never fixed hues**; `dark:` follows `data-mode`. Rozha One + Mukta fonts, zari border, `TagTile` hang-tag actions, floating dock with a raised Sell button, PIN keypad login, dyed scan zone (reference §17). **Hindi + English, scan feedback (2026-11-15/16, ADR-017):** the whole app follows the person's language — dictionaries `src/lib/i18n/{en,hi}.ts` + `modules/` per area (typed keys; add every new UI string to both, English byte-identical for e2e), `getT()` / `useT()`, per-person `staff.language`; Web Audio "ting"/chime/buzz + tick/shake/"Sale done" card (`src/features/feedback`). **Sales team + tag photos (ADR-016):** `/admin/team` (salesmen count, share bars, daily columns per seller, table); optional photo per colour (New design) / per product (Quick add), shared photos stored once (`addPhotoToProducts`). **Category sizes + 40 × 60 mm tags (ADR-015):** `categories.sizes` (owner-editable, presets; Ladies/Gents Jeans as separate categories); stock entry offers the category's sizes first; tags print every size of the category with tick boxes. **QR hang tags + Guide (ADR-014):** `HangTag` (QR item link `/i/<barcode>`, size boxed, ART. = SKU, EAN-13, MRP); formats A4 (16/page), tag printer 40×60, sticker 50×25; `/help` = quick reference. **Prices by size (ADR-013):** defaults + a size's own MRP/selling/purchase for all its colours (`src/lib/size-prices.ts`). **Plan v3 live (2026-11-15):** owner-granted permissions (`staff.permissions`: catalog, prices, stock, costs; `src/lib/permissions.ts`, `requirePermission` in every /admin page/action; proxy only checks login), product photos (`product_images` bytea, `/api/product-images/<id>`, resized on the phone), `/admin/stock/old` Tag old stock + `/admin/labels/print?mine=today`, `/help` guide + `docs/USER_GUIDE.md`. **Previously (2026-11-15):** `/admin/stock` hub with **quick add** (many products, one company + category), code price setting (`/admin/settings`, purchase price printed on tags in a secret letter code), 5 sample suppliers + categories in prod, salesman permissions verified by E2E. **Owner stock workflow live (2026-11-15):** suppliers, categories (SKU codes), `/admin/stock/new` design in sizes × colours → SKUs + in-store barcodes + per-piece label sheet, `/admin/stock/receive` scan-to-restock, design-wide rates, every delivery a `stock_receipts` row (retry-safe), phone bottom tab bar; Playwright runs desktop + phone. **Plan v2 implemented and live** (`docs/PLAN_V2_SHOP_OPERATIONS.md`): shared Postgres (Neon, Singapore), staff login by name + PIN, roles admin / salesman. Salesman: `/pos` counter sale with "credit sale to" (on behalf of a colleague; stores `sold_by` + `recorded_by`), `/pos/exchange`, `/pos/my-sales` (today / month in IST). Admin: `/admin/dashboard`, `/admin/products` (add with generated SKU + in-store EAN-13 `200…` or manufacturer barcode, label, edit, stock-in, history), `/admin/staff`, `/admin/activity`, `/admin/labels`. Business rules in `src/server/services/` with tests on PGlite. Seed staff: Owner (admin), Vishal, Nitin, Pradeep, Balram; local PIN 1234, production PINs set by the owner (never written in the repo; reset 2026-11-16 at the owner's request). Deployed at https://maa-collection-pi.vercel.app (Vercel CLI; repo not Git-connected; previews share the production DB). Code: https://github.com/malavnitin199/maa-collection. Guides: `README.md`, `docs/SCANNING.md`. Open decisions: D-EX-1, D-ST-1, D-PR-1, D-RF-1 in `docs/DECISIONS.md`. Next: GST/receipts and payments per backlog.
