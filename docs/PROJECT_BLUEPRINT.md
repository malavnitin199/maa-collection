# Maa Collection | Retail Inventory & Point-of-Sale System
## Technical architecture, developer handbook and delivery blueprint

**Version:** 1.0  
**Prepared:** 14 November 2026  
**Source of truth:** Uploaded *Product Requirements Document (PRD): Retail Shop Stock, Sales & Billing System*, 12 pages.  
**Audience:** Developer/tech lead, shop owner, QA, future contributors.  
**Status:** Recommended architecture, not yet implemented. Items marked **Decision required** are not specified by the PRD.

---

## 1. Product summary and recommendation

Build an installable, mobile-first retail clothing shop system with two experiences:

- **Owner/Admin:** master catalog; product variants; supplier receipts and stock entry; barcode label creation; pricing and cost; stock health; sales and gross-profit reporting; staff permissions; return/damage approval; audits and reorder suggestions.
- **Cashier/Salesperson:** quick SKU/barcode lookup; cart and discounts within permissions; payment recording; receipt generation; size exchange/returns; offline operation with clear pending sync states.

**Decision: Next.js App Router + React + TypeScript, with a PostgreSQL backend and an offline-capable PWA.** The user interface is React in either option. Next.js simplifies colocating trusted APIs, access control, and database transactions in one deployable application. This is an operational choice, not an SEO requirement. The billing screen remains a **Client Component** and does not depend on server rendering to accept each scan.

### React + Vite alternative

React + Vite is also valid if there is an existing standalone API or a team deliberately wants separate frontend/backend deployments. PWA and browser scanner support are **not** unique advantages of Next.js. Because the PRD calls for a new integrated web + backend application and the initial implementation is lean, the extra API service is not needed.

### Design principles

1. **Correct inventory and financial history beat visual polish.** A sale either commits atomically on the server or is visibly pending/conflicted locally.
2. **Server-authorized, least-privilege access.** Hiding cost-related components is insufficient; sensitive fields must be excluded from cashier API responses.
3. **Offline capable, not magically globally consistent.** Each disconnected counter sees an estimate, not guaranteed global stock.
4. **Append-only operational ledger.** Corrections are new events/documents; do not silently edit historical sales or stock movements.
5. **One product variant = one sellable SKU.** Brand + category + design + size + colour describe the SKU; identical physical pieces share a barcode unless per-piece serial tracking is separately required.
6. **Feature-based modular monolith.** One deployable Next.js app; domain services separated from pages/components.
7. **Tests ship with money/stock features.** Never defer core business-rule tests until the end.

---

## 2. PRD coverage and boundaries

| PRD location | Required business behaviour | Planned implementation |
|---|---|---|
| pp. 1–2, Sec. 1–3A | Detailed stock by brand/category/design/size/colour | Product catalogue + variant/SKU table + stock balances |
| p. 2, Sec. 3B | Purchase stock-in and sticker generation | Purchase/stock receipts, Code 128 barcode and tested print layout |
| p. 2, Sec. 3C | Fast counter sale and automatic deduction | POS cart, server transaction, payment record, stock movement |
| p. 2, Sec. 3D | Low stock, 7/30/90-day sales velocity | Threshold alerts, baseline forecast, suggestions (later phase) |
| pp. 2–3, Sec. 3E | Exchanges, damaged goods | Return/exchange documents, stock quarantine and adjustments |
| pp. 3–5, Sec. 4 and 7 | Owner and cashier panels, protected costs/profits | Role-based layouts **and** enforced server permissions |
| pp. 5–8, Sec. 8 and 9 | Offline billing, local queue, sync, concurrency, scanners | IndexedDB/Dexie, service worker, idempotency, atomic database operations |
| pp. 8–10, Sec. 10 | SQL schema and normalization | Normalized PostgreSQL tables with immutable movement history |
| pp. 11–12, Sec. 11 | Next.js/React/PWA, scanner, printing, patterns | App Router, client POS, installable shell, peripheral adapters |

### Explicit design additions (not sufficiently defined in PRD)

The PRD lists a starter schema but does not fully model `suppliers`, purchase receipt lines, physical stock locations, payments, returns, stock movements, audit logs, or offline sync idempotency. We add those entities to satisfy the described workflows safely. Exact GST invoice rules, receipt/legal format, payment gateway integration, exchange/refund policy, printer models, and offline oversell policy are **open business decisions**, not settled requirements.

### Delivery scope

- **Working online pilot:** authentication and roles; catalog; locations; receiving stock; scanning/manual lookup; cash and manually recorded UPI/card sales; stock deduction; basic receipt; returns; simple reports.
- **Operationally ready full PRD release:** durable offline queue + reconciliation, conflict handling, browser/device matrix validation, audited adjustments, validated printer workflows and payment-state behaviour.
- **Enhancements after stable core:** sales-velocity-based reorder suggestions, advanced staff performance insights, SMS/WhatsApp provider integration, richer forecasting and multi-store extensions.

**Do not advertise the pilot as production-ready offline billing until its sync and failure-mode acceptance tests pass.**

---

## 3. Stack decisions

| Concern | Recommendation | Reason / boundary |
|---|---|---|
| Runtime | **Node.js 24 LTS** | Stable default; use a single pinned major across CI/deployment |
| App | **Next.js App Router** | React frontend plus route handlers and authenticated server code |
| Language | **TypeScript strict** | Typed domain transactions and external API contracts |
| Package manager | **pnpm** | Efficient installs; one lockfile; don't mix lockfiles |
| UI | **Tailwind CSS + shadcn/ui + Lucide** | Mobile-first, reusable form and dashboard primitives |
| Forms | **React Hook Form + Zod** | Validated request and form contracts |
| Remote data | **TanStack Query** | Server cache/retries and invalidation for online UI |
| Local POS state | **Zustand** | Ephemeral cart interactions; durable cart snapshots go to Dexie |
| DB | **PostgreSQL** | ACID transactions, row locking, constraints, rich SQL reporting |
| DB layer | **Drizzle ORM + versioned migrations** | SQL-friendly modeling and explicit transaction logic |
| Authentication | **Better Auth with PostgreSQL adapter** | Session management and credential flow; staff roles are enforced in the app |
| Local DB | **Dexie.js (IndexedDB)** | Durable browser queue, local catalog/cache, active cart |
| Offline app | **Manifest + Service Worker** | Offline shell; cautious precaching and reconnect behavior |
| Camera scan | **@zxing/browser** | Mobile camera fallback; manual SKU entry always available |
| Barcode print | **Code 128 generator, template and browser print** | Use label-specific sizing; validate printer before promising one-click operation |
| Tests | **Vitest, Testing Library, Playwright** | Business logic, UI workflows and browser/device coverage |
| Deployment | **Vercel + managed PostgreSQL**, or another full Node host | Next.js route handlers must run server-side; database backups required |

**Do not install every package on day one.** Add each module's dependencies in the phase when used. Avoid Redux, Redis, Kafka, microservices, payment gateway SDKs and native-app wrappers until an actual requirement justifies them.

**Source references (official):**
- Next.js setup: https://nextjs.org/docs/app/getting-started/installation
- Next.js PWA: https://nextjs.org/docs/app/guides/progressive-web-apps
- Next.js testing: https://nextjs.org/docs/app/guides/testing
- Drizzle/PostgreSQL: https://orm.drizzle.team/docs/get-started/postgresql
- Better Auth/Next.js: https://better-auth.com/docs/integrations/next
- Dexie React: https://dexie.org/docs/Tutorial/React
- Playwright: https://playwright.dev/docs/intro

---

## 4. System architecture

```text
Mobile phone / tablet / desktop (installed PWA or browser)
    |
    +-- Owner/Admin React UI ----> Next.js server routes / server services
    |                                    |
    +-- Cashier POS React UI             +-- Session / role / store checks
            |                             +-- Zod input validation
            +-- Scanner adapter           +-- Atomic sale / return / stock services
            +-- Cart state (Zustand)      +-- Idempotency / audit logging
            +-- IndexedDB (Dexie)        |
            |   +-- SKU catalog cache    v
            |   +-- active carts      PostgreSQL
            |   +-- pending ops         +-- canonical SKU + inventory balance
            |   +-- sync outcomes       +-- append-only stock movements
            +-- Service Worker           +-- immutable sale/payment records
            +-- Sync engine
                    |
                    +---- POST /api/v1/sync (authenticated, batch or one-by-one)
                                |
                                +--> committed | duplicate | rejected | needs-review
```

### Separation of responsibility

- `src/app/`: routing/layouts, small page-level components and route handlers.
- `src/features/`: UI and browser hooks for a specific feature.
- `src/server/services/`: trusted business logic; **all stock and money-changing operations live here**.
- `src/server/repositories/`: SQL read/write operations, called by services.
- `src/db/`: PostgreSQL schema/migrations and connection.
- `src/offline/`: browser-only Dexie tables, queue and synchronization.
- `src/lib/`: shared utilities, session checks, validation, money formatting.

**Anti-patterns to avoid:** direct DB access from Client Components; stock updates in two unrelated HTTP requests; trusting an `admin` flag sent by the browser; sending wholesale prices to cashier APIs; using display-side optimistic totals as accounting truth; making offline operations disappear on logout.

---

## 5. Proposed repository and project structure

**Target structure.** These paths are added gradually, not generated in full by `create-next-app`.

```text
maa-collection/
├── docs/
│   ├── PROJECT_BLUEPRINT.md
│   ├── TASK_BACKLOG.md
│   ├── DECISIONS.md
│   ├── API_CONTRACTS.md              # Phase 2/4
│   ├── TEST_MATRIX.md                # Phase 1 onward
│   └── ADR/                          # important decisions
├── drizzle/                          # generated SQL migrations
├── e2e/                              # Playwright scenarios
├── public/
│   ├── icons/                        # installable PWA artwork
│   └── sw.js                         # later, carefully versioned
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (admin)/admin/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── catalog/page.tsx
│   │   │   ├── inventory/page.tsx
│   │   │   ├── purchases/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   └── staff/page.tsx
│   │   ├── (pos)/pos/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # fast billing
│   │   │   ├── stock/page.tsx
│   │   │   └── returns/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...all]/route.ts
│   │   │   └── v1/
│   │   │       ├── catalog/route.ts
│   │   │       ├── stock-receipts/route.ts
│   │   │       ├── sales/route.ts
│   │   │       └── sync/route.ts
│   │   ├── manifest.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                         # shadcn components
│   │   └── layout/                     # app navigation, headers
│   ├── features/
│   │   ├── auth/
│   │   ├── catalog/
│   │   ├── inventory/
│   │   ├── pos/                         # cart, scan-to-cart, checkout UX
│   │   ├── returns/
│   │   ├── reports/
│   │   ├── scanning/
│   │   └── printing/
│   ├── offline/
│   │   ├── db.ts                       # Dexie schema
│   │   ├── queue.ts
│   │   ├── sync-engine.ts
│   │   └── sync-types.ts
│   ├── server/
│   │   ├── services/
│   │   │   ├── sale.service.ts
│   │   │   ├── inventory.service.ts
│   │   │   ├── receipt.service.ts
│   │   │   ├── return.service.ts
│   │   │   └── sync.service.ts
│   │   ├── repositories/
│   │   └── access/                     # canonical server authorization
│   ├── db/
│   │   ├── client.ts
│   │   └── schema/
│   │       ├── auth.ts
│   │       ├── catalog.ts
│   │       ├── inventory.ts
│   │       ├── sales.ts
│   │       ├── returns.ts
│   │       └── sync.ts
│   ├── lib/
│   │   ├── money.ts
│   │   ├── permissions.ts
│   │   ├── idempotency.ts
│   │   └── validators/
│   └── test/
│       ├── setup.ts
│       └── factories/
├── .github/workflows/ci.yml
├── .env.example
├── .env.local                       # never commit
├── docker-compose.yml               # local DB, Phase 2
├── drizzle.config.ts                # Phase 2
├── playwright.config.ts             # Phase 1
├── vitest.config.ts                 # Phase 1
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```

**Naming policy:** `sale.service.ts` handles use cases, not HTTP; `*.route.ts` only authenticates/validates/returns responses. Shared business types are not duplicated across offline, database and API layers. Define external payload schemas in `src/lib/validators` and derive types from Zod.

---

## 6. Domain and database model

The PRD's SQL tables are a **starting point**, not yet complete enough for the full workflows. Keep entities normalized and add event/ledger tables.

| Entity | Purpose / important fields |
|---|---|
| `stores` | Store identity, timezone, display name and receipt preferences (even if only one store initially) |
| `users`, `sessions`, `store_memberships` | Better Auth-managed identities/sessions; role, active status, store association |
| `brands`, `categories`, `suppliers` | Master data |
| `products` | Design/article-level details, brand, category |
| `product_variants` | SKU, barcode (unique per shop or global), size, color, current retail price, cost and low-stock threshold |
| `locations` | Storefront, godown, damage quarantine; scoped to store |
| `inventory_balances` | Fast-read balance by `(store_id, location_id, variant_id)` with uniqueness/constraints |
| `stock_movements` | Immutable inventory ledger: variant, location, signed quantity, reason, source document, actor, timestamp |
| `stock_receipts`, `stock_receipt_lines` | Supplier stock-in, purchase-cost snapshot and receiving audit |
| `registers` | Billing device/counter identity, needed for offline origin and numbering policy |
| `sales`, `sale_lines` | Completed/accepted orders; immutable quantities, discounts, price and **cost snapshots** |
| `payments` | Cash/manual UPI/card records and verified/pending/refunded states; source and gateway reference if used |
| `returns`, `return_lines`, `exchanges` | Separate reversal/exchange documents that reference original sale lines |
| `stock_adjustments` | Damaged, missing, found, manual write-off, approvals and reason |
| `sync_operations` | Client-generated UUID/idempotency key, device, request digest, processed status and response |
| `audit_logs` | Actor, action, target, authorization context, timestamp; no customer secrets in logs |

### Database rules

1. **Never use a floating-point type for money.** For INR, store paise as integer (`amount_minor`) with explicit tax/discount calculation and rounding rules.
2. `product_variants.sku` and barcode must be unique within the approved scope. Barcode values are stable; reprints reuse the same identifier.
3. History stores **snapshots** of selling price, original/list price, applied discounts, cost and tax (if applicable). Price changes must not rewrite past margins.
4. `stock_movements` and posted `sales` are append-only; a sale refund or damage is a separate linked transaction.
5. `inventory_balances` is a projection of canonical movements. On-hand, reserved, sellable and damaged/quarantined quantities must be named explicitly.
6. Stock adjustments require reason codes; missing/stolen stock requires owner approval per PRD.
7. Store/location constraints and server checks prevent cross-store access. Even single-shop MVP should carry `store_id` to avoid ambiguous records.
8. Add supporting database constraints, indexes, transaction boundaries and unique idempotency keys.
9. Keep a reconciliation query/job that flags mismatch between balances and summed movements; alert rather than auto-overwriting history.

### Example stock flow (online)

`Receive 10 units → movement +10 and balance 10 → sell 2 → sale + movement -2, balance 8 → quarantine 1 damaged → movement -1 from sellable location and +1 in quarantine, sellable balance 7.`

If a return is resellable, it increases sellable inventory with a documented return movement; a damaged return goes into quarantine instead.

### Profit terminology

The PRD often calls `selling price - purchase cost` "net profit." Technically this is **gross profit on goods before operating costs and other adjustments**. Label owner reports accurately. GST, refunds, shipping/transaction fees and overhead definitions must be agreed before presenting a true net-profit figure.

---

## 7. Critical workflows and API design

### 7.1 Purchase receiving and barcode label

1. Owner creates or selects supplier; chooses existing SKUs or creates variant combinations.
2. Staff enters received quantity/cost and destination location.
3. Server validates role, SKU/location, duplicate request token and non-negative quantity; atomically posts receipt, movements and balance changes.
4. Optional label batch generated using stable variant barcode; print dimensions and printer DPI configured per hardware profile.
5. Print failure **does not undo the successful stock receipt**; user can reprint without posting stock twice.

### 7.2 Scan → cart → checkout (online)

1. Scanner acts as keyboard input with suffix configured (typically Enter). Camera and manual SKU search are alternatives.
2. Debounce physical scan bursts conservatively; do **not** block two intentional scans of the same SKU. Provide quantity controls.
3. POS adds/updates local cart immediately and persists draft in IndexedDB.
4. On checkout, client generates `operation_id` UUID and submits one sale request (total is recomputed on server).
5. Server checks session, store, staff discount limit, price/stock rules and payment state.
6. **Inside one PostgreSQL transaction:** check idempotency; lock/conditionally update affected inventory rows in deterministic order; verify policy; create sale header, lines and payment record; append stock movements; update balances; write idempotency outcome; commit.
7. Client shows **confirmed** receipt only after server confirmation. If network response is lost, retry same UUID and recover exact original result, never charge/deduct twice.

### 7.3 Sale concurrency: last physical piece

Two cashiers scan the last item. Both can view `1 available`, but the server serializes their commits. One succeeds; the other receives `OUT_OF_STOCK` / conflict with a corrective action. A browser-only or optimistic decrement does not solve this.

### 7.4 Offline queue + sync

```text
Customer checkout
  → persist immutable local operation + cart snapshot in Dexie FIRST
  → mark as PENDING_SYNC (not server-confirmed)
  → optional locally numbered provisional customer slip, visibly labelled
  → reconnect / app foreground / manual retry / supported service worker background sync
  → POST /api/v1/sync with stable operation UUID
  → server transaction + idempotency + stock checks
  → COMMITTED | DUPLICATE_COMMITTED | NEEDS_REVIEW | REJECTED
  → local queue retains receipt/exception and a durable audit trail
```

**Never use Last-Write-Wins to silently overwrite stock or financial transactions.** The PRD mentions LWW plus reconciliation, but LWW is unsafe for physical stock movements. Use idempotent append-only operations and explicit conflict review. Offline last-piece overselling is physically impossible to prevent across truly disconnected devices without preallocated inventory rights or an operational reconciliation policy. Choose and document one policy before launch.

**Recommended starting offline policy:** Cash-only provisional offline bills (owner-configurable), explicit pending status, offline quantity limits where practical, and conflict review on reconnect. Do not tell customers UPI/card was verified from an offline device. UPI gateway verification requires a payment provider integration; manual marking of a UPI payment is **unverified/manual**, not a bank confirmation.

**Background Sync support is not universal.** Sync on app open/focus, `online` event, retry with backoff and a visible `Sync now` button. Use service worker Background Sync only as an enhancement on supported browsers. `navigator.onLine` does not prove the application API is reachable. Handle timeouts and uncertain commit responses with status/idempotency lookup.

### 7.5 Returns, exchanges and damage

- A return references original sale line and cannot exceed remaining returnable quantity.
- Restock as sellable or quarantine as damaged; exchange returns one variant and sells another **in one transaction**.
- Preserve original prices and tender history; if refund amount differs, create linked adjustment/payment record.
- Cashier cannot approve unexplained loss write-offs or edit prior posted events.

### 7.6 Suggested API contracts

All endpoints authenticate and use server-derived store membership. Example shapes are illustrative, to be finalized in `docs/API_CONTRACTS.md`.

| Endpoint | Action | Permission |
|---|---|---|
| `GET /api/v1/catalog` | Search SKUs, available stock, cashier-safe prices | Staff/Owner |
| `POST /api/v1/products` | Create designs/variants | Owner |
| `POST /api/v1/stock-receipts` | Post supplier receipt | Owner/authorized staff |
| `POST /api/v1/sales` | Atomic checkout using `operation_id` | Cashier/Owner |
| `GET /api/v1/sales/by-operation/:id` | Recover uncertain checkout outcome | Original register/Owner |
| `POST /api/v1/returns` | Atomic return/exchange | Authorized staff |
| `POST /api/v1/stock-adjustments` | Quarantine/write-off with policy | Owner/authorized staff |
| `POST /api/v1/sync` | Idempotent offline operations | Authenticated device/staff |
| `GET /api/v1/reports/*` | Sales, margins, stock metrics | Owner only |

---

## 8. Authentication, security and privacy

- Owner provisions staff accounts; public sign-up disabled by default. Rate-limit and log login attempts.
- Session cookie is secure/HttpOnly/SameSite as appropriate; role authorization runs on **every server operation**.
- Define capabilities such as `catalog:write`, `stock:receive`, `sale:create`, `returns:process`, `adjustments:approve`, `reports:view_cost`, `staff:manage`. Do not rely solely on two hardcoded roles in UI code.
- Separate DTOs: cashier API response does not contain cost, gross profit or supplier prices. Hide UI elements too, but treat that only as presentation.
- Keep DATABASE_URL, session secrets, and gateway credentials on server, never prefixed `NEXT_PUBLIC_`.
- Log actor, store, terminal and operation UUID for billing/movement audits.
- Shared terminals need session timeout/lock and staff switch policy. IndexedDB is **not automatically encrypted at rest**. Avoid caching sensitive owner-only fields. Define what happens to un-synced sales when staff logs out (never silently discard them).
- HTTPS is required for most production PWA/device capabilities. Configure backups, retention, migration recovery and monitoring before launch.

---

## 9. PWA, scanning and hardware reality check

### PWA

- Manifest + installable icons; cache application shell and selected static assets.
- IndexedDB contains only the least sensitive data needed for POS operation and scoped to device/store.
- Offline cached catalog may be stale: show `last_synced_at`; avoid misleading "live stock" claims when disconnected.
- Do not cache authenticated API responses across users without an explicit scoped cache strategy.
- Test service-worker upgrades with pending operations, storage quota failures, private-browsing modes and shared-device logout.

### Scanners

- First support USB/Bluetooth **keyboard-wedge HID** scanners, which type into the active app like a keyboard. They ordinarily do not need the browser Web Bluetooth API.
- Provide a dedicated scanner-input strategy with burst detection and focus handling, plus manual SKU search.
- Add camera scanning with ZXing as a fallback; verify camera permission, HTTPS and low light.

### Printers

- **Barcode label printer** and **receipt printer** are separate hardware use cases.
- Begin with HTML/CSS print templates and `window.print()` as a portable fallback.
- Select a concrete hardware model and test label size, margins, calibration, OS print dialog, Android and desktop before promising silent print or exact thermal alignment.
- Direct Bluetooth/USB printing often requires printer-specific protocols, browser support or a local/native print bridge. Web Bluetooth is limited and focuses on BLE; it does not generically connect every classic Bluetooth thermal printer.
- Run an early 1-day hardware proof of concept before finalizing a purchase recommendation.

---

## 10. Step-by-step setup on a developer machine

**First coding task:** `P1-01` in `TASK_01_BOOTSTRAP.md`. Commands here are for macOS/Linux; do not mix npm/yarn/bun lockfiles.

### 10.1 Prerequisites

- Node.js **24 LTS**, Git, VS Code/Cursor, pnpm, a modern Chrome browser.
- Docker Desktop later for local PostgreSQL (Phase 2); deployment account later.

```bash
node -v
npm -v
git --version
npm install -g pnpm@latest
pnpm -v
```

If your local Node is not 24 LTS, switch with `nvm` or your preferred Node version manager **before** creating the project.

### 10.2 Create the project

```bash
pnpm create next-app@latest maa-collection \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias '@/*' --use-pnpm
cd maa-collection
pnpm dev
```

Visit **http://localhost:3000**. The scaffold includes Next.js, TypeScript, Tailwind, App Router, lint config and a lockfile. Route handlers, offline files and DB schema are not present yet.

### 10.3 Add basic UI/form tooling (when needed)

```bash
pnpm dlx shadcn@latest init
pnpm add zod react-hook-form @hookform/resolvers
```

For the client POS module (Phase 4):

```bash
pnpm add @tanstack/react-query zustand
```

For offline work (Phase 6):

```bash
pnpm add dexie dexie-react-hooks
```

For camera scans (Phase 8, or earlier if hardware demands):

```bash
pnpm add @zxing/browser
```

### 10.4 Database and authentication (Phase 2)

```bash
pnpm add drizzle-orm pg better-auth @better-auth/drizzle-adapter
pnpm add -D drizzle-kit @types/pg tsx dotenv
```

Create `docker-compose.yml` with a local PostgreSQL container, an `.env.local` (untracked) for the app, and `drizzle.config.ts` for migrations. Follow Better Auth's current Drizzle schema generation/setup instructions, as generated tables and adapter integration can evolve. Use **versioned migrations** and never auto-run destructive schema sync in production.

`.env.example` should initially document:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maa_collection
BETTER_AUTH_SECRET=replace-with-a-long-random-value
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Maa Collection
```

Only `NEXT_PUBLIC_APP_NAME` is browser-visible. **Never commit actual `.env.local` secrets.**

### 10.5 Testing baseline (Phase 1, not after features)

```bash
pnpm add -D vitest @vitejs/plugin-react vite-tsconfig-paths \
  jsdom @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event
pnpm create playwright
```

Choose TypeScript, `e2e` as the tests directory, GitHub Actions CI and browser installation as needed. See `TASK_01_BOOTSTRAP.md` for starter config and exact smoke test.

Add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Merge these into the existing `scripts` object; **do not replace the entire package.json**.

### 10.6 Quality gate for every feature

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

For E2E, configure Playwright `webServer` or start the app separately. Test browsers need installing at least once. Do not rely on screenshots alone for transaction integrity.

---

## 11. Testing strategy: start early, scale risk-based

**Do not postpone tests to the end.** Configure testing in Phase 1. Implement unit/integration tests with the feature they cover. End-to-end tests can expand gradually.

| Test level | Begin | Must cover |
|---|---|---|
| Static type/lint | Phase 1 | Strict TS, no accidental server code imported into client |
| Unit (Vitest) | Phase 1 | Money rounding, cart math, discount limits, scanner parsing, sync state machine |
| Database integration | Phase 2/3 | SQL constraints, append-only movement, authentication, inventory invariants |
| Service integration | Phase 4 | Last-piece concurrency, idempotency, duplicate request, rollback on failure |
| Browser E2E (Playwright) | Phase 1 smoke; grow each phase | Owner login, staff restricted screens, stock receiving, scan, checkout, return, reports |
| Offline and hardware tests | Phase 6/8 | Reconnect, crash/retry, shared device, camera, real scanners/labels |

**High-risk, non-negotiable test cases**

1. Two concurrent transactions for one last unit: exactly one commits under the chosen stock policy.
2. Duplicate same `operation_id`: returns the prior outcome; no double sale, payment or stock movement.
3. Lost HTTP response after committed sale: retry recovers the receipt.
4. Incomplete checkout SQL transaction: sale, movement and balance **all** roll back.
5. Cashier direct API access to purchase costs/profit: 403 or filtered DTO; never leaked.
6. Variant colour/size stock isolated; scanning another SKU never changes the wrong balance.
7. Return cannot exceed originally sold quantity, even if retried.
8. Exchange both legs commit together or neither does.
9. Damaged/quarantined item is unavailable for sale.
10. Offline crash preserves pending cart/operation; reconnect yields a reconciled outcome.
11. Multiple devices offline sell the same final stock: explicit conflict surfaced, never silently erased.
12. Payment states distinguish manual record, pending gateway verification and confirmed payment.
13. Counter/day reports use the configured shop timezone, not the developer's browser clock.
14. Printing failures do not duplicate receipts or inventory transactions.

**Suggested CI gate:** lint + TS + unit tests + integration tests using a disposable PostgreSQL database + build + Chromium smoke. Add WebKit/mobile emulator and physical peripherals in release gates.

---

## 12. Phased implementation and release gates

**Detailed atomic tasks:** see [`TASK_BACKLOG.md`](TASK_BACKLOG.md). The rough relative sizing below is planning guidance, not a delivery promise.

| Phase | Workstream | Exit criteria / demo |
|---|---|---|
| **P0 - Discovery** | Open decisions, billing semantics, user journeys, hardware choices | Signed-off assumptions and initial acceptance criteria |
| **P1 - Foundation** | Next app, repo, TypeScript, layout shells, testing, CI, env config | App boots; smoke test and quality commands pass |
| **P2 - Data & access** | DB schema, migrations, Better Auth, roles, server permission helpers | Admin and cashier identities isolated; unauthorized data inaccessible |
| **P3 - Catalog & stock-in** | Brands, categories, variants, suppliers, locations, incoming stock, labels | Receive 10 units of a variant and find exactly 10 available |
| **P4 - Online POS** | Scanner/manual entry, cart, discounts, sales/payment service, receipts | Sell and receive atomic stock updates; retry is safe |
| **P5 - Returns & audits** | Exchange, return, damaged stock, adjustments, approval history | Swap M → L in one audited transaction; damage removed from sellable |
| **P6 - Offline reliability** | Dexie, local cart, queue/sync, conflict review, service worker | Crash/reconnect/device-conflict scenarios pass in supported browsers |
| **P7 - Owner reporting** | Sales/cost snapshots, dashboard, low-stock and reorder velocity | Accurate owner-only daily/monthly figures and 7/30/90-day suggestions |
| **P8 - Device, security & release** | Hardware validation, accessibility, performance, monitoring, backups, pilot training | Pilot store signs off on real-device runbook and recovery procedures |

### Build order and dependencies

- `P1` is the first coding phase. `P0` must identify policies before billing/inventory semantics are finalized.
- `P2` must precede posting stock or sales.
- `P3` must precede `P4`; `P4` must precede reliable offline sync.
- `P5` return/exchange service and `P6` local transaction contracts should share immutable operation models.
- `P7` reports can begin after sales ledger exists, but advanced forecasting needs sufficient sales history.
- `P8` hardware **proof of concept should start early** (parallel with P1/P3); the final certification gate is late.

### Proposed release definition of done

- No high-severity unresolved oversell, double-charge, authorization or lost-queue bug.
- Inventory reconciles; every stock movement has a source/actor.
- User-facing pending/conflicted/offline indicators are honest.
- Staff cannot query admin-only prices or report data.
- Browser and physical printer/scanner coverage documented.
- Database migrations, backup restore, incident rollback and register recovery are rehearsed.
- Owner approves workflows, invoice policy and support operations.

---

## 13. Key questions to decide before financial launch

These are **not** answered by the uploaded PRD. We can bootstrap code while collecting answers, but do not invent policy:

1. Is this **one shop** or multiple stores? Are storefront and godown physically separate sellable locations?
2. What **GST/tax invoice**, rounding, customer name/phone, refund and bill-numbering requirements apply?
3. Are UPI and card transactions merely **cashier-recorded**, or must the system verify payment through a real payment provider?
4. May sales be finalized offline, or are they clearly **provisional** until server confirmation? Who resolves double-sold items?
5. Can staff set discounts? What is the maximum amount/percentage without owner authorization?
6. Which exact scanner, label printer, receipt printer, label sizes, OS/browser and connection methods are available?
7. How are returns/refunds approved, and how long after purchase are they allowed?
8. Do you need purchase orders, supplier outstanding balances, multi-godown transfers or customer loyalty in v1? (Not specified.)
9. What is the rollout/backup/support model and expected peak concurrent registers?

Track decisions in [`DECISIONS.md`](DECISIONS.md), each with an owner, date and architecture consequence.

---

## 14. How to execute the work one task at a time

**Workflow for each task:**

1. Read task ID, requirement origin and dependencies in `TASK_BACKLOG.md`.
2. Write acceptance criteria and at least one failure test before implementing the risky logic.
3. Implement only the vertical slice needed; avoid unrelated refactors.
4. Run relevant tests, lint/typecheck and a build.
5. Record test results and any decisions; commit with task ID, e.g. `chore(P1-01): bootstrap Next.js app`.
6. Mark the task done only when its acceptance criteria pass; then pick the next task.

### Task selected now: `P1-01 - Bootstrap app and repository`

Run the commands in [`TASK_01_BOOTSTRAP.md`](TASK_01_BOOTSTRAP.md). Its initial exit criteria are:

- `/` renders at `http://localhost:3000`.
- `pnpm-lock.yaml` and TypeScript/Tailwind/App Router config exist.
- `pnpm lint`, `pnpm typecheck` and `pnpm build` pass.
- Test tooling is installed and a smoke test passes.
- Initial commit created; no secrets committed.

**Then proceed to `P1-02 - Shell layouts and routing`**, while P0 decision discovery continues. Do not build a database or billing feature during this first task.

---

## 15. References and source reliability

**Requirements source:** Uploaded Maa Collection PRD, 12 pages, sections 1–11, referenced by page and section throughout this document. **The architecture, expanded schema, security decisions, offline reconciliation policy and phased task order are recommendations**, not quotations from the PRD.

**Browser/platform caveats:**
- Background Sync compatibility: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
- Web Bluetooth compatibility: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- Official Node release lifecycle: https://nodejs.org/en/about/previous-releases

This plan deliberately does **not** promise "zero downtime", universal auto-reconnect to peripherals, guaranteed globally accurate offline inventory, or automatic UPI confirmation without an integrated provider. Those claims would exceed what a browser-only PWA can guarantee.
