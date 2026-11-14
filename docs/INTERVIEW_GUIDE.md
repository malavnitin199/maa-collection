# Maa Collection — Project Explanation Guide

A guide for explaining this project in an interview or to a tester. Each section has a short "say it like this" version you can speak aloud, followed by the detail behind it.

---

## 1. The project in one minute

**Say it like this:**
"Maa Collection is a mobile-first inventory and point-of-sale web app for a clothing shop. Staff log in with their name and a PIN. A salesperson scans an item's barcode with the phone camera or a USB scanner, enters the price the customer bargained for, and the sale is recorded on the server — credited to themselves or to a colleague. Exchanges are handled too. The admin adds products and the app generates SKUs and printable barcodes, receives stock, manages staff and sees a live dashboard. It's built with Next.js 16, React 19, TypeScript and PostgreSQL, with business rules tested against a real Postgres engine. It's live on Vercel with a Neon database."

**The problem it solves:** Small clothing shops track stock on paper or in Excel. They don't know live stock per size and colour, can't tell which salesperson sold what, and prices vary per customer because of bargaining. This app gives one shared, accurate stock count, a per-sale price record and per-salesperson reporting, from any phone.

---

## 2. Users and roles

| Role | What they do | Screens |
|---|---|---|
| **Admin / Owner** | Add products (SKU + barcode generated), print labels, receive stock, edit prices and cost, manage staff and PINs, see shop dashboard and activity, plus everything a salesman can do | `/admin/dashboard`, `/admin/products`, `/admin/staff`, `/admin/activity`, `/admin/labels` |
| **Salesman** | Scan and sell (optionally credited to a colleague), process exchanges, see own sales today / this month | `/pos`, `/pos/exchange`, `/pos/my-sales` |

Key rule: **the salesman never receives cost price or profit.** The server builds a separate "counter" view of a product without the cost field, and a test checks it. Hiding a field in the UI is not security.

---

## 3. Technology stack and why

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | One codebase for UI and trusted server code; server components for data pages, client components for the live scan screens; server actions for mutations |
| Language | **TypeScript (strict)** | Catches money/stock bugs at compile time |
| Database | **PostgreSQL** — Neon in production, **PGlite** locally | Transactions and constraints for stock and money; PGlite is a real Postgres engine in WASM, so dev and tests need no install |
| ORM | **Drizzle** + drizzle-kit migrations | Typed SQL close to the metal; SQL migration files committed to the repo |
| Validation | **Zod** | Every server action validates its input |
| Auth | Name + PIN (scrypt), HMAC-signed session cookie | Fast on a phone at the counter; role checks on the server |
| Scanning | Browser `BarcodeDetector` (Android) / **zxing** (iPhone) + keyboard-wedge scanners | Works with camera and cheap USB/Bluetooth scanners |
| Styling | **Tailwind CSS 4** | Mobile-first utilities, dark mode |
| Tests | **Vitest** (unit + services on PGlite), **Playwright** (end-to-end) | Fast, real-database tests; real browser flows |
| Hosting | **Vercel** (Singapore) + **Neon** (Singapore) | Low latency for India; HTTPS needed for the phone camera |

---

## 4. Architecture and project structure

```
Browser (phone / laptop)
  └─ Pages (server components) + client screens
        └─ Server actions   src/server/actions/    who is logged in? which role? validate input
              └─ Services    src/server/services/   ALL money & stock rules, DB transactions
                    └─ Drizzle ─▶ Neon Postgres  |  PGlite (local, tests)
```

```
src/app/            Routes: (auth)/login, (pos)/pos/…, (admin)/admin/…
src/proxy.ts        Route guard (logged out → login; salesman can't open /admin)
src/features/       Screens: pos/, catalog/, reports/, scanning/, auth/
src/server/         actions/, services/ (+ tests), security/ (PIN, session), auth.ts
src/db/             Drizzle schema, client (Neon or PGlite), seed
drizzle/            SQL migrations
e2e/                Playwright tests
```

**Say it like this:** "Routes and screens are thin. Every rule that touches money or stock lives in one service layer on the server, inside database transactions, and that layer is what the tests target."

---

## 5. The core flows

### Sale

```
Scan barcode (camera / USB scanner / typed)
  → server looks up product by barcode or SKU → counter view (no cost)
  → not found → "No item found"
Salesman: quantity, bargained price (prefilled with selling price, max MRP), credit sale to (me / colleague)
  → server, in ONE transaction:
      price ≤ MRP? stock ≥ qty?  →  stock − qty (guarded UPDATE)  →  stock movement row  →  sale row
      (sale stores sold_by = credited person, recorded_by = logged-in person, MRP + cost snapshots)
  → "Sold 2 × Kurta @ ₹1,100 — credited to Vishal (recorded by Nitin). Stock left: 3."
```

### Exchange

```
Scan the returned item → recent sales of it that still have returnable units → choose one
Scan the new item → price → summary: "Customer pays ₹200" / "Give back ₹X"
  → server, in ONE transaction: lock original sale, check units not already returned,
     returned stock +qty, new item stock −qty (guarded), exchange row linked to the original sale
```

The returned item is valued at **the price the customer actually paid**, not today's MRP. The original sale is never edited.

### Product creation (admin)

Name, brand, category, size, colour, MRP, selling price, optional cost, opening stock → SKU `MAA-KU-003` and barcode `200…` generated → printable label.

**Why `200` barcodes:** GS1 reserves the 20–29 prefix for a shop's own in-store codes, so a generated barcode can never collide with a manufacturer's EAN-13. Manufacturer barcodes can still be entered as-is.

---

## 6. Design decisions worth explaining

1. **Money is integer paise, never floats.** ₹499 is `49900`. Rupees exist only at the display edge.
2. **Append-only ledger.** Sales, exchanges and stock movements are never edited or deleted; corrections are new linked records. `products.stock` is a running total updated in the same transaction, with a database check that it can't go below zero.
3. **Idempotency.** Each sale/exchange carries a client-generated `operation_id` with a unique constraint. A retried tap returns the original sale instead of selling twice.
4. **No overselling.** `UPDATE … SET stock = stock − n WHERE stock ≥ n` — if two phones sell the last piece, one succeeds and the other gets "Out of stock".
5. **Snapshots.** Each sale stores MRP and cost at that moment, so later price edits never rewrite past revenue or profit.
6. **Sale on behalf of.** Two columns — `sold_by` (credit) and `recorded_by` (who typed it) — so commission and accountability both work.
7. **Shop time zone.** "Today" and "this month" are computed in `Asia/Kolkata` in SQL, not in the server's UTC. A test checks a sale at 00:30 IST counts as today.
8. **`store_id` everywhere.** Ready for many shops later; the cheapest time to add tenancy is at the start.
9. **No database install for developers.** PGlite runs real Postgres in-process; `pnpm dev` creates and seeds it automatically.

---

## 7. Testing strategy

| Level | Tool | What is covered | Count |
|---|---|---|---|
| Services | Vitest on PGlite (fresh DB per test) | SKU/barcode generation, manufacturer barcode checks, stock-in, sale deduction, retry never double-sells, oversell refused, price ≤ MRP, on-behalf columns, exchanges (stock, price paid, limits, retry, rollback), IST day boundary, profit, last-admin protection | 14 |
| Unit | Vitest | Session tokens (tamper, expiry), PIN hashing, paise, EAN-13 drawing/check digits, scanner keystroke detection, sale validation | 34 |
| End-to-end | Playwright | Login + role guards; admin adds product + receives stock; salesman sells it credited to a colleague; my-sales; MRP and unknown-code errors; full exchange with stock checks; admin pages | 5 |
| Static | TypeScript strict, ESLint | every run | — |

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

**Say it like this:** "The service tests run against a real Postgres engine, not mocks, so they catch real constraint and transaction behaviour — like a failed exchange leaving stock untouched."

---

## 8. Problems I hit and how I solved them

1. **Demo barcodes could never be scanned.** All 8 demo EAN-13s had wrong check digits. I added a check-digit validator and a test that guards every barcode in the catalog.
2. **Hardware scans got lost.** The scan box wasn't focused after page load (focus ran while the input was still disabled before hydration), and a scan while a button had focus "pressed" that button. Fix: focus after hydration, plus a keystroke-burst detector that catches scanner input anywhere on the page.
3. **iPhone camera barely read barcodes.** In `@zxing/browser` 0.2.1 the "try harder" rotation rotates pixels but keeps the old width/height, so it decodes garbage. I wrote our own frame loop: full frame, the guide-box band zoomed 2×, and a correctly rotated frame. Hard-image benchmark: 3/6 → 5/6.
4. **Production secrets in the dev env file.** The Neon integration wrote the production URL into `.env.local`, which `pnpm dev` and the tests load — they would have written test data into the live shop. Moved to a separate git-ignored file used only for migrations.
5. **Next.js 16 prerender check.** Reading the clock (session expiry, DB driver) during prerender triggers an error; fixed by marking data pages request-time (`connection()`) before any data or clock access.
6. **Vercel install failed.** pnpm 12 refuses unapproved package build scripts in CI; esbuild's script was explicitly declined (its prebuilt binary is enough).

---

## 9. What is next (roadmap)

| Next | Work |
|---|---|
| Receipts & tax | GST per item by price slab, receipt numbering, payment method (cash / UPI) |
| Returns | Refund-only returns, exchange time limit (owner decision pending) |
| Stock-in safety | Retry protection on stock receiving |
| Operations | Day-close cash count, accountant export, CI with branch protection |
| Offline | Queue sales in IndexedDB, sync with explicit conflict review |

---

## 10. Likely interview questions

**Q: Why Next.js instead of plain React + a separate API?**
One deployable app where money and stock code runs only on the server (server actions + services), while scan screens stay fast client components.

**Q: How do you stop a salesman from seeing cost price?**
The server returns a counter-specific DTO without the cost field; the admin-only pages run admin checks on the server. A unit test asserts the counter DTO has no cost key.

**Q: What if two salesmen sell the last piece at the same time?**
The stock update is a guarded single statement inside a transaction; only one succeeds. The other gets "Out of stock" and nothing is written for it.

**Q: What if the network drops right after "Record sale"?**
The client reuses the same `operation_id` on retry; the unique constraint means the second request returns the first sale.

**Q: Why PIN login instead of email/password?**
Staff share a counter phone and need a 3-second login. PINs are scrypt-hashed, sessions are signed and short-lived, and every action re-checks the role. Full accounts (Better Auth) can come with multi-shop.

**Q: How would this support many retailers?**
`store_id` is on every table and every query already filters by it; next steps are a stores/membership model and per-store settings.

---

## 11. Quick demo script (3 minutes)

Local (`pnpm dev`, every PIN `1234`) or live (owner's PINs).

1. Log in as **Owner** → **Products → + Add product** → fill details → show the generated SKU, `200…` barcode and label.
2. **Receive stock** +5 on that product.
3. Open the label on the laptop. On a phone, log in as **Nitin** → **Scan with camera** → scan it → sell 2 at a bargained price, **credit sale to Vishal**.
4. **Exchange** → scan the item → choose the sale → scan another size → "Customer pays ₹…" → confirm.
5. **My sales** (Nitin): sales recorded for others. Back on the laptop, **Dashboard**: today's revenue and Vishal's row; **Activity**: credited to Vishal, recorded by Nitin.
6. Try a price above MRP → refused. Try opening `/admin/dashboard` as Nitin → sent back to the counter.
7. Run `pnpm test && pnpm test:e2e` to show the automated checks.
