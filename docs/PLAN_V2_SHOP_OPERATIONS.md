# Plan v2: shared database, admin console, salesman dashboard, exchanges

Status: **approved by owner 2026-11-15, being implemented** · Author: engineering · Replaces the browser-only demo store.

## 1. Goals

| # | Goal | Who |
|---|---|---|
| G1 | One shared catalog, stock and sales for every phone and laptop | Everyone |
| G2 | Admin adds products (name, brand, category, size, colour, MRP, selling price, cost) and the app **generates the SKU and barcode**; labels can be printed | Admin |
| G3 | Admin receives stock (stock-in) and sees the shop dashboard: today / this month revenue, units, profit, per-salesperson totals, low stock | Admin |
| G4 | Admin manages staff (add, set PIN, deactivate) | Admin |
| G5 | Salesman sells by scanning, and may **credit a sale to another salesperson** | Salesman, Admin |
| G6 | Salesman sees **their own** dashboard: today's and this month's sales | Salesman |
| G7 | **Exchanges**: customer returns an item from an earlier sale and takes another; stock and money stay correct, and we record who processed it and who it is credited to | Salesman, Admin |

Out of scope for v2 (later phases): GST and receipts, payments (cash/UPI split), day-close, offline billing, CSV bulk import, refunds without a replacement item.

## 2. Roles and permissions

Staff log in by choosing their name and entering a **4–6 digit PIN** (fast on a phone at the counter). The server checks every action. Hiding a button is never the only protection.

| Action | Admin | Salesman |
|---|:-:|:-:|
| Scan, see item details and stock, record a sale | ✅ | ✅ |
| Credit a sale to another salesperson ("sale on behalf of") | ✅ | ✅ |
| Process an exchange | ✅ | ✅ |
| See own dashboard (today / month) | ✅ | ✅ |
| See shop-wide dashboard, all salespeople, profit | ✅ | ❌ |
| Add / edit products, generate barcodes, print labels | ✅ | ❌ |
| Stock-in (receive new stock) | ✅ | ❌ |
| See **cost price** and profit | ✅ | ❌, never sent to salesman screens |
| Manage staff and PINs | ✅ | ❌ |

Initial staff (owner's list): **Vishal, Nitin, Pradeep, Balram** as salesmen, plus one **Owner** admin account. The admin can add more people (the owner mentioned six) and rename or deactivate anyone. PINs are generated once and handed to the owner; they are never stored in the code or the repository.

## 3. Screens and flows

### 3.1 Login

```
/login
┌──────────────────────────────┐
│ Who are you?                 │
│ [Vishal] [Nitin] [Pradeep]   │
│ [Balram] [Owner]             │
│ PIN: [••••]   [Log in]       │
└──────────────────────────────┘
  admin → /admin/dashboard     salesman → /pos
```

### 3.2 Counter sale (existing flow, now server-backed)

```
/pos
Scan / type code ─▶ item card (SKU, barcode, brand, size, colour, MRP, stock)
                    └─▶ Sell: quantity · price (prefilled with selling price, ≤ MRP)
                              Credit sale to: [me ▾ / Vishal / Pradeep / …]
                              [Record sale] ─▶ "Sold 2 × Kurta @ ₹1,100 — credited to Vishal (recorded by Nitin)"
```

The server, in one database transaction: checks stock ≥ quantity and price ≤ MRP, takes the stock off, appends a stock movement, and records the sale with `sold_by` (credited) and `recorded_by` (logged-in user). A retried tap can never sell twice, because each submission carries a unique `operation_id`.

### 3.3 Exchange

```
/pos/exchange
1. Find the original sale
   Scan the item the customer brought back ─▶ list of recent sales of that item
   (date, qty, price, salesperson) ─▶ pick one
2. How many are returned?  [1]  (≤ sold − already returned)
3. Scan the new item ─▶ quantity · price (≤ MRP)
4. Summary
   Returned: 1 × Anarkali Kurta M @ ₹1,100 (price originally paid)  = ₹1,100
   New:      1 × Anarkali Kurta L @ ₹1,200                         = ₹1,200
   Customer pays ₹100            (or: Give back ₹X to customer)
   Credit to: [original seller ▾]   Processed by: Nitin
   [Confirm exchange]
```

Rules:
- The returned item is valued at the **price the customer actually paid** in the original sale, not today's MRP.
- Returned stock goes back on the shelf (+qty); the new item's stock goes down (−qty). Both are stock movements, all in one transaction.
- The original sale is **never edited** (append-only). The exchange is its own record linked to it.
- Revenue effect = new total − returned value (it can be negative when the customer gets money back).
- **Open policy (D-EX-1):** whether money may be given back, and any time limit on exchanges. Until the owner decides, the app allows both directions and records the difference; no time limit is enforced.

### 3.4 Salesman dashboard

```
/pos/my-sales
Today            This month
₹4,350 · 6 pcs   ₹62,100 · 81 pcs
Credited to me (incl. exchanges)  ·  Recorded by me for others
Recent: time · item · qty · price · credited to · recorded by
```

### 3.5 Admin console

```
/admin/dashboard  Today / This month: revenue · units · est. profit · exchanges
                  Sales by salesperson (today, month) · Low-stock items · Stock value at MRP
/admin/products   List (search) · [Add product]
   Add: name · brand · category · size · colour · MRP · selling price · cost (optional)
        · opening stock · barcode: (•) generate  ( ) use the manufacturer's barcode
        ─▶ SKU (e.g. MAA-KU-003) + EAN-13 barcode generated ─▶ label preview / print
/admin/products/[id]  Edit details and prices · Stock-in (+qty) · Label · Movement history
/admin/labels     Printable sheet of every product's barcode
/admin/staff      List · Add (name, role, PIN) · Reset PIN · Deactivate
/admin/activity   All sales and exchanges (who sold, who recorded, credited to)
```

## 4. Barcode and SKU generation

- **Generated barcodes** use the GS1 *in-store* prefix `2` (range 20–29 is reserved for a shop's own use), so they can never clash with a real manufacturer barcode: `2` + `00` + 9-digit running number + check digit, for example `2000000000015`.
- **Manufacturer barcodes**: the admin may type or scan the EAN-13 already on the tag instead (domain invariant 7). It must be a valid EAN-13 and unique in the shop.
- **SKU**: `MAA-<first two letters of category>-<3-digit running number>`, for example `MAA-KU-003`, unique per shop.
- The label shows name, size, colour, MRP and the barcode, drawn by `ean13Svg` (already tested by camera).

## 5. Data model (PostgreSQL)

All tables carry `store_id`, so more shops can be added later. Money is integer **paise**.

| Table | Key columns |
|---|---|
| `stores` | id, name, timezone (`Asia/Kolkata`) |
| `staff` | id, store_id, name, role (`admin`/`salesman`), pin_hash (scrypt), active |
| `products` | id, store_id, sku, barcode, name, brand, category, size, color, mrp_paise, price_paise, cost_paise (admin-only), stock, active |
| `stock_movements` | id, store_id, product_id, quantity_change (±), reason (`opening`/`stock_in`/`sale`/`exchange_return`/`exchange_issue`), ref_id, staff_id, created_at, append-only |
| `sales` | id, store_id, operation_id (unique), product_id, snapshots (sku, name, size, color, mrp), quantity, unit_price_paise, total_paise, sold_by, recorded_by, created_at, append-only |
| `exchanges` | id, store_id, operation_id (unique), original_sale_id, returned product/qty/unit price, issued product/qty/unit price/mrp, difference_paise, credited_to, recorded_by, created_at, append-only |

`products.stock` is the running total, updated in the same transaction as each movement with a guard (`stock >= quantity`). That keeps it fast to read and impossible to oversell.

## 6. Architecture

```
Browser (phone / laptop)
  └─ Next.js pages (server components) + client forms
        └─ Server actions  (src/server/actions/*)   auth check, validation (Zod)
              └─ Services   (src/server/services/*)  all money and stock rules, DB transactions
                    └─ Drizzle ORM ─▶ Neon Postgres (production, Singapore region)
                                  └▶ PGlite, an embedded Postgres (local dev and tests, no setup)
```

- **Sessions**: signed (HMAC-SHA256) http-only cookie `{staffId, role, exp}`; the secret is `SESSION_SECRET` in Vercel environment variables. `proxy.ts` redirects logged-out users; every page and action re-checks the role on the server.
- **Salesman responses never include `cost_paise`** (DTOs are built in services, not filtered in the UI).
- **Time zone**: "today" and "this month" are computed in the store's time zone (`Asia/Kolkata`), not the server's.
- **Region**: database and Vercel functions both in Singapore (`sin1`), the closest to India.

## 7. Implementation steps (each step is its own commit)

1. This plan document.
2. Database layer: Drizzle schema, migrations, PGlite for dev/tests, Neon in production, seed (demo products and staff).
3. Services with unit tests: products (create, barcode/SKU generation, stock-in), sales (record, on-behalf), exchanges, dashboards (today/month in IST).
4. Auth: PIN login, signed session, proxy route guard, role checks.
5. POS on the server: lookup, sale with "credit to", exchange screen, my-sales dashboard.
6. Admin console: dashboard, products, stock-in, labels, staff, activity.
7. End-to-end tests for the main flows; README, scanning guide and progress log updated.
8. Provision Neon, run migrations and seed production, deploy, and run a live check.

## 8. Testing

- Unit tests run every service against a real Postgres engine (PGlite in memory): stock never negative, idempotent retries, price ≤ MRP, exchange return limits, exchange stock and money math, IST day boundaries, salesman DTO has no cost.
- End-to-end (Playwright): login by PIN; admin adds a product and sees its barcode; salesman sells it crediting someone else; exchange; my-sales totals; a salesman is blocked from admin pages.

## 9. Open decisions for the owner

| ID | Question | v2 behaviour until decided |
|---|---|---|
| D-EX-1 | Can money be given back on an exchange? Is there a time limit? | Allowed both ways, no limit, difference recorded |
| D-ST-1 | Six staff were mentioned, but the names were Vishal, Nitin, Pradeep, Nitin, Balram. Who else, and who is admin? | Seeded: Vishal, Nitin, Pradeep, Balram (salesmen) + Owner (admin); admin can add more |
| D-PR-1 | Should salesmen be able to sell below the selling price (bargaining floor)? | Any price from ₹0.01 up to MRP, as today (D-08 still open) |
