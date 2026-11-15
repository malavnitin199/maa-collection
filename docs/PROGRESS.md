# Development progress (living)

Last updated: 2026-11-16

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

## Sell without scanning + owner approvals — v0.2.0 (2026-11-16, latest)
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
Read `CLAUDE.md`, `docs/PROJECT_CONTEXT.md`, `docs/PROGRESS.md`, `docs/TASK_BACKLOG.md`. Next per backlog is **P1-03**; if the owner wants persistence first, pull **P2-01** (Docker PostgreSQL) forward and replace `dummy-store.ts` with real services. Inspect the actual repo before modifying anything.
