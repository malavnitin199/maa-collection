# Plan v13: All tags — grouped, filtered, grid or rows (2026-11-16)

Owner request (chat): "Make sure we are very clear and sorted with the flow where the admin generates the QR codes. All the generated QR codes are in a grid — make sure they are well categorised, by date or by company name. Give filters so there is a proper, well-maintained view, and different views like horizontal scrollable rows for the same filter. Enhance the creation of QR codes / barcodes so it has a proper flow. Push to Git and make it live."

Owner said to go ahead; the plan below was posted in chat before building.

## What was wrong

`/admin/labels` ("Test labels") printed **every active item's tag in one long wall**: no order, no heading, no filter, no way to find or reprint one company's or one day's tags. Today's tags and a delivery's tags could only be printed right after saving them.

## What it is now: the **All tags** page (`/admin/labels`)

| Part | What it does |
|---|---|
| **Group by** | **Date** made (default, newest first: Today, Yesterday, 14 Nov 2026 …) · **Company** (A–Z, "No company" last) · **Category** (A–Z) · **Delivery** (one bill / one stock entry, newest first; items added one by one last). Each group has a heading with its tag and piece counts. |
| **Filters** | Search (name, item code, colour, brand, barcode) · Company · Category · **Made by** (the person who created the tag) · **When made**: Today / Last 7 days / Last 30 days / All time · **Only items in stock**. *Clear filters* resets them. Filters live in the address, so Back and a shared link keep them. |
| **Views** | **Grid**: the tags of a group wrap onto lines. **Rows**: each group is one line of tags you swipe sideways (scroll snaps to a tag). The choice is remembered **on that phone** (`localStorage` `maa-tag-view`), like sound and colours. |
| **Print** | **Print this group** on every group heading; **Print these tags** for everything the filters show. A delivery group opens the existing delivery print (pieces as received); every other group opens the print page with the same filters (one tag per piece in stock, or one per item; A4 / tag printer / sticker as before). |
| **Each tag** | The real 40 × 60 mm hang tag (QR, sizes, barcode, MRP); tap it to open the item; the pieces in stock are shown under it. |
| **Big catalogues** | The page draws the newest **120 tags** at once (each QR is a few hundred squares); a line says "Showing 120 of N" with **Show more** (+120). Group counts are always the full numbers. |

### Flow around it

- After saving new tags (New design, Quick add, Restock, Tag old stock → today's labels), the print page now has **See all tags →**.
- A company's page has **See this company's tags** (All tags filtered to that company, grouped by delivery).
- More menu hint: "All tags, by date or company".
- Guide, lesson *Print tags*: a first step "**All tags**: by date or company".

## How it is built

| Piece | Where |
|---|---|
| Query | `listTagLibrary(db, storeId, filter)` in `src/server/services/tag-library.ts`: active items + company name + who made it + the delivery the item was created in (its `opening` stock movement → `stock_receipts`: bill no., date, person). Filters in SQL; "today / 7 / 30 days" use the shop time zone like Reports. |
| Grouping, filters in the address | `src/lib/tag-library.ts` (pure, unit-tested): `parseTagParams`, `tagFilter`, `tagLibraryHref`, `tagPrintHref`, `groupTags` (by date / company / category / delivery, ordering, "none" groups last), `capGroups`, `shopDay`. |
| Page | `src/app/(admin)/admin/labels/page.tsx` (server): filters form, chips, groups of `HangTag`s. |
| Views | `src/features/tag-library/tag-views.tsx` (client: Grid / Rows switch, remembered) + `tag-library.css` (`[data-view="rows"]` turns each group into a sideways strip). The tags stay server-rendered, so purchase prices never reach the phone. |
| Print | `src/app/(admin)/admin/labels/print/page.tsx` gains `?list=1&…filters…&key=<group>` (same parser), capped at 400 items per print. |
| Words | `stk.lib.*` in `src/lib/i18n/modules/stock.ts`, English + Hindi. |

No database change (every product already has `created_at`, `created_by`, company, category and its opening movement).

Permissions unchanged: the page and its print need the *Catalog* or *Stock* right (owner always). Code price on tags as before.

## Tests

- Unit (`src/lib/tag-library.test.ts`): parsing drops bad values; groups by each mode in the right order with "none" last; shop day at 23:30 / 00:30 IST; cap keeps full counts.
- Service (`src/server/services/tag-library.test.ts`, PGlite): filters by company, category, made by, when (an item made 10 days ago is in 30 days but not 7), in stock, search; delivery bill and date come through; inactive items are left out.
- E2E (desktop + phone): quick add from a company → All tags grouped by company / delivery shows them under the right heading → Rows view puts them on one sideways line, still Rows after reload → filters (category, in stock) narrow it → Print this group prints the right tags; a salesman can't open it.
