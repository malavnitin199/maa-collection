# Maa Collection - phased implementation backlog

**Use:** Execute tasks in sequence within each phase. A checked task means its acceptance criteria passed, not merely that code was written. IDs are stable for tickets/commits.  
**Source:** Uploaded Maa Collection PRD. Items flagged `[Design]` are necessary recommendations or unresolved scope, not explicit source requirements.

## P0 - Requirements, policies and risk decisions (parallel with P1)

- [ ] **P0-01** Confirm store/location model: single shop vs multiple, storefront/godown; document store and location IDs. **Done:** representative inventory transfer/search workflow agreed.
- [ ] **P0-02** Confirm GST invoice, receipt numbering, tax/rounding and gross vs net profit definitions. **Done:** sample real invoice approved; no ambiguous money calculations.
- [ ] **P0-03** Confirm tender policy: manually recorded cash/UPI/card vs verified gateway; offline tender restrictions. **Done:** payment state diagram agreed.
- [ ] **P0-04** Confirm offline oversell and conflict-resolution policy. **Done:** owner approves provisional-bill and discrepancy handling scenarios.
- [ ] **P0-05** Confirm role permission/discount/return/adjustment limits. **Done:** capability matrix reviewed.
- [ ] **P0-06** Confirm target Android/iPhone/desktop browsers, scanner and printer models/label sizes; obtain hardware for POC. **Done:** compatibility checklist recorded.
- [ ] **P0-07** Agree MVP acceptance scenarios, priority, expected devices, daily transaction volume and rollout owner. **Done:** sample shop day walkthrough sign-off.

## P1 - Application foundation

- [x] **P1-01** Bootstrap Next.js/TS/Tailwind/pnpm Git repository and tests. **Done:** dev/build/lint/typecheck/unit smoke all pass; initial commit. (Completed 2026-11-14; see PROGRESS.md verification log.)
- [x] **P1-02** Create basic `(auth)`, `(admin)` and `(pos)` route shells and responsive layouts. **Done:** `/login`, `/admin/dashboard`, `/pos` navigate on mobile and desktop, using placeholder data only. (Completed 2026-11-15 with dummy scan-to-sell demo; see PROGRESS.md.)
- [ ] **P1-03** Initialize shadcn/ui, typography/tokens and shared form/table/modal patterns. **Done:** design tokens and accessible mobile navigation used in both panels.
- [ ] **P1-04** Add environment schema, app configuration, logging/Error boundaries and error convention. **Done:** missing required server env fails clearly.
- [ ] **P1-05** Add CI workflow: lint, typecheck, tests and production build. **Done:** failing tests block merge.
- [ ] **P1-06** Add documented PR checklist, issue template, README, branch strategy and ADR template. **Done:** contributor can run project from clean machine.
- [ ] **P1-07** Hardware POC: sample barcode scanner input and printable label/receipt prototype (no integration promises). **Done:** actual device/browser results documented. [Design]

## P2 - PostgreSQL, schema, authentication and authorization

- [ ] **P2-01** Stand up disposable PostgreSQL via Docker; define migration/development/seeding rules. **Done:** database starts from documented commands.
- [ ] **P2-02** Implement normalized schema: store, staff memberships, brands, categories, suppliers, products, SKU variants, locations, balances. **Done:** uniqueness and FK tests pass.
- [ ] **P2-03** Implement append-only `stock_movements`, stock receipts/lines, sale headers/lines/payments, returns/adjustments, sync operations, audit logs. **Done:** migrations run from empty DB and constraints tested.
- [ ] **P2-04** Integrate Better Auth and staff provisioning; no public sign-up. **Done:** owner login and staff login work; deactivated staff denied.
- [ ] **P2-05** Build server capabilities/permission checks and store scoping on every protected route. **Done:** direct API tests prove cashier can't view costs, profits or other stores.
- [ ] **P2-06** Define Zod schemas, API error codes, idempotency response model and canonical money/date types. **Done:** valid/invalid payload contract tests pass.
- [ ] **P2-07** Seed sample realistic brand/design/size/colour variants and two staff roles. **Done:** repeatable dev seed with test-only users.
- [ ] **P2-08** Add disposable DB integration test runner, migration checks and backup/restore guidance. **Done:** transactional tests use real PostgreSQL.

## P3 - Catalog, inventory and stock-in

- [ ] **P3-01** Owner can create/edit/archive brand, category and supplier. **Done:** permissions, validation, search tested.
- [ ] **P3-02** Owner creates product/design and size/colour SKUs with stable unique barcode. **Done:** variant uniqueness prevents duplicates.
- [ ] **P3-03** Owner edits MRP, cost and low-stock threshold; changes are audited. **Done:** cashier cannot fetch cost fields.
- [ ] **P3-04** Implement read-only cross-location stock lookup for staff with price, size and colour. **Done:** results show correct quantities and `last_updated`.
- [ ] **P3-05** Build stock-receipt screen and **atomic** receipt service with movement ledger. **Done:** receive 10 units once even if request retried.
- [ ] **P3-06** Record stock positions by location and quarantine status; optional stock transfer service. **Done:** movement reconciliation passes.
- [ ] **P3-07** Generate Code 128 tags and browser print view with shop, design, size, colour, MRP. **Done:** correct barcode resolves to SKU on tested scanner.
- [ ] **P3-08** Allow label reprint without stock receipt re-post. **Done:** printing twice changes zero inventory quantities.
- [ ] **P3-09** Add inventory history view and low-stock threshold marker. **Done:** owner sees source documents for every adjustment.

## P4 - Online cashier POS and receipts

- [ ] **P4-01** Define cart line/discount/price snapshot/domain event and money-rounding rules; write unit tests first. **Done:** totals consistent across items/tax policy.
- [ ] **P4-02** Implement keyboard-wedge scanner adapter with deliberate repeat-scan behaviour. **Done:** one scan adds one item; intentional repeated scans add multiple; blur/refocus tested.
- [ ] **P4-03** Add manual SKU and catalogue search fallback, cart quantity controls and removal. **Done:** torn barcode does not block billing.
- [ ] **P4-04** Persist draft cart in browser storage with restore test. **Done:** reload recovers draft without changing stock.
- [ ] **P4-05** Implement sale endpoint, server-side total calculation, atomic stock commit and immutable sale records. **Done:** no partial sale, no negative sellable stock under online policy.
- [ ] **P4-06** Implement unique `operation_id` idempotency and uncertain-response lookup. **Done:** retry never makes duplicate sale or stock decrement.
- [ ] **P4-07** Implement verified/manual/pending payment states per P0 decision and receipt numbering. **Done:** no false bank-verified status.
- [ ] **P4-08** Build receipt view/download/print (digital sharing only if approved provider). **Done:** receipt mirrors server-confirmed sale.
- [ ] **P4-09** Implement sale search/reprint and reconciliation view. **Done:** old receipt reprints without mutation.
- [ ] **P4-10** Add concurrency/integration tests for last item, rollback and duplicate submit. **Done:** all critical cases deterministic.
- [ ] **P4-11** Browser E2E: cashier receives item list, scans, discounts, pays and prints. **Done:** pass Chromium and mobile viewport.

## P5 - Returns, exchanges and audit controls

- [ ] **P5-01** Define allowed return window, linked original sale line and refundable quantity. **Done:** no over-return or unauthorized reverse.
- [ ] **P5-02** Implement return flow with restock/quarantine selection and reversal records. **Done:** stock and payment adjustments audit correctly.
- [ ] **P5-03** Implement single-transaction size exchange (M return + L sale). **Done:** either both stock legs commit or neither does.
- [ ] **P5-04** Implement damaged/defective quarantine and owner-approved write-off. **Done:** quarantined stock cannot be sold.
- [ ] **P5-05** Add stock adjustment approvals, reason codes, audit event browsing and role limits. **Done:** lost/missing stock requires correct authorization.
- [ ] **P5-06** E2E and DB tests for duplicate returns, exchange rollback, partial refunds and audit history. **Done:** all critical paths pass.

## P6 - Offline POS and synchronization reliability

- [ ] **P6-01** Define stable offline operation schemas, client UUIDs, device/register identity and state machine. **Done:** `PENDING_SYNC`, `COMMITTED`, `NEEDS_REVIEW`, `REJECTED` documented.
- [ ] **P6-02** Introduce Dexie schema for cached cashier-safe catalog, active cart, pending operations and sync results. **Done:** can reload while offline.
- [ ] **P6-03** Enqueue operation durably before attempting remote checkout; do not delete on timeout. **Done:** crash/restart test passes.
- [ ] **P6-04** Build idempotent server sync endpoint that validates session, actor, store and operation UUID. **Done:** same request sent N times posts once.
- [ ] **P6-05** Support sync on app open, reconnect, focus, manual button and backoff; service-worker Background Sync only where supported. **Done:** browser matrix has fallback.
- [ ] **P6-06** Implement provisional offline receipt and clear pending indicator. **Done:** customer is not told payment/stock is confirmed before server ack.
- [ ] **P6-07** Handle stock conflicts with owner review queue and explicit resolutions. **Done:** competing offline sale cannot silently overwrite inventory.
- [ ] **P6-08** Cache versions and updates safely during pending transactions; support storage quota problems. **Done:** SW update does not drop queued operations.
- [ ] **P6-09** Handle shared-device logout/session changes without exposing or silently losing pending operations. **Done:** approved recovery flow tested.
- [ ] **P6-10** Offline browser E2E: timeout, crash, restart, duplicate, conflicting devices and delayed UPI. **Done:** test matrix passes.

## P7 - Owner dashboard, reporting and reorder intelligence

- [ ] **P7-01** Implement day/month sales and units sold, scoped to shop timezone. **Done:** ties to immutable sales ledger.
- [ ] **P7-02** Implement gross profit using historical cost snapshots, separated from net-profit terminology. **Done:** price edits cannot rewrite past margin.
- [ ] **P7-03** Owner reporting by brand, category, product/variant, cashier and tender method. **Done:** cashier endpoints do not leak owner data.
- [ ] **P7-04** Low-stock threshold list by SKU/location. **Done:** alert matches current sellable inventory.
- [ ] **P7-05** 7-, 30-, 90-day velocity report with clearly labeled insufficient-history conditions. **Done:** historical samples tested.
- [ ] **P7-06** Simple reorder suggestion based on daily velocity, lead time and safety buffer (once P0 assumptions agreed). **Done:** deterministic, explainable formula and test cases.
- [ ] **P7-07** Dashboard drill-down and safe CSV export; no sensitive cashier export. **Done:** permission and data tests pass.

## P8 - Hardware validation, operational hardening and rollout

- [ ] **P8-01** Test specified USB/Bluetooth HID scanners on actual target devices; manual input fallback always works. **Done:** hardware report and operator instructions.
- [ ] **P8-02** Test camera scan and permissions on approved browsers/devices. **Done:** failure UX and fallback work.
- [ ] **P8-03** Calibrate label and receipt printers, sizes/margins and reprint; use local/native bridge only if actual printers demand it. **Done:** real tag scan succeeds after print.
- [ ] **P8-04** Review auth, API permission boundaries, dependency audit, secret management and device session policy. **Done:** high-severity issues fixed.
- [ ] **P8-05** Add tracing/healthcheck, exception monitoring and sync backlog health metrics. **Done:** operations staff can identify stuck devices.
- [ ] **P8-06** Migrations and tested database backup/restore; release rollback and disaster-recovery runbook. **Done:** restore rehearsal passes.
- [ ] **P8-07** Performance/accessibility testing for low-end Android and busy checkout workflows. **Done:** agreed targets met on target devices.
- [ ] **P8-08** Pilot a complete shop day: stock-in → label → scan/sale → return/exchange → close report → offline/reconnect. **Done:** owner signs off with no critical unresolved discrepancy.
- [ ] **P8-09** Create owner/cashier onboarding and troubleshooting checklist. **Done:** staff can operate without developer at checkout.
- [ ] **P8-10** Production deployment, monitoring, domain/HTTPS, data retention and sign-off. **Done:** release checklist approved.

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

**Next task after `P1-01`:** `P1-02` (create admin/pos/login shell routes using placeholder content). Do not begin business transaction implementation until foundation and database authorization are in place.
