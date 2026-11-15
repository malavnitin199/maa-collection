# Plan v12: sell without scanning, and the owner's approval queue (2026-11-16)

Owner request (chat): tags are stuck on shirts, pants and so on; sometimes a tag will not scan, the scanner is broken or the phone's back camera does not work. In that case the salesman must still be able to record the sale: just type the item's name as they call it and the selling price. The owner then checks every entry himself.

## Owner decisions (asked before building)

| Question | Answer |
|---|---|
| How does the owner keep an eye on hand-entered sales? | **Full approval queue**: every salesman's sale and exchange waits for the owner's Approve / Reject before it counts in any total. The owner's own entries are approved as they are recorded. |
| What does the salesman type on a hand-entered sale? | **Item name + sale price**, plus an **optional size** box. Quantity (default 1) and "Credit sale to" as on every sale. No SKU, no code. |

Assumptions stated in chat and not objected to: a hand-entered sale **moves no stock** (we do not know which piece it was) and has **no MRP cap** (no MRP known); it counts in revenue once approved and never in profit (no purchase price). Exchanges of a hand-entered sale are not possible (nothing to return against). The migration also allows an exchange without a bill (sold before the app) — the schema is ready but **no screen uses it yet** (D-EX-2).

## 1. Salesman: "Tag won't scan? Enter by hand" (`/pos`)

| Part | What happens |
|---|---|
| Where | Under the scan box: **Enter by hand** (secondary button, always visible) |
| Form | Item name (as the salesman calls it, ≤ 80 chars) · Size (optional) · Quantity (default 1) · Sale price (₹) · Credit sale to |
| Record | Same chime and "Sale done" card as a scanned sale; message adds **"Sent to the owner to check."** (owner's own entry: no such note) |
| Saved as | `sales` row with `manual = true`, `product_id` / `mrp_paise` / `cost_paise` empty, `sku = ''`, `color = ''`, size as typed (or `''`). Idempotent by `operation_id` like every sale. **No stock movement.** |
| My sales | Each sale shows a chip: **Waiting** / **Approved** / **Rejected (reason)**; "By hand" mark on hand-entered ones. Today / month totals count **approved** sales only, with a line "Waiting for the owner: n sales · ₹x". |

## 2. Owner: Approvals (`/admin/approvals`, owner only)

| Part | What happens |
|---|---|
| Entry points | Home: **"n entries waiting"** tile (red count) → Approvals; More → Approvals; header link |
| List | Waiting entries grouped by shop day (IST), newest first; each card: what was sold / swapped, qty, price, **MRP and usual selling price** next to a scanned sale's price (so a cut price is obvious), who sold and who recorded, **By hand** mark + typed name/size |
| Approve | One tap per card. **Approve all for this day** and **Approve everything** (one batch id). Nothing moves; the entry starts counting. |
| Reject | Reason chips (Wrong price · Wrong item · Duplicate · Not sold · Other) + optional note → **Reject**. A scanned sale's pieces go **back into stock** through a new `sale_rejected` movement (never by editing the sale); a hand-entered sale returns nothing. A rejected exchange is undone: the new item comes back, the returned piece goes out again (`exchange_rejected` ×2). |
| Guards | One decision per sale / exchange (unique index): a double tap or two phones can never decide — or return stock — twice. A sale with a live exchange on it cannot be rejected before the exchange. If the owner **cleared stock** after the sale, rejecting it does not add pieces back. |
| Record | Below the list: the owner's last 50 decisions (who, when, reason). Decisions are append-only; nothing is ever edited or deleted. |

## 3. What "counts"

Every total — Home, Reports, Sales team, My sales, CSV export — includes **only approved** sales and exchanges. Activity lists show every entry with its status chip, so nothing disappears. The CSV gains **Status** and **By hand** columns and now includes hand-entered sales (no SKU / category / company).

## 4. Database (migration `0007`, already generated)

`approval_decisions` (one row per decided sale or exchange; `auto = true` for the owner's own entries) · `sales.manual`, `sales.manual_note`; `sales.product_id` and `sales.mrp_paise` nullable with checks `sales_item_or_manual` and `sales_price_le_mrp` (MRP cap only when an MRP exists) · `exchanges.original_sale_id` nullable (D-EX-2, unused) · new movement reasons `sale_rejected`, `exchange_rejected`.

Code: `src/server/services/approvals.ts` (decisions, queue, counts, batch approve, statuses), `recordSale` manual mode + owner auto-approval in `sales.ts` / `exchanges.ts`, approved-only predicates in `reports.ts`, actions `src/server/actions/approvals.ts`, screen `src/features/approvals/`, POS form in `pos-screen.tsx`, dictionaries `src/lib/i18n/modules/approvals.ts` + `sell.manual*` keys.

## Tests

Unit (`approvals.test.ts`): hand-entered sale moves no stock and has no MRP cap; owner's entry auto-approved, salesman's waiting; approve → counts in dashboard / report / team; reject scanned sale → stock back with one movement, totals drop; reject hand-entered → nothing back; second decision changes nothing (same stock); approve-all by day is idempotent; reject sale with exchange refused; reject exchange reverses both pieces; cleared-after-sale guard; export includes hand-entered rows with status. Guide step limits still pass. E2E (desktop + phone): salesman enters by hand → sees Waiting → owner's Home shows the count → approve one, reject one with a reason → stock, My sales and Home match; a salesman cannot open Approvals.

## Ship

Small commits in order: docs → server + tests → owner screen → POS + lists + guide → docs + version **0.2.0** + tag `v0.2.0` → push → `pnpm db:migrate` on Neon → `vercel deploy --prod` → live check.
