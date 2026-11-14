# Development progress (living)

Last updated: 2026-11-15

## Current milestone
Phase P1: application foundation, plus an owner-requested dummy scan-to-sell demo.

## Task status
- [x] P1-01: bootstrap Next.js project + quality baseline (DONE 2026-11-14)
- [x] P1-02: admin, cashier and login route shells (DONE 2026-11-15)
- [x] Demo scan-to-sell flow on dummy data (owner request, outside backlog numbering; DONE 2026-11-15)
- [ ] P1-03: shadcn/ui, tokens, shared patterns (NEXT per backlog; P2-01 database may be pulled forward since the demo flow now needs real persistence)

All other tasks are tracked in `docs/TASK_BACKLOG.md`.

## Verification log
| Date | Task | Commands run | Result | Notes |
|---|---|---|---|---|
| 2026-11-14 | P1-01 | `pnpm lint` | PASS | ESLint 9 flat config, no warnings |
| 2026-11-14 | P1-01 | `pnpm typecheck` | PASS | `tsc --noEmit`, strict mode |
| 2026-11-14 | P1-01 | `pnpm test` | PASS | 1 Vitest unit test (app-config smoke) |
| 2026-11-14 | P1-01 | `pnpm build` | PASS | Next.js 16.4.6 production build, `/` static |
| 2026-11-14 | P1-01 | `pnpm test:e2e` | PASS | 1 Playwright Chromium test, heading visible |
| 2026-11-15 | P1-02 + demo | `pnpm lint` | PASS | react-hooks `set-state-in-effect` rule enforced; fixed via `useSyncExternalStore` |
| 2026-11-15 | P1-02 + demo | `pnpm typecheck` | PASS | |
| 2026-11-15 | P1-02 + demo | `pnpm test` | PASS | 15 Vitest tests: money, catalog lookup, sale validation |
| 2026-11-15 | P1-02 + demo | `pnpm build` | PASS | `/`, `/login`, `/pos`, `/admin/dashboard` static |
| 2026-11-15 | P1-02 + demo | `pnpm test:e2e` | PASS | 5 Playwright tests: role picker, scan→deduct→dashboard, above-MRP rejected, unknown/out-of-stock errors |

## Owner stock workflow: suppliers, categories, sizes × colours, labels, restock, rates (2026-11-15, latest)
- Owner request: admin-side flow for goods from a company — add the company, define categories, generate barcodes, set rates, maintain it; phone-first. Delivered in 4 deployed checkpoints.
- Data: `suppliers`, `categories` (SKU code), `stock_receipts` (one per delivery, `operation_id` retry-safe), `products.supplier_id/category_id`; migration 0001 backfills categories from existing products (applied to Neon).
- Screens: `/admin/suppliers` (+ detail), `/admin/categories`, `/admin/stock/new` (design in sizes × colours → SKUs + `200…` barcodes, preview, duplicate guard), `/admin/labels/print?receipt=` (one label per piece / per item), `/admin/stock/receive` (scan each piece = +1, name search), product page rebuilt (design variants, design-wide rates, history with supplier/bill), product cards with filters, phone bottom tab bar + More page, dashboard quick actions.
- Fixed: stock-in double-add gap (P3-05) — every stock arrival is a receipt with an idempotency key; label SVG announced twice to screen readers.
- Issue hit: the long-running local dev server kept its PGlite connection from before the new migration (stale schema → server errors); restarting `pnpm dev` applies new migrations. Production is unaffected (migrations run before deploy).
- Verified: lint, typecheck, **57 unit tests**, build, **17 Playwright tests now run at desktop and phone (Pixel 7) size**. Live (read-only, phone size): tab bar, migrated categories, new-stock form + preview, product page with design variants and rates, restock page — no page errors. No test data written to production this round; production has no suppliers yet.

## Plan v2: shared database, admin console, salesman dashboard, exchanges (2026-11-15)
- Plan: `docs/PLAN_V2_SHOP_OPERATIONS.md` (owner request). Decisions ADR-005…008; open questions D-EX-1, D-ST-1, D-PR-1, D-RF-1.
- Neon Postgres (free, `sin1`) provisioned via the Vercel Marketplace (owner accepted terms) and connected to the project; Vercel functions pinned to `sin1`; `SESSION_SECRET` added for production + preview.
- Built: Drizzle schema + migration; PGlite for local/tests (auto-migrate + seed, PIN 1234); services (products with generated SKU + `200…` EAN-13 or manufacturer barcode, stock-in, idempotent sales with sold_by/recorded_by, exchanges valued at price paid with return limits, staff, dashboards in IST); name + PIN login, signed sessions, proxy guard, server-side role checks; screens: login, counter sale with "credit sale to", exchange, my sales, admin dashboard, products (add/edit/stock-in/label/history), staff, activity, labels from DB. Browser-only demo store removed.
- Issues found and fixed on the way: Neon setup wrote the production URL into `.env.local` (dev/tests would have written to production) → moved to git-ignored `.env.neon`; `Date.now()` during prerender on every page → `requestDb()` / `connection()` before data and session checks; form hints inside `<label>` polluted field names → moved out; Vercel install failed on pnpm 12's unapproved esbuild build script → declined in `pnpm-workspace.yaml`; e2e login helper raced navigation → waits for login.
- Verified locally: lint, typecheck, **48 unit tests** (14 service tests on real Postgres engine), build, **5 Playwright tests** (login/roles, add product + stock-in + on-behalf sale, full exchange, admin pages), no browser console errors on any page.
- Production: migrations applied to Neon, seeded with random PINs (given to the owner in chat, not stored), deployed. Live check on https://maa-collection-pi.vercel.app: login redirect, wrong PIN refused, salesman blocked from /admin, scan → sale credited to Vishal by Nitin, exchange (give back ₹1,001), my-sales, admin dashboard, products/staff/activity/labels (8 barcodes) — all OK. **These test entries are in the production database** (1 A-Line Dress sale + 1 exchange for a Classic Crew Tee L).
- Known limits: previews share the production database; no GST/receipts/payments/refunds yet; camera not yet confirmed on a physical iPhone.

## Phone scan failure: not deployed + iPhone reader fix (2026-11-15)
- Owner report: still can't scan with the phone. **Main cause: the live site was never redeployed** after the camera fix and barcode-only labels; production (deployment 60 min old) still served the old camera code and the old QR-only labels page.
- Also found: the zxing fallback (used where the browser has no `BarcodeDetector`, e.g. iPhone Safari) did not benefit from TRY_HARDER. Root cause in `@zxing/browser` 0.2.1: `HTMLCanvasElementLuminanceSource.rotate()` rotates the pixels but keeps the old width/height, so its rotated retry decodes garbage; and it only ever decodes the full, unzoomed frame.
- Fix (`camera-scanner.tsx`): our own frame loop for the zxing path, cycling three views per tick — full frame, the guide-box band zoomed 2×, and the frame rotated 90° (rotated correctly by us) — decoded with `reader.decodeFromCanvas`.
- Verified in full Chromium (has `BarcodeDetector`) on both paths: native 5/6, zxing 3/6 → 5/6 on the hard-image set; all 8 label barcodes + QR read on both paths. lint, typecheck, 28 unit, 9 e2e, build PASS. Still unverified on a physical phone.
- Deployed to production (`maa-collection-ef3bdpo0h…`, aliased to https://maa-collection-pi.vercel.app). Live check: labels page is barcode-only; live camera scan read barcodes on both the native and the zxing path, including a sideways barcode.

## One code per item: barcode-only labels (2026-11-15)
- Owner decision: each item carries **one** scannable code, not a QR code plus a barcode. Chosen: **EAN-13 barcode** (matches clothing tags and manufacturer barcodes, works with any cheap 1D USB/Bluetooth scanner; phone camera reads it too).
- `/admin/labels` shows one barcode per item; QR images (`public/qr/`) and the `qrcode` / `@types/qrcode` dev dependencies removed; `scripts/generate-qr.ts` → `scripts/generate-labels.ts`; `pnpm qr:generate` removed (use `pnpm labels:generate`). Scan box label is now "Scan barcode or enter SKU".
- The camera still decodes QR codes, so an item that ever carries one still works.
- Printable sheet regenerated: `../Maa-Collection-test-labels.pdf` / `.png`.

## Documentation + fresh-clone fix (2026-11-15)
- README rewritten: features, install/run guide (Node 26, pnpm 12.18 via `npm i -g`, since Corepack is no longer bundled with Node), scripts, tests, structure, deployment, docs index, troubleshooting, roadmap. `PROJECT_CONTEXT.md` status and `CLAUDE.md` stack/status brought up to date.
- Verified the guide on a fresh clone from GitHub: install, lint, unit tests, build, `pnpm start` all OK.
- Found and fixed: `pnpm typecheck` failed on a fresh clone (`Cannot find name 'LayoutProps'`). Next's global route types live in git-ignored `.next/types` and only appear after `dev`/`build`. The script is now `next typegen && tsc --noEmit`; verified on the fresh clone with `.next` removed.

## Camera barcode reliability (2026-11-15)
- Owner report: phone camera pointed at a barcode never read it.
- Causes found: no resolution requested (many phones default to 640×480, too coarse for EAN-13 bars on a screen); zxing ran without TRY_HARDER (few rows, no rotation); every format enabled.
- `camera-scanner.tsx` now: requests 1920×1080 ideal + continuous focus; uses native `BarcodeDetector` when available (Chrome Android) else zxing with formats limited to EAN-13/EAN-8/UPC-A/Code 128/QR and TRY_HARDER, 100 ms between attempts; manages the stream itself; on-screen guide box; shows which reader is active.
- Hard-image benchmark (640×480 fake camera): 3/6 → 5/6. **Correction (later the same day):** this run was actually on the native `BarcodeDetector` path, not zxing (the earlier "headless has no BarcodeDetector" check ran on about:blank, which is not a secure context). The zxing path was still 3/6; fixed in the next entry. All 8 label barcodes + QR still read. lint, typecheck, 28 unit, 9 e2e, build PASS. Not verified on a real phone yet; needs deploy.

## Barcode test labels (2026-11-15)
- Owner request: scannable barcode images for the dummy items to test the phone app.
- `ean13Modules` / `ean13Svg` in `src/features/scanning/ean13.ts` draw EAN-13 barcodes (no new dependency); `pnpm labels:generate` (alias of `qr:generate`) now also writes `public/barcodes/<SKU>.svg`. `/admin/labels` (heading now "Test labels") shows QR + barcode per item.
- Printable sheet saved outside the app: `../Maa-Collection-test-labels.pdf` and `.png`.
- Verified: each of the 8 barcodes rasterised into a fake camera feed and scanned on `/pos` → correct item (8/8). lint, typecheck, 28 unit tests, 9 Playwright tests, build — PASS. Not yet deployed.

## Scanner fixes + scan-only POS screen (2026-11-15)
- Owner request: POS screen no longer lists inventory/demo items. It starts with only the scan box, Find, and Scan with camera; an item appears only after it is scanned. Recent sales still show once a sale is recorded.
- Fixed: scan box was never focused on page load (focus ran while the box was still disabled pre-hydration), so the first hardware scan was lost.
- Fixed: a hardware scan while a button had focus was lost and its Enter pressed that button (e.g. reopened the camera). New `useScannerKeystrokes` (`src/features/scanning/scanner-keystrokes.ts`) catches fast keystroke bursts outside text boxes. Deliberately no extra `focus()` calls after camera scans, to avoid popping the phone keyboard over the item card.
- Fixed: all 8 demo EAN-13 barcodes had wrong check digits (no real label could carry them). Corrected in the catalog, tests and docs; `isValidEan13` (`src/features/scanning/ean13.ts`) + a catalog test now guard this.
- Fixed: camera scanner could report one scan twice (first frame decodes before zxing returns its controls); now stops via the callback's controls and reports once.
- Verified: lint, typecheck, 24 unit tests, 9 Playwright tests, build — all PASS. Also verified live camera decoding in headless Chromium with a fake camera feed (QR `MAA-KU-001` and EAN-13 `8901111000014` both decoded and opened the right item in ~0.3 s). Not yet tried on a real phone or a real USB/Bluetooth scanner.
- Deployed to Vercel production (deployment `dpl_7H6vYpMEttL6wEe2eo1PAodKjQ16`, aliased to https://maa-collection-pi.vercel.app). Live check: no inventory list, scan box focused on load, typed scan and fake-camera EAN-13 scan both open the right item.

## Camera scanning, QR labels, two-step sale (2026-11-15, later)
- POS flow is now two steps: scan → item details card (SKU, barcode, brand, category, size/colour, MRP, stock) → "Sell this item" → quantity + bargained price → record.
- **Camera scanning** via `@zxing/browser` (`src/features/scanning/camera-scanner.tsx`): rear camera, QR + 1D barcodes, stops after one decode. Needs HTTPS or localhost.
- **QR labels**: `pnpm qr:generate` writes `public/qr/<SKU>.png` (encodes the SKU); `/admin/labels` shows all codes for scanning from another screen. Admin header now has Dashboard / Labels links.
- `tsconfig.json` gained `allowImportingTsExtensions` so `scripts/generate-qr.ts` can run directly with Node's type stripping (`node scripts/generate-qr.ts`).
- Verified: lint, typecheck, 15 unit tests, 6 Playwright tests, build — all PASS. Camera path is not covered by automated tests (needs a real device); documented in `docs/SCANNING.md`.
- Deployed to Vercel: https://maa-collection-pi.vercel.app (project `maa-collection`).

## P1-02 + demo scan-to-sell notes (2026-11-15)
- Owner decision: **no multi-item cart**. Each scan deducts stock and records one sale with a **bargained per-customer unit price** typed by the salesperson, attributed to that salesperson. See `docs/DECISION_LOG.md` ADR-004.
- Engineering assumption to confirm: sale price capped at MRP (selling above MRP is unlawful in India); below MRP is free-form until D-08 discount limits are decided.
- Routes: `/login` (fake role picker, no auth), `/pos` (Salesman), `/admin/dashboard` (Admin). Shared `RoleHeader`.
- Data: `src/features/catalog/dummy-catalog.ts` (8 items, cashier-safe, no cost fields — unit-tested) and `src/features/inventory/dummy-store.ts` (localStorage-backed stock + sales shared by POS and dashboard; single-browser demo only). Both are throwaway until P2/P3.
- Scanner input is a plain focused text box: USB/Bluetooth HID scanners (barcode or QR) type the code and press Enter. No camera scanning yet.
- Gotcha: Next 16 dev blocks assets/HMR for non-`localhost` origins, so pages at `http://127.0.0.1:3000` render but never hydrate (controls stay disabled). Playwright now uses `localhost`; `next.config.ts` adds `allowedDevOrigins: ["127.0.0.1"]` for manual use.
- Interactive POS controls are disabled until hydration (`useHydrated`), which also makes Playwright auto-wait correctly.

## P1-01 notes / deviations from the bootstrap guide
- Node 26 installed locally instead of 24 LTS; `.nvmrc` pins `26`. Both are even (LTS-line) majors; keep one major across CI/deploy.
- Versions pinned by lockfile: Next.js 16.4.6, React 19.3.0, Tailwind 4, TypeScript 5.9, Vitest 5, Playwright 1.65, pnpm 12.18.0.
- Playwright set up manually (config + `e2e/home.spec.ts` + `playwright install chromium`) instead of the interactive `pnpm create playwright` wizard.
- Blueprint folder skeleton created with `.gitkeep` placeholders (`src/features`, `src/server/*`, `src/db/schema`, `src/offline`, etc.). No functionality implemented.
- `CLAUDE.md` added at repo root as the single-source-of-truth context file for agents and contributors.
- Dev server prints an `allowedDevOrigins` hint when accessed via 127.0.0.1; harmless, can be configured later if it becomes noisy.

## Blockers / open questions
- P0 policy questions in `docs/DECISIONS.md` have not been approved.
- Confirm real scanner/printer models before choosing hardware APIs.
- Review gaps to add to backlog (see `CLAUDE.md`): day-close/cash reconciliation, EAN-13 mapping, stock-take, price override, GST slabs/HSN, accountant export, D-15 multi-tenant ambition.

## Next session handoff
Read `CLAUDE.md`, `docs/PROJECT_CONTEXT.md`, `docs/PROGRESS.md`, `docs/TASK_BACKLOG.md`. Next per backlog is **P1-03**; if the owner wants persistence first, pull **P2-01** (Docker PostgreSQL) forward and replace `dummy-store.ts` with real services. Inspect the actual repo before modifying anything.
