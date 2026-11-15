# Plan v11: fresh start and "Clear stock" (2026-11-16)

Owner request (chat): "Remove all the test records from the database so I can start fresh. And give the option of clear stock also, so the admin can clear stock from the app."

## Owner decisions (asked before doing anything)

| Question | Answer |
|---|---|
| What to remove now? | **Products, stock and sales**: the 35 test products (285 pieces), 1 photo, 2 receipts, 41 stock-history entries, 5 sales, 1 exchange. **Kept**: 5 staff and their PINs, 13 categories with size lists, 5 companies, shop settings. |
| What should "Clear stock" in the app do? | **Set every item's pieces to 0** — items, barcodes, prices, photos and past sales stay; the history records it. Not a "delete everything" button. |

## 1. Fresh start (done once, 2026-11-16)

- A full backup of every table was saved first, on the owner's Mac only (not in Git; it holds PIN hashes and purchase prices): `Maa_Collection_Cursor_Starter/backups/maa-backup-2026-11-16-before-fresh-start.json`.
- Then one transaction deleted, in order: exchanges, sales, stock movements, stock receipts, product photos, products. Checked afterwards: all six tables empty; staff 5, categories 13, companies 5 unchanged.
- SKU and barcode numbers come from what exists, so numbering **starts again** (first kurta is `MAA-KU-001`, first barcode `2000000000015`). **Throw away any tags printed during testing** — their barcodes will be given to new items.
- This was a one-off clean-up of test data, done by a script that is not kept in the repo. It is not a feature of the app.

## 2. Clear stock (in the app, owner only)

| Part | What happens |
|---|---|
| Where | **More → Clear stock**, or Settings → Clear stock |
| Screen | "In stock now: N items, M pieces." → **Clear all stock…** → warning + **your PIN** → **Set all pieces to 0** (or Cancel) |
| Result | Every item's count is 0. Message: "Stock cleared: N items, M pieces set to 0." |
| What stays | Items, barcodes, SKUs, prices, photos, sales, exchanges, earlier history |
| History | Each item that had stock gets one entry **"Stock cleared"** (minus what it had, the owner's name, date) — the ledger still adds up to the count |
| Safety | Owner (admin) only; the server checks the owner's PIN; a wrong PIN changes nothing; running it twice changes nothing more |

Rule: `clearAllStock` / `stockTotals` in `src/server/services/products.ts`; action `clearStockAction`; form `src/features/catalog/clear-stock-form.tsx`. New stock-movement reason `cleared` — the column is plain text, so **no database migration**. This keeps the append-only rule: nothing is edited or deleted, a correcting entry is added.

## Tests

Unit: clears everything with one `cleared` entry per item, sales and items stay, ledger sums to 0, second run does nothing, a cleared item can't be sold, receiving works again. E2E: reachable from More, two steps, Cancel, wrong PIN changes nothing, a salesman can't open it. The real clear was also run in a browser against a private demo database (7 items / 29 pieces → 0, history shows "Stock cleared").

## Still open

Correcting **one item's** count (D-ST-2) — only the whole-shop clear exists.
