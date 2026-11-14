# Maa Collection: project context (living)

## Product
Mobile-first retail clothing inventory and POS app for shop owner and cashier roles. Catalog by brand/category/design/size/color; stock receipts; printable barcodes; fast online checkout; returns/exchanges/damage; owner's analytics and low-stock/reorder guidance; offline-capable cashier experience.

## Requirements source
The 12-page uploaded *Retail Shop Stock, Sales & Billing System* PRD is the product requirements source. Save it to `docs/SOURCE_PRD.pdf`. `docs/PROJECT_BLUEPRINT.md` is a *proposed implementation design* and may add assumptions not explicitly specified in the PRD. Never silently transform proposal into an agreed requirement.

## Working technical direction (proposed; confirm in decision log)
- Next.js App Router, React, TypeScript strict, Tailwind CSS, shadcn/ui
- PostgreSQL + Drizzle ORM; Better Auth for staff/admin; Zod for validation
- TanStack Query, Zustand (small POS UI state only); Dexie.js IndexedDB
- PWA/service worker with reliable foreground retry fallback
- Vitest and React Testing Library, Playwright E2E, PostgreSQL integration tests
- pnpm and Node LTS pinned for the project; choose and record exact versions
- One full-stack repository, keep POS core domain logic in reusable services

## Non-negotiable domain invariants
- Owner-only cost/profit/supplier numbers must be protected server-side; never send them to cashier devices.
- Completed sales and posted stock movements are append-only. Returns/corrections use linked reversal/adjustment transactions.
- Server is the ultimate authority for inventory. Use DB transactions + idempotency keys. Never let duplicate sync requests create duplicate sales.
- Offline receipts are provisional until acknowledged by the server; reconcile conflicts explicitly. Do not use naive last-write-wins for financial records.
- Store money as integer minor units (paise) or exact decimals, never floats.
- Hardware and Background Sync API support depend on browser/device; develop a scanner/printing proof of concept early.

## Team workflow
- Use stable IDs from `docs/TASK_BACKLOG.md` and implement one task at a time.
- Before coding, inspect existing repo files and `docs/PROGRESS.md` and explain the smallest plan.
- Write relevant tests with each task, not at the end.
- At completion, show commands executed, actual results, modified files, gaps and the next task.
- Update `docs/PROGRESS.md` and check off backlog ONLY when acceptance criteria pass.

## Current status
Not started. P1-01 bootstrap is the next coding task. Policy questions P0 remain open.
