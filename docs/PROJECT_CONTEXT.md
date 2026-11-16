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

## Current status (2026-11-17, live through plan v16 — v0.6.0)

Live: https://maa-collection-pi.vercel.app · Code: https://github.com/malavnitin199/maa-collection · Deployed with the Vercel CLI (repo not Git-connected).

**Who uses it and how they get in**
- Staff log in by tapping their **name circle** and entering a 4–6 digit **PIN** on a number keypad. Roles: owner (admin) and salesman; the owner grants extra **rights** per person: Catalog (catalog / QC person), Prices, Stock, Purchase price (`costs`). Without `costs`, purchase prices are never sent to that person.
- Production PINs are set by the owner (never written in the repo; reset on 2026-11-16 at the owner's request; each person can be given their own PIN in More → Staff).

**Selling (every salesman)**
- Scan with the phone camera, a USB/Bluetooth scanner, or type the code; a tag's **QR** opens the item straight at the counter (`/i/<barcode>`).
- One item per sale, no cart: quantity + the **bargained price** (≤ MRP), credited to yourself or a colleague (`sold_by` + `recorded_by`). Exchanges, "My sales" (today / month).
- Payment-app style feedback: green tick + "ting", shake + buzz on a failed scan, "Sale done" card + chime; mute per phone.
- **Tag won't scan? Enter by hand** (plan v12): item name as the salesman calls it, optional size, quantity, price paid; no stock change, no MRP cap. **Every salesman entry waits for the owner** ("Waiting" in My sales; counts once approved); the owner's own entries count at once.

**Stock and tags (catalog / stock people)**
- Companies (suppliers), categories with SKU codes and **size lists** (shirts S–XXL, kurtas M–XXL, Ladies Jeans 26–32, Gents Jeans 28–36; owner-editable).
- Add stock: **Quick add** (many products, one company + category), **New design** in sizes × colours with **prices by size** (MRP / selling / purchase per size, same for all colours), **Restock** by scanning, **Tag old stock** one piece at a time with photos, with **✎ Edit this item** right after saving (same barcode; prices fixable by the creator until the first sale). Optional photo per colour / per product while creating tags.
- Tags: **40 × 60 mm QR hang tags** (QR, name, ART. = SKU + secret code price, every size of the category with tick boxes, EAN-13, MRP); A4 (16 per page), tag printer, or 50 × 25 mm sticker.
- **Combined view** (plan v14, default on Products and All tags): items with the same name, company and MRP are one card (photos, sizes and colours with pieces, design QR); *Show N items / tags* or *Every item / Every tag* for the separate ones. Printed tags stay one per piece.
- **All tags** (`/admin/labels`, plan v13): every tag grouped by **date made, company, category or delivery**, with filters (search, company, category, made by, when made, in stock), **Grid** or sideways **Rows** (remembered per phone), **Print this group** / **Print these tags**; tap a tag to open its item.

**Owner**
- **Fresh start on 2026-11-16**: all test products, stock history and sales were removed from the live database at the owner's request (backup kept on the owner's Mac); staff, categories and companies were kept. Real stock entry starts from an empty shop.
- **Demo data in the live shop (2026-11-16, owner request)**: 62 demo items in 12 categories from 4 "Demo …" companies and 40 demo sales (7 waiting in Approvals) so All tags and the reports can be tried. They count in Home / Reports until removed; remove them (backup first, one-off script, see `docs/PROGRESS.md`) before real stock entry, and don't print demo tags.
- **Clear stock** (More / Settings, owner's PIN): sets every item's pieces to 0 and records it in each item's history; nothing is deleted.
- **Approvals** (`/admin/approvals`, Home tile with the waiting count): every salesman sale / exchange by day; Approve one, a day or everything; Reject with a reason (pieces go back into stock through a new movement; an exchange is undone). Only approved entries count anywhere; hand-entered sales carry a **By hand** mark.
- Home dashboard (today / month, profit, exchanges, low stock, activity), reports + CSV export, **sales team dashboard** (`/admin/team`: sellers, share, daily sales per seller), activity log, staff and rights, settings (code price).

**Language, look, learning**
- **Hindi + English** on every screen, chosen per person (`staff.language`).
- **Clean header** (plan v15): one slim row of round symbols — ☀/☾ colours and day/night, sound, अ/A language, Guide, log out. Small pictures (a swinging hang tag on Sell and login, a tick when Approvals is empty), tiles that rise in, a counter card that leads with the price, size/colour and stock; Home shows the first 6 low-stock items and the latest 6 entries.
- **Bahi theme** (plan v16, default): a clean billing-app look (indigo + orange, light grey page, Poppins, a plain line instead of the zari strip), inspired by myBillBook; the owner is testing it and will give feedback.
- **Five dye themes** (Peacock, Marigold, Rani, Neel, Mehendi) and **Day / Night / Same as phone**, chosen per phone. Shop-made design: zari border, hang-tag action tiles, floating dock with a round Sell button.
- `/guide`: 16 **short story lessons** by role, in both languages — one step at a time with an animated phone scene, at most 7 words on screen, and the **phone's own voice** saying a fuller line and moving on by itself; a **practice sale** that saves nothing; `/help`: quick reference and problems & fixes; `docs/USER_GUIDE.md`.

**Not built yet**: GST / receipts, payments, refunds, day-close / cash drawer, offline billing, **per-item stock correction** (lowering one item's wrong count; D-ST-2 — only the whole-shop Clear stock exists), **exchange without a bill** (D-EX-2: the schema allows it, no screen), photos on Vercel Blob (D-IMG-1).

**Stack actually in use**: Next.js 16.4.6 (App Router, Cache Components), React 19, TypeScript strict, Tailwind CSS 4, Drizzle ORM on Neon Postgres (PGlite locally and in tests), Zod, Vitest, Playwright (desktop + phone). Not used (yet): shadcn/ui, Better Auth, TanStack Query, Zustand, Dexie. Never put the Neon URL in `.env.local` (it lives in `.env.neon` for migrations only).

**Where the details are**
- Plans, one per owner request: `docs/PLAN_V2_SHOP_OPERATIONS.md` … `docs/PLAN_V16_BAHI_THEME.md`, `docs/PLAN_SIZE_PRICES.md`.
- Decisions: `docs/DECISION_LOG.md` (ADR-001…026); open questions: `docs/DECISIONS.md`.
- The original starter pack (2026-11-14), what it planned and what changed: `docs/STARTER_PACK_HISTORY.md`; the untouched originals: `docs/archive/starter-pack-2026-11-14/`.
- How it works (developers): `docs/TECHNICAL_REFERENCE.md`; how to use it (shop): `docs/USER_GUIDE.md`; what was done and verified: `docs/PROGRESS.md`; agent rules + status: `CLAUDE.md`.
