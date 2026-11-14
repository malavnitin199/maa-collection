# Architecture & product decision log (living)

Record agreed decisions here. Do not treat provisional ideas as final.

| ID | Date | Status | Decision | Rationale | Impact |
|---|---|---|---|---|---|
| ADR-001 | 2026-11-14 | Proposed | Next.js App Router in one repository | Built-in server layer supports secure business operations; POS remains client-heavy | Foundation |
| ADR-002 | 2026-11-14 | Proposed | PostgreSQL with transactional sales/stock ledger | Atomic checkout, constraints, audits | P2 onward |
| ADR-003 | 2026-11-14 | Proposed | Offline sales remain provisional pending sync | Offline counters cannot know real-time final stock across devices | P6 |
| ADR-004 | 2026-11-15 | Confirmed by owner (chat) | Scan-to-sell without a multi-item cart: each scan deducts stock and records one sale with a per-customer bargained unit price entered by the salesperson, attributed to that salesperson | Owner: every customer negotiates a different price; MRP is only a ceiling | POS flow (P4) stores the entered price and an MRP snapshot per sale line. MRP cap is an engineering assumption pending owner confirmation (relates to D-08). |

Use `docs/DECISIONS.md` for unresolved requirements; add a dated approved entry once confirmed.
