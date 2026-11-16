# Plan v14: combined view — one card per design (2026-11-16)

Owner request (chat): "I am unable to see any minimisation in the admin product view; it is still a simple list for the tags. Group the same kind of products: if the colour or size is different but the MRP, the company and the product name are the same, show a single QR code, mention all the sizes, combine the images. If the owner wants to see all the different QR codes he can, but by default minimise it and show only the combined view, concise and easy to use."

## Owner decision (asked before building)

| Question | Answer |
|---|---|
| What is the "single QR code"? | **A combined card on screen.** Printed tags stay **one per piece with its own barcode** (a scan still tells the size and colour, stock stays exact), and the Sell screen does not change. Not chosen: one printed design tag where the salesman picks size and colour after scanning. |

## What it is now

A **design** = items with the same **name** (spaces / capitals ignored), the same **company** and the same **MRP**. A size with its own higher MRP is its own card (the owner's rule: same MRP).

| Screen | Default: **Combined** | One tap away |
|---|---|---|
| **Products** (`/admin/products`) | One card per design: photos side by side (up to 3), name, company · MRP · selling price (or range), items and pieces, **every size with its pieces**, **every colour with its pieces** (sold-out ones struck through), one **design QR** (opens the design's page, which lists all its sizes and colours) | **Show N items** opens the separate items inside the card; **Show: Every item** = the old one-row-per-item list |
| **All tags** (`/admin/labels`) | The same card inside each date / company / category / delivery group; Grid or Rows (cards swipe sideways); summary "Designs · Tags · In stock · Groups" | **Show N tags** opens the real hang tags inside the card; **Show: Every tag** = the v13 view; **Print tags** prints that design (one tag per piece, or per item) |

The design QR is for the screen only — it is never printed. Printing is unchanged: every piece gets its own 40 × 60 mm tag.

## How it is built

| Piece | Where |
|---|---|
| Rule | `src/lib/design-groups.ts` (pure, unit-tested): `designKey` (`company~mrp~name`), `parseDesignKey`, `groupDesigns` (sizes in shop order and colours with pieces, price range, items by colour then size) |
| Card | `src/features/catalog/design-card.tsx` (server component): photos, QR (`QrCode`), size / colour chips, one footer line with *Show N …* (a `<details>`) and *Print tags* |
| Products | `src/app/(admin)/admin/products/page.tsx`: `?show=items` for every item; the item row is `ProductRow` (unchanged look) |
| All tags | `src/app/(admin)/admin/labels/page.tsx`: `show` (`designs` default / `tags`) in `TagParams`; cards per group; `tag-library.css` `.design-cell`, `.tag-grid` |
| Print | `/admin/labels/print?list=1&…&design=<key>` (`tagPrintHref(p, groupKey, designKey)`); heading = the design's name |
| Words | `cat.view.*`, `cat.design.*` (catalog module), `stk.lib.view.tags`, `stk.lib.summaryDesigns` — English + Hindi |

No database change.

## Tests

- Unit: `design-groups.test.ts` (combining, spelling, keeping designs apart by name / company / MRP, size order, item order, keys); `tag-library.test.ts` (`show`, `design` in the address and print links).
- E2E (desktop + phone): a design in 2 sizes × 2 colours → Products shows **one** card with "M · 4 L · 4", "Blue · 4 Pink · 4", "Items: 4 · In stock: 8 pcs" and the design QR; Show 4 items; Every item lists 4; All tags shows one card, Show 4 tags, Every tag shows 4 tags; Print tags prints 8 (or 4 per item). Tests that need one row per item open *Every item*.
