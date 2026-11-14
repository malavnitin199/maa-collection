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

## Stack (pinned by P1-01 bootstrap)

- Node 26 (`.nvmrc`), **pnpm** only (one lockfile, never mix npm/yarn/bun)
- **Next.js 16 App Router** (16.4.6), React 19, TypeScript strict, Tailwind CSS 4
- Tests: **Vitest** (`pnpm test`, jsdom, `src/**/*.{test,spec}.{ts,tsx}`) + **Playwright** (`pnpm test:e2e`, `e2e/`, Chromium, auto-starts dev server)
- Quality gate for every task: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
- Scanning: `@zxing/browser` (installed) + native `BarcodeDetector` when available; labels are EAN-13 barcodes only (owner decision: one code per item), drawn by our own `src/features/scanning/ean13.ts`
- Data: **PostgreSQL** via **Drizzle ORM** (`src/db/`), Neon in production (`DATABASE_URL`), PGlite embedded Postgres when unset (local dev, tests; `pglite:memory` for e2e). Migrations in `drizzle/` (`pnpm db:generate`, `pnpm db:migrate`), seed `pnpm db:seed`. **Never put the Neon URL in `.env.local`** (dev/tests would write to production); keep it in `.env.neon` for migrate/seed only.
- Auth: name + PIN (scrypt), HMAC-signed session cookie (`SESSION_SECRET`), `requireStaff` / `requireAdmin` in every page and action, `src/proxy.ts` guard. Zod validates action input. Pages read data through `requestDb()` (request-time).
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

**Plan v2 implemented and live** (`docs/PLAN_V2_SHOP_OPERATIONS.md`): shared Postgres (Neon, Singapore), staff login by name + PIN, roles admin / salesman. Salesman: `/pos` counter sale with "credit sale to" (on behalf of a colleague; stores `sold_by` + `recorded_by`), `/pos/exchange`, `/pos/my-sales` (today / month in IST). Admin: `/admin/dashboard`, `/admin/products` (add with generated SKU + in-store EAN-13 `200…` or manufacturer barcode, label, edit, stock-in, history), `/admin/staff`, `/admin/activity`, `/admin/labels`. Business rules in `src/server/services/` with tests on PGlite. Seed staff: Owner (admin), Vishal, Nitin, Pradeep, Balram; local PIN 1234, production PINs random (given to the owner, not stored). Deployed at https://maa-collection-pi.vercel.app (Vercel CLI; repo not Git-connected; previews share the production DB). Code: https://github.com/malavnitin199/maa-collection. Guides: `README.md`, `docs/SCANNING.md`. Open decisions: D-EX-1, D-ST-1, D-PR-1, D-RF-1 in `docs/DECISIONS.md`. Next: GST/receipts and payments per backlog.
