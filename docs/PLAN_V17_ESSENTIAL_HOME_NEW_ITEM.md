# Plan v17: an essential Home, a clear Add stock, one minimal item layout (2026-11-18/19)

Owner requests (chat, summarised, in order):

1. "On Home keep only Today's sales and New stock, Suppliers, Reports, Approvals. Remove Est. profit, Exchanges, This month, Restock, sales by salesperson, Stock and Low stock. Make Add stock clear. When adding an item, keep the essentials on top and the rest behind switch buttons (Details, Colours, …)." → plan posted; owner: **"go, keep MRP at the top"**.
2. A reference picture of a billing app's *Create New Item* screen (underlined top tabs, Save at the bottom): "I wanted this kind of design."
3. "Don't change any logic. The main fields — when adding and when viewing a product — are the **company** (where we buy it), the **product name**, the **sale price** and the **purchase price**: mandatory, minimal. Remove the headers and descriptions. Right: the product's picture. Left, concise: name, sizes, category, and small tags — **girls or boys, adult or child**. Below: **top tabs** — Details, Colours (sizes × colours and how many units), Other details (for fields we add later). Commit, push, deploy."
4. Asked how to store girls / boys / adult / child, the owner chose **new fields** (one database update).

Only the layout changed; saving, stock, prices, barcodes and permissions work exactly as before. The one addition is the two optional tags.

## What changed

| Area | Before | Now |
|---|---|---|
| **Home** | 5 buttons; Today (net sales, est. profit, exchanges); This month; Sales by salesperson; Stock + Low stock; Latest activity | **4 buttons** (New stock, Suppliers, Reports, Approvals with the waiting count) and **Today**: net sales, pieces sold, number of sales |
| **Add stock** | Four equal tiles | **New item** (big) + *Other ways*: *More pieces of an existing item*, *Tag old stock* |
| **New item** (`/admin/stock/new`) | Two screens: Quick add (many products) and New design (4 numbered steps, long help texts) | **One minimal screen**: ← New item; header card — product name, category, the chosen sizes as small pills, and **For: Girls · Boys · Both / Age: Adult · Child** tap-tags, with the **photo square on the right** (tap = gallery, 📷 = camera, ✕ = remove; a dyed-cloth background with a kurta on a hanger until a photo is chosen); must-haves card — **Company**, **Sale price (MRP) ₹**, **Purchase price ₹** (both required; purchase only with the *Purchase price* right); **top tabs**: **Details** (pieces / pieces each, counter price if lower, supplier bill no.), **Colours** (sizes, colours, a grid of every colour × size with its pieces, a photo per colour, price by size), **Other details** (brand; later fields go here); one summary line (`6 items · 12 pcs · purchase ₹9,600.00`) and **Save N items** |
| **Product page** (`/admin/products/[id]`) | Hang tag + a column of facts, then Photos, Design variants, Rates, Receive, Edit details (folded), History | Same layout: header (name, colour · size · brand, pills for the design's sizes, category, For, Age; **main photo on the right**); must-haves card (company, MRP / selling / purchase, pieces in stock, Print label, Restock); **top tabs**: **Details** (hang tag, rates for the whole design, receive stock, history), **Colours** (grid of every colour × size with its pieces — tap to open — and the total; photos), **Other details** (For / Age for the whole design, edit this item) |
| **Labels after saving** | Labels only | Also **+ Add next item** (New item with the same company and category) |
| **Old addresses** | `/admin/stock/quick` | Forwards to `/admin/stock/new` (`?supplier=` kept) |

Where the removed Home parts are now: month, profit, exchanges, sellers → **Reports** / **Team**; restock → **Add stock → More pieces of an existing item**; low / no stock → **Products** (red / orange counts) and **Needs attention**; activity → **More → Activity**.

## The two tags

| Tag | Values | Stored |
|---|---|---|
| **For** | Girls · Boys · Both | `products.for_gender` (`girls` / `boys` / `both`, or empty) |
| **Age** | Adult · Child | `products.age_group` (`adult` / `child`, or empty) |

- Optional; tap again to clear. Older items have no tag until it is set.
- The same for every size and colour of a design: New item puts them on every item it makes; the product page's *Other details → Save tags* changes the whole design (same name, brand and category). Prices, stock and history are not touched.
- **Tag old stock** (owner follow-up, 2026-11-19): the same For / Age rows under the product name; saved on the item, changed by *✎ Edit this item*, and kept for the next item like category and size.
- **Add a single product** (owner follow-up, 2026-11-19): the same rows after the company. Every add screen now offers the tags; to change them later use the product page's *Other details*.
- The server and the database refuse any other value.
- Migration `drizzle/0008_product_tags.sql`: two nullable columns + two checks. It only adds; the app already live keeps working before and after it.

## Companies: a fresh list, added on the spot (owner follow-up, 2026-11-19)

Owner: "remove all the companies that were here, and give the owner the option to add companies manually, or choose between the previous companies." Asked how to remove them, the owner chose **hide** (not delete) and to **keep the demo data** for now.

- **Live shop:** all 9 companies (5 sample + 4 "Demo …") are hidden (`suppliers.active = false`). Nothing is deleted: their 67 items and 17 deliveries keep their company name, and the Suppliers page still lists them as "(inactive)". A backup of the list was saved first.
- **Company box** on New item, Tag old stock and Add a single product (`CompanyPicker`):
  - the companies in use;
  - **Previous companies** (the hidden ones): choosing one brings it back at once, with its phone, GSTIN and notes;
  - **+ New company…**: type a name → **Add**. The same name in any letter case is reused (and brought back if hidden), never doubled.
- Suppliers → a company → *Edit supplier details* → untick **Active** hides it again ("Previous companies").
- Receive stock, filters and reports are unchanged (they list companies as before).

## Staff, profit / loss on Approvals, colour-coded tabs (owner follow-up, 2026-11-19)

Owner: "give the admin the option to manage users: add members (staff, salesmen) or remove a salesman. When a salesman sells, show the owner, on Approvals, in a different colour or style whether it was a profit or a loss deal — nothing changes for the salesman. On the stock screens, colour-code the lower part (Details, Colours, Other details) so it stands apart from the rest."

| Part | Now |
|---|---|
| **Staff** (More → Staff & permissions) | Add a person (name, role, PIN), Set PIN, rights per salesman — as before; **Remove** (asks once: "They can no longer log in. Their past sales stay.") moves a person to **Removed staff**, with **Bring back**. Role shown as a pill. No delete: sales, stock history and approvals point to the person. Removed people are off the login screen and *Credit sale to*, and an open session stops at the next page (as before). |
| **Approvals** (owner) | Each scanned sale shows *purchase ₹… each* and a tag: **▲ Profit ₹…** (green left edge), **▼ Loss ₹…** (red card), *At purchase price*, or *No purchase price* (hand-entered). A legend under *Approve everything*; each day shows its profit or loss. Uses the purchase price saved on the sale (`sales.cost_paise`). |
| **Home** | The Approvals tile adds a red **n at a loss** when waiting sales were sold below their purchase price. |
| **Salesman** | Unchanged; purchase prices are never sent to salesman screens. |
| **Tabs** (New item, product page) | The tab bar sits on a band in the theme's colour (open tab underlined in the accent), and each tab's panel has its own tint: Details = theme tint, Colours = accent tint, Other details = grey; the cards inside stay white. |

## Two fixes found on the way

Next 16 (Cache Components) keeps a page alive after you leave it, with what was typed (React `<Activity>`):

- **New item** came back with the last item's prices and save id, so *Add next item* showed the first item's labels again. It now clears the item after saving (company, category, tags and brand stay).
- **Receive stock** kept the received lines: coming back and scanning one more piece would have **received the old pieces again** (this was already live). It now clears after saving.

## How it is built

| Piece | Where |
|---|---|
| Home | `dashboard/page.tsx` — `shopToday()` (`services/reports.ts`, 2 queries) + `pendingCount()` |
| Add stock | `stock/page.tsx` (`NEW_ITEM`, `OTHER_WAYS`) |
| New item | `src/features/catalog/new-item-form.tsx` (`NewItemForm`, `PhotoSquare`); saves with `createDesignAction` (nothing picked = size Free, colour Assorted); replaces `quick-add-form.tsx` and `design-form.tsx` |
| Shared parts | `src/features/catalog/item-parts.tsx`: `ItemTabs` (underlined top tabs, panels stay mounted, ←/→, a `print` panel stays in the printout — the hang tag), `TagChooser`, `DesignTagsForm`; `src/components/ui/pill.tsx`; `usePhotoPicker()` in `photo-slot.tsx`; `IconBack` |
| Tags | `src/lib/product-tags.ts` (values, labels, `parseTag`); `createDesign(… forGender, ageGroup)`, `setDesignTags()` in `services/products.ts`; `updateDesignTagsAction` |
| Background | `.cloth-backdrop` (globals.css), `GarmentArt` (art.tsx) |
| Add next item | `nextItemHref()` in `labels/print/page.tsx` |
| Removed | `createQuickAction`; retired dictionary words |
| Guide and Help | Lesson *New item* (`#new-design`): name, category, photo → company, sale and purchase price → Colours tab → Save; Help lines updated |

## Tests

- Unit (153): `shopToday` = today's part of `shopDashboard`; tags saved on every size and colour, changed for one design only, prices and stock untouched, unknown values refused by the server and the database; `parseTag`.
- Browser (desktop + phone, against a production build with a fresh database): **75 passed, 1 skipped (phone-only)**. Every stock-entry test uses the new screen and tabs; For / Age chosen on New item, shown as pills on the product page and changed there for the whole design; the product page's Colours grid; the main photo; *+ Add next item* opens an empty item with company and category kept; Receive stock is empty after going back; Home has 4 actions and today's sales only (English and Hindi).
