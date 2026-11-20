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

## Current status (2026-11-19, live through plan v18 — v0.8.0)

Live: https://maa-collection-pi.vercel.app · Code: https://github.com/malavnitin199/maa-collection · Deployed with the Vercel CLI (repo not Git-connected).

**Who uses it and how they get in**
- Staff log in by tapping their **name circle** and entering a 4–6 digit **PIN** on a number keypad. Roles: owner (admin) and salesman; the owner grants extra **rights** per person: Catalog (catalog / QC person), Prices, Stock, Purchase price (`costs`). Without `costs`, purchase prices are never sent to that person.
- Production PINs are set by the owner (never written in the repo; reset on 2026-11-16 at the owner's request; each person can be given their own PIN in More → Staff).

**Selling (every salesman)**
- Scan with the phone camera, a USB/Bluetooth scanner, or type the code; a tag's **QR** opens the item straight at the counter (`/i/<barcode>`).
- One item per sale, no cart: quantity + the **bargained price** (≤ MRP), credited to yourself or a colleague (`sold_by` + `recorded_by`). Exchanges, "My sales" (today / month).
- Payment-app style feedback: green tick + "ting", shake + buzz on a failed scan, "Sale done" card + chime; mute per phone.
- **Tag won't scan? Enter by hand** (plan v12): item name as the salesman calls it, optional size, quantity, price paid; no stock change, no MRP cap. **Every salesman entry waits for the owner** ("Waiting" in My sales; counts once approved); the owner's own entries count at once.
- **No internet? Keep selling** (plan v18, ADR-032): an amber strip says so; scanning (scanner, camera, a tag's QR link) uses **this phone's copy** of the items (no purchase prices), and each sale — scanned or by hand — is **saved on the phone** and sent by itself when internet is back (tap the strip to see them, or **Send now**). The counter opens without internet once it was opened online on that phone (offline helper). Offline sales are always recorded, **even if the stock goes below zero** (owner's choice); the owner sees a **Made offline** mark in Approvals. Exchanges need internet. Logging out with unsent sales warns (they wait for that person's next login).

**Stock and tags (catalog / stock people)**
- **Product page clean-up (2026-11-20, ADR-037):** figures on top for a period (in stock, sold — approved only, came in, profit, last sale, last arrival; `productReport`), one row with company + prices + Print label / Restock, tabs Details · Colours · Sales · Purchases · Other details.
- **Typing in Hindi or English, voice, fresh forms (2026-11-20, ADR-036):** every box for words has अ / A (the phone's typing script; English letters → Devanagari word by word, offline, `src/lib/transliterate.ts`), ⇄ (change what is typed either way) and a microphone (browser speech, hi-IN / en-IN). New item, the old form and Tag old stock start fresh on return and have a *Start again* chip.
- **Company accounts (2026-11-20, ADR-035):** a company's page shows bills (open / paid), purchases, **dues now**, pieces, collections and the last bill for a period, with tabs Bills · Payments · Products · By type · Details; payments (*Record a payment*, *Mark paid*) are append-only `supplier_payments`; bill amounts come from the purchase price on the day of arrival (`stock_movements.unit_cost_paise`, older deliveries estimated); companies have a **location**. Amounts only with the *costs* right.
- Companies (suppliers), categories with SKU codes and **size lists** (shirts S–XXL, kurtas M–XXL, Ladies Jeans 26–32, Gents Jeans 28–36; owner-editable).
- **Sections (plan v19, ADR-033/034, live since 2026-11-20):** every category sits under **Men / Women / Boys / Girls** (or a section the owner adds); Categories shows the sections as tiles (Hindi name, picture, order, hide) with a *Needs sorting* tile for the shop's old categories (*Move under*). New items need both levels (server-checked). The guided New item flow (start choice *One item / Many items* → who is it for → what is it → details → sizes & pieces → review; size-only variants) is V19-03/04. Migration 0010 ran on Neon on 2026-11-20 (V19-04e); the owner creates the four sections with the one-time *Set up* button on Categories, then sorts the old categories.
- Add stock (plan v17): one main way, **New item** — a minimal screen: header with product name, category, size pills and **For (Girls / Boys / Both) / Age (Adult / Child)** tags, photo square on the right; must-haves company, **sale price (MRP)** and **purchase price**; top tabs **Details** (pieces, counter price, bill) · **Colours** (sizes × colours grid with pieces, **prices by size**, a photo per colour) · **Other details** (brand, later fields). Nothing picked = one item (Free / Assorted). After saving, **+ Add next item** keeps company and category. The **product page** uses the same layout (tabs Details · Colours · Other details). Other ways: **More pieces of an existing item** (restock by scanning) and **Tag old stock** one piece at a time with photos, with **✎ Edit this item** right after saving (same barcode; prices fixable by the creator until the first sale). Optional main photo and photo per colour while creating tags.
- Tags: **40 × 60 mm QR hang tags** (QR, name, ART. = SKU + secret code price, every size of the category with tick boxes, EAN-13, MRP); A4 (16 per page), tag printer, or 50 × 25 mm sticker.
- **Combined view** (plan v14, default on Products and All tags): items with the same name, company and MRP are one card (photos, sizes and colours with pieces, design QR); *Show N items / tags* or *Every item / Every tag* for the separate ones. Printed tags stay one per piece.
- **All tags** (`/admin/labels`, plan v13): every tag grouped by **date made, company, category or delivery**, with filters (search, company, category, made by, when made, in stock), **Grid** or sideways **Rows** (remembered per phone), **Print this group** / **Print these tags**; tap a tag to open its item.

**Owner**
- **Fresh start on 2026-11-16**: all test products, stock history and sales were removed from the live database at the owner's request (backup kept on the owner's Mac); staff, categories and companies were kept. Real stock entry starts from an empty shop.
- **Demo data in the live shop (2026-11-16, owner request)**: 62 demo items in 12 categories from 4 "Demo …" companies and 40 demo sales (7 waiting in Approvals) so All tags and the reports can be tried. They count in Home / Reports until removed; remove them (backup first, one-off script, see `docs/PROGRESS.md`) before real stock entry, and don't print demo tags.
- **Clear stock** (More / Settings, owner's PIN): sets every item's pieces to 0 and records it in each item's history; nothing is deleted.
- **Approvals** (`/admin/approvals`, Home tile with the waiting count): every salesman sale / exchange by day; Approve one, a day or everything; Reject with a reason (pieces go back into stock through a new movement; an exchange is undone). Only approved entries count anywhere; hand-entered sales carry a **By hand** mark.
- **Home** (plan v17, essentials only): New stock, Suppliers, Reports, Approvals (with the waiting count) and **today's sales**; the month, profit, exchanges and sellers are in **Reports** / **Team**. Reports + CSV export, **sales team dashboard** (`/admin/team`: sellers, share, daily sales per seller), activity log, staff and rights, settings (code price).

**Language, look, learning**
- **Hindi + English** on every screen, chosen per person (`staff.language`).
- **Header** (plans v17–v18): MC badge, the shop's full name and who is logged in, then just अ / A and a ⋯ menu (colours, day / night, sound, Guide, log out); made **taller and bigger** in v18, with the offline strip under it when needed. Small pictures (a swinging hang tag on Sell and login, a tick when Approvals is empty, a kurta on a hanger in the New item photo box), tiles that rise in, a counter card that leads with the price, size/colour and stock.
- **Bahi theme** (plan v16, default): a clean billing-app look (indigo + orange, light grey page, Poppins, a plain line instead of the zari strip), inspired by myBillBook; the owner is testing it and will give feedback.
- **Dye themes** (Peacock, Marigold, Rani, Neel, Mehendi; since 2026-11-19 also Sindoor, Jamun, Aasmani; Bahi is the default) and **Day / Night / Same as phone**, chosen per phone. Shop-made design: zari border, hang-tag action tiles, floating dock with a round Sell button.
- `/guide`: 17 **short story lessons** by role, in both languages — one step at a time with an animated phone scene, at most 7 words on screen, and the **phone's own voice** saying a fuller line and moving on by itself; a **practice sale** that saves nothing; `/help`: quick reference and problems & fixes; `docs/USER_GUIDE.md`.

**Not built yet**: GST / receipts, payments, refunds, day-close / cash drawer, offline exchanges, sending saved sales while the app is closed, **per-item stock correction** (lowering one item's wrong count; D-ST-2 — only the whole-shop Clear stock exists), **exchange without a bill** (D-EX-2: the schema allows it, no screen), photos on Vercel Blob (D-IMG-1).

**Stack actually in use**: Next.js 16.4.6 (App Router, Cache Components), React 19, TypeScript strict, Tailwind CSS 4, Drizzle ORM on Neon Postgres (PGlite locally and in tests), Zod, Vitest, Playwright (desktop + phone). Not used (yet): shadcn/ui, Better Auth, TanStack Query, Zustand, Dexie. Never put the Neon URL in `.env.local` (it lives in `.env.neon` for migrations only).

**Where the details are**
- Plans, one per owner request: `docs/PLAN_V2_SHOP_OPERATIONS.md` … `docs/PLAN_V18_OFFLINE_COUNTER.md`, `docs/PLAN_SIZE_PRICES.md`.
- Decisions: `docs/DECISION_LOG.md` (ADR-001…032); open questions: `docs/DECISIONS.md`.
- The original starter pack (2026-11-14), what it planned and what changed: `docs/STARTER_PACK_HISTORY.md`; the untouched originals: `docs/archive/starter-pack-2026-11-14/`.
- How it works (developers): `docs/TECHNICAL_REFERENCE.md`; how to use it (shop): `docs/USER_GUIDE.md`; what was done and verified: `docs/PROGRESS.md`; agent rules + status: `CLAUDE.md`.
