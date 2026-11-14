# Maa Collection

Mobile-first **inventory + point-of-sale (POS)** web app for an Indian clothing shop. Staff log in with their name and a PIN. A salesperson scans an item's barcode, sees its details and stock, enters the price the customer agreed to pay, and records the sale, for themselves or **on behalf of a colleague**. Exchanges are handled in the same flow. The admin adds products (the app generates SKUs and printable barcodes), receives stock, manages staff and sees the shop dashboard. Each salesperson sees their own sales for today and this month.

It starts as a tool for one shop (Maa Collection). The plan is to grow it into a product many retailers can use, so every record carries a `store_id` and shop settings are data-driven.

- **Live:** https://maa-collection-pi.vercel.app
- **Status:** working app on a shared PostgreSQL database (Neon). Not yet built: GST/receipts, payments, offline billing, day-close. See [Project status and roadmap](#project-status-and-roadmap) and the plan in [`docs/PLAN_V2_SHOP_OPERATIONS.md`](docs/PLAN_V2_SHOP_OPERATIONS.md).

---

## Contents

1. [What the app does](#what-the-app-does)
2. [Roles and permissions](#roles-and-permissions)
3. [Tech stack and architecture](#tech-stack-and-architecture)
4. [Installation and running locally](#installation-and-running-locally)
5. [Using the app](#using-the-app)
6. [Testing barcode scanning](#testing-barcode-scanning)
7. [Available scripts](#available-scripts)
8. [Running the tests](#running-the-tests)
9. [Database](#database)
10. [Project structure](#project-structure)
11. [Core rules the code follows](#core-rules-the-code-follows)
12. [Deployment (Vercel + Neon)](#deployment-vercel--neon)
13. [Documentation index](#documentation-index)
14. [Troubleshooting](#troubleshooting)
15. [Project status and roadmap](#project-status-and-roadmap)
16. [Contributing](#contributing)

---

## What the app does

| Screen | URL | Who | What it does |
|---|---|---|---|
| Login | `/login` | Everyone | Tap your name, enter your PIN |
| Counter sale | `/pos` | Salesman, Admin | Scan or type a code → item details → quantity, agreed price (≤ MRP), **credit sale to** (me or a colleague) → record |
| Exchange | `/pos/exchange` | Salesman, Admin | Scan the returned item → pick the original sale → scan the new item → "customer pays / give back" → confirm |
| My sales | `/pos/my-sales` | Salesman, Admin | Own sales **today** and **this month** (Indian time), sales recorded for others, recent activity |
| Dashboard | `/admin/dashboard` | Admin | Today / month net revenue, units, estimated profit, exchanges, sales by salesperson, stock value, low stock, latest activity |
| Add stock hub | `/admin/stock` | Admin | **+ Stock** tab: choose Many different products · One design in sizes × colours · More of existing items |
| Quick add | `/admin/stock/quick` | Admin | **Same company + category, many products:** each card has name, MRP, selling price (shown), purchase price (code), pieces; Copy / Remove; one save → barcodes + labels |
| Settings | `/admin/settings` | Admin | **Code price:** a secret 10-letter word (e.g. BLACKHORSE: B=1 … E=0); optionally print the purchase price on tags in code; decoder |
| New design | `/admin/stock/new` | Admin | **New items from a supplier:** one design in sizes × colours → every combination gets its own SKU + barcode → label sheet (one label per piece) |
| Restock | `/admin/stock/receive` | Admin | Scan or search existing items (scanning a tag again = +1 piece), supplier + bill no., save once → labels |
| Suppliers | `/admin/suppliers` | Admin | Companies you buy from: contact, tap-to-call, deliveries (with labels), their products |
| Categories | `/admin/categories` | Admin | Kurta, Saree… each with a 2–3 letter SKU code |
| Products | `/admin/products` | Admin | Cards with search + supplier/category filters; product page: label, the design's sizes/colours, **rates for the whole design**, receive stock, edit, history (supplier + bill) |
| Staff | `/admin/staff` | Admin | Add people, set PINs, activate / deactivate |
| Activity | `/admin/activity` | Admin | Every sale and exchange: credited to whom, recorded by whom |
| Labels | `/admin/labels` | Admin | Printable barcode label for every product |

### The sale flow

```
Scan (phone camera / USB or Bluetooth scanner / typed code)
  → item details: SKU, barcode, brand, category, size, colour, MRP, selling price, stock
  → "Sell this item" → quantity · price (prefilled with the selling price, bargain down, max MRP)
                     · credit sale to: me ▾ / Vishal / Pradeep / …
  → "Record sale" → stock goes down; the sale stores who it's credited to AND who recorded it
```

Every customer bargains a different price, so the price entered is what gets recorded, and the MRP at that moment is stored next to it. There's no multi-item cart (owner decision ADR-004).

### Exchanges

The customer brings back part of an earlier sale and takes something else, for example the same kurta in a different size.
- The returned item is valued at **the price the customer actually paid**.
- Returned pieces go back into stock; the new item's stock goes down.
- The original sale is never edited; the exchange is its own record linked to it.
- You can't return more pieces than were sold, counting earlier exchanges.
- The screen shows "Customer pays ₹X" or "Give back ₹X". By default it's credited to the original seller.

### Three ways to scan

1. **Phone camera.** Tap **Scan with camera**. Reads EAN-13, EAN-8, UPC-A and Code 128 barcodes (and QR codes), then closes by itself. It uses the phone's built-in reader on Chrome for Android, and a tuned [zxing](https://github.com/zxing-js/browser) reader elsewhere (iPhone).
2. **USB or Bluetooth barcode scanner.** Acts like a keyboard; just scan, no tap needed.
3. **Typing.** Type a SKU (`MAA-TS-001`) or barcode (`8901111000014`) and press Enter.

---

## Roles and permissions

| Action | Admin | Salesman |
|---|:-:|:-:|
| Scan, see item details and stock, record a sale | ✅ | ✅ |
| Credit a sale or exchange to another salesperson | ✅ | ✅ |
| Process an exchange | ✅ | ✅ |
| See own sales (today / this month) | ✅ | ✅ |
| Shop dashboard, all salespeople, profit | ✅ | ❌ |
| Add / edit products, generate barcodes, print labels | ✅ | ❌ |
| Receive stock | ✅ | ❌ |
| See cost price | ✅ | ❌ (never sent to salesman screens) |
| Manage staff and PINs | ✅ | ❌ |

The server checks every action; hiding a button is never the only protection. Initial staff: **Owner** (admin) plus **Vishal, Nitin, Pradeep, Balram** (salesmen). The admin can add more people.

---

## Tech stack and architecture

| Area | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, server actions, Cache Components), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL: **Neon** in production; **PGlite** (embedded Postgres) for local dev and tests |
| ORM / migrations | Drizzle ORM + drizzle-kit (SQL migrations in `drizzle/`) |
| Validation | Zod |
| Auth | Name + PIN (scrypt-hashed), signed http-only session cookie, role checks on the server |
| Scanning | Browser `BarcodeDetector` when available, otherwise `@zxing/browser` |
| Barcodes | Our own EAN-13 encoder (`src/features/scanning/ean13.ts`) |
| Tests | Vitest (unit, services on a real Postgres engine) + Playwright (end-to-end) |
| Package manager | **pnpm only** |
| Hosting | Vercel (functions in Singapore `sin1`, next to the database) |

```
Phone / laptop browser
  └─ Next.js pages (server components) + client screens
        └─ Server actions  src/server/actions/   check login + role, validate input (Zod)
              └─ Services   src/server/services/  ALL money and stock rules, DB transactions
                    └─ Drizzle ─▶ Neon Postgres (production)  |  PGlite (local dev, tests)
```

Planned for later phases: shadcn/ui, TanStack Query, Dexie (offline billing).

---

## Installation and running locally

### 1. Prerequisites

| Tool | Version | Check with |
|---|---|---|
| [Node.js](https://nodejs.org) | **26** (pinned in `.nvmrc`) | `node -v` |
| [pnpm](https://pnpm.io) | **12.18.0** (pinned in `package.json`) | `pnpm -v` |
| [Git](https://git-scm.com) | any recent | `git --version` |

```bash
nvm install && nvm use          # Node 26 from .nvmrc
npm install -g pnpm@12.18.0     # newer Node versions no longer include Corepack
```

### 2. Get the code and install

```bash
git clone https://github.com/malavnitin199/maa-collection.git
cd maa-collection
pnpm install
```

### 3. Start the development server

```bash
pnpm dev
```

Open **http://localhost:3000** and log in. **No database setup is needed locally.** The app uses PGlite, an embedded Postgres stored in `./.pglite/`. It creates the tables and the demo shop the first time it runs.

> **Local login:** every seeded account (Owner, Vishal, Nitin, Pradeep, Balram) uses PIN **`1234`** in local development and tests only. Production has different, random PINs.
>
> Use `localhost`, not `127.0.0.1` or your IP address, or the page loads but its buttons stay disabled.

To start over with a fresh local database: stop the server, delete `.pglite/`, and run `pnpm dev` again.

### 4. (Optional) Production build on your computer

```bash
pnpm build
pnpm start      # http://localhost:3000
```

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Vercel (set by the Neon integration) | Production Postgres. **Unset locally**, so local dev uses PGlite. `pglite:memory` gives a throwaway in-memory database (used by Playwright). |
| `DATABASE_URL_UNPOOLED` | Vercel (Neon) | Direct connection, used for migrations |
| `SESSION_SECRET` | Vercel (production, preview) | Signs login sessions. 32+ random characters. Required in production. |

Never commit `.env*` files; they are git-ignored. **Don't put the production `DATABASE_URL` in `.env.local`**, because `pnpm dev` and the tests would then write to the live shop database. Keep it in a separate file such as `.env.neon` and load it only for migration and seed commands (see [Database](#database)).

---

## Using the app

1. **Set up once (admin):** **More → Suppliers → + Add supplier** (e.g. "XYZ Textiles"); check **Categories** (Kurta, Saree… with their SKU codes) and add any missing.
2. **Several different products from one company:** **+ Stock → Many different products** → company → category → one card per product (name, MRP, selling price, purchase price, pieces; **Copy** for similar items) → **Save … and print labels**. Hand the labels to the seller; scanning one shows the selling price, and the purchase price never appears at the counter.
3. **One design in many sizes/colours:** **+ Stock → One design in sizes × colours** → supplier → category → design name → tap the **sizes** → add the **colours** → MRP, selling price, cost → pieces each → **Save … and print labels**. Every size/colour gets its own SKU and barcode; the label sheet has one label per piece.
4. **More of existing items:** **+ Stock → More of existing items** (or dashboard **Restock**) (or the supplier page) → scan each piece or search by name → **Receive … pieces and print labels**.
5. **Change prices:** open any product → **Rates for the whole design** → applies to all its sizes/colours (past sales keep their prices). A single item with a manufacturer barcode: **More → Add a single product**.
6. **Sell:** log in as a salesman → scan the label → **Sell this item** → price → **Credit sale to** (yourself or a colleague) → **Record sale**.
7. **Exchange:** **Exchange** → scan the returned item → **Choose** the original sale → scan the new item → check "Customer pays / Give back" → **Confirm exchange**.
8. **Track:** salesmen open **My sales**; the admin opens **Dashboard** and **Activity**.
9. **Staff:** **Staff** → add a person with a PIN, change a PIN, or deactivate someone who left.

### Demo catalog (seeded)

| SKU | Barcode | Item | Opening stock |
|---|---|---|---|
| MAA-TS-001 | 8901111000014 | Classic Crew Tee, M, Black | 3 |
| MAA-TS-002 | 8901111000021 | Classic Crew Tee, L, White | 5 |
| MAA-KU-001 | 8902222000016 | Anarkali Kurta, M, Blue | 4 |
| MAA-KU-002 | 8902222000023 | Anarkali Kurta, L, Red | 2 |
| MAA-JE-001 | 8903333000018 | Slim Fit Jeans, 32, Indigo | 6 |
| MAA-SH-001 | 8905555000012 | Oxford Shirt, 40, Sky Blue | 1 |
| MAA-SA-001 | 8904444000010 | Banarasi Saree, Free, Green | 0 |
| MAA-DR-001 | 8906666000014 | A-Line Dress, S, Maroon | 8 |

New products get barcodes starting with **`200`**. GS1 reserves 20–29 for a shop's own in-store codes, so they can never clash with a manufacturer barcode. SKUs are `MAA-<first 2 letters of category>-<number>`, for example `MAA-KU-003`.

---

## Testing barcode scanning

**The camera only works on `https://` addresses or `localhost`.** To scan with a phone, use the live site.

1. On a laptop, log in as admin and open **Labels** (`/admin/labels`), or a product's page. You can print it.
2. On the phone, log in as a salesman, open **Counter sale**, tap **Scan with camera**, and allow camera access.
3. Hold the barcode flat inside the green box, 15–20 cm away. Keep the screen bright and avoid glare.

Full guide: **[`docs/SCANNING.md`](docs/SCANNING.md)**.

---

## Available scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server on http://localhost:3000 (PGlite database) |
| `pnpm build` / `pnpm start` | Production build / serve it |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `next typegen` (route types) then `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright). Starts a dev server with an in-memory database, or reuses one already on port 3000 |
| `pnpm db:generate` | Create a SQL migration in `drizzle/` after changing `src/db/schema` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` |
| `pnpm db:sample` | Add the 5 sample companies and 5 extra categories to a database (skips existing ones) |
| `pnpm db:seed` | Seed an **empty** Postgres with the shop, staff and demo products; prints one random PIN per person |

---

## Running the tests

```bash
pnpm exec playwright install chromium     # once
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

The full chain above is the quality gate; every change must pass it.

| Suite | Covers |
|---|---|
| Unit: services (`src/server/services/services.test.ts`) | On a real Postgres engine (PGlite): SKU and barcode generation, manufacturer barcode checks, stock-in, sale stock deduction, no double sale on retry, no overselling, price ≤ MRP, sale on behalf (sold by vs recorded by), exchanges (stock, price paid, return limits, retries), today/month in Indian time, profit, last admin can't be deactivated |
| Unit: other | Session tokens (tampering, expiry), PIN hashing, money in paise, EAN-13 drawing and check digits, scanner keystroke detection |
| End-to-end (`e2e/`) | Login and role guards, admin adds a product and receives stock, salesman sells it credited to a colleague, my-sales, above-MRP and unknown codes refused, a full exchange with stock checks, admin pages |

---

## Database

- Schema: `src/db/schema/index.ts`. Migrations: `drizzle/`. Seed: `src/db/seed.ts`.
- Tables: `stores`, `staff`, `suppliers`, `categories`, `products`, `stock_receipts` (one per delivery), `stock_movements`, `sales`, `exchanges`. Every table has `store_id`, and money is integer paise.
- `sales`, `exchanges` and `stock_movements` are **append-only**. `products.stock` is the running total, updated in the same transaction with a `stock >= quantity` guard. Each sale or exchange carries a unique `operation_id`, so a retried tap never sells twice.

**Changing the schema:**

```bash
# 1. edit src/db/schema/index.ts
pnpm db:generate                       # writes drizzle/000N_*.sql — review and commit it
# 2. locally: delete .pglite/ (or just restart; new migrations apply on start)
# 3. production (before deploying code that needs it):
set -a; source .env.neon; set +a       # file with the Neon variables, never committed
DATABASE_URL="$DATABASE_URL_UNPOOLED" pnpm db:migrate
```

To get `.env.neon`, run `vercel env pull .env.neon` (or copy the values from Vercel → Settings → Environment Variables).

---

## Project structure

```
maa-collection/
├── src/
│   ├── app/                         Routes only
│   │   ├── (auth)/login/            /login
│   │   ├── (pos)/pos/               /pos, /pos/exchange, /pos/my-sales
│   │   └── (admin)/admin/           /admin/dashboard, products, products/new, products/[id], staff, activity, labels
│   ├── proxy.ts                     Route guard (logged out → /login, salesman ↛ /admin)
│   ├── features/                    Screens and browser logic
│   │   ├── auth/                    Login form
│   │   ├── pos/                     Counter sale, exchange, product card, "credit to" picker
│   │   ├── catalog/                 Product form, barcode label, stock-in / staff forms
│   │   ├── reports/                 Stat tiles, activity list
│   │   └── scanning/                Camera reader, scan box, hardware-scanner detection, EAN-13
│   ├── server/
│   │   ├── actions/                 Server actions (auth, POS, admin): login + role checks, validation
│   │   ├── services/                Business rules: products, sales, exchanges, staff, reports (+ tests)
│   │   ├── security/                PIN hashing, signed sessions
│   │   ├── auth.ts                  Current staff, requireStaff / requireAdmin
│   │   └── request-db.ts            Database access for pages (request-time)
│   ├── db/                          Drizzle schema, client (Neon or PGlite), seed
│   ├── components/                  Header, shared styles
│   └── lib/                         Money formatting, app config (store id, time zone)
├── drizzle/                         SQL migrations
├── e2e/                             Playwright tests
├── scripts/                         db-seed.ts (production seeding)
└── docs/                            Plans, decisions, progress, scanning guide
```

---

## Core rules the code follows

1. **Money is whole paise** (₹499.00 = `49900`), never fractional numbers.
2. **Sales, exchanges and stock movements are never edited or deleted.** Corrections are new, linked records.
3. **The server decides stock and totals**, inside database transactions. A retried request never sells twice.
4. **Salespeople never receive cost or profit data.** It's excluded on the server, not hidden on screen.
5. **"Today" and "this month" use the shop's time zone** (`Asia/Kolkata`), not the server's.
6. **GST can differ per item by price.** Not built yet; never assume one flat rate.
7. **Both kinds of barcode are supported:** generated in-store barcodes and manufacturer EAN-13s.

---

## Deployment (Vercel + Neon)

Production: https://maa-collection-pi.vercel.app, Vercel project `maa-collection`, Neon database `maa-collection-db` (free plan, Singapore). Deployed with the [Vercel CLI](https://vercel.com/docs/cli); GitHub is not connected, so pushing does not deploy.

```bash
vercel login && vercel link          # once
# if the schema changed: migrate production first (see Database)
vercel deploy                        # preview URL (https, good for phone testing)
vercel deploy --prod                 # production
```

> Preview deployments currently use the **same** Neon database as production. Test on previews with care, or create a Neon branch for previews.

**First-time setup of a new database:** run `pnpm db:migrate`, then `pnpm db:seed` (prints one PIN per person, shown once), then deploy.

---

## Documentation index

| Document | Read it for |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Single source of truth: product, stack, core rules, workflow, status |
| [`docs/PLAN_V2_SHOP_OPERATIONS.md`](docs/PLAN_V2_SHOP_OPERATIONS.md) | The current plan: roles, flows, data model, architecture, open decisions |
| [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) | Short product reference and current status |
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | What's done, test results, next steps |
| [`docs/TASK_BACKLOG.md`](docs/TASK_BACKLOG.md) | Phased task list P0–P8 |
| [`docs/SCANNING.md`](docs/SCANNING.md) | Scanning: camera, hardware scanners, labels, troubleshooting |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) / [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md) | Open questions / approved decisions |
| [`docs/PROJECT_BLUEPRINT.md`](docs/PROJECT_BLUEPRINT.md) | Original proposed architecture |
| [`docs/INTERVIEW_GUIDE.md`](docs/INTERVIEW_GUIDE.md) | Plain-language walkthrough of the project |
| [`docs/SOURCE_PRD.pdf`](docs/SOURCE_PRD.pdf) | Original 12-page requirements |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `pnpm: command not found` | `npm install -g pnpm@12.18.0` |
| Odd install or build errors | Check `node -v` is 26, delete `node_modules`, run `pnpm install` |
| Forgot a PIN | Admin → **Staff** → set a new PIN. Locally, all PINs are `1234` |
| Locked out of every admin account | Run `pnpm db:seed` on an empty database, or ask a developer to reset a PIN in the database |
| Page loads but buttons stay disabled (dev) | Use `http://localhost:3000`, not `127.0.0.1` or an IP address |
| Local data looks wrong / want a clean start | Stop `pnpm dev`, delete `.pglite/`, start again |
| "Camera needs HTTPS" | Use the live site or `localhost` |
| Camera opens but never reads | Barcode flat in the green box, 15–20 cm away, bright screen, no glare |
| "No item found" | That code isn't a product yet. Admin → Products → Add product |
| "Only N left in stock" | Receive stock first (admin), or sell fewer |
| `pnpm test:e2e` says the browser is missing | `pnpm exec playwright install chromium` |

---

## Project status and roadmap

**Done:** project setup and quality gate; owner stock workflow (suppliers, categories, sizes × colours entry with generated barcodes, per-piece label sheets, scan-to-restock, design-wide rates, phone tab bar); camera, hardware-scanner and typed scanning; barcode labels; shared PostgreSQL database; name + PIN login with roles; products with generated SKUs and barcodes; stock-in; sales with bargaining and "on behalf of"; exchanges; salesman and admin dashboards; staff management; activity log.

**Next** (see [`docs/TASK_BACKLOG.md`](docs/TASK_BACKLOG.md) and the open decisions in the plan):
- GST per item and receipts, payment method (cash / UPI)
- Returns without a replacement item (refunds), and an exchange time limit if the owner wants one (D-EX-1)
- Day-close cash count, accountant export (Tally / Excel)
- Offline billing, stock-take, CSV product import, label sheets for printers

---

## Contributing

- One backlog task at a time, smallest change that does the job; tests ship with the feature.
- Business rules live in `src/server/services/`, not in screens or actions.
- Run the full quality gate before committing; record results in `docs/PROGRESS.md`.
- [Conventional Commits](https://www.conventionalcommits.org): `feat(scope): …`, `fix(scope): …`, `docs: …`.
- Never commit secrets. Don't invent business policy (tax, discounts, refunds): ask the owner and record it in `docs/DECISIONS.md`.

## License

No license has been chosen yet. Until one is added, all rights are reserved by the project owner.
