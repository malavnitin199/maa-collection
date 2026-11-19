# Maa Collection - decisions and assumptions log

**Status legend:** PROPOSED = technical recommendation, OPEN = business owner answer required, CONFIRMED = agreed and recorded. No current open item is implied to have been approved.

| ID | Topic | Current status | Proposed/default option | Consequence |
|---|---|---|---|---|
| D-01 | React or Next.js | PROPOSED | Next.js App Router + React | Single app with trusted backend routes |
| D-02 | Database | PROPOSED | PostgreSQL + Drizzle | Real transactions, migrations and SQL learning |
| D-03 | Auth | PROPOSED | Better Auth, owner-provisioned accounts | No public user sign-up |
| D-04 | Stores and locations | OPEN | One store, with storefront/godown/quarantine locations | Affects balance schema and receipt lookup |
| D-05 | Tax/GST and legal invoice | OPEN | No tax formula invented | Required before final invoice layout |
| D-06 | Payment modes and verification | OPEN | Manual tender record until gateway selected | Manual UPI entry is not bank confirmation |
| D-07 | Offline oversell policy | CONFIRMED 2026-11-19 (ADR-032) | Owner: **let stock go below zero** — a sale made offline is always recorded when it is sent; the owner checks it in Approvals (*Made offline* mark) and recounts | Online sales still refuse overselling; counts can be negative until recounted |
| D-08 | Discount authority | OPEN | Cashier limits set by owner | Required for server-side discount validation |
| D-09 | Return/exchange policy | OPEN | Linked to original sale, cannot over-return | Refund/stock rules and audit constraints |
| D-10 | Hardware | OPEN | USB/Bluetooth HID barcode scanner; tested label printer profile | Browser support and direct/silent print vary |
| D-11 | Receipt numbering | OPEN | Server-assigned canonical sequence, provisional local slip for offline | Avoid duplicate offline legal invoices |
| D-12 | Gross vs net profit | PROPOSED | Call selling minus cost 'gross profit' | Avoid false net profit claims |
| D-13 | Source of truth for inventory | PROPOSED | Append-only movements + canonical balance projection | Supports reconciliations and audited corrections |
| D-14 | MVP and go-live | CONFIRMED 2026-11-19 (ADR-032) | Owner signed off offline selling at the counter (scan, by hand, saved on the phone, sent later); exchanges stay online-only | Offline is live from plan v18 |

## Decision record template

```text
Decision ID:
Date:
Owner (decision maker):
Status:
Problem and alternatives:
Chosen rule:
Impact on API/data/testing:
Evidence (shop walkthrough, printer model, sample invoice):
```

## Suggested sample shop walkthrough for P0

1. Owner receives 10 blue size-M shirts; cashier can search and see 10 while cost is hidden.
2. Owner prints 10 labels; a sample scanned label finds the exact SKU.
3. Cashier sells 2, chooses payment and prints receipt; server stock is 8.
4. Customer exchanges one blue M for one blue L; both stock changes are auditable.
5. One damaged item goes to quarantine and is not sellable.
6. Two registers attempt the final same piece online: only one succeeds.
7. Register loses connectivity, records an approved provisional sale, restarts, reconnects and resolves its sync status.
8. Owner sees correct cash/UPI records, gross profit and low-stock list; staff cannot see cost.


## Open questions from plan v2 (2026-11-15)

| ID | Question | Current behaviour until decided |
|---|---|---|
| D-EX-1 | On an exchange, may money be given back to the customer? Is there a time limit (e.g. 7 days)? | Allowed both ways, no time limit; the difference is recorded |
| D-ST-1 | Six staff were mentioned; names given: Vishal, Nitin, Pradeep, Nitin, Balram. Who else, and who should be admin? | Seeded Owner (admin) + Vishal, Nitin, Pradeep, Balram; admin can add more |
| D-PR-1 | Is there a minimum price (floor) below which salesmen may not bargain? | Any price from ₹0.01 up to MRP (relates to D-08) |
| D-RF-1 | Returns without taking another item (refund only)? | Not supported yet |

## Open questions from plan v3 (2026-11-15)

| ID | Question | Current behaviour until decided |
|---|---|---|
| D-PERM-1 | Should a catalog person without the *Prices* right be allowed to set prices when **creating** an item (needed to tag old stock)? | Yes when creating, and when fixing that item right after (Edit) until it is first sold; otherwise existing prices can't be changed without *Prices* |
| D-QR-1 | What should the tag's QR code hold? | A link to the item in this app (`https://<app>/i/<barcode>`): staff land on the item; anyone not logged in only sees the login page. Alternative: public product info for customers (would show prices/photos publicly) |
| D-TAG-1 | Should tags also show the selling price (like a sale sticker), or MRP only? | MRP only, with "(incl. of all taxes)"; the bargained price is entered at the sale |
| D-LANG-1 | Hindi wording: should someone in the shop review the Hindi lines (`src/lib/i18n/hi.ts`, `src/features/guide/lessons.hi.tsx`) before the owner/catalog screens are translated? | Written by the assistant in simple shop Hindi; staff can report lines that read oddly |
| D-LANG-2 | ~~Round 2 of Hindi~~ — **done 2026-11-16** (owner asked): owner/catalog screens, Help and all Guide lessons are in Hindi | — |
| D-ST-2 | Lowering a piece count typed wrongly (e.g. 5 instead of 3) — owner said **not now** (2026-11-16). Needs a "stock correction" kind in the stock ledger (DB change), saved with who and why, shown in the item's history | Pieces can only be added per item; the owner can set **all** counts to 0 with Clear stock (ADR-021). A per-item correction / stock-take is still open |
| D-EX-2 | An exchange of a piece **sold before the app** (no bill in the app): should the salesman be able to type the price the customer paid and swap it? Migration 0007 already allows an exchange without an original sale | Not possible in the app: an exchange needs a sale recorded in the app. Nothing is built for it until the owner asks |
| D-IMG-1 | Move photos to Vercel Blob (needs the owner to approve creating a Blob store on the Vercel account)? | Photos in Postgres; switch before ~5k photos |

## Questions from plan v19 (2026-11-19) — **all CONFIRMED by the owner on 2026-11-19 (ADR-033)**; see `docs/PLAN_V19_PRODUCT_MANAGEMENT.md` §7

| ID | Question | Owner's answer (ADR-033) |
|---|---|---|
| D-V19-1 | Names of the four starting sections: Men / Women / Boys / Girls (brief) or Man / Woman / Girl / Boy (uncommitted code)? | **Men / Women / Boys / Girls** (Hindi पुरुष / महिला / लड़के / लड़कियाँ) |
| D-V19-2 | Existing categories: a **Needs sorting** bucket the owner sorts once (recommended), or auto-sort men's names → Men and everything else → Women? Add the suggested starting types for Men and Women? | **Needs sorting bucket**, the owner sorts once; never auto-sorted. Starter types only for sections with no types |
| D-V19-3 | An item with no colour: show nothing (store empty, recommended) or keep showing "Assorted"? | **Show nothing**: new items store an empty colour; existing *Assorted* rows untouched |
| D-V19-4 | For / Age tags (ADR-027) once sections exist: retire the tag UI and keep the data read-only (recommended), or keep both? | **Retire the tag UI**; keep the columns; show a legacy value read-only |
| D-V19-5 | Brand left empty: stays empty (recommended) or the company's name as today? | **Stays empty** |
