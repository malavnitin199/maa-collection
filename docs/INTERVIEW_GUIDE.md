# Maa Collection — Project Explanation Guide

A guide for explaining this project in an interview or to a tester. Each section has a short "say it like this" version you can speak aloud, followed by the detail behind it.

---

## 1. The project in one minute

**Say it like this:**
"Maa Collection is a mobile-first inventory and point-of-sale web app for a clothing retail shop. It has two roles. The Admin manages stock, prices and reports. The Salesman scans an item's barcode, enters the price the customer negotiated, and the system deducts stock and records the sale under that salesperson. It's built with Next.js 16, React 19 and TypeScript, with a full automated test setup. The business plan is to start with one shop and later offer it to many retailers."

**The problem it solves:** Small clothing shops track stock on paper or in Excel. They don't know live stock per size and colour, they can't tell which salesperson sold what, and prices vary per customer because of bargaining. This app gives accurate stock, per-sale pricing and per-salesperson reporting from a phone or tablet.

---

## 2. Users and roles

| Role | What they do | Screen |
|---|---|---|
| **Admin / Owner** | See stock levels, revenue, sales by salesperson, low-stock items; later: manage catalog, costs, staff | `/admin/dashboard` |
| **Salesman / Cashier** | Scan an item, enter quantity and bargained price, record the sale | `/pos` |

Key rule: **the salesman never sees purchase cost or profit.** This is enforced in the data layer, not just hidden in the UI. Even the dummy catalog has no cost fields, and a unit test checks that.

---

## 3. Technology stack and why

| Layer | Choice | Why I chose it |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | One codebase for UI and server; server components for admin pages, client components for the live POS screen; route groups keep role areas separate |
| UI library | **React 19** | Component model, hooks, `useSyncExternalStore` for external state |
| Language | **TypeScript (strict)** | Catches money/stock bugs at compile time; typed domain models |
| Styling | **Tailwind CSS 4** | Mobile-first utility classes, dark mode support, no custom CSS files |
| Package manager | **pnpm** | Fast, strict dependency resolution, single lockfile |
| Unit tests | **Vitest + Testing Library** | Fast, TypeScript-native, jsdom environment |
| Browser tests | **Playwright** | Real Chromium tests of the full scan-to-sale flow |
| Linting | **ESLint 9 (flat config) + Next rules** | Includes the new React hooks rules |
| Runtime | **Node 26** | Pinned in `.nvmrc` |

**Planned, not yet added:** PostgreSQL + Drizzle ORM (database), Better Auth (login), Zod (validation), Dexie/IndexedDB (offline mode), shadcn/ui (component library). The rule I follow: install a dependency only in the phase that needs it.

---

## 4. Project structure

```
src/app/                 Routes and layouts only
  (auth)/login           Role picker (will become real login)
  (pos)/pos              Salesman screen
  (admin)/admin/dashboard Admin screen
src/features/            Feature code, grouped by business domain
  catalog/               Item catalog + lookup by barcode/SKU
  inventory/             Stock rules, sale validation, demo store
  pos/                   The scanning screen
  reports/               Admin dashboard
src/components/layout/   Shared header
src/lib/                 Utilities (money formatting, app config)
src/server/              Future: services, repositories, access control
src/db/                  Future: database schema
src/offline/             Future: offline queue and sync
e2e/                     Playwright browser tests
docs/                    Blueprint, backlog, decisions, progress log
```

**Say it like this:** "I used a feature-based structure. Routes are thin; business logic lives in `features/`, and anything that changes stock or money will live in `server/services/` once the database is added. This keeps the POS logic reusable and testable without the UI."

---

## 5. The core flow: scan to sale

```
Salesman scans barcode / QR (or types SKU)
  → lookup item in catalog
  → not found?        show "No item found"
  → stock is 0?       show "Out of stock"
  → found:            show item, size, colour, stock left, MRP
Salesman enters quantity + bargained sale price
  → validate: whole-number qty ≥ 1, qty ≤ stock, price > 0, price ≤ MRP
  → record sale { salesperson, sku, qty, unit price, MRP snapshot, time }
  → deduct stock
  → show "Sold 2 × Classic Crew Tee @ ₹450 — by Ravi. Stock left: 1"
Admin dashboard reads the same store → revenue, units, sales by salesperson
```

**How the scanner works:** USB and Bluetooth barcode/QR scanners behave like a keyboard. They type the code and press Enter. So the POS screen just has an always-focused text input with an Enter handler. No special hardware API is needed, and a real scanner will work without code changes. Manual typing is the fallback for torn labels.

**Why bargained price, not MRP:** In this shop every customer negotiates. So the price entered at the sale is the true record. MRP is stored alongside as a snapshot and used as the ceiling (selling above MRP is not allowed in India).

---

## 6. Design decisions worth explaining

1. **Money is stored as integer paise, never floats.** ₹499 is stored as `49900`. Floating-point arithmetic gives rounding errors (`0.1 + 0.2 ≠ 0.3`). Rupees exist only at the display edge in `formatPaise()`.

2. **Sales are append-only records.** A sale is never edited. Corrections will be new linked records (returns, adjustments). This gives an audit trail and makes reports reliable.

3. **Price snapshots.** Each sale stores the price paid *and* the MRP at that time. Changing an item's MRP later never rewrites past sales.

4. **Pure validation functions.** `validateSaleDraft()` and `rupeesToPaise()` have no React or browser dependencies, so they are unit-tested directly and will move to the server unchanged.

5. **Cashier-safe data shape.** The catalog type sent to the salesman has no cost, profit or supplier fields. When the API exists, it will return this same shape — hiding fields in the UI is not security.

6. **Keep `store_id` ready for multi-store.** The business wants to serve many retailers later. Carrying a store/tenant ID from day one makes that cheap; retrofitting it is the most expensive migration in this kind of app.

7. **Dummy store, same interface.** Until the database exists, stock and sales live in a small localStorage store exposed through `useInventory()`. The POS and the dashboard both read it. Swapping it for real API calls touches one file.

---

## 7. State management

- **Local screen state** (what was scanned, typed quantity, typed price): React `useState`.
- **Shared demo data** (stock, sales): a tiny external store with `useSyncExternalStore`. This is React's official hook for subscribing to data outside React. It also handles server rendering safely by taking a separate server snapshot.
- **Hydration gate:** interactive controls are disabled until React has hydrated, using `useSyncExternalStore(() => true on client, () => false on server)`. This prevents a half-working page before JavaScript loads and lets Playwright auto-wait correctly.

**Say it like this:** "I didn't add Redux or Zustand because there was no need yet. React's built-in `useSyncExternalStore` was enough for shared state, and the blueprint reserves Zustand only for the cart-style UI state later."

---

## 8. Testing strategy

| Level | Tool | What is covered | Count |
|---|---|---|---|
| Unit | Vitest | Money formatting, rupee parsing, catalog lookup, sale validation rules, no-cost-field guarantee | 15 tests |
| Browser (E2E) | Playwright | Role navigation; scan → quantity → bargained price → stock deducts → dashboard updates; above-MRP rejected; unknown code and out-of-stock errors | 5 tests |
| Static | TypeScript strict, ESLint | Type errors, hook misuse | every run |
| Build | `next build` | All routes compile and prerender | every run |

**Quality gate before any commit:**
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

**Say it like this:** "Tests ship with the feature, not at the end. The money and stock rules are pure functions with unit tests, and one Playwright test walks the full real flow in Chromium — scan, bargain, deduct, and verify the admin dashboard."

---

## 9. Problems I hit and how I solved them

1. **Page never became interactive in tests.** Playwright pressed Enter, the form did a native submit and reloaded the page. Root cause: Next.js 16 dev server blocks assets and hot reload for any origin other than `localhost`, so pages opened via `127.0.0.1` rendered HTML but never hydrated. Fix: run Playwright against `localhost` and add `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts`. I proved it by loading both origins in a script and checking whether the input became enabled.

2. **New React hooks lint rule.** ESLint flagged `setState` called synchronously inside `useEffect` (used to read a saved preference from localStorage). Fix: model the preference as an external store with `useSyncExternalStore`, which is the correct pattern for browser storage and is hydration-safe.

3. **Scope change mid-build.** The original blueprint assumed a shopping cart. The owner clarified there is no cart: each scan is one sale with a bargained price. I removed the cart code rather than keeping dead code, and recorded the decision in the decision log (ADR-004).

---

## 10. What is next (roadmap)

| Phase | Work |
|---|---|
| P2 | PostgreSQL with Drizzle ORM; real login with Better Auth; role permissions enforced on the server |
| P3 | Admin catalog management, stock receiving, barcode label printing |
| P4 | Server-side sale endpoint with database transactions and idempotency keys (a retried request can never deduct stock twice) |
| P5 | Returns, exchanges, damaged stock |
| P6 | Offline mode: queue sales in IndexedDB, sync when online, explicit conflict handling |
| P7 | Owner reports: gross profit from cost snapshots, low-stock and reorder suggestions |
| P8 | Real scanner/printer testing, security review, deployment |

---

## 11. Likely interview questions

**Q: Why Next.js instead of plain React?**
One deployable app with trusted server code for stock and money operations. The POS screen is still a client component, so scanning stays fast. SEO was not the reason; colocating secure APIs was.

**Q: How do you stop a salesman from seeing cost price?**
The server will never include it in the salesman's API response. The data type for the cashier has no such field. UI hiding is only presentation.

**Q: Why integer paise?**
Floats cannot represent decimal money exactly. Integers make totals exact and comparisons safe.

**Q: What happens if two salesmen scan the last piece at the same time?**
Today, with the in-browser demo, nothing prevents it. In P4 the server will run the sale inside a database transaction with a row lock; one commits, the other gets an out-of-stock error. That is why stock changes must move to the server.

**Q: How does the barcode scanner connect?**
It doesn't need an API. HID scanners act as keyboards: the focused input receives the digits and Enter. Camera scanning (ZXing) is a planned fallback.

**Q: How would this support many retailers?**
Keep a store/tenant ID on every record, keep tax and receipt settings as data, add org-based auth. The schema is being designed with that from the start.

**Q: What would you do differently?**
Add the database earlier — the demo store was useful to validate the flow with the owner, but real persistence is the next priority.

---

## 12. Quick demo script (2 minutes)

1. Open `/login` → "Continue as Salesman".
2. Scan `8901111000011` (Classic Crew Tee, 3 in stock). Set quantity 2, price ₹450. Record sale → "Stock left: 1".
3. Scan the Banarasi Saree → "out of stock" error. Type `0000` → "No item found".
4. Try price ₹600 on any item → "cannot be above MRP".
5. Switch role → Admin. Show revenue ₹900, units 2, Ravi in "Sales by salesperson", tee at 1 in the inventory table.
6. Run `pnpm test && pnpm test:e2e` to show the automated checks.
