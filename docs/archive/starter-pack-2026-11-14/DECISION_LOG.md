# Architecture & product decision log (living)

Record agreed decisions here. Do not treat provisional ideas as final.

| ID | Date | Status | Decision | Rationale | Impact |
|---|---|---|---|---|---|
| ADR-001 | 2026-11-14 | Proposed | Next.js App Router in one repository | Built-in server layer supports secure business operations; POS remains client-heavy | Foundation |
| ADR-002 | 2026-11-14 | Proposed | PostgreSQL with transactional sales/stock ledger | Atomic checkout, constraints, audits | P2 onward |
| ADR-003 | 2026-11-14 | Proposed | Offline sales remain provisional pending sync | Offline counters cannot know real-time final stock across devices | P6 |

Use `docs/DECISIONS.md` for unresolved requirements; add a dated approved entry once confirmed.
