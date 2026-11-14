# Architecture & product decision log (living)

Record agreed decisions here. Do not treat provisional ideas as final.

| ID | Date | Status | Decision | Rationale | Impact |
|---|---|---|---|---|---|
| ADR-001 | 2026-11-14 | Proposed | Next.js App Router in one repository | Built-in server layer supports secure business operations; POS remains client-heavy | Foundation |
| ADR-002 | 2026-11-14 | Proposed | PostgreSQL with transactional sales/stock ledger | Atomic checkout, constraints, audits | P2 onward |
| ADR-003 | 2026-11-14 | Proposed | Offline sales remain provisional pending sync | Offline counters cannot know real-time final stock across devices | P6 |
| ADR-004 | 2026-11-15 | Confirmed by owner (chat) | Scan-to-sell without a multi-item cart: each scan deducts stock and records one sale with a per-customer bargained unit price entered by the salesperson, attributed to that salesperson | Owner: every customer negotiates a different price; MRP is only a ceiling | POS flow (P4) stores the entered price and an MRP snapshot per sale line. MRP cap is an engineering assumption pending owner confirmation (relates to D-08). |
| ADR-005 | 2026-11-15 | Confirmed by owner (chat) | One scannable code per item: an EAN-13 barcode (no QR on labels). Generated barcodes use the GS1 in-store prefix `200`; manufacturer EAN-13s are accepted as-is | Matches clothing tags and cheap 1D scanners; in-store prefix can't clash with manufacturer codes | Labels, product creation |
| ADR-006 | 2026-11-15 | Confirmed by owner (chat) | Shared PostgreSQL on Neon (free plan, via Vercel Marketplace, Singapore), Drizzle ORM; PGlite for local dev/tests | Admin-created products and sales must be visible on every device | Replaces the browser-only demo store |
| ADR-007 | 2026-11-15 | Implemented (plan v2) | Staff log in with name + 4–6 digit PIN (scrypt), signed http-only session cookie; roles admin / salesman checked on the server | Fast at the counter on a phone; real accounts needed for "sale on behalf of" and per-person dashboards. Better Auth (blueprint) deferred until email/password or multi-shop accounts are needed | Auth, all server actions |
| ADR-008 | 2026-11-15 | Confirmed by owner (chat) | Salesmen may record a sale or exchange credited to another salesperson; both `sold_by` (credited) and `recorded_by` are stored | Owner request (Vishal, Nitin, Pradeep, Balram) | Sales, exchanges, dashboards |

Use `docs/DECISIONS.md` for unresolved requirements; add a dated approved entry once confirmed.
