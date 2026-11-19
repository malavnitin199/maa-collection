# Development progress (living)

Last updated: 2026-11-19

## Current milestone
v0.8.0 (plan v18): **selling without internet** (scan from the phone's copy, sell by hand, sales saved on the phone and sent by themselves; the counter opens offline) and a **taller, bigger header**.

## Task status
- [x] P1-01: bootstrap Next.js project + quality baseline (DONE 2026-11-14)
- [x] P1-02: admin, cashier and login route shells (DONE 2026-11-15)
- [x] Demo scan-to-sell flow on dummy data (owner request, outside backlog numbering; DONE 2026-11-15)
- [x] Owner-requested v0.2.0: live catalog, POS, approvals, and supporting workflows (DONE 2026-11-16; see entries below)
- [x] Camera scan popup: anchor it above the camera button; center the close action and use accessible tap targets (DONE 2026-11-16; see verification log)
- [x] Plan v13 All tags: grouped, filtered, grid or rows, print a group (DONE 2026-11-16; see below)
- [x] Plan v14 combined view: one card per design on Products and All tags (DONE 2026-11-16; see below)
- [x] Plan v15 cleaner UI: icon header, pictures, motion, counter card, shorter Home (DONE 2026-11-16; see below)
- [x] Plan v16 Bahi theme (DONE 2026-11-17; owner feedback pending)
- [x] Plan v17 essential Home, clear Add stock, minimal New item + product page, For / Age tags (DONE 2026-11-19; see below)
- [x] Plan v18 selling without internet + a bigger header (DONE 2026-11-19; see below)
- [x] **V19-00** untangle the tree: v18 committed and deployed on its own, Neon migrated to 0009, unplanned v19 code parked on branch `v19-sections` (DONE 2026-11-19; see below). Plan v19 approved (ADR-033)
- [x] **V19-02a** category foundation on the server: `sections` + migration 0010, one-time backfill script, a new item needs section + type (DONE 2026-11-19; see below). **`main` needs migration 0010 on Neon before its next deploy**
- [x] **V19-02b** Categories screen: section tiles (Men / Women / Boys / Girls + the owner's own) with Hindi name, picture, ▲ / ▼ order, hide / bring back; categories under the chosen tile with Hindi names; *Needs sorting* tile with *Move under* (DONE 2026-11-19; see below)
- [x] **V19-02c** docs for the category stage: ADR-034 (clarified New item flow, D-V19-6 confirmed), user guide *Categories* section + owner checklist, project context, reference §29, plan (DONE 2026-11-19)
- [x] **V19-03a** New item, step by step at `/admin/stock/add` (hub tile *Add stock step by step*): One item / Many items → who is it for → what is it → details → sizes & pieces → check and save (DONE 2026-11-19; see below). Next **V19-03b** (step-4 speed) or straight to **V19-04a** (review buttons *Save / Save & add next*) — owner's call; the old form stays at `/admin/stock/new` until V19-04. Production still serves `prod-v18`
- [ ] Remaining work: see `docs/TASK_BACKLOG.md` and the open decisions in `docs/DECISIONS.md`

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
| 2026-11-16 | Camera scan popup | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm exec playwright test e2e/pos.spec.ts -g "camera scanner opens"` | PASS | 135 unit tests pass; desktop + mobile E2E confirms button-anchored placement, centered 44px+ controls, unchanged scan-form bounds, close button/Escape/outside-click behavior, and focus restoration |
| 2026-11-16 | Plan v13 All tags | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` | PASS except 2 known timing-dependent tests | 146 unit tests (9 new); build 36 routes; Playwright 71 passed, 1 skipped, 2 failed: `pos.spec.ts:59` camera popup and `guide-voice.spec.ts:46` — both fail the same way on the untouched `f0d5505` under load (see the v13 entry); the new All tags test passes at desktop + phone |
| 2026-11-16 | Plan v14 combined view | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` | PASS except known timing-dependent tests | 150 unit tests (5 new + 1 extended); Playwright 72 passed, 1 skipped, 3 failed: `pos.spec.ts:59`, `guide-voice.spec.ts:46` (known) and `pos.spec.ts:378` on phone (sell by hand + approvals: the scanned item card did not appear within 5 s; 3/8 then 0/8 on repeat with the same code; it visits no changed page). The new combined-view test passes at desktop + phone |
| 2026-11-19 | Three more colour themes | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Playwright vs `next start -p 3217` (pglite:memory) `--workers=3` | PASS | 192 unit tests; build OK; **104 passed, 4 skipped, 0 failed** (look test extended: the picker lists nine themes; Sindoor / Jamun / Aasmani apply, the brand scale changes, the choice survives a reload) |
| 2026-11-19 | V19-03a New item steps | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Playwright vs `next start -p 3217` (pglite:memory) `--workers=3` | PASS | 192 unit tests (30 files; `design.test.ts` 4 new: pieces per size, default pieces + refusals, stock date, old form unchanged; 1 catalog expectation updated to D-V19-3); build OK; **104 passed, 4 skipped, 0 failed** in 2.7 min (`new-item-wizard.spec.ts` 3 new: many items end to end with back navigation, one item with a new category + new size on the spot, permission; desktop + phone). First runs caught two naming slips (decorative badge text in button names; hub tile colliding with the old *New item* link) — fixed before commit. Hindi: dictionary complete, not browser-tested (03e) |
| 2026-11-19 | V19-02c docs | none (documentation only; no code or dictionary changed) | — | ADR-034, DECISIONS D-V19-6, USER_GUIDE §4 *Categories*, PROJECT_CONTEXT, TECHNICAL_REFERENCE §29, plan §5.1 / §7 / §8 |
| 2026-11-19 | V19-02b Categories screen | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Playwright vs `next start -p 3217` (pglite:memory) `--workers=3` | PASS | 188 unit tests (29 files; `sections.test.ts` +1 `moveType`, 3 adjusted for the seed's unsorted category); build OK; **99 passed, 3 skipped, 0 failed** in 2.4 min (3 new tests: Categories screen desktop + phone; New item refuses an unsorted category and *Needs sorting → Move under*, desktop only because they share one seed row). Hindi screen checked by code review of `localName` paths, not in a browser |
| 2026-11-19 | V19-02a sections foundation | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Playwright vs `next start -p 3217` (pglite:memory) `--workers=3`; `node --import ./scripts/register.mjs scripts/backfill-sections.ts --dry-run` on a scratch PGlite | PASS | 187 unit tests (29 files; `sections.test.ts` 10 new, 1 catalog test adjusted); build OK; **95 passed, 1 skipped (phone-only), 0 failed** in 2.4 min; the script runs under plain Node. Not run: the migration on a Neon copy (no copy available; it ran on PGlite from empty) |
| 2026-11-19 | V19-00 (v18 alone on main) | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Playwright vs `next start -p 3217` (pglite:memory) `--workers=3` | PASS | 178 unit tests (28 files); build OK; **95 passed, 1 skipped (phone-only), 0 failed** in 2.9 min. On the mixed tree before the split: lint, typecheck, 187 unit tests passed; build / e2e not run |
| 2026-11-16 | Plan v15 cleaner UI | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e --workers=3` | PASS | 150 unit tests; Playwright **75 passed, 1 skipped (phone-only), 0 failed** with 3 workers. At default parallelism on the busy Mac (load 8–12) random tests timed out; the camera and Guide tests that used to flake now pass 16/16 and 24/24 on repeat |
| 2026-11-17 | Plan v16 Bahi theme | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e --workers=3` | PASS | 150 unit tests; Playwright 75 passed, 1 skipped, 0 failed (2.0 min) |
| 2026-11-19 | Plan v17 | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Playwright `--workers=3` against `next start -p 3217` with `DATABASE_URL=pglite:memory` | PASS | 153 unit tests (3 new); Playwright 75 passed, 1 skipped, 0 failed. The long-running dev server on :3000 was not reused: its local database misses "Ladies Jeans" (old local data) and the new columns until it restarts |
| 2026-11-19 | Plan v18 | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Playwright `--workers=3` against `next start -p 3217` with `DATABASE_URL=pglite:memory` | PASS | 178 unit tests (15 new: offline sales on the server, sending engine, phone-copy look-up, Clear stock below zero); Playwright 95 passed, 1 skipped, 0 failed (4 new: offline sale + by hand + list + logout warning + sent when back, below-zero stock, Made offline mark; counter reopened with no internet through the offline helper, QR link, other screens' No internet page). Header checked in phone screenshots online and offline. |

## Three more colour themes (2026-11-19, owner request)

**Sindoor / सिंदूर** (vermilion red + gold zari), **Jamun / जामुन** (plum purple + leaf green), **Aasmani / आसमानी** (sky blue + coral) join Peacock, Marigold, Rani, Neel, Mehendi and Bahi in ⋯ → Colour theme (nine swatches, three per row). Same pattern as plan v8: a full `--b-50…950` scale per theme in `globals.css` (the 600 step keeps white text ≥ 4.5:1: #b91c1c, #7e22ce, #0369a1), swatches in `THEME_SWATCH`, names in both dictionaries; nothing else changed. Deployed to production from `prod-v18` (cherry-pick) so the owner can try them on the phone.

## V19-03a — New item, step by step (2026-11-19)

Plan v19 task 03a (plan §5.1, ADR-034). New screen **`/admin/stock/add`** (`src/features/catalog/new-item-wizard.tsx`, route `src/app/(admin)/admin/stock/add/page.tsx`), reached from Add stock → *Add stock step by step* (under *Other ways*). **The old form at `/admin/stock/new` is untouched** and still the main tile; the swap happens in V19-04 once the review buttons, photo and *Add next item* are on the new screen (its tests move then).

- **Steps**: start choice **One item / Many items** (D-V19-6: same screens; *One item* lets one size be chosen) → **Who is it for?** (section tiles with pictures, *+ Add* opens a sheet: name + picture) → **What is it?** (the section's categories with pictures and size ranges, *+ Add*: name + sizes with presets) → **Item details** (company picker, product name, sale price (MRP), purchase price per piece with the *costs* right; *More*: counter price, bill no., stock date, brand) → **Which sizes?** (the category's sizes as big cards, tap = chosen with − pieces + and a pieces box; *All sizes* / *Clear all* in many-items mode; *+ Add size* is kept on the category) → **Check and save** (name, path, company, size × pieces chips, total pieces · items, MRP, purchase per piece and total, bill / date / brand; **Save & print tags** → the labels page as today). Progress bar of five, back arrow, path chips that jump back; every value is kept when going back (the details form stays mounted once reached). Step changes slide (`.step-next` / `.step-back`, off under reduced motion). Names come from `localName` (Hindi when the phone is in Hindi).
- **Server**: `createDesign` takes `quantities` (pieces per size), `stockDate` (`cleanStockDate`: a real day, 2000 → today in the shop's time zone), accepts **no colour** (one item per size with an empty colour, D-V19-3) and an **empty brand** (D-V19-5); the old form still sends colours and the company's name as brand, so nothing changes for it. `stock_receipts.stock_date` is now written. Actions `addSectionAction`, `addTypeAction`, `addTypeSizeAction` (object results for the sheets); `createDesignAction` passes `quantities` / `stockDate`. The labels page's receipt lines skip an empty colour.
- **Not in 03a** (next tasks): number pad / *Same for all* (03b); `colourLabel()` everywhere an empty colour could show (03c — today the counter card, lists and tags print the empty string, i.e. nothing); photo on the details step and inline company add beyond the picker's own (03d); Hindi + 360 px + dark browser tests (03e); *Save* / *Save & add next*, the labels page's *+ Add next item* pointing at the new screen with section / bill / date kept, Guide story, release (V19-04).
- Acceptance check for 03a: cold start to saved item = 1 (start) + 1 (section) + 1 (type) + typing name and two prices + company pick + Next + sizes (1 tap each + pieces) + Next + Save = **8 taps + typing** for one size; every string in both dictionaries; no new dependency.

## V19-02c — docs for the category stage (2026-11-19)

Plan v19 task 02c, documentation only. **ADR-034** records the owner's clarified New item flow and **D-V19-6** (*One item* = one size + pieces; *Many items* = the size grid + *Save & add next*; same screens). `docs/USER_GUIDE.md` §4 gains **Categories: Men, Women, Boys, Girls** (tiles, section card, add category / section, *Needs sorting → Move under*, and why New item refuses an unsorted category) and the owner checklist mentions the one-time sorting. `docs/PROJECT_CONTEXT.md` describes sections and that production serves `prod-v18` until V19-04e. No Guide story exists for Categories (none to update; a *New item* story update belongs to V19-04d). Next: **V19-03a**.

## V19-02b — Categories screen with sections (2026-11-19)

Plan v19 task 02b. Screen only — no schema change, nothing deployed (production stays on `prod-v18` until V19-04e).

- **Categories** (`/admin/categories`, `src/app/(admin)/admin/categories/page.tsx`): the sections as **tiles on top** (picture, name in the person's language, category count; hidden ones dimmed with *(Hidden)*), the chosen tile kept in the address (`?s=<section id>` or `?s=unsorted`), **the first section opens by default**. Under the tile: the section card (picture, English + Hindi name, count, **▲ / ▼** to change the shop order — the ends are disabled, *Edit section*: name, Hindi name, picture as big radio tiles, *Shown in New item* to hide / bring back), *+ Add category* (goes under the chosen section; Hindi name optional; the *Under* box lets the owner pick another section) and the section's categories (name + Hindi, code, products / pieces, sizes, *Edit* with the same form). **Needs sorting** tile only while something is unsorted (or the shop has no sections yet — the live DB before the backfill): each row has **Move under … → Move**; the row leaves the list, the tile disappears when empty. *+ Add section* at the bottom (name, Hindi, picture). Owner's minimal-UI rule: the page subtitle is gone; no new help text.
- **Server**: `moveType(db, storeId, categoryId, sectionId)` in `sections.ts` (code, sizes and items stay; hidden section or a name already used there is refused; same place = no-op); actions `createSectionAction`, `updateSectionAction`, `moveSectionAction(id, 'up' | 'down')` (bound form actions), `moveTypeAction`; `createCategoryAction` / `updateCategoryAction` now carry `sectionId` + `nameHi`. All behind `requirePermission('catalog')`. Pictures: `src/features/catalog/section-art.tsx` (from the parked branch, unchanged). Words `sec.*` in both languages.
- **Seed**: one old-style category *Dress Material (DM)* with no section, so dev / tests have a *Needs sorting* row (the live shop will have many).
- **Two bugs found by the browser tests and fixed before commit**: (1) a `key={section.id}` on a server component that is a direct child of the page fragment made the previous section's card stay on screen when switching tiles (both headers visible) — keys now sit on the client forms inside, which is what they were for; (2) after *hide → bring back*, the add form's *Under* box silently pointed at Men (the hidden section had left the option list and the browser picked the first one) — the form is keyed on the hidden state too, so it resets.
- Acceptance for V19-02 as a whole: the owner can build the Men / Women / Boys / Girls tree with the brief's types and sizes without a developer ✅ (tiles, add / rename / Hindi / picture / order / hide, categories with sizes, *Needs sorting*); no product row changed by the migration — verified on PGlite in 02a, to be re-verified on the Neon backup at 04e.

## V19-02a — sections on the server (2026-11-19)

Plan v19 task 02a (`docs/PLAN_V19_PRODUCT_MANAGEMENT.md` §8, §12). Server and data only — no screen changed, nothing deployed.

- **Migration 0010_sections** (one migration instead of the planned 0010 + 0011): `sections` (name, `name_hi`, icon, sort, active), `categories.section_id` (null = *Needs sorting*), `categories.name_hi`, unique (store, section_id, name) replaces (store, name), `stock_receipts.stock_date`. **Not yet applied to Neon** — do it (backup first) before the next production deploy of `main`; the live v18 app does not read these columns, so the migration itself is safe to run early.
- **One-time set-up** `backfillSections` + `scripts/backfill-sections.ts` (`--dry-run` prints the report): Men / Women / Boys / Girls with Hindi names (D-V19-1); **every existing category stays unsorted** for the owner (D-V19-2); a starter type is added only when no category in the shop has that name in any spelling (refinement of D-V19-2, so the owner never meets a duplicate when sorting "Kurta" under Men); starter codes are the shop's usual ones (KR, DU, …) when free. The lazy `ensureSections()` of the parked branch is gone. Scripts under `scripts/` can now import app code (`@/…`) via `node --import ./scripts/register.mjs`.
- **A new item needs both levels**: `createDesign`, `createProductsBatch` (Tag old stock) and `createProduct` refuse a category without an active section (`sec.err.needsSection`, `sec.err.hidden`). Restocking, editing and moving existing items keep working with unsorted categories. **Until V19-02b/03 ship, a locally pulled `main` refuses New item for unsorted categories** — run the script on `.pglite` (`DATABASE_URL=pglite:./.pglite`) or sort them once 02b exists; the dev / test seed already places every demo category.
- Codes: a type keeps its own two letters when free (Dupatta → DU), else section + type (Girls › Jeans → GJ, GJE) — the branch's section-first rule (`BJ`) was dropped so SKUs stay as the shop knows them.
- Services ready for the screens: `listSections`, `unsortedCount`, `createSection` / `updateSection` (Hindi, picture, hide), `moveSection`, `createType`, `addTypeSize`, `sectionOfType`; `createCategory` / `updateCategory` take `sectionId` + `nameHi`; `listCategories` returns `sectionName`, `sectionNameHi`, `nameHi`. Words in `src/lib/i18n/modules/sections.ts`. Reference §29.

## V19-00 — the tree untangled, v18 live (2026-11-19)

Found at session start: the last commit was plan v17; plan v18 was finished but uncommitted; unplanned v19 code (sections, 4-step New item wizard, company report, migration 0010) sat in the same working tree with its owner choices only in code comments; production was still v17 (`/api/ping` → 404). Plan written: `docs/PLAN_V19_PRODUCT_MANAGEMENT.md`; owner approved it and D-V19-1…5 as recommended (ADR-033).

- **Branch `v19-sections`** (`6a5949e`, pushed): the whole mixed tree as found — nothing lost. Must be re-based on main and cleaned (no lazy `ensureSections`, names per D-V19-1, no auto-sort per D-V19-2) before any of it is merged.
- **`main`**: `c7c63a4` = v18 alone (57 files; the five files that mixed v18 and v19 — schema, products service, journal, globals.css, en/hi dictionaries — were split by hand, dropping sections / `section_id` / `stock_date` / `quantities` / step animations / `newstock` module); `2a4ca3d` = plan v19 docs + ADR-033.
- **Neon**: read-only backup `../backups/maa-backup-2026-11-19-before-0009.json` (69 products, 44 sales, 13 categories, 9 suppliers, 6 staff), then `pnpm db:migrate` (0009). Verified read-only afterwards: 10 migrations, `sales.offline_at` present, `products_stock_nonnegative` gone, no `sections` table.
- **Deployed** `maa-collection-b8slmq5wo…` → https://maa-collection-pi.vercel.app (status Ready). Live: `/api/ping` 200, `/sw.js` 200, `/login` 200. Not done live: a logged-in offline sale (production PINs are the owner's) — please try one on a phone: airplane mode → scan → *Saved on this phone* → internet back → it reaches Approvals with *Made offline*.
- Dev note: the old `next start` on :3217 was replaced by a fresh v18 build for the E2E run (in-memory DB); the owner's `next dev` on :3000 was not touched — after pulling, `touch next.config.ts` so it runs migration 0009 on its `.pglite`.

## Selling without internet, bigger header — v0.8.0 (2026-11-19)

Owner: *"Increase the height of the header… looking so small. And give the functionality of the offline support… if salesman is offline and still scan the QR code, then the record is able to maintain when he or she back online again. So build a backup system also."* Owner chose: **let stock go below zero** (D-07), **sell by hand + see unsent sales** (+ scanning, named in the request), **the phone keeps unsent sales**. Plan: `docs/PLAN_V18_OFFLINE_COUNTER.md`; ADR-032; reference §28; user guide §3a; Guide lesson *No internet*.

- **Counter offline:** an amber strip under the shop's name; scanning (scanner, camera, a tag's QR link) uses the phone's copy of the items (`/api/counter-catalogue`, no purchase prices); *Record sale* / *Enter by hand* save the sale on the phone (IndexedDB, localStorage fallback) — *Saved on this phone* card, count on the strip, the list with *Send now*.
- **Sent by themselves** when the shop can be reached (`POST /api/offline-sales`, same `recordSale`, retry-safe `operationId`, only by the person who made them): on opening, on reconnect, every 30 s, or *Send now*. A sale the shop refuses stays on the phone with the reason (*Try again* / *Remove*). Logout warns and keeps them.
- **Server:** an offline sale is always recorded — stock may go below zero, a since-hidden item still sells, the MRP the phone showed is kept, a since-removed salesperson keeps the credit; `sales.offline_at` = the phone's time. Online sales keep every refusal. Migration **0009** (drop `products_stock_nonnegative`, add `sales.offline_at`) must reach Neon **before** the deploy.
- **Owner:** Approvals mark each such sale *Made offline · time* (blue). Exchanges stay online-only (*Exchange needs internet*).
- **Offline helper** (`public/sw.js`, built app only): the counter opens without internet; `/` and `/login` go to the counter; a tag's QR link `/i/<code>` → `/pos?code=<code>`; other screens show a short *No internet* page. Saved pages are deleted at login and logout.
- **Header:** badge 52 px, name 1.55 rem, name · role 14 px, अ / ⋯ buttons 48 px, more padding (still exactly two header buttons).
- **Clear stock** now also resets a count below zero to 0 (its promise: every count becomes 0).
- Tests: `offline-sales.test.ts` (9), `offline.test.ts` (6), `e2e/offline.spec.ts` (2 × desktop/phone, incl. reloading with no internet and the QR link). Guide lesson count 16 → 17 in two E2E checks.

## Essential Home, one minimal item layout, For / Age tags — v0.7.0 (2026-11-19)
Owner requests: a Home with only the essentials; a clear Add stock; then a billing-app picture as the model and "don't change any logic — company, product name, sale price and purchase price minimal on top, photo on the right, small tags (girls / boys, adult / child), top tabs Details · Colours · Other details; commit, push, deploy". The owner chose **new fields** for the tags. Plan: `docs/PLAN_V17_ESSENTIAL_HOME_NEW_ITEM.md`; ADR-027; reference §27.

| # | Task | Result |
|---|---|---|
| 1 | Home: New stock, Suppliers, Reports, Approvals + today's sales (`shopToday`) | Done |
| 2 | Add stock: New item + other ways (receive, old stock); `/admin/stock/quick` redirects | Done |
| 3 | New item: one minimal screen (header + photo square, must-haves, tabs); Quick add and New design merged; + Add next item | Done |
| 4 | Product page in the same layout; Colours grid (colour × size with pieces) | Done |
| 5 | For / Age tags: migration 0008, per design, server + database checks | Done |
| 6 | Fix: New item and **Receive stock** clear after saving (Next 16 keeps pages alive; Receive stock could receive old lines twice — live before this) | Done |
| 7 | Guide lesson, Help, user guide, docs; version **0.7.0** | Done |
- Migration 0008 is additive (two nullable columns + checks); it must reach Neon **before** the deploy.
- Verified: lint, typecheck, **153 unit tests**, build; Playwright (desktop + phone, production build, fresh database): **75 passed, 1 skipped, 0 failed**. Phone screenshots: New item (empty, Colours, Details), product page (Details, Colours, Other details, night).
- **Live (2026-11-19):** pushed `1d667cd`…`cfc5113` (9 commits) + tag `v0.7.0`; each in-between commit type-checks on its own. Migration 0008 applied to Neon first (`DATABASE_URL=$DATABASE_URL_UNPOOLED pnpm db:migrate`): `for_gender`, `age_group` present, 69 products, none tagged yet. `vercel deploy --prod` from the clean tree → `maa-collection-mue7go3ej`, aliased to https://maa-collection-pi.vercel.app. Live check (logged out; production PINs are the owner's): `/login`, `/guide`, `/help` 200; `/admin/stock/quick?supplier=x` → 307 `/admin/stock/new?supplier=x`; admin pages → login; the Help text and the Guide's *New item* lesson ("Name, category, photo on the right") are live. Logged-in screens not checked live.

### Follow-up: For / Age on Tag old stock (2026-11-19)
Owner: "add the For / Age tags to Tag old stock too". The same tap-tags under the product name; saved with the item (`createProductsBatch`), changed by *Edit this item* (`correctTaggedItem`; left out = kept, a bad value changes nothing), kept for the next item. No database change (columns from migration 0008). Verified: lint, typecheck, **154 unit tests** (1 new), build; Playwright (desktop + phone, production build, fresh database) **75 passed, 1 skipped, 0 failed** — the edit-after-tagging test now picks Girls · Adult, changes Adult → Child in Edit, and sees *Girls* and *Child* on the product page. **Live (2026-11-19):** pushed `832f200`…`89354ba`; `vercel deploy --prod` → `maa-collection-9swn9z33n`, aliased to https://maa-collection-pi.vercel.app; `/login`, `/help` 200 (new Help step live), `/admin/stock/old` → login.

### Follow-up: For / Age on Add a single product (2026-11-19)
Owner: "add the For / Age tags to Add a single product too". The same tap-tags after the company on `/admin/products/new` (not in the product page's edit form, which has the design-wide tags above it); `createProduct` saves them, unknown values refused before anything is saved. No database change. Verified: lint, typecheck, **155 unit tests** (1 new), build; Playwright (desktop + phone, production build, fresh database) **75 passed, 1 skipped, 0 failed** — the add-product test now picks Boys · Child and sees both on the product page. **Live (2026-11-19):** pushed `19a611a`…`1d32df0`; `vercel deploy --prod` → `maa-collection-4ovx9dm7d`, aliased to https://maa-collection-pi.vercel.app; `/login` 200, `/admin/products/new` → login.

### Follow-up: selection rebuilt like a phone app (2026-11-19, ADR-031)
Owner: the selection was not working / not up to the mark (no Select all, vague icons, small checkboxes). Found the real bug: the fixed selection bars were page-relative because `.page-in` kept a filled transform — on long lists they were off-screen. Fixed (`backwards` fill) and rebuilt the selection: long-press, dark top bar with ✕ · count · Select all, 32 px animated round ticks, icon tiles (dock hidden), bottom sheets, toast, haptics. Verified: lint, typecheck, **163 unit tests**, build; Playwright (desktop + phone, production build, fresh database) **91 passed, 1 skipped, 0 failed** — new: long-press starts selecting without opening the card; Select all tri-state; bars stay on screen at the bottom and middle of a long list; dock hidden on phones; sheets for Rename / For / Age / Prices / Hide; Approvals Approve n / Reject with reason in a sheet. **Live (2026-11-19):** pushed `4434a26`…`345e00a`; `vercel deploy --prod` → `maa-collection-52ygk8xet`, aliased to https://maa-collection-pi.vercel.app; live CSS has `.page-in … backwards` and the new `.sel-check` styles; `/login` 200, `/admin/products` → login.

### Follow-up: calmer header, slate & amber tabs, selecting many (2026-11-19, ADR-030)
Owner: improve the congested header with different shading; give the item tabs a completely different style; add selection across the app (Products: delete / rename / edit; Approvals: pick particular entries). Owner chose name + 2 buttons, slate & amber, hide (not delete), all product actions. Built as in the plan v17 doc. No schema change. Found on the way: on a phone the selection bar covered the last items so they could not be ticked — fixed with room under the list while selecting. Verified: lint, typecheck, **163 unit tests** (4 new: bulk hide / show, rename / company / category / tags, all-or-nothing prices, companies), build; Playwright (desktop + phone, production build, fresh database): full run **87 passed, 2 failed, 1 skipped** — the 2 (phone: scan feedback after the ⋯ menu; Guide *Read a tag*) passed **2/2 and 2/2** when re-run, so timing under load; new tests: header + ⋯ menu (theme, Guide, Log out), Products select (rename 3, For / Age 2, prices refused then applied, print 2, hide 3 → Hidden items → bring back), Approvals select (approve 2, reject 1 with a reason), Companies hide 2, All tags print 2. **Live (2026-11-19):** pushed `42b8eac`…`a31a568`; `vercel deploy --prod` → `maa-collection-d95lxc28u`, aliased to https://maa-collection-pi.vercel.app; `/login`, `/guide` 200, `/admin/products` → login; the new Help line (⋯ → Log out) is live.

### Follow-up: staff Remove / Bring back, profit / loss on Approvals, colour-coded tabs (2026-11-19, ADR-029)
Owner: manage staff (add, remove a salesman); on the owner's Approvals show profit vs loss in a different colour/style (nothing for the salesman); colour-code the tab area on the stock screens. Built as in the plan v17 doc. No schema change. Verified: lint, typecheck, **159 unit tests** (3 new: `saleDeal`, the queue's purchase price + loss count) — one earlier run had 11 timeouts with the Mac at load ~9.5; two runs in a row then passed 159/159; build; Playwright (desktop + phone, production build, fresh database) **81 passed, 1 skipped, 0 failed** — new: staff add → remove (gone from login) → bring back; a sale below the purchase price shows *▼ Loss ₹100.00* and Home's *at a loss*; the profit sale shows *▲ Profit ₹600.00*; the salesman's screens show no profit/loss. **Live (2026-11-19):** pushed `5f13d42`…`f5e12dc` (in-between commits type-check); `vercel deploy --prod` → `maa-collection-fe3z4cbwo`, aliased to https://maa-collection-pi.vercel.app; `/login` 200, `/admin/staff` and `/admin/approvals` → login (owner-only).
- **Local break and fix (2026-11-19):** a commit check in a temporary git worktree with `node_modules` linked into it made `pnpm` rewrite the app's package links to the worktree; after it was removed, `pnpm dev` showed "Could not find the Next.js package". Fixed with `rm -rf node_modules && pnpm install --frozen-lockfile` (lockfile unchanged; 0 broken links). Build, typecheck, lint and 159 unit tests pass; the dev server on :3000 answers again. Live was never affected (Vercel installs its own packages); redeployed → `maa-collection-3yunhph52` (Ready).

### Follow-up: a fresh company list, added on the spot (2026-11-19, ADR-028)
Owner: "remove all the companies that were here, and give the option to add companies manually, or choose between the previous companies." Owner chose **hide** (not delete) and **keep demo data**. `CompanyPicker` on New item, Tag old stock and Add a single product: companies in use, *Previous companies* (choose = bring back), *+ New company…* (type a name; an existing name is reused, never doubled). Services `addOrRestoreSupplier`, `restoreSupplier`; actions `addCompanyAction`, `restoreCompanyAction`; Suppliers' *Active* hint reworded. No schema change. Verified: lint, typecheck, **156 unit tests** (1 new), build; Playwright (desktop + phone, production build, fresh database) **77 passed, 1 skipped, 0 failed** — new test adds a company on the spot, reuses the same name in another case, hides it on Suppliers and brings it back from *Previous companies* on Tag old stock. **Live (2026-11-19):** pushed `38b9a4b`…`e2b0cfa`; `vercel deploy --prod` → `maa-collection-obmono3zw`, aliased to https://maa-collection-pi.vercel.app. Then, at the owner's request: backup of all 9 companies (`../backups/companies-2026-11-19/suppliers-before-hiding.json`), and all 9 hidden — 0 of 9 active; the 67 items linked to them keep their company. To undo: set `active = true` for the ids in the backup, or choose them under *Previous companies*.

## Bahi theme: a billing-app touch — v0.6.0 (2026-11-17)
Owner request: explore the Bill Book app and give our app one touch of its theme; deploy; the owner will test and give feedback. Taken as **myBillBook**: its public site's colours (indigo #4C3CCE, orange #DB631A, light grey #F6F7F7, white cards, borders #E0E2E7) and font (Poppins) were read; only the feel is borrowed (no logo / name / trade dress). Plan: `docs/PLAN_V16_BAHI_THEME.md`; ADR-026; reference §26.

| # | Task | Result |
|---|---|---|
| 1 | Sixth theme **Bahi / बही**: indigo scale on #4C3CCE (white on 600 ≈ 7.6 : 1), orange accent, light grey page, near-black text; night mode like the others | Done |
| 2 | Poppins (Latin + Devanagari) for text, headings and big numbers in this theme; the zari strip becomes a plain 3 px orange line | Done |
| 3 | **Default** for phones that never chose a theme; picker 3 × 2 with Bahi last; Guide picture keeps the five dye themes | Done |
| 4 | Header name smaller in Bahi so the five symbols fit (measured: 24 px gap at 412 px, 30 px at 360 px) | Done |
| 5 | Docs (plan, ADR-026, reference §26, user guide, context, backlog V2-11, CLAUDE.md); version **0.6.0** | Done |
- No database change. Revert = `DEFAULT_THEME` back to `peacock`.
- Verified: lint, typecheck, **150 unit tests**, build; Playwright `--workers=3`: **75 passed, 1 skipped, 0 failed**. Phone screenshots: login, Sell with an item, Products, the picker, Home by night; header at 360 px.
- **Live (2026-11-17):** pushed `dcf4fab`…`b4ed4c5` + tag `v0.6.0`; no migration; `vercel deploy --prod` → `maa-collection-b018zbd8v`, aliased to https://maa-collection-pi.vercel.app. Live check (logged out, phone size): `<html data-theme="bahi">`, body font Poppins, `--b-600` #4c3cce, login band indigo with the orange line; `/admin/dashboard` and `/pos` redirect to login. A phone that picked a theme before keeps it (☀ → Bahi to see it).

## Cleaner UI: icon header, pictures, gentle motion — v0.5.0 (2026-11-16)
Owner request: make the UI very clean, with animations, small pictures, interactive images and symbols; easier for salesmen and the admin; for the day / dark theme mode just an icon at the top; push with proper commits and deploy. Plan posted in chat, then built. Plan: `docs/PLAN_V15_UI_CLEANUP.md`; ADR-025; reference §25.

| # | Task | Result |
|---|---|---|
| 1 | Header: one slim row — name + "Name · Role", five round symbols (☀/☾ with a theme dot, speaker, अ/A, book, door) with tooltips and unchanged accessible names; login uses the same symbols | Done — header about half as tall |
| 2 | Pictures (`art.tsx`): a swinging hang tag with a sweeping scan line (Sell ready card, login band), a popping tick (empty Approvals); theme colours, decorative | Done |
| 3 | Motion: tiles / cards rise in (Home, My sales, More, Stock, Products), symbols lift and pop; all off with reduced motion; `scroll-padding` keeps scrolled-to things clear of the header and the dock | Done |
| 4 | Counter card: photo or tag symbol, size / colour chips, selling price big, MRP, stock badge, codes in one grey line; Sell ready card with *Enter by hand* (pencil); *My sales today* pill | Done |
| 5 | Home: section symbols, tile symbols, first 6 low-stock items + *Show all N*, latest 6 entries + *See all activity*; My sales: tile symbols, "1 sale" | Done — Home about a third shorter |
| 6 | Guide: *Language and colours* says "Tap अ / A" and "Sun button"; the drawn header shows the new symbols with the finger on them | Done — screenshots checked |
| 7 | Tests made reliable: camera test waits for a still layout; Guide tests hide the dev-only overlay; dev badge off when Playwright starts the server (`E2E=1`) | Done |
| 8 | Docs (plan, ADR-025, reference §25, user guide, context, backlog V2-10, CLAUDE.md); version **0.5.0** | Done |
- No database change; no test lost an assertion. Hindi + English for every new line.
- Verified: lint, typecheck, **150 unit tests**, build; full Playwright with `--workers=3`: **75 passed, 1 skipped, 0 failed**. Before/after phone screenshots of login, Sell (empty and with an item), My sales, Home, More, Stock, Approvals; the Guide's header steps (finger on अ, speaker, log out).
- Found on the way: on a phone the floating dock could cover the very thing the browser had just scrolled to (seen when a test tapped *Grid* and hit the dock) → `scroll-padding-bottom` for the dock and `scroll-padding-top` for the sticky header. The other app on port 3100 (running for a day) was left alone.
- **Live (2026-11-16):** pushed `97f87e1`…`8a6497e` (7 commits) + tag `v0.5.0`; no migration; `vercel deploy --prod` from a clean tree → `maa-collection-ntjfyvhm5`, aliased to https://maa-collection-pi.vercel.app. Live check (logged out, phone size): login shows the round ☀ (with the theme dot) and अ symbols and the hanging tag; `/admin/dashboard` and `/pos` redirect to login; the public Guide's *Language and colours* opens on "Tap अ / A at the top". Logged-in screens are for the owner to try with the production PINs.

## Combined view: one card per design — v0.4.0 (2026-11-16)
Owner request: the admin product view and the tags were still one row / one tag per size and colour; group the same kind of products — same product name, company and MRP, only size or colour different — into one view with a single QR, all the sizes and the images combined; the separate ones only when the owner asks; concise and easy by default. Owner chose (asked before building): a **combined card on screen**; printed tags stay one per piece with its own barcode, Sell unchanged. Plan: `docs/PLAN_V14_COMBINED_VIEW.md`; ADR-024; reference §24.

| # | Task | Result |
|---|---|---|
| 1 | `src/lib/design-groups.ts`: `designKey`, `parseDesignKey`, `groupDesigns` (sizes in shop order and colours with pieces, price range, items by colour then size) | Done — 4 unit tests |
| 2 | `DesignCard`: photos side by side, name, company · MRP · selling, items · pieces, size and colour chips with pieces, on-screen design QR, one footer line *Show N items / tags* + *Print tags* | Done |
| 3 | **Products**: combined by default; *Show: Combined · Every item* (`?show=items` = the old list) | Done |
| 4 | **All tags**: combined by default inside every group (Grid or Rows); *Show: Combined · Every tag*; summary with designs; *Print tags* per design (`design=<key>`) | Done |
| 5 | Hindi + English (`cat.view.*`, `cat.design.*`, `stk.lib.view.tags`, `stk.lib.summaryDesigns`); docs (plan, ADR-024, reference §24, user guide, context, README, backlog V2-09, CLAUDE.md); version **0.4.0** | Done |
- No database change.
- Existing tests that need one row per item now open *Every item* (`&show=items`: prices by size, design rates, hang tag / code price / restock checks, edit after tagging) or *Every tag* (`show=tags`: the seeded tag check); the phone tab test checks the combined list. The v13 All tags test opens the design's tags before tapping one.
- Verified: lint, typecheck, **150 unit tests**, build; new E2E "combined view: one card per design …" passes at desktop + phone (one card for 4 items, "M · 4 L · 4", "Blue · 4 Pink · 4", design QR, Show 4 items / tags, Every item / Every tag, Print tags 8 → 4 per item). Full Playwright: **72 passed, 1 skipped, 3 failed** — `pos.spec.ts:59` and `guide-voice.spec.ts:46` (known), and `pos.spec.ts:378` on phone, which failed 3/8 and then 0/8 on repeat with the same code and visits no changed page (new timing flake; follow-up with the camera test).
- Phone screenshots (private copy of the demo data): Products as cards (Anarkali Kurta: M · 3, L · 3, XL · 4; Maroon · 3, Navy · 7), a card opened (its items by colour then size), All tags by company (22 tags → 3 cards), Rows (cards swipe sideways), a card's tags opened (2 per line). Found and fixed on the way: the count and *Show N* sat on two lines (now one line with *Print tags*); opened items came out in name order (now by colour, then size).
- **Live (2026-11-16):** pushed `70c9cb9`…`1bcb274` + tag `v0.4.0`; no migration; `vercel deploy --prod` from a clean tree → `maa-collection-d6m1a19cw`, aliased to https://maa-collection-pi.vercel.app. Live check (logged out): `/login` 200; `/admin/products`, `?show=items`, `/admin/labels?show=tags` and the design print link redirect to login. The live demo data (62 items) shows as about 31 design cards for the owner.

## Demo data in the live shop (2026-11-16)
Owner request: put dummy tags in random categories and dummy sales for the reports on the live app, to check All tags and the reports. Owner chose **into the live shop** (over a separate demo site or screenshots only), knowing the demo sales count in Home / Reports / Approvals until removed.

- Backup first (read-only, owner's Mac, not in Git): `backups/maa-backup-2026-11-16-before-demo-data.json` — the live DB then had 0 products, 1 sale, 5 staff, 13 categories, 5 companies.
- Added through the app's own services (`createDesign`, `createProductsBatch`, `recordSale`, `approveSale`, `rejectSale`), so SKUs, barcodes, receipts, stock movements and approvals follow the normal rules; only `created_at` was moved back to spread the history over the last 10 days. Dry-run twice on PGlite first (re-run adds nothing).
- Live result (checked): **62 items / 156 pieces in 12 categories**, 4 companies *Demo Ganga Textiles, Demo Kashi Silk Mills, Demo Rangoli Fashion, Demo Jaipur Prints* + 2 old-stock items with no company; 13 deliveries (bills DEMO-101…112); **40 sales** over 7 days by the salesmen (some on behalf of a colleague): 31 approved, 2 rejected, **7 waiting** (6 today + 1 by hand). The owner's own sale is untouched. SKUs MAA-DR-001 … MAA-TS-008, barcodes 2000000000015 … 2000000000626.
- Markers for removal: companies `Demo %`, products `Demo %`, `operation_id` `demo-%` on receipts and sales. Scripts + how to remove: `backups/demo-data-2026-11-16/README.md` (outside Git). Removal is a one-off on the owner's request (backup first); afterwards numbering restarts at 001, so printed demo tags must be thrown away.
- No code change, so no redeploy: the live app reads the database directly.

## All tags: grouped, filtered, grid or rows — v0.3.0 (2026-11-16)
Owner request: the generated QR codes / barcodes were one grid; categorise them by date or company name, add filters for a well-maintained view, offer different views such as horizontal scrollable rows for the same filter, and give tag creation a proper flow; push and make it live. Owner said go ahead (plan posted in chat first). Plan: `docs/PLAN_V13_TAG_LIBRARY.md`; ADR-023; reference §23.

| # | Task | Result |
|---|---|---|
| 1 | `listTagLibrary`: active items with company, maker and the delivery they were created in; filters for search, company (or none), category, made by, when made (shop day), in stock | Done — 3 service tests on PGlite |
| 2 | `src/lib/tag-library.ts`: address ⇄ filters, `groupTags` by date / company / category / delivery (order, "none" last), `capGroups` (newest 120, Show more) | Done — 6 unit tests |
| 3 | **All tags** page `/admin/labels`: filters that apply at once (search with Show), Group by + When made chips, summary, group headings with counts (delivery: bill, date, person), Print this group, tap a tag to open its item, pieces under each tag | Done |
| 4 | **Grid / Rows** switch, remembered per phone; Rows = each group one sideways strip with scroll snap | Done |
| 5 | Print page `list=1` (what the filters show, or one group; one tag per piece in stock or per item; up to 400 items); *See all tags →* on every print page; *See this company's tags* on a company's page; More hint | Done |
| 6 | Hindi + English (`stk.lib.*`), Guide *Print tags* starts with "All tags: by date or company"; docs (plan, ADR-023, reference §23, user guide, context, README, backlog V2-08, CLAUDE.md); version **0.3.0** | Done |
- No database change.
- Verified: lint, typecheck, **146 unit tests** (23 files; 9 new), build (36 routes), new E2E "all tags: grouped by date, company or delivery; filters; grid or sideways rows; print one group" passes at desktop + phone, the labels check in `pos.spec.ts` now searches `?q=MAA-TS-001`. Full Playwright run: **71 passed, 1 skipped, 2 failed**. Both failures are pre-existing timing problems, not this change: `pos.spec.ts:59` (camera popup, from the Copilot commits `d925bea`…`f0d5505`) measures the scan form while the page is still moving (5 px or 56 px); with the Guide test running beside it, it failed **6 of 8 on the untouched `f0d5505`** and passes 4 of 4 alone on both versions. `guide-voice.spec.ts:46` is the known dev-badge flake. Follow-up: make the camera test wait for the page to settle before measuring.
- Phone screenshots (private demo DB, 2 deliveries): Grid by date (2 tags per line), Rows by company (third tag cut at the edge = swipe), delivery headings "Laxmi Fashion House · bill LF-88 / 16 Nov 2026, 2:14 pm · by Owner", Hindi in Rani night theme.
- **Live (2026-11-16):** pushed `ba4a537`…`27fb6bd` + tag `v0.3.0`; no migration needed; `vercel deploy --prod` from a clean tree → `maa-collection-rwwgvntzg`, aliased to https://maa-collection-pi.vercel.app. Live check (logged out): `/login` 200; `/admin/labels`, `/admin/labels?group=company&when=7d` and `/admin/labels/print?list=1&…` redirect to login; the public Guide's *Print tags* lesson opens on step 1 of 4 "All tags: by date or company". The logged-in All tags screen is for the owner to try with the production PINs.

## Sell without scanning + owner approvals — v0.2.0 (2026-11-16)
Owner request: tags are stuck on shirts, pants and so on; sometimes a tag will not scan, the scanner breaks or the phone's back camera does not work. The salesman must still capture the sale by typing the item's name and the selling price. Owner chose: **full approval queue** (every salesman entry waits for him) and **name + price + optional size**. Plan: `docs/PLAN_V12_HAND_ENTRY_APPROVALS.md`; ADR-022; new open question D-EX-2.

| # | Task | Result |
|---|---|---|
| 1 | **Enter by hand** on `/pos`: item name, optional size, quantity, price paid, credit to → sale with `manual = true`, no item, no stock movement, no MRP cap; retry-safe | Done |
| 2 | Owner approval decisions (migration 0007, `approval_decisions`, one append-only row per sale / exchange); owner's own entries approved as recorded | Done |
| 3 | **Approvals** screen `/admin/approvals`: by shop day, MRP + usual price beside a cut price, By hand mark, Approve / Approve the day / Approve everything, Reject with reason + note (pieces back through `sale_rejected`; exchange undone with `exchange_rejected`), last 50 decisions; Home tile with the waiting count; More + header links | Done |
| 4 | Every total (Home, Reports, Sales team, My sales, CSV) counts **approved** entries only; activity lists show Waiting / Rejected / By hand; My sales shows "Waiting for the owner"; CSV gains Status and By hand columns and includes hand-entered sales | Done |
| 5 | Guards: one decision per entry (double tap / second phone), reject a sale's exchange first, no stock back after Clear stock, exchange undo refused if the returned piece was sold again, nothing returnable against a rejected or hand-entered sale | Done — unit-tested |
| 6 | Hindi + English (`modules/approvals.ts`, `sell.byHand*`, …), Guide: 5th step of *Sell an item* + owner lesson *Approve sales* (16 lessons) | Done |
| 7 | Docs: plan v12, ADR-022, D-EX-2, user guide §3 + §5c, reference §21, context, README, backlog V2-07, CLAUDE.md; version **0.2.0** | Done |
- Found and fixed during the work: the uncommitted v12 schema left in the folder would have broken production if deployed alone (`recordSale`'s bare `select()` names the new `manual` columns, which Neon did not have) — the 2026-11-16 redeploy before this work used a clean snapshot of `6bb493e` for that reason.
- Existing tests updated for the new rule: three dashboard/report unit tests now approve before checking totals; the sales-team E2E approves Pradeep's sale first; Guide counts (16 lessons, Sell has 5 steps) and the CSV header.
- Verified (full gate, one run): lint, typecheck, **135 unit tests** (21 files; 13 new in `approvals.test.ts`), build (36 routes incl. `/admin/approvals`), **Playwright 68 passed + 1 skipped + 1 flaky** at desktop + phone. The flaky one is `guide-voice.spec.ts:46` on phone size: the Next.js **dev** error badge covers the lesson's *Back a step* button. Shown to be **pre-existing**: the same test fails 3 of 5 repeats on the untouched `6bb493e` too (dev mode only; not a production issue). Follow-up: hide the dev badge in that test or set `devIndicators` for E2E.
- **Live (2026-11-16):** migration 0007 applied to Neon with the owner's go-ahead (8 migrations; `approval_decisions`, `sales.manual` / `manual_note`; staff 5, categories 13, sales 0 unchanged), then `vercel deploy --prod` of `fcaa338` → `maa-collection-8nfianvbl`, aliased to https://maa-collection-pi.vercel.app. Live check (logged out): `/login` 200, protected pages redirect to login, the public Guide shows the new *Tag won't scan? Enter by hand* step. Logged-in screens (Enter by hand, Approvals, My sales) are for the owner to try with the production PINs.

## Fresh start + Clear stock (2026-11-16)
Owner request: remove all test records to start fresh, and give the admin a "clear stock" option in the app. Owner chose: remove products/stock/sales now (keep staff, categories, companies); in-app Clear stock = set all pieces to 0. Plan: `docs/PLAN_V11_FRESH_START_CLEAR_STOCK.md`; ADR-021.

| # | Task | Result |
|---|---|---|
| 1 | Live database: full backup file on the owner's Mac, then test products (35), photo (1), receipts (2), stock history (41), sales (5), exchange (1) deleted in one transaction | Done — verified empty; staff 5, categories 13, companies 5 kept |
| 2 | **Clear stock** for the owner (More / Settings): totals, two-step confirmation with the owner's PIN, every count to 0, "Stock cleared" entry in each item's history | Done — no DB migration |
- Verified: lint, typecheck, **122 unit tests**, build, **67 Playwright tests at desktop + phone size** (+1 phone-only skip). Real clear run in a browser on a private demo database. Live after deploy: Owner sees an empty shop and "Nothing is in stock right now."

## A short Guide: stories with an animation per step (2026-11-16)
Owner feedback: the look is very good, but the Guide is too long — minimum words, better animations, better guidance. Owner chose the **story player** (one step at a time). Plan: `docs/PLAN_V10_SHORT_GUIDE.md`; reference §19; ADR-020.

| # | Task | Result |
|---|---|---|
| 1 | All 15 lessons rewritten: 2–5 steps, each ≤ 7 words on screen, with a fuller spoken line; English + Hindi | Done — ~1,600 words → under 450 |
| 2 | One animated scene per step (63 steps, 22 scene kinds): phone in the theme's colours, finger tap, typing, scan line, ticks, bars, the real tag with a part ringed | Done |
| 3 | Story player: progress bars, Next / Back, swipe, arrow keys, voice that moves on by itself, final card (tip, open the screen, practice a sale, Got it ✓) | Done |
| 4 | Guide page: pick your part (preselected from the login), lesson tiles; `/guide#sell` opens a lesson, `/guide#for-owner` picks a part, Back closes | Done |
| 5 | Old long lessons, drawings and the page-level Listen player removed; dead dictionary keys removed | Done |
- Verified: lint, typecheck, **121 unit tests** (incl. the word limits), build, **65 Playwright tests at desktop + phone size** (+1 phone-only skip). Screenshots of every step at phone size (finger positions and tag highlights calibrated against them), and a Hindi lesson in the Rani night theme.

## Edit after tagging + a Guide that talks (2026-11-16)
Owner request: an **Edit** option at the end of tagging (only *Next item* / *Print today's labels* before); improve the Guide with voice (translated) and interaction; keep the docs and `PROJECT_CONTEXT.md` current. Owner decisions before building: the phone's own voice (not recorded files); Edit does not lower piece counts for now (D-ST-2). Plan: `docs/PLAN_V9_GUIDE_VOICE_EDIT.md`; reference §18; ADR-019.

| # | Task | Result |
|---|---|---|
| 1 | Tag old stock finish screen: **✎ Edit this item** → same form filled in → **Save changes**; same barcode/SKU/pieces; tag preview refreshes | Done |
| 2 | Server rule `correctTaggedItem`: prices by the *Prices* right, or by the item's creator before its first sale; purchase price only with *costs* | Done + 2 unit tests |
| 3 | **▶ Listen** on every lesson (Hindi/English phone voice), step highlight, back / pause / next / stop / slow, sticky controls; **Listen to all** per part; tap-to-hear on the tag's parts | Done |
| 4 | **Practice a sale** in the Sell lesson with voice help, real labels/sounds/"Sale done" card, nothing saved | Done |
| 5 | Lessons updated for the new look (login keypad, round Sell button, palette), new lesson **Colours and day/night**, Edit step in Tag old stock; Hindi for all; 15 lessons | Done |
| 6 | Docs: plan v9, ADR-019, D-ST-2, reference §18, user guide, `PROJECT_CONTEXT.md` (in repo + the copy in the parent `docs/`), CLAUDE.md | Done |
- Verified: lint, typecheck, **117 unit tests**, build, **65 Playwright tests at desktop + phone size** (+1 phone-only skip) incl. new `e2e/guide-voice.spec.ts` (3 tests × 2 sizes, stand-in voice) and the Edit-after-tagging test. Phone screenshots: finish screen with Edit, edit mode, a lesson being read (step lit up), practice sale refusing a price above MRP.

## Look and feel v8: five themes, day/night, shop-made design (2026-11-16)
Owner request: make the app easier and more catchy for retailers — several themes, colours, day/night mode, more interactive, creative (no plain rectangles), take references. Plan + direction: `docs/PLAN_V8_LOOK_AND_FEEL.md`; developer notes: `docs/TECHNICAL_REFERENCE.md` §17; ADR-018.

| # | Task | Result |
|---|---|---|
| 1 | Theme system: 5 dye themes (Peacock default, Marigold, Rani, Neel, Mehendi) as CSS variables behind Tailwind `brand-*`; `emerald-*` replaced app-wide; day / night / same as phone; chosen per phone, applied before the first paint | Done |
| 2 | Theme picker (palette button in the header and on login): swatches like dyed cloth with a zari edge; bottom sheet on phones, pop-over on bigger screens | Done |
| 3 | Type: Rozha One (titles, big numbers) + Mukta (body), both Latin + Devanagari | Done |
| 4 | Header band in the theme's dye with the woven **zari border**; icon buttons (theme, sound, language, Guide, log out) | Done |
| 5 | Floating bottom dock with a raised round **Sell** button; line icons | Done |
| 6 | Home: hang-tag shaped quick actions, today's net revenue as a dyed hero card; Stock hub options as hang tags | Done |
| 7 | Login: name circles with initials, big PIN number keypad (typing still works) | Done |
| 8 | Scan zone on every scanning screen: dyed panel with viewfinder corners, white Find, camera button with icon | Done |
| 9 | More menu: grouped lists with an icon per row | Done |
- Verified: lint, typecheck, **114 unit tests**, build, **57 Playwright tests at desktop + phone size** (+1 phone-only skip), incl. new `e2e/look.spec.ts` (theme + night apply at once and stay after reload; keypad fills the PIN and logs in). Phone screenshots of login, Home, Sell, Stock, More in all five themes, day and night. Found and fixed on the way: the theme button's label "Colours…" clashed with the product "Colour" box for screen readers/tests → renamed "Theme and day/night"; the picker opened off-screen on phones → bottom sheet rendered on `<body>`; base CSS moved into `@layer base` so utility colours win.

## Hindi round 2: owner and catalog screens (2026-11-16)
Owner request: translate the owner and catalog screens too; the live Home dashboard still showed "Net revenue", "Net profit", "Sold", "Exchange", "This month" in English. Approach: `docs/PLAN_V7_HINDI_AND_SCAN_FEEDBACK.md` § Round 2; developer notes + word list: `docs/TECHNICAL_REFERENCE.md` §15.

| # | Task | Result |
|---|---|---|
| 1 | Area dictionaries (`src/lib/i18n/modules/*`: stock, catalog, owner, help, actions) merged into en/hi; Hindi type-checked complete | Done (~710 keys) |
| 2 | Owner screens: Home dashboard (every tile, sub-line, heading, button, table, low stock, activity), reports, sales team (incl. chart labels), activity, staff (permission names/descriptions), settings (code price) | Done |
| 3 | Catalog screens: products list/page/new, product form, rates, stock-in, photos, suppliers, categories (size presets), needs attention, More menu | Done |
| 4 | Stock entry + labels: new design (size chips, price by size, colour photos, preview), quick add, tag old stock, restock, stock hub, label pages | Done (printed tags stay English) |
| 5 | Server messages: all rule errors (products, images, catalog, staff, settings) and owner/catalog action messages carry keys | Done |
| 6 | Help page and all 14 Guide lessons (and drawing labels) in Hindi; dates follow the language | Done |
- Verified: lint, typecheck, **114 unit tests** (dictionary completeness/placeholders/Devanagari incl. all modules), build, **53 Playwright tests at desktop + phone size** (+1 phone-only skip) incl. a new test "owner and catalog screens in Hindi" (a new owner-level person in Hindi: Home has no English labels; products, stock entry, reports, categories open in Hindi); English unchanged everywhere. Hindi crawler over 26 screens: only shop data, the "English" button and "Bluetooth" remain. Phone screenshots: Hindi dashboard and new-design form.

## Hindi + English, and payment-app style scan feedback (2026-11-15)
Owner request (chat): multi-language (Hindi + English for now) with a smooth switch; after a successful scan, a completion effect with a sound like payment apps; write every approach into `docs/`. Owner decisions (ADR-017): salesman screens first, choice saved per person, sound on by default with mute. Plan + approach: `docs/PLAN_V7_HINDI_AND_SCAN_FEEDBACK.md`; developer notes: `docs/TECHNICAL_REFERENCE.md` §15–16.

| # | Task | Result |
|---|---|---|
| 1 | i18n core: `src/lib/i18n` (en/hi dictionaries, typed keys, placeholders, plurals), `getLocale`/`getT`, `I18nProvider`/`useT`, `LocaleRoot` in the root layout | Done |
| 2 | `staff.language` (migration 0006) + `maa-lang` cookie; `LanguageSwitch` in header and login page; `setLanguageAction` + `router.refresh()` | Done |
| 3 | Translated: login, header/menus/tabs, Sell, Exchange, My sales + activity, scan box + camera, first-time tips, sale/exchange/login errors (keys on `DomainError`), Guide page + 5 lessons | Done (owner/catalog screens: next round, D-LANG-2) |
| 4 | Feedback: Web Audio "ting" / chime / buzz + vibration, green tick with ripple, shake + red flash on failure, "Sale done ✓" card; 🔊/🔇 per phone; reduced-motion safe; on Sell, Exchange, restock | Done |
| 5 | Phone checks (Hindi login, Sell with tick, sale card): fixed the tick covering the Find button and a cramped header (buttons now wrap to a second row) | Done |
- Verified: lint, typecheck, **114 unit tests** (dictionaries complete with matching placeholders and real Devanagari, plurals, Hindi sale errors, sound on/off with a fake AudioContext, error keys from the sale service), build, **51 Playwright tests at desktop + phone size** (+1 phone-only skip): Hindi on the login page → a new salesman gets Hindi, switches in place, keeps Hindi on another phone; Hindi server message; tick/shake markers, "Sale done" card closes by itself, mute remembered.
- Live (2026-11-16, owner said "update the live database and deploy"): migration 0006 applied on Neon (`staff.language` added, nullable; 5 staff, all still English; sales/products untouched), deployed to production. Read-only checks: login page English by default and Hindi with the phone's language cookie, Guide lessons in Hindi with the "English for now" note on owner lessons, Hindi labels on the language and sound buttons, protected pages still send logged-out visitors to login.

## Sales team dashboard + photos while creating tags (2026-11-15)
Owner request (chat): a dashboard of the sellers — how many, each one's %, graphs of their sales, all salesmen's data kept; salesmen scan the QR and enter the value; an optional product photo when tags are created (every SKU its own item). Plan: `docs/PLAN_V6_TEAM_DASHBOARD_PHOTOS.md`; ADR-016.

| # | Task | Result |
|---|---|---|
| 1 | `/admin/team` (owner): period filter, tiles (salesmen, team sales, bills, pieces), **share of sales** ranked bars, **each seller day by day** (columns on one shared scale), table incl. exchanges and "below MRP"; linked from Home, menu, header, Guide | Done; charts follow the dataviz rules (one validated hue in light/dark, ≤24 px bars, 4 px rounded data-end, hover titles, table view) |
| 2 | `teamReport` + `periodDays` (shop days in IST; net = sales credited + exchange differences credited) | Done; unit-tested incl. the 23:30 IST edge |
| 3 | Optional photo per colour (New design) and per product (Quick add); shared photo stored once (`addPhotoToProducts`), safe delete | Done; unit + e2e (Blue L shows the photo taken for Blue; Red has none) |
| 4 | "Scan the QR and put the value": already the counter flow — `/i/<barcode>` → Sell with the item loaded → agreed price; e2e covers it as Pradeep | Done (interpretation: sale amount; salesmen never enter purchase prices) |
| 5 | Guide: new lesson "Sales team dashboard" (14 lessons), colour photo step in the New design lesson | Done |
- Found and fixed: the daily grouping failed because the time zone was sent twice as two parameters (Postgres saw two different expressions) — it's now one constant in the SQL.
- Verified: lint, typecheck, **104 unit tests**, build, **47 Playwright tests at desktop + phone size** (+1 phone-only skip) on a fresh production build (port 3218, in-memory DB). Screens checked with a week of sample sales (desktop, phone light + dark).

## Size lists per category + smaller tag with tick boxes (2026-11-15)
Owner request (chat): much smaller tag with little padding; every size of the category on the tag so a size can be ticked by pen on the printed tag; sizes depend on the category (shirts S–XXL, kurtas M–XXL, jeans by gender: girls 26–32, boys 28–36); choose the category first when entering stock. Owner decisions (ADR-015): 40 × 60 mm, jeans as two categories, lists pre-filled + owner-editable, update live. Plan: `docs/PLAN_V5_CATEGORY_SIZES_SMALL_TAG.md`.

| # | Task | Result |
|---|---|---|
| 1 | `categories.sizes` (migration 0005: column + default lists for known codes + Ladies/Gents Jeans); `src/lib/size-lists.ts` (presets, defaults, `cleanSizeList`, `tagSizeRange`); seed uses the same defaults | Done |
| 2 | Categories screen: *Sizes (in shop order)* with presets; list shows each category's sizes | Done |
| 3 | Stock entry: New design shows the category's sizes first (+ *Pick all*, other sizes under *More sizes*); Tag old stock shows them first; Quick add suggests them | Done |
| 4 | Tag 40 × 60 mm, 1.5 mm padding, QR 12 mm, tick-box size row (category list; piece's size added if missing, e.g. shirt 40), barcode 37 mm at 0.33 mm/bar; A4 16 per page; tag printer 40×60 | Done; QR and EAN-13 decode (ZXing) |
| 5 | Sample images in `public/sample-scanner-images/` regenerated with the new tag | Done |
- Verified: lint, typecheck, **102 unit tests**, build, **43 Playwright tests at desktop + phone size** (+1 phone-only skip) — run against a fresh production build on port 3218 (`next start`, in-memory DB) because the long-running dev server on :3000 still had the old schema and stopping it was not permitted from this session; it needs a restart to pick up migration 0005.

## QR hang tags + Guide section (2026-11-15)
Owner request (chat, while away; photo of a fashion-store hang tag): tags with a QR code, product name, barcode and the sizes (S M L XL Free) with this one marked; replace and regenerate the test label images; a **Guide** section with steps and animations, including how to manage inventory; log and docs of what was done. Plan and decisions: `docs/PLAN_V4_QR_TAGS_GUIDE.md`, ADR-014, open D-QR-1 / D-TAG-1.

**Work log (tasks covered)**
| # | Task | Result |
|---|---|---|
| 1 | Hang tag 50 × 80 mm (`HangTag`, `QrCode`): shop, QR, size box + colour, design's sizes with this one highlighted, name, ART. (SKU) + code price, EAN-13, MRP box | Done — product page, all print sheets, test labels, tag old stock |
| 2 | QR item link `/i/<barcode>` (`src/app/i/[code]/route.ts`): owner/catalog → product page, seller → `/pos?code=` (item preloaded), logged out → login; `codeFromScan` so in-app/USB scanners accept the link | Done |
| 3 | Label formats: Tags on A4 (9/page, default) · Tag printer 50×80 mm · Sticker 50×25 mm (barcode only, unchanged) | Done |
| 4 | Regenerated the sample tags (8 demo items, from a fresh in-memory DB, QR → live app): `public/sample-scanner-images/` — `all-tags.png`, `all-tags-print-a4.pdf` and one PNG per tag (owner asked to keep them in the app's public folder; served at `/sample-scanner-images/<file>`) | Done |
| 5 | `/guide`: 13 lessons in 4 groups (everyone, selling, stock & tags, owner), animated SVG/CSS illustrations (static for reduced motion), steps, "Open" buttons, tips, real tag anatomy, inventory routine, "Mark as learned" progress (localStorage). Linked from header, menu, login, first-time tips; `/help` kept as quick reference & fixes | Done |
| 6 | Tests, docs, commits, push, deploy, live check | See verification below |

- Verification of codes: tags rendered at ~190 dpi decode with ZXing — QR → `https://maa-collection-pi.vercel.app/i/<barcode>`, EAN-13 → the same barcode (also checked on the regenerated test image). The browser `BarcodeDetector` hangs in headless Chromium, so ZXing was used instead.
- Issues found and fixed: punch hole overlapped the shop name (name now wraps into a fixed width); an old e2e assertion "no QR on labels" (ADR-005) updated for ADR-014; a new e2e count included other items entered today in the long-lived local DB (now filtered by this run's barcode); port 3100 was taken by another app, so the test images were made on 3217.
- Verified: lint, typecheck, **95 unit tests**, build, **41 Playwright tests at desktop + phone size** (+1 phone-only skip): tag contents and 50 × 80 mm size, QR link for owner / seller / logged out, scanning a typed item link at the counter, tag-printer format, guide lessons and progress, help still reachable.

## Prices by size (2026-11-15)
- Owner request: one default MRP / selling / purchase price for a design, and any **size** can have its own (all its colours share it). Owner decisions (ADR-013): MRP by size too; product-page rates by size too. Plan: `docs/PLAN_SIZE_PRICES.md`.
- **No migration**: each size × colour was already its own product with its own prices. Shared rule `src/lib/size-prices.ts` (`ratesForSize`, `splitDesignRates`, `sortSizes`); `createDesign` / `updateDesignRates` check every size on the server (errors name the size; a price for a size not in the design is refused). Empty selling price = each size's own MRP.
- Screens: **Price by size (optional)** fold-out on `/admin/stock/new` (2+ sizes) and in *Rates for the whole design* on the product page (`SizeRatesEditor`): grey = default, green = the size's own price; preview lists the price per size and the purchase value; sizes whose colours differ today are named and made equal on save.
- Purchase prices (default and per size) are only shown, accepted and saved with `costs` (server drops them otherwise; unit-tested on the actions).
- Verified: lint, typecheck, **91 unit tests** (shared rule, services on PGlite, server actions with/without `costs`), build, **39 Playwright tests at desktop + phone size** (+1 phone-only skip): owner sets size prices → preview → per-size above-MRP refused → labels print each size's MRP → product list per size → rates by size on the product page; catalog person without `costs` sees no purchase boxes. Phone screenshots checked (light + dark).

## Installable app, owner reports, CSV export (2026-11-15)
- **Installable phone app**: `app/manifest.ts` (standalone, portrait, brand green, start /login), generated icons `/app-icon/192|512` + apple-icon (next/og), theme colour; `/login` redirects someone already logged in to their screen. Tests switching user now log out first.
- **Reports** (`/admin/reports`, owner): periods Today / 7d / 30d / month in IST; totals, best sellers, by category / company / salesperson, "not selling" (in stock, no sale in 30 days).
- **CSV export** (owner, 403 for others): `/admin/export/sales?period=` (sales + exchanges, purchase, profit, credited/recorded) and `/admin/export/stock`. `src/lib/csv.ts` quotes, neutralises formula injection, adds BOM.
- Verified: lint, typecheck, **72 unit tests**, build, **37 Playwright tests (desktop + phone)**.

## Catalog person extras: sticker labels, tag barcodes, Needs attention (2026-11-15)
- **Sticker printer 50×25 mm** label format (one per page via `@page`), with short bars so the barcode spans ~47 mm. Rendered at 203 dpi it decodes with the browser BarcodeDetector; E2E checks the 50×25 mm size.
- **Tag old stock with the barcode already on the item**: scan the manufacturer EAN-13 first. Unused + valid → item uses it (no sticker). Already known → shows the item, save blocked. Invalid → explained. The E2E test caught a nested-form bug (Enter submitted the page) — scanner moved above the form. It also showed the duplicate-barcode guard working (desktop and phone runs picked the same random code; the second was refused).
- **Needs attention** (`/admin/catalog/check`): items without photo / company / stock / purchase price (last only with the costs right).
- Verified: lint, typecheck, **69 unit tests**, build, **33 Playwright tests (desktop + phone)**. Deployed after each feature.
- Still waiting on the owner: GitHub `workflow` scope for CI (branch `ci-workflow`), Vercel Blob approval (D-IMG-1), D-PERM-1.

## Plan v3: catalog team permissions, product photos, old-stock tagging, in-app help (2026-11-15)
- Owner request: a dedicated catalog / QC person (a salesman the owner promotes) photographs items, edits names/prices, generates barcodes and labels — including **old stock already in the shop**; owner grants all rights; app must be easy, with a guide. Plan: `docs/PLAN_V3_CATALOG_TEAM.md`; decisions ADR-009…012, open D-PERM-1, D-IMG-1.
- Checkpoints (each committed, pushed; deployed when no half-finished links): (1) plan; (2) permissions — `staff.permissions` (migration 0003), `requirePermission`, Staff & permissions toggles, menus/tabs by right, purchase price hidden and ignored without `costs`; (3) photos — `product_images` (migration 0004), camera/gallery upload resized on the phone, gallery with main/delete, thumbnails, photo at the counter; "Tag old stock" flow + "print today's labels"; (4) `/help` guide + first-time tips; (5) docs + `docs/USER_GUIDE.md`.
- Issues found and fixed: creating a Vercel Blob store was **blocked by the assistant's safety check** → photos stored in Postgres (verified bytes round-trip on Neon inside a rolled-back transaction); test data in the long-lived local DB made the sample "Dupatta" code collide (test switched to a seeded category); admin page shells (empty "Add a person" / "Add supplier" forms) were sent before the permission redirect → moved inside the checked part (no data ever leaked); local dev server had to be restarted twice to apply new migrations.
- Verified: lint, typecheck, **67 unit tests**, build, **29 Playwright tests at desktop + phone size** (owner grants rights; catalog person without purchase-price right; tag old stock with a real JPEG → 3 labels → seller sees the photo; help & tips). Live (read-only): help, tip, salesman without rights redirected from catalog/owner pages (no data in HTML), staff permissions UI, Tag old stock page.
- Production data: migrations 0003–0004 applied; no permissions changed and no products/photos created on the live site — the owner decides who gets which right.

## Quick add, code price, sample catalogue, salesman permission check (2026-11-15)
- Owner asked: can a salesman add prices/companies? **No** — audited all 14 admin server actions (each calls `requireAdmin`) and the `/admin` route guard; new E2E bounces a salesman from 8 admin pages and checks the counter never shows a purchase price. At the counter a salesman only sets that sale's price (≤ MRP).
- Sample data: 5 suppliers (Shree Ganesh Textiles, Laxmi Fashion House, Royal Garments, Kalyan Silk Mills, Jaipur Prints Co.) + 5 categories (Kurti KR, Lehenga LE, Dupatta DU, Leggings LG, Night Suit NS) via idempotent `addSampleCatalog`; added to production with `pnpm db:sample`; local dev seeds them; unit tests use the plain demo seed.
- Two prices as the owner describes them: **purchase price = code price** (admin-only, stored as cost) and **selling price** (shown), plus MRP; admin UI renamed. Optional code price on tags: `/admin/settings` code word (10 different letters = 1…9,0), print switch, decoder; migration 0002 (`stores.price_code_word`, `print_price_code`), applied to Neon.
- **Quick add** (`/admin/stock/quick`, `createProductsBatch`): one company + category, many products with their own name/MRP/selling/purchase/pieces → one receipt → labels. Shares `insertNewProducts` with the sizes × colours flow. "+ Stock" tab opens a 3-way hub.
- Verified: lint, typecheck, **62 unit tests**, build, **23 Playwright tests (desktop + phone)**. Live: salesman bounced from supplier/quick-add/settings, quick add lists all 5 companies and 11 categories, summary maths, settings page — no page errors. No products created in production.
- Assumption to confirm with the owner: they wrote "QR code" but chose barcode-only labels earlier; labels remain EAN-13 barcodes.

## Owner stock workflow: suppliers, categories, sizes × colours, labels, restock, rates (2026-11-15)
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
Read `CLAUDE.md`, `docs/PROJECT_CONTEXT.md`, `docs/PROGRESS.md`, and `docs/TASK_BACKLOG.md`. The latest implemented milestone is v0.2.0; choose the next task from the remaining backlog and open owner decisions. Inspect the actual repo before modifying anything.
