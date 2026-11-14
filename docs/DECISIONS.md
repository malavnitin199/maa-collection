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
| D-07 | Offline oversell policy | OPEN | Cash-only provisional checkout plus owner conflict audit | Real offline sales can conflict across devices |
| D-08 | Discount authority | OPEN | Cashier limits set by owner | Required for server-side discount validation |
| D-09 | Return/exchange policy | OPEN | Linked to original sale, cannot over-return | Refund/stock rules and audit constraints |
| D-10 | Hardware | OPEN | USB/Bluetooth HID barcode scanner; tested label printer profile | Browser support and direct/silent print vary |
| D-11 | Receipt numbering | OPEN | Server-assigned canonical sequence, provisional local slip for offline | Avoid duplicate offline legal invoices |
| D-12 | Gross vs net profit | PROPOSED | Call selling minus cost 'gross profit' | Avoid false net profit claims |
| D-13 | Source of truth for inventory | PROPOSED | Append-only movements + canonical balance projection | Supports reconciliations and audited corrections |
| D-14 | MVP and go-live | OPEN | Pilot online first; offline only after dedicated signoff | Makes release risk visible |

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
