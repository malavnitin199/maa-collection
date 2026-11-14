# Maa Collection — Single Source of Truth

Mobile-first retail clothing **inventory + POS + billing** web app (installable PWA) with two roles: **Owner/Admin** (catalog, stock-in, barcodes, pricing/cost, reports, staff, approvals) and **Cashier** (scan/search, cart, checkout, receipts, returns/exchanges, offline-capable billing).

Business intent: start with one shop, later expand into a product usable by many retailers. Build single-store now, but keep `store_id` on every record and keep tax/receipt/shop settings data-driven — never hardcoded.

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
- Planned, NOT yet installed (add only in the phase that needs them): PostgreSQL + Drizzle, Better Auth, Zod + React Hook Form, shadcn/ui, TanStack Query, Zustand, Dexie, @zxing/browser
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

**P1-01 (bootstrap) done.** Next task: **P1-02** — `(auth)`/`(admin)`/`(pos)` route shells with responsive placeholder layouts. No DB, auth, or business logic yet.
