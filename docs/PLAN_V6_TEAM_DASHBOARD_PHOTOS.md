# Plan v6: sales team dashboard + photos when creating tags (2026-11-15)

Owner request (chat): a **dashboard of the sellers** — how many sellers, each one's **share (%)** and **graphs of their sales**, with all salesmen's data kept; salesmen scan the QR and enter the value; and when tags/barcodes are created, an **optional photo** of the product so it can be identified later (every SKU is its own item). Owner said to build, test and push without a further plan round.

## What is built

| Part | Change |
|---|---|
| **Sales team** `/admin/team` (owner) | Period filter (Today / 7 days / 30 days / This month, default 7 days). Number tiles: sellers (active salesmen), sellers who sold, team sales, pieces, bills. **Share of sales**: ranked horizontal bars, one hue, % and amount per seller. **Each seller**: a card with sales, share, bills, pieces, average discount below MRP, and a daily column chart on a scale shared by all sellers. A table with every number. Linked from the dashboard, menu and header. |
| Numbers | Same rules as the dashboard: a seller's sales = sales credited to them (`sold_by`) + exchange differences credited to them; days in shop time (IST). |
| **Photo per colour** in New design | Each colour gets optional 📷 / 🖼; after the items are saved, the photo is attached to **every size of that colour** (stored once; the other sizes point to it). |
| **Photo per product** in Quick add | Each card gets optional 📷 / 🖼, attached to that product after saving. |
| Tag old stock | Already had photos. |
| Photo failures | Items are never lost: if a photo fails, the labels page says so and the photo can be added on the product page. |

**Shared photos** (no migration): the first item of a colour stores the bytes; the other sizes get a `product_images` row whose `url` is that photo's address. Deleting the original hands its bytes to the next item first, so the others keep their photo.

## Interpretation to confirm

"Scan the QR code and put the purchase value" is read as the **sale amount** the customer pays — already how the counter works (scan → agreed price ≤ MRP). Salesmen still never see or enter the shop's purchase (cost) price (invariant 4).
