# The original starter pack (2026-11-14) and what became of it

Before any code existed, the project started from a **starter pack** of planning documents (made 2026-11-14 from the 12-page PRD). Those files have since grown into today's docs. This page keeps their context: what the starter pack said, what was decided or built since, and where the untouched originals are kept.

**Originals, unchanged:** `docs/archive/starter-pack-2026-11-14/` (in Git, and in the parent folder's `docs/archive/` with every file incl. the PDFs). The first Git commit (`2d6a9a9`, 2026-11-14) also has them.

## 1. What was in the starter pack

| File | What it was | Today |
|---|---|---|
| `PROJECT_CONTEXT.md` | One-page brief: product, PRD as the source, proposed stack, domain rules, team workflow; status "Not started" | Same file, kept current (status through plan v9) |
| `SOURCE_PRD.pdf` | The 12-page *Retail Shop Stock, Sales & Billing System* PRD — the business source of truth | Unchanged |
| `PROJECT_BLUEPRINT.md` / `.pdf` | Full proposed architecture (a recommendation, not settled requirements) | Unchanged; much of it was simplified in practice (section 5) |
| `DECISIONS.md` | 14 questions D-01…D-14 (proposed / open), a decision template and an 8-step "sample shop day" | Same file + newer questions (D-EX-1, D-PR-1, D-RF-1, D-PERM-1, D-QR-1, D-TAG-1, D-LANG-1/2, D-IMG-1, D-ST-1/2) |
| `DECISION_LOG.md` | ADR-001…003, all "Proposed" | ADR-001…019 |
| `TASK_BACKLOG.md` | Phases P0–P8 with task IDs and "done when" checks | Same file with P1–P4 items ticked / marked partial |
| `TASK_01_BOOTSTRAP.md` | Instructions for the first coding task (P1-01) | Unchanged; done 2026-11-14 |
| `PROGRESS.md` | Empty log: P1-01 next, nothing verified | 249-line log of every round with test results |

## 2. The starter plan in brief

- **Product:** mobile-first clothing shop inventory + POS for **owner and cashier** roles: catalog by brand / category / design / size / colour, stock receipts, printable barcodes, fast online checkout with a **cart**, returns / exchanges / damage, owner analytics and reorder guidance, an **offline-capable cashier**.
- **Proposed stack:** Next.js App Router, TypeScript, Tailwind, **shadcn/ui**; PostgreSQL + Drizzle; **Better Auth**; Zod; **TanStack Query, Zustand, Dexie** (offline); PWA service worker; Vitest + Playwright; pnpm; **Docker** Postgres for development.
- **Rules that still stand:** cost / profit hidden from cashiers on the server; append-only sales and stock movements; server is the authority (transactions + idempotency keys); offline sales provisional until the server accepts them; money as integer paise.
- **Workflow:** one backlog task at a time, plan first, tests with each task, record verified results in `PROGRESS.md`.
- **Status then:** not started; P1-01 bootstrap next; all P0 policy questions open.

## 3. The 14 starter questions, then and now

| ID | Topic | Starter proposal | Now (2026-11-16) |
|---|---|---|---|
| D-01 | React or Next.js | Next.js App Router | **Built** on Next.js 16 (ADR-001) |
| D-02 | Database | PostgreSQL + Drizzle | **Built**: Neon Postgres in production, PGlite locally (ADR-002, ADR-006) |
| D-03 | Auth | Better Auth, owner-provisioned | **Changed**: name + PIN login, owner adds staff, no sign-up (ADR-007) |
| D-04 | Stores and locations | One store with storefront / godown / quarantine | One store, `store_id` on every record; **no locations / quarantine yet** — open |
| D-05 | GST and legal invoice | No tax formula invented | **Open** — no invoices yet |
| D-06 | Payment modes | Manual tender record | **Open** — payments not recorded yet |
| D-07 | Offline oversell | Cash-only provisional checkout + owner audit | **Open** — offline selling not built |
| D-08 | Discount authority | Cashier limits set by owner | Salesman enters the **bargained price ≤ MRP** (ADR-004); a minimum price is open (D-PR-1) |
| D-09 | Return / exchange | Linked to the original sale, no over-return | **Exchanges built**, linked to the sale; refund-only returns open (D-RF-1, D-EX-1) |
| D-10 | Hardware | USB/Bluetooth scanner, tested label printer | Phone camera + USB/Bluetooth scanners work; tags for A4, 40 × 60 mm tag printer, 50 × 25 mm sticker; specific printer models not yet validated |
| D-11 | Receipt numbering | Server sequence, provisional offline slip | **Open** — no receipts yet |
| D-12 | Gross vs net profit | Call it gross profit | Dashboard shows **estimated profit** (selling − purchase price, items with a purchase price); never "net profit" |
| D-13 | Inventory source of truth | Append-only movements + balance | **Built**: append-only `stock_movements` + `products.stock` |
| D-14 | MVP / go-live | Online pilot first, offline later | **Online app live** since 2026-11-15; offline not started |

Starter ADRs: ADR-001 (Next.js) and ADR-002 (Postgres ledger) are built; ADR-003 (offline sales provisional) still stands as the rule for when offline is built.

## 4. The starter backlog, phase by phase

| Phase | Starter intent | What happened |
|---|---|---|
| P0 Policies | Owner answers on stores, GST, payments, offline, discounts, hardware, MVP | Answered as features were asked for (cart dropped, bargaining, EAN-13 + QR tags, rights per person); GST, payments, offline still open |
| P1 Foundation | Bootstrap, route shells, shadcn, env, CI, README, hardware POC | Bootstrap + shells done; README done; a CI workflow is written (branch `ci-workflow`) but not on `main` yet (pushing it needs the GitHub token's `workflow` scope); shadcn not used (own components, plan v8 look) |
| P2 Data + auth | Docker Postgres, full schema, Better Auth, permissions, Zod, seed, DB tests | Done in simpler form: Neon/PGlite, PIN auth, rights per person (ADR-009), Zod, seed, PGlite tests |
| P3 Catalog + stock-in | Brands/categories/suppliers, SKUs, stock receipts, Code 128 labels, history | Done and extended: suppliers, categories with sizes, quick add, sizes × colours with prices by size, restock, tag old stock, photos, EAN-13 + QR hang tags |
| P4 Online POS | Cart, scanner, search, sale endpoint, idempotency, payments, receipts | Scan-to-sell **without a cart** (ADR-004), idempotent sales, scan feedback; payments and receipts not yet |
| P5 Returns + audit | Returns, exchanges, quarantine, adjustments | Exchanges done; returns, quarantine, stock corrections (D-ST-2) not yet |
| P6 Offline | Dexie queue, sync, conflicts | Not started |
| P7 Owner reports | Day/month sales, profit, reports, low stock, reorder | Dashboard, reports + CSV, low stock, sales team dashboard done; reorder suggestions not yet |
| P8 Hardening | Hardware tests, security review, monitoring, backups | Not started as a phase |

**Sample shop day (starter `DECISIONS.md`)**: steps 1–3 (receive, label, sell with stock going down) and 4 (size exchange) work today, and 6 (two phones, last piece: only one sale succeeds) is enforced by the server. Step 5 (quarantine), step 7 (offline sale) and the payment/receipt parts of steps 3 and 8 are not built yet.

## 5. The biggest changes from the starter plan

| Starter assumption | What the shop has now | Why |
|---|---|---|
| Cashier with a multi-item **cart** | **Scan-to-sell**, one item at a time, salesman types the bargained price; sale credited to a colleague if needed | Every customer bargains a different price (ADR-004, ADR-008) |
| **Code 128** labels | **EAN-13** barcodes, then **40 × 60 mm QR hang tags** with all sizes and tick boxes | One code per item, works with cheap scanners; tags like branded stores (ADR-005, ADR-014, ADR-015) |
| Better Auth accounts | **Name + PIN** on a number keypad | Fast at the counter (ADR-007) |
| Two roles | Owner + salesmen, with **rights per person** (catalog, prices, stock, purchase price) | A salesman can be the catalog / QC person (ADR-009) |
| Docker Postgres | **Neon** (production) + **PGlite** (local, tests) | No setup on the owner's Mac (ADR-006) |
| shadcn, TanStack Query, Zustand, Dexie | Not used; own small components | Not needed yet; offline not started |
| English UI | **Hindi + English**, per person | Counter staff read Hindi more easily (ADR-017) |
| — (not in the starter) | Prices by size, category size lists, product photos, sales team dashboard, five colour themes + day/night, Guide with voice and practice, edit after tagging | Owner requests, plans v3–v9 |

For everything since, read `docs/PROJECT_CONTEXT.md` (current state), `docs/DECISION_LOG.md` and `docs/PROGRESS.md`.
