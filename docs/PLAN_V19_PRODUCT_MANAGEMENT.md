# Plan v19 — Product management: category-first New item, Products, Companies, Salesperson profiles

**Status: APPROVED by the owner on 2026-11-19 (ADR-033) — all recommendations in §7 taken (D-V19-1…5) and V19-00 approved; D-V19-6 confirmed 2026-11-19 (ADR-034). Done: V19-00, 02a, 02b, 02c. Next: V19-03a. Each task still becomes DONE only when its acceptance criteria pass.**

Owner brief (2026-11-19): redesign the whole product-management experience, starting with **Product Addition** as a guided flow — *Who is it for?* → *What is it?* → *Sizes and pieces* → *Details* → *Review, save, print tags* — then the Products list and product page, then company bills and purchasing reports, then salesperson profiles. One functionality at a time; nothing is DONE until its acceptance criteria pass.

---

## 0. Where the repository actually is (audit, 2026-11-19)

The documented baseline is v18 / v0.8.0, but the repository is **not** in that state:

| Fact | Evidence |
|---|---|
| Last commit is plan v17 (`1b9ba25 docs: selection v2 is live`, 2026-11-19 07:44 IST) | `git log` |
| **Plan v18 (offline counter, bigger header) is complete, tested and documented but uncommitted** | `docs/PROGRESS.md` v0.8.0 entry; 50 modified + 22 new files in the working tree |
| **Plan v19 work has already been started, unplanned, in the same working tree**: `sections` table + migration 0010, a 4-step `NewStockWizard`, quantities per size, stock date on receipts, inline add section / type / size, optional colour, For / Age tag UI removed, a company bills report | `src/lib/sections.ts`, `src/server/services/sections.ts`, `src/features/catalog/new-stock-wizard.tsx`, `src/server/services/company.ts`, `drizzle/0010_sections.sql` |
| No plan document, no ADR, no PROGRESS entry exists for that v19 code; owner choices are recorded only as **code comments** ("owner's choice, 2026-11-19") | `src/lib/sections.ts` |
| **Production is still v17**: `GET https://maa-collection-pi.vercel.app/api/ping` → 404 (that route is v18) | curl, 2026-11-19 |
| Migrations **0009** (v18) and **0010** (v19) are generated locally; whether 0009 has reached Neon is unverified | `drizzle/meta/_journal.json` |
| Working tree passes `pnpm lint`, `pnpm typecheck`, `pnpm test` (29 files, **187 tests pass**) | run 2026-11-19 11:17 IST. `pnpm build` and `pnpm test:e2e` **not run** in this audit |

**Consequence:** before any V19 task, the tree must be untangled (§8, task V19-00): commit v18 on its own, deploy it (0009 first), and park the v19 code on a branch so `main` = what is live.

---

## 1. Business goals

1. A shop owner or stock person adds a new product in **under a minute on a phone**, by tapping: who it is for → what it is → sizes with pieces → name, company, two prices → save and print tags.
2. The catalogue becomes **browsable by who it is for** (Men / Women / Boys / Girls …) and then by type, on Products, All tags and reports.
3. Every number the owner sees about a **company** (bills, amounts, pieces) comes from recorded purchase lines, never from today's prices.
4. Every **salesperson** sees their own performance without cost or profit; the owner sees profit, loss and comparisons.
5. Nothing that works today breaks: scanning, offline selling, approvals, exchanges, tags, Hindi, themes.

## 2. Existing functionality (what already exists and is reused)

### 2.1 Product Addition today (committed v17, live)

`/admin/stock/new` → `NewItemForm` (one screen): product name, **category** pill-select (categories = item types with a size list each, ADR-015), size chips (category's sizes first, then "More sizes"), For / Age tags (ADR-027), photo square; must-haves company (`CompanyPicker`), sale price (MRP), purchase price; tabs **Details** (pieces each, counter price, bill no.) · **Colours** (colour chips, sizes × colours grid, price by size, photo per colour) · **Other details** (brand). Nothing picked = one item *Free / Assorted*. Save → `createDesignAction` → `createDesign` → `insertNewProducts` (one transaction: one `stock_receipts` row, one `products` row per size × colour with generated SKU `MAA-<code>-NNN` and in-store EAN-13 `200…`, one `opening` movement per row; idempotent by `operationId`; SKU / barcode race retried 3×). Then `/admin/labels/print?receipt=…` with **+ Add next item** (keeps company + category).

Other creation paths sharing `insertNewProducts`: **Tag old stock** (`createProductsBatch`, one row, optional manufacturer barcode) and **Add a single product** (`createProduct`). **Receive stock** (`receiveStock`) adds pieces to existing items.

### 2.2 Product Addition in the uncommitted v19 code

`NewStockWizard` (4 steps, progress bar, tappable crumbs, slide animations, haptics):

| Step | Built | Matches the brief? |
|---|---|---|
| 1 *Who is it for?* | Big tiles from `sections` (icon + name), **+ Add** sheet (name + picture) | Yes, except names (**Man / Woman / Girl / Boy** vs brief **Men / Women / Boys / Girls**) and no Hindi for owner-added names |
| 2 *What is it?* | Tiles of that section's types with size range, **+ Add** sheet (name, size preset, sizes) | Yes |
| 3 *Sizes* | Tap sizes (Pick all), − n + per size, **+ Add size** saved on the type, sticky summary + Next | Yes; quantity keypad could be faster (see V19-03b) |
| 4 *Details* | `NewItemForm` reduced: name, path chip, size pills (tap = back to step 3), photo; company, MRP, purchase price; tabs Details (counter price, bill no., **stock date**) · Colours (**optional**, grid, photo per colour, price by size) · Other (brand) | Yes |
| 5 *Review / Save* | **Missing.** One *Save* button → tags print page; next item keeps section, company, bill no., stock date | Brief wants a compact review + **Save / Save & Add next / Save & print tags** |

Server side (uncommitted): `sections` table; `categories.section_id`; unique (store, section, name) replaces unique (store, name) — *Boys › Jeans* and *Girls › Jeans* can coexist with different size lists; `createDesign` takes `quantities` per size and `stockDate`; `stock_receipts.stock_date`; section-aware category codes (`suggestSectionCode`: Boy › Jeans → `BJ`); `ensureSections` **lazily** creates the four sections on first read, sorts existing categories (men's names → Man, **everything else → Woman**) and inserts suggested type lists for all four sections.

### 2.3 Everything else that stays as is

Login + PIN, permissions (`catalog`, `prices`, `stock`, `costs`), photos (`product_images`), size-based prices (ADR-013, `src/lib/size-prices.ts`), EAN-13 + QR hang tags 40 × 60 mm / A4 / sticker, code price, counter sale + bargained price + credit-to, exchanges, hand entry + approvals (ADR-022), offline counter (ADR-032: counter catalogue, outbox, sync, service worker), combined design view (ADR-024, `designKey` = company ~ MRP ~ name), selection v2, All tags, reports, team dashboard, Hindi / English, themes, Guide stories.

## 3. Requested changes vs. what exists — gap list

| # | Brief | Exists? | Gap / change |
|---|---|---|---|
| G1 | Primary category table, stable IDs, add / rename / reorder / deactivate, icon, Hindi + English | `sections` (id, name, icon, sort, active) | **Reorder UI** missing (column exists); **Hindi name** missing for owner-added sections (the four defaults are translated by key) |
| G2 | Secondary categories per primary, duplicates prevented within a parent, same type under several parents with own sizes, deactivate not delete | `categories.section_id`, unique (store, section, name), `active` | Done in code. **Mandatory** only if `createDesign` refuses a category without a section (not yet enforced) |
| G3 | "All" option for browsing, not saving | — | Products page (V19-05) |
| G4 | Size presets per primary + secondary combination | `categories.sizes` per type row (a type row belongs to one section) | Done |
| G5 | Quantity per size, fast touch entry | − n + per size | OK; add a numeric keypad / "same for all" (V19-03b) |
| G6 | Colour optional, no invented visible colour name | Optional, but stored and shown as **`Assorted`** | Decide D-V19-3 (§7) |
| G7 | Two items same design + size, different colours | Separate `products` rows (own SKU + barcode each), prices follow size | Already correct; a **stable design id** is missing (grouping is by name ~ company ~ MRP) → `products.design_id` (V19-05) |
| G8 | Required: name, both categories, sizes + qty, company, MRP, purchase price | All present (purchase price required only with `costs`) | — |
| G9 | Optional: photo, colour, brand, bill no., bill date, notes, future attributes | photo, colour, brand, bill no., **stock date (new)** | **Notes** missing (small additive column, V19-04 or later); custom attributes deferred |
| G10 | Creation timestamp automatic | `products.created_at`, `stock_receipts.created_at` | Done |
| G11 | Company: search, select, add inline, reuse deactivated, no case-only duplicates | `CompanyPicker` + `addOrRestoreSupplier` (ADR-028) | Done; search is a native `<select>` — fine on phones; revisit if the list grows |
| G12 | Never print the company on tags | `HangTag` prints brand only when it differs from the company name (uncommitted) | Done; note that **brand defaults to the company's name** when left empty (v17) — the counter shows `brand`, so salesmen see the company's name there. Low-stakes, see D-V19-5 |
| G13 | Review step: totals, Save / Save & Add next / Save & print tags | Missing | V19-04a |
| G14 | Reuse / generate barcodes, reprint without stock, keep selections, no duplicate submit | All exist (`operationId`, labels page, Add next item) | — |
| G15 | Legacy items: don't assume Men / Women / Boys / Girls; *Needs classification* bucket | `ensureSections` **auto-sorts** every existing type (men's names → Man, rest → Woman) | Conflict — D-V19-2 (§7) |
| G16 | Category names in Hindi and English | Only the four defaults | `name_hi` nullable on `sections` (and `categories`) — V19-02 |
| G17 | Don't invent Men / Women type lists without checking or asking | `SUGGESTED_TYPES` invents 4 Men and 8 Women types; the comment says the owner chose them | Confirm in D-V19-2 |
| G18 | Company bill totals from reliable purchase lines, not latest cost | `company.ts` computes **purchase price × pieces from `products.cost_paise` today** | Conflict — V19-06 must add a cost snapshot per receipt line before these numbers are shown as bill amounts |

## 4. Conflicts with confirmed decisions (must be settled before coding)

| ADR / rule | What v19 changes | Proposed handling |
|---|---|---|
| **ADR-027** — owner chose For (Girls / Boys / Both) and Age (Adult / Child) tags as new fields; "don't change any logic" | Uncommitted v19 **removes the tag UI** (`TagChooser`, `DesignTagsForm`, `updateDesignTagsAction`); columns stay, `createDesign` still accepts them | Ask (D-V19-4). Recommended: sections replace the tags for new items; keep the columns; show a legacy tag read-only under *Other details* where set; never backfill sections from `for_gender` automatically |
| **ADR-015** — jeans by gender as two categories (Ladies Jeans `LJ`, Gents Jeans `GJ`) | Sections make *Women › Jeans* and *Men › Jeans* the natural model | No data change: `GJ` is sorted under Men and `LJ` under Women; the owner may rename them to "Jeans" (name unique per section, so allowed). SKUs keep their codes |
| **ADR-024** — design = same name, company, MRP | Brief asks for a stable identity; prices can differ by size, so one design can split into several cards today | Additive `products.design_id` (V19-05), backfilled from `listDesignVariants` logic (name + brand + category); `designKey` falls back for rows without one |
| **ADR-005 / 014** — one EAN-13 per piece, QR item link | Unchanged | Category code scheme changes only for **new** types (`BJ` style); existing codes untouched |
| **ADR-013** — prices follow size | Unchanged (wizard keeps `SizeRatesEditor`) | — |
| **ADR-032** — offline counter catalogue | Unchanged columns (`category` name snapshot stays) | Section never needs to reach the counter |
| **CLAUDE.md invariant 4** — cashiers never receive supplier figures | `brand` = company name by default (v17) is visible at the counter | Not a financial figure; D-V19-5 decides whether an empty brand stays empty |
| **Workflow rule** — plan before build, one task per session, record owner choices in the decision log | v19 code was written before this plan; choices live in code comments | This plan; ADRs only after the owner confirms §7 |
| **Data-safety rule** — never change live data from a read path | `ensureSections` inserts sections and **categories** during a page GET | Replace with an explicit, backed-up one-time backfill (migration 0011 or script) — V19-02a |

## 5. Proposed UX flows

### 5.1 New item (Add stock → New item)

**Owner clarification 2026-11-19 (after seeing v18 live; replaces the first draft of this flow):** the owner wants a start screen with two choices, the section and the type each on their own screen, the details *before* the sizes, and **size as the only variant** (no colour in the flow for now). Pieces are entered per size (2 × M, 2 × L, 5 × XL) or the sizes are "generated" from the type's size list; the owner can add a size that the list lacks. Each name × size becomes one SKU row (as today).

```
Step 0  Add new product        [One item]            [Many items / a bill]          (owner's two options)
Step 1  Who is it for?         [Men] [Women] [Boys] [Girls] [+ Add]           (one tap → next; the owner can add more later)
Step 2  What is it?            [Jeans 28–36] [Shirt M–XXL] [T-shirt] [Kurta] [+ Add]   (types of the chosen section only)
Step 3  Details                Name ________________        [photo]
                               Men › Jeans (tap to change)
                               Company ▾   Sale price (MRP) ₹___   Purchase ₹___ per piece
                               Tabs: Details (counter price, bill no., stock date) · Other (brand, notes)
Step 4  Sizes & pieces         Type's sizes first:  28 ▢  30 ▣ − 2 +  32 ▣ − 2 +  34 ▢  36 ▢
                               [All sizes] [+ Add size]      (a new size is saved on the type)
                               ───────── 2 sizes · 4 pieces · purchase ₹2,600 ──────── [Next ▸]  (sticky)
Step 5  Review                 Name · Men › Jeans · Company
                               30 × 2, 32 × 2 → 4 pieces · 2 items (one SKU per size)
                               MRP ₹999 · purchase ₹650 · purchase total ₹2,600
                               [Save & print tags]  [Save & add next]  [Save]
```

- *One item* = the same screens, but step 4 asks for one size and its pieces only (quick single entry). *Many items* = the full size grid and *Save & add next* for the next product of the same bill (**D-V19-6**, confirmed 2026-11-19, ADR-034).
- Default sizes per type come from `categories.sizes` (jeans 28 / 30 / 32 / 34 / 36, shirts M / L / XL / XXL, …); the owner edits them in Categories (02b) or adds one inline in step 4 (03d).
- One purchase price per piece for the whole product (all sizes), as today; a size's own price stays possible later on the product page (ADR-013).
- Colour: **no colour step in the wizard** (owner, 2026-11-19); new items store an empty colour (D-V19-3) and colour stays editable on the product page.
- Back arrow and crumb chips return to any step; **state is kept** (no retyping).
- After *Save & add next*: step 2 of the same section, same company / bill no. / stock date, fields empty, new `operationId` (Activity rule).
- After *Save & print tags*: labels page as today (reprint never touches stock).
- Hindi everywhere; big tiles ≥ 44 px; reduced motion = no slides; keyboard: tiles are buttons, tablist arrows.

### 5.2 Products (V19-05)

Chips row 1: **All · Men · Women · Boys · Girls · …**; row 2 (when a section is picked): **All · Jeans · Shirts · …**. Search box (name, SKU / barcode, company, type). Filters in the URL (`?section=&type=&q=&supplier=&stock=`). Default view: combined design cards grouped by `design_id`; `?show=items` for every SKU; `?show=hidden`. Card: photo, name, *Boys › Jeans*, sizes, pieces, MRP or range, stock badge. Selection v2 unchanged.

### 5.3 Product page (V19-05)

Top: name, photo, *Boys › Jeans*, company, sizes, MRP / selling, pieces in stock, created date; purchase price only with `costs`. Tabs **Overview · Sizes & colours · Sales · Purchases · Other**. Sales = rows from `sales` (+ approval status, offline mark, exchange / rejection link); Purchases = receipts (bill no., date, pieces, unit cost snapshot when available).

### 5.4 Companies (V19-06) and 5.5 Salesperson profiles (V19-07)

As the brief; detailed when their turn comes (§8 keeps their task IDs and prerequisites).

## 6. Architecture and database changes (smallest safe set)

### 6.1 Keep from the uncommitted work (migration **0010_sections**, already generated)

- `sections` (id, store_id, name, icon, sort, active, created_at), unique (store, name).
- `categories.section_id` → `sections.id` (nullable = **Needs sorting**).
- Unique (store, **section_id**, name) replaces unique (store, name). Note: Postgres treats NULLs as distinct, so two unsorted types with one name are only blocked by `assertFreeTypeName` — acceptable because the bucket is temporary.
- `stock_receipts.stock_date date` (nullable; the bill's date as given).

### 6.2 Add (migration **0011**, V19-02a)

- `sections.name_hi text` null, `categories.name_hi text` null — Hindi names; UI falls back to `name`.
- **Backfill, explicit and once**: insert the four sections with the names the owner picks (D-V19-1); set `name_hi`; sort existing categories only as the owner decides (D-V19-2); otherwise leave `section_id` null. **Remove the lazy `ensureSections()` from read paths.** Suggested type lists are inserted only if the owner approves them (D-V19-2), else the owner adds types from the wizard's **+ Add**.
- No change to `products` for product addition. Section is derived through `category_id → section_id`; moving a type under another section moves all its items (intended).

### 6.3 Validation (V19-02a)

- `createDesign`, `createProductsBatch` (Tag old stock), `createProduct`: the category must be **active and have an active section** — new items always have both levels. Legacy items keep `category_id` null / unsorted.
- `updateCategory`: a type with items may be renamed, re-sorted, hidden; never deleted (already true). `updateSection`: hiding a section hides it from New item; its types and items stay.
- Server-side permission checks stay: `catalog` for sections / types / sizes, `costs` for purchase price, store scoping on every query (already in place).

### 6.4 Later, additive

- V19-05: `products.design_id uuid` null (+ index) set by `insertNewProducts` per save and backfilled once; `products.notes text` null (optional "Other details").
- V19-06: `stock_movements.unit_cost_paise integer` null for `opening` / `stock_in` rows (the purchase price **at receipt time**), backfilled from `products.cost_paise` only with an explicit *estimated* flag, so bill amounts are never silently invented.
- Nothing for V19-07 (sales already carry `sold_by`, `recorded_by`, `cost_paise`, `offline_at`, approvals).

### 6.5 Money, stock, offline

Integer paise only (unchanged). All stock changes still go through `insertNewProducts` / `receiveStock` / `recordSale` and the movement ledger; no new mutation path. Counter catalogue, QR lookup, outbox and sync are untouched by sections.

## 7. Owner decisions needed (essential only)

| ID | Question | Options | Recommendation |
|---|---|---|---|
| **D-V19-1** | Names of the four starting sections | (a) Men / Women / Boys / Girls (brief) · (b) Man / Woman / Girl / Boy (current code) | (a); Hindi पुरुष / महिला / लड़के / लड़कियाँ |
| **D-V19-2** | Existing categories (live shop has 12 demo + real ones) | (a) **Needs sorting** bucket: the owner moves each type under a section once from Categories (2 minutes) · (b) auto-sort as the code does (men's names → Men, **everything else → Women**) · (c) auto-sort, then the owner fixes. Also: add the suggested starting types for Men (Shirt, T-shirt, Jeans, Kurta) and Women (Kurti, Saree, Lehenga, Dupatta, Leggings, Night Suit, Tops, Jeans)? | (a), and add starting types only for sections with no types |
| **D-V19-3** | Item without a colour | (a) store empty, show nothing on tags / counter / lists · (b) keep showing **Assorted** (today) | (a) for new items; existing *Assorted* rows untouched |
| **D-V19-4** | For / Age tags (ADR-027) now that sections exist | (a) retire the tag UI, keep the columns and show a legacy value read-only · (b) keep both | (a) |
| **D-V19-5** | Brand left empty | (a) stays empty (counter shows no brand) · (b) company's name as today | (a) |
| **D-V19-6** | The start screen's two choices, *One item* vs *Many items*: what does each mean? | (a) same steps; *One item* asks for one size + pieces, *Many* shows the full size grid and *Save & add next* for the next product of the bill · (b) *Many* = several different products on one screen (old Quick add table) | (a) — **confirmed by the owner 2026-11-19 (ADR-034)** |

Process approval needed too: **V19-00** (commit v18 alone, run 0009 on Neon, deploy v18, park v19 code on a branch) — see §8.

## 8. Roadmap and task IDs

Each task = one session, quality gate (`pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e --workers=3`), PROGRESS entry, no DONE without passing acceptance criteria.

### V19-00 Untangle the working tree (no new code) — **first, needs approval**
1. Commit v18 only (docs + code listed in the v0.8.0 PROGRESS entry; new files under `src/offline/`, `src/features/offline/`, `public/sw.js`, `api/ping`, `api/counter-catalogue`, `api/offline-sales`, migration 0009, `e2e/offline.spec.ts`, `modules/offline.ts`). Verify the committed tree alone passes the gate.
2. Back up Neon, run migration **0009**, deploy v18, live check `/api/ping` and an offline sale.
3. Move the v19 files (sections, wizard, company report, migration 0010, their doc / i18n / test changes) to branch `v19-sections`. `main` = live.
- **Acceptance:** `git status` clean on `main`; production shows the v18 header and the offline strip; `drizzle.__drizzle_migrations` on Neon ends at 0009.

### V19-01 Repository and database audit — **this document**
Remaining checks on real data before V19-02: count categories, products with `category_id null`, products with colour *Assorted*, usage of `LJ` / `GJ`, demo data (`Demo …`, `demo-%`). Read-only queries on Neon with the owner's OK.

### V19-02 Category foundation (data + owner tools)
- **02a** ✅ done 2026-11-19 (see PROGRESS). Schema + backfill in **one** migration `0010_sections` (`name_hi` included, no 0011); explicit `backfillSections` + script; no lazy set-up; `createDesign` / `createProductsBatch` / `createProduct` require an active section. Refinements agreed in code: a starter type is never added when the shop already has a category with that name (any spelling), so sorting an existing type never collides; codes keep the type's own letters when free (DU), else section + type (GJ). Unit tests: both levels required on all three paths; same type name under two sections; duplicate within a section refused; rename / hide keeps items; legacy items still restock / move. **Migration 0010 must reach Neon before the next deploy of `main`** (planned with the backfill at 04e, owner present).
- **02b** ✅ done 2026-11-19 (see PROGRESS). Categories screen: section **tiles on top** (picture, local name, count; `?s=` in the address), the chosen section's card (rename, Hindi name, picture tiles, **▲ / ▼**, *Shown in New item* = hide / bring back), its categories (Hindi name, code, sizes, counts, *Under* box), **Needs sorting** tile with *Move under… → Move*, *+ Add section*. `moveType` on the server. E2E desktop + phone (Hindi by `localName`, both dictionaries complete). Seed gained one unsorted category (*Dress Material*).
- **02c** ✅ done 2026-11-19: ADR-034 (clarified flow + D-V19-6), reference §29, user guide §4 *Categories* + owner checklist, project context, PROGRESS. No code change.
- **Acceptance:** owner can create the full Men / Women / Boys / Girls tree with the brief's example types and sizes without a developer; no product row changed by the migration (row count and checksums equal before / after).

### V19-03 Category-first New item UX
- **03a** ✅ done 2026-11-19 (see PROGRESS): new screen `/admin/stock/add` (hub tile *Add stock step by step*; the old form stays at `/admin/stock/new` until V19-04): start *One item / Many items* (D-V19-6), section → type → details → sizes & pieces → check and save (*Save & print tags*), names via `name_hi`, selection kept on back, progress bar + path chips, sticky Next, slide animation off under reduced motion, `aria-current`, 44 px targets. Server: pieces per size, stock date, empty colour / brand. Not yet: photo, 360 px / Hindi / dark browser tests (03e), review buttons (04a).
- **03b** Step 4 speed: pieces per size (2 × M, 2 × L, 5 × XL), *All sizes*, tap a number pad for pieces, *Same for all*, long-press − / + repeat; total pieces and purchase total always visible.
- **03c** No colour step in the wizard (owner, 2026-11-19); empty colour per D-V19-3 (`colourLabel()` helper used by tags, counter card, lists, approvals, CSV); brand per D-V19-5.
- **03d** Inline **+ Add** for section / type / size / company (a new size is saved on the type's size list): permission checks on the server (exist), error states, duplicate names.
- **03e** E2E: full flow at 360 × 780 and desktop, en + hi, light + dark; back navigation keeps input (desktop + Pixel 7 in English done in 03a).
- **Acceptance:** new item from a cold start in ≤ 12 taps + typing name and two prices; every string in both languages; no new dependency.

### V19-04 Saving, review and labels
- **04a** Review step (name, path, company, sizes × pieces, total pieces, MRP, purchase, purchase total) with **Save / Save & add next / Save & print tags**; purchase figures only with `costs`.
- **04b** After save: keep section, company, bill no., stock date; new `operationId`; Activity-safe reset; success toast with SKU range; failure keeps the form and explains.
- **04c** Tests: duplicate submit = one receipt (exists; extend to the wizard), repeated *Save & add next* never reuses an id, labels reprint changes no stock, tag never shows the company.
- **04d** Guide story *New item* updated; user guide §; reference.
- **04e** Release: backup, migrations 0010 + 0011 on Neon, deploy, live check with one real entry (owner present), rollback note.
- **Acceptance:** owner enters a real bill end to end on their phone and prints tags; Approvals, counter scan and offline lookup of the new item work.

### V19-05 Products list and product page
`products.design_id` (+ backfill), section / type chip filters with URL state, search, stock filters, combined cards by design id, product page tabs (Overview · Sizes & colours · Sales · Purchases · Other), bounded loading (page size 60 designs). Bulk actions, hide / restore, print unchanged.

### V19-06 Company bills and purchasing reports
`stock_movements.unit_cost_paise` snapshot (new receipts), estimated flag for old rows, bills by number + date, company list with bills / value / pieces / SKUs / last purchase, company page Overview · Bills · Products · Reports (daily / monthly / by section + type / custom dates). The uncommitted `company.ts` must be re-based on the snapshot; until then its amounts are labelled *estimated from today's purchase price*.

### V19-07 Salesperson profiles
Salesperson view (today / week / month / custom; approved vs waiting vs rejected vs saved-on-phone; by section / type; trends) and owner view (gross profit, loss deals, average price, discount vs MRP, on-behalf sales, comparison). *Cost unavailable* for hand entries. All totals through `saleApproved`.

### V19-08 Quality, performance, release readiness
Regression matrix (brief §10), real Android device run, 360 px audit, Lighthouse on `/pos` and `/admin/stock/new`, permission probes over HTTP, backup / restore rehearsal, PROGRESS sign-off.

**Dependencies:** V19-00 → 01 → 02 → 03 → 04 → 05 → (06, 07 in either order) → 08. 06 and 07 need no schema from 05.

## 9. Test cases (product addition)

| Area | Test |
|---|---|
| Categories | new item refused without section or type; same name under two sections allowed with different sizes; duplicate within a section refused (any case); rename / hide a type keeps its items, SKUs and tags; legacy item with `category_id null` still scans, sells, shows |
| Sizes / pieces | 3 sizes with 2 / 1 / 4 pieces → 3 rows, stock 2 / 1 / 4, receipt lines match; size's own MRP / purchase honoured for every colour; `price ≤ mrp` per size |
| Colour | none → one row per size, display rule per D-V19-3; two colours × two sizes → 4 rows, 4 barcodes, no merge |
| Idempotency | same `operationId` twice → one receipt, same products; *Save & add next* → new id; SKU / barcode race retried |
| Company | existing chosen; hidden one restored; `XYZ` vs `xyz` reused; new added inline needs `catalog` |
| Permissions | without `costs` the purchase field is absent and a posted cost is ignored; without `catalog` the wizard is refused server-side |
| Labels | tag shows no company; reprint changes no stock; 40 × 60, A4, sticker unchanged |
| Regression | counter scan + QR link resolve the new item; offline catalogue includes it; offline sale of it syncs once; Approvals shows it |
| Browser | 360 × 780 and desktop; en + hi; light + dark; back keeps input; keyboard through tiles and tabs |

## 10. Risks

- **Tangled working tree**: v18 and v19 mixed; a careless commit ships half-tested v19 to production. Mitigation: V19-00 first.
- **Lazy data creation on GET** (`ensureSections`) would insert categories in the live shop on the first visit after deploy. Mitigation: explicit backfill.
- **Auto-sorting everything else under Women** mislabels real categories (sarees fine; "Dress", "T-shirt" ambiguous). Mitigation: D-V19-2 (a).
- **Unique index change** on categories (0010): run on a backup first; Neon free tier has no PITR.
- **Colour sentinel change** touches tags, counter, exchange, approvals, CSV. Mitigation: one helper, e2e sweep, legacy rows untouched.
- **Company amounts from today's cost** would show wrong historic bills. Mitigation: label as estimated until V19-06.
- Activity (Next 16 keeps pages alive): every form that saves and navigates must reset itself — already a known rule.

## 11. Open questions (non-blocking)

- Should a *type* also carry a picture (today `TypeArt` guesses from the name)?
- Category code for new types: `BJ` style (section + type) vs type-only (`JE`); SKUs are internal, either works.
- Notes per item vs per design (notes on a design would be copied to every row today).
- Draft / resume of an unfinished entry (sensitive purchase prices in browser storage) — recommended later, not now.
- Products page page size and server pagination once the shop passes ~1,000 designs.

## 12. First implementation task after approval

**V19-00** (no product code): split, commit and deploy v18; branch the v19 code. Then **V19-02a** with this exact scope:

- Files: `drizzle/0011_*.sql` (+ meta), `src/db/schema/index.ts` (`name_hi` ×2), `src/server/services/sections.ts` (remove lazy `ensureSections`; add `backfillSections(db, storeId, { names, sortRule, addStarterTypes })` used by a one-off script `scripts/backfill-sections.ts`), `src/server/services/products.ts` (`resolveCategory` requires an active section for new items), `src/lib/sections.ts` (names per D-V19-1), tests in `sections.test.ts` and `products.test.ts`.
- Not in scope: any screen change, Products page, company report.
- Acceptance: unit tests listed in §9 "Categories" pass; migration applies on an empty PGlite and on a Neon backup copy; zero `products` rows modified.
