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

## Camera barcode reliability (2026-11-15, latest)
- Owner report: phone camera pointed at a barcode never read it.
- Causes found: no resolution requested (many phones default to 640×480, too coarse for EAN-13 bars on a screen); zxing ran without TRY_HARDER (few rows, no rotation); every format enabled.
- `camera-scanner.tsx` now: requests 1920×1080 ideal + continuous focus; uses native `BarcodeDetector` when available (Chrome Android) else zxing with formats limited to EAN-13/EAN-8/UPC-A/Code 128/QR and TRY_HARDER, 100 ms between attempts; manages the stream itself; on-screen guide box; shows which reader is active.
- Hard-image benchmark (640×480 fake camera, zxing path): 3/6 → 5/6 (now reads tiny 1.2px/bar and sideways barcodes). All 8 label barcodes + QR still read. lint, typecheck, 28 unit, 9 e2e, build PASS. Not verified on a real phone yet; needs deploy.

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
