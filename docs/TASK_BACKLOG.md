# Maa Collection - phased implementation backlog

**Use:** Execute tasks in sequence within each phase. A checked task means its acceptance criteria passed, not merely that code was written. IDs are stable for tickets/commits.  
**Source:** Uploaded Maa Collection PRD. Items flagged `[Design]` are necessary recommendations or unresolved scope, not explicit source requirements.

## P0 - Requirements, policies and risk decisions (parallel with P1)

- [ ] **P0-01** Confirm store/location model: single shop vs multiple, storefront/godown; document store and location IDs. **Done:** representative inventory transfer/search workflow agreed.
- [ ] **P0-02** Confirm GST invoice, receipt numbering, tax/rounding and gross vs net profit definitions. **Done:** sample real invoice approved; no ambiguous money calculations.
- [ ] **P0-03** Confirm tender policy: manually recorded cash/UPI/card vs verified gateway; offline tender restrictions. **Done:** payment state diagram agreed.
- [x] **P0-04** Confirm offline oversell and conflict-resolution policy. **Done:** owner approves provisional-bill and discrepancy handling scenarios. *(2026-11-19, ADR-032: owner chose "let stock go below zero"; offline sales always recorded, checked in Approvals.)*
- [ ] **P0-05** Confirm role permission/discount/return/adjustment limits. **Done:** capability matrix reviewed.
- [ ] **P0-06** Confirm target Android/iPhone/desktop browsers, scanner and printer models/label sizes; obtain hardware for POC. **Done:** compatibility checklist recorded.
- [ ] **P0-07** Agree MVP acceptance scenarios, priority, expected devices, daily transaction volume and rollout owner. **Done:** sample shop day walkthrough sign-off.

## P1 - Application foundation

- [x] **P1-01** Bootstrap Next.js/TS/Tailwind/pnpm Git repository and tests. **Done:** dev/build/lint/typecheck/unit smoke all pass; initial commit. (Completed 2026-11-14; see PROGRESS.md verification log.)
- [x] **P1-02** Create basic `(auth)`, `(admin)` and `(pos)` route shells and responsive layouts. **Done:** `/login`, `/admin/dashboard`, `/pos` navigate on mobile and desktop, using placeholder data only. (Completed 2026-11-15 with dummy scan-to-sell demo; see PROGRESS.md.)
- [ ] **P1-03** Initialize shadcn/ui, typography/tokens and shared form/table/modal patterns. **Done:** design tokens and accessible mobile navigation used in both panels.
- [ ] **P1-04** Add environment schema, app configuration, logging/Error boundaries and error convention. **Done:** missing required server env fails clearly.
- [ ] **P1-05** Add CI workflow: lint, typecheck, tests and production build. **Done:** failing tests block merge. **Partial:** a GitHub Actions workflow (lint, typecheck, unit tests, build, e2e) is written on branch `ci-workflow` but is **not on `main` yet** — pushing it needs the GitHub token's `workflow` scope (corrected 2026-11-16; the quality gate is run locally before every push). Blocking merges then needs branch protection on `main` (owner action).
- [ ] **P1-06** Add documented PR checklist, issue template, README, branch strategy and ADR template. **Done:** contributor can run project from clean machine. **Partial (2026-11-15):** README with clean-machine setup verified on a fresh clone. PR checklist, issue template, branch strategy and ADR template not done.
- [ ] **P1-07** Hardware POC: sample barcode scanner input and printable label/receipt prototype (no integration promises). **Done:** actual device/browser results documented. [Design]

## P2 - PostgreSQL, schema, authentication and authorization

- [x] **P2-01** Stand up disposable PostgreSQL via Docker; define migration/development/seeding rules. **Done:** database starts from documented commands. (Done 2026-11-15, **deviation:** Neon Postgres in production and PGlite embedded Postgres locally instead of Docker; `pnpm dev` needs no setup; migrations `pnpm db:generate` / `db:migrate`, seed `db:seed`; ADR-006.)
- [ ] **P2-02** Implement normalized schema: store, staff memberships, brands, categories, suppliers, products, SKU variants, locations, balances. **Done:** uniqueness and FK tests pass. **Partial (2026-11-15):** stores, staff, products (each product = one size/colour variant) with uniqueness constraints. No separate brand/category/supplier/location/balance tables yet.
- [ ] **P2-03** Implement append-only `stock_movements`, stock receipts/lines, sale headers/lines/payments, returns/adjustments, sync operations, audit logs. **Done:** migrations run from empty DB and constraints tested. **Partial (2026-11-15):** append-only `stock_movements`, `sales`, `exchanges` with check constraints. No receipts/payments/returns-only/sync/audit-log tables.
- [x] **P2-04** Integrate Better Auth and staff provisioning; no public sign-up. **Done:** owner login and staff login work; deactivated staff denied. (Done 2026-11-15, **deviation:** name + PIN login with signed session instead of Better Auth, ADR-007; admin adds staff, no sign-up; deactivated staff denied — unit-tested.)
- [ ] **P2-05** Build server capabilities/permission checks and store scoping on every protected route. **Done:** direct API tests prove cashier can't view costs, profits or other stores. **Partial (2026-11-15):** every page/action checks session + role on the server; cost excluded from the counter DTO (unit-tested). Single store constant, no multi-store scoping tests; no direct HTTP-level permission tests.
- [ ] **P2-06** Define Zod schemas, API error codes, idempotency response model and canonical money/date types. **Done:** valid/invalid payload contract tests pass. **Partial (2026-11-15):** Zod on all server-action inputs, `operation_id` idempotency, integer paise. No API error-code catalogue or contract tests.
- [x] **P2-07** Seed sample realistic brand/design/size/colour variants and two staff roles. **Done:** repeatable dev seed with test-only users. (Done 2026-11-15: 8 demo products, Owner admin + 4 salesmen; dev/test PIN 1234 only, random PINs in production.)
- [ ] **P2-08** Add disposable DB integration test runner, migration checks and backup/restore guidance. **Done:** transactional tests use real PostgreSQL. **Partial (2026-11-15):** service tests run in transactions on a real Postgres engine (PGlite, fresh per test). No backup/restore guidance yet.

## P3 - Catalog, inventory and stock-in

- [ ] **P3-01** Owner can create/edit/archive brand, category and supplier. **Done:** permissions, validation, search tested.
- [x] **P3-02** Owner creates product/design and size/colour SKUs with stable unique barcode. **Done:** variant uniqueness prevents duplicates. (Done 2026-11-15 in simplified form: one product row per size/colour; generated SKU + unique in-store EAN-13 or manufacturer barcode; duplicates rejected — unit-tested.)
- [ ] **P3-03** Owner edits MRP, cost and low-stock threshold; changes are audited. **Done:** cashier cannot fetch cost fields. **Partial (2026-11-15):** admin edits MRP, selling price, cost; salesmen never receive cost. Low-stock threshold is one global value; edits are not audited yet.
- [ ] **P3-04** Implement read-only cross-location stock lookup for staff with price, size and colour. **Done:** results show correct quantities and `last_updated`.
- [x] **P3-05** Build stock-receipt screen and **atomic** receipt service with movement ledger. **Done:** receive 10 units once even if request retried. (Done 2026-11-15: `stock_receipts` with `operation_id`; restock screen and product stock-in both retry-safe — unit-tested.)
- [ ] **P3-06** Record stock positions by location and quarantine status; optional stock transfer service. **Done:** movement reconciliation passes.
- [x] **P3-07** Generate Code 128 tags and browser print view with shop, design, size, colour, MRP. **Done:** correct barcode resolves to SKU on tested scanner. (Done 2026-11-15, **deviation:** EAN-13 instead of Code 128 (owner decision ADR-005); print view with name, size, colour, MRP; scans resolve to the product via camera.)
- [x] **P3-08** Allow label reprint without stock receipt re-post. **Done:** printing twice changes zero inventory quantities. (Done 2026-11-15: labels print from product data; printing never touches stock.)
- [ ] **P3-09** Add inventory history view and low-stock threshold marker. **Done:** owner sees source documents for every adjustment. **Partial (2026-11-15):** per-product stock history (reason, who, when, note) and low-stock list. History rows don't link through to the sale/exchange document yet.

## P4 - Online cashier POS and receipts

- [ ] **P4-01** Define cart line/discount/price snapshot/domain event and money-rounding rules; write unit tests first. **Done:** totals consistent across items/tax policy.
- [ ] **P4-02** Implement keyboard-wedge scanner adapter with deliberate repeat-scan behaviour. **Done:** one scan adds one item; intentional repeated scans add multiple; blur/refocus tested. **Partial (2026-11-15):** wedge-scanner input works without focusing the box and never presses a focused button (e2e-tested). Cart-related repeat-scan rules N/A: no cart (ADR-004).
- [ ] **P4-03** Add manual SKU and catalogue search fallback, cart quantity controls and removal. **Done:** torn barcode does not block billing. **Partial (2026-11-15):** manual SKU/barcode entry works. No catalogue search at the counter; cart controls N/A (ADR-004).
- [ ] **P4-04** Persist draft cart in browser storage with restore test. **Done:** reload recovers draft without changing stock.
- [x] **P4-05** Implement sale endpoint, server-side total calculation, atomic stock commit and immutable sale records. **Done:** no partial sale, no negative sellable stock under online policy. (Done 2026-11-15: server computes totals, atomic stock guard, immutable sales; oversell refused — unit- and e2e-tested.)
- [x] **P4-06** Implement unique `operation_id` idempotency and uncertain-response lookup. **Done:** retry never makes duplicate sale or stock decrement. (Done 2026-11-15: client sends one `operation_id` per sale/exchange; retries return the original record — unit-tested.)
- [ ] **P4-07** Implement verified/manual/pending payment states per P0 decision and receipt numbering. **Done:** no false bank-verified status.
- [ ] **P4-08** Build receipt view/download/print (digital sharing only if approved provider). **Done:** receipt mirrors server-confirmed sale.
- [ ] **P4-09** Implement sale search/reprint and reconciliation view. **Done:** old receipt reprints without mutation.
- [ ] **P4-10** Add concurrency/integration tests for last item, rollback and duplicate submit. **Done:** all critical cases deterministic. **Partial (2026-11-15):** duplicate submit and oversell are tested. No true concurrent last-item test yet.
- [ ] **P4-11** Browser E2E: cashier receives item list, scans, discounts, pays and prints. **Done:** pass Chromium and mobile viewport.

## P5 - Returns, exchanges and audit controls

- [ ] **P5-01** Define allowed return window, linked original sale line and refundable quantity. **Done:** no over-return or unauthorized reverse. **Partial (2026-11-15):** exchanges link to the original sale and can't exceed the units still returnable (tested). Return window pending owner decision D-EX-1.
- [ ] **P5-02** Implement return flow with restock/quarantine selection and reversal records. **Done:** stock and payment adjustments audit correctly.
- [x] **P5-03** Implement single-transaction size exchange (M return + L sale). **Done:** either both stock legs commit or neither does. (Done 2026-11-15: return leg + issue leg + exchange record in one transaction; rollback if the new item is out of stock — unit- and e2e-tested.)
- [ ] **P5-04** Implement damaged/defective quarantine and owner-approved write-off. **Done:** quarantined stock cannot be sold.
- [ ] **P5-05** Add stock adjustment approvals, reason codes, audit event browsing and role limits. **Done:** lost/missing stock requires correct authorization.
- [ ] **P5-06** E2E and DB tests for duplicate returns, exchange rollback, partial refunds and audit history. **Done:** all critical paths pass. **Partial (2026-11-15):** duplicate exchange, over-return and failed-exchange rollback tested. Refunds/returns-only not built.

## P6 - Offline POS and synchronization reliability

- [ ] **P6-01** Define stable offline operation schemas, client UUIDs, device/register identity and state machine. **Done:** `PENDING_SYNC`, `COMMITTED`, `NEEDS_REVIEW`, `REJECTED` documented. *(v18: `QueuedSale` waiting → sent (removed) / problem (refused, reason kept); no device / register identity yet.)*
- [x] **P6-02** Introduce Dexie schema for cached cashier-safe catalog, active cart, pending operations and sync results. **Done:** can reload while offline. *(v18: IndexedDB copy of the counter's items (no cost) + offline helper; the counter reloads offline. A small IndexedDB layer instead of Dexie.)*
- [ ] **P6-03** Enqueue operation durably before attempting remote checkout; do not delete on timeout. **Done:** crash/restart test passes. *(v18: queued when the shop is unreachable or does not answer in 6/12 s, never deleted on a timeout; online sales are still sent first — no crash/restart test yet.)*
- [x] **P6-04** Build idempotent server sync endpoint that validates session, actor, store and operation UUID. **Done:** same request sent N times posts once. *(v18: `POST /api/offline-sales`, same `recordSale` + `operationId`; recorder must be the session.)*
- [ ] **P6-05** Support sync on app open, reconnect, focus, manual button and backoff; service-worker Background Sync only where supported. **Done:** browser matrix has fallback. *(v18: on app open, reconnect, every 30 s, Send now, one run across tabs; no Background Sync; one browser (Chromium) tested.)*
- [x] **P6-06** Implement provisional offline receipt and clear pending indicator. **Done:** customer is not told payment/stock is confirmed before server ack. *(v18: "Saved on this phone" card, header strip with count, list; no printed receipt.)*
- [x] **P6-07** Handle stock conflicts with owner review queue and explicit resolutions. **Done:** competing offline sale cannot silently overwrite inventory. *(v18: owner chose to record them; stock moves by append-only deltas (never overwritten) and may go below zero; every such sale is in Approvals with a "Made offline" mark.)*
- [ ] **P6-08** Cache versions and updates safely during pending transactions; support storage quota problems. **Done:** SW update does not drop queued operations. *(v18: the helper never touches saved sales (IndexedDB); localStorage fallback when storage fails; no quota screen yet.)*
- [x] **P6-09** Handle shared-device logout/session changes without exposing or silently losing pending operations. **Done:** approved recovery flow tested. *(v18: sales are sent only by the person who made them; logout warns and keeps them; saved counter page deleted at login and logout.)*
- [ ] **P6-10** Offline browser E2E: timeout, crash, restart, duplicate, conflicting devices and delayed UPI. **Done:** test matrix passes. *(v18: offline sale, by hand, reload offline, QR link, below-zero stock, duplicate send (unit); not yet: crash, two devices, UPI.)*

## P7 - Owner dashboard, reporting and reorder intelligence

- [x] **P7-01** Implement day/month sales and units sold, scoped to shop timezone. **Done:** ties to immutable sales ledger. (Done 2026-11-15: today/month in Asia/Kolkata from the sales ledger, including an IST midnight boundary test.)
- [x] **P7-02** Implement gross profit using historical cost snapshots, separated from net-profit terminology. **Done:** price edits cannot rewrite past margin. (Done 2026-11-15: cost snapshot stored on each sale; shown as "estimated profit" on the admin dashboard.)
- [ ] **P7-03** Owner reporting by brand, category, product/variant, cashier and tender method. **Done:** cashier endpoints do not leak owner data. **Partial (2026-11-15):** reporting by salesperson (credited) for today/month. No brand/category/product/tender breakdowns yet.
- [x] **P7-04** Low-stock threshold list by SKU/location. **Done:** alert matches current sellable inventory. (Done 2026-11-15: low-stock list from current stock with one global threshold; single location.)
- [ ] **P7-05** 7-, 30-, 90-day velocity report with clearly labeled insufficient-history conditions. **Done:** historical samples tested.
- [ ] **P7-06** Simple reorder suggestion based on daily velocity, lead time and safety buffer (once P0 assumptions agreed). **Done:** deterministic, explainable formula and test cases.
- [ ] **P7-07** Dashboard drill-down and safe CSV export; no sensitive cashier export. **Done:** permission and data tests pass.

## P8 - Hardware validation, operational hardening and rollout

- [ ] **P8-01** Test specified USB/Bluetooth HID scanners on actual target devices; manual input fallback always works. **Done:** hardware report and operator instructions.
- [ ] **P8-02** Test camera scan and permissions on approved browsers/devices. **Done:** failure UX and fallback work. **Partial (2026-11-15):** camera confirmed working by the owner on their phone; denial/no-camera/HTTPS errors handled. Formal browser/device matrix not recorded.
- [ ] **P8-03** Calibrate label and receipt printers, sizes/margins and reprint; use local/native bridge only if actual printers demand it. **Done:** real tag scan succeeds after print.
- [ ] **P8-04** Review auth, API permission boundaries, dependency audit, secret management and device session policy. **Done:** high-severity issues fixed.
- [ ] **P8-05** Add tracing/healthcheck, exception monitoring and sync backlog health metrics. **Done:** operations staff can identify stuck devices.
- [ ] **P8-06** Migrations and tested database backup/restore; release rollback and disaster-recovery runbook. **Done:** restore rehearsal passes.
- [ ] **P8-07** Performance/accessibility testing for low-end Android and busy checkout workflows. **Done:** agreed targets met on target devices.
- [ ] **P8-08** Pilot a complete shop day: stock-in → label → scan/sale → return/exchange → close report → offline/reconnect. **Done:** owner signs off with no critical unresolved discrepancy.
- [ ] **P8-09** Create owner/cashier onboarding and troubleshooting checklist. **Done:** staff can operate without developer at checkout.
- [ ] **P8-10** Production deployment, monitoring, domain/HTTPS, data retention and sign-off. **Done:** release checklist approved. **Partial (2026-11-15):** live on Vercel with HTTPS (https://maa-collection-pi.vercel.app). Monitoring, custom domain, retention policy and sign-off not done.

---

## Per-task template

```md
### [ID] [Task title]
- Requirement reference: PRD page/section or [Design]
- Dependencies:
- Objective:
- Files likely changed:
- Business rules / security:
- Test cases: happy path + rejection/failure path
- Acceptance criteria:
- Verification commands / evidence:
- Status: TODO / IN PROGRESS / BLOCKED / DONE
```

## Owner-requested work outside the original phases (plan v2, done 2026-11-15)

- [x] **V2-01** Sale on behalf of a colleague: store `sold_by` (credited) and `recorded_by` on sales and exchanges (ADR-008). Unit- and e2e-tested.
- [x] **V2-02** Salesman dashboard `/pos/my-sales`: own today/month totals, sales recorded for others, recent activity.
- [x] **V2-03** Admin staff management: add people, set PINs, activate/deactivate; last active admin protected.
- [x] **V2-04** Admin activity log of all sales and exchanges.
- [x] **V2-06** Plan v3: owner-granted permissions (catalog/QC, prices, stock, purchase price), product photos, Tag old stock with today's labels, in-app help + user guide.
- [x] **V2-05** Owner stock workflow: suppliers, categories, sizes × colours entry with generated barcodes, per-piece labels, scan-to-restock, design-wide rates, phone tab bar.
- [x] **V2-07** Plan v12 (2026-11-16): sell without scanning (item name + price typed, no stock change) and the owner's approval queue — every salesman sale / exchange waits for Approve / Reject; only approved entries count. `docs/PLAN_V12_HAND_ENTRY_APPROVALS.md`, ADR-022.
- [x] **V2-08** Plan v13 (2026-11-16): **All tags** — every generated tag grouped by date / company / category / delivery, filters, Grid or sideways Rows, print one group; links from print pages and company pages. `docs/PLAN_V13_TAG_LIBRARY.md`, ADR-023.
- [x] **V2-09** Plan v14 (2026-11-16): **combined view** — one card per design (same name, company, MRP) on Products and All tags with sizes / colours / pieces and a design QR; every item / tag one tap away; print one design. `docs/PLAN_V14_COMBINED_VIEW.md`, ADR-024.
- [x] **V2-10** Plan v15 (2026-11-16): **cleaner UI** — header of round symbols only, pictures and gentle motion, counter card led by price / size / stock, shorter Home. `docs/PLAN_V15_UI_CLEANUP.md`, ADR-025.
- [x] **V2-11** Plan v16 (2026-11-17): **Bahi theme** (billing-app look, default; dye themes still selectable) — owner feedback pending. `docs/PLAN_V16_BAHI_THEME.md`, ADR-026.
- [x] **V2-12** Plan v17 (2026-11-18/19): **Essential Home** (4 actions + today's sales); Add stock = **New item** + 2 other ways; New item and the product page in one **minimal layout** (name, category, size pills, For / Age tags, photo on the right; company, sale and purchase price; top tabs Details · Colours · Other details); **+ Add next item**; For / Age tags stored per design (migration 0008); forms clear after saving. `docs/PLAN_V17_ESSENTIAL_HOME_NEW_ITEM.md`, ADR-027.
- [x] **V2-13** Plan v18 (2026-11-19): **selling without internet** (phone's copy of the items, sales saved on the phone and sent by themselves, offline helper) and a **bigger header**. `docs/PLAN_V18_OFFLINE_COUNTER.md`, ADR-032.
- [ ] **V19** Plan v19 (approved 2026-11-19, ADR-033): category-first New item, Products, product page, company bills, salesperson profiles — tasks V19-00 … V19-08 in `docs/PLAN_V19_PRODUCT_MANAGEMENT.md`. **V19-00** (untangle) — **done 2026-11-19**. **V19-02a** (sections on the server: migration 0010, backfill script, a new item needs section + type) — **done 2026-11-19**. **V19-02b** (Categories screen: section tiles, Hindi names, pictures, order, hide, *Needs sorting → Move under*) — **done 2026-11-19**. **V19-02c** (docs, ADR-034) — **done 2026-11-19**. **V19-03a** (New item step by step) — **done 2026-11-19**; **04b in part** (the steps are `/admin/stock/new`, old form at `/admin/stock/form`, *Add next item* keeps company / section / bill / date, Categories set-up button) — **done 2026-11-19**. Next **V19-04a** (Save / Save & add next) or **03b**. `main` needs migration 0010 on Neon before its next deploy; production serves branch `prod-v18` until V19-04e.

## Suggested next tasks

2. **P0-02 / P0-03 → P4-07, P4-08:** GST rules, receipt numbering, payment method (cash/UPI), receipts.
3. **P5-01 / P5-02:** owner decision D-EX-1 / D-RF-1, then refunds and the exchange time limit.
4. **P1-03:** shadcn/ui shared components once screens settle.

Plan v2 details: `docs/PLAN_V2_SHOP_OPERATIONS.md`.
