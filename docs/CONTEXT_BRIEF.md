# Maa Collection — context brief (for a brainstorming partner)

*As of 15 Nov 2026. Hand this to another assistant to bring it up to speed. No passwords or PINs are included.*

## 1. The business in one paragraph

**Maa Collection** is an Indian clothing shop (kurtas, sarees, jeans, shirts, tees, dresses, dupattas…). The owner wants a **phone-first shop app** for stock, barcode labels, counter sales and staff tracking. The longer-term ambition is to turn it into a **product other clothing retailers can use** (multi-shop / SaaS). Customers **bargain**: every customer can pay a different price, so the app records the agreed price per sale, never above MRP. All staff use **mobile phones only**.

## 2. Where things stand

- **Live web app** (installable on phones): https://maa-collection-pi.vercel.app
- **Code**: https://github.com/malavnitin199/maa-collection (Next.js 16, TypeScript, PostgreSQL on Neon, hosted on Vercel, Singapore region)
- **People set up**: Owner (admin) and salesmen Vishal, Nitin, Pradeep, Balram. The owner mentioned 6 staff; only these names were given.
- **Sample data**: 8 demo products, 11 categories, and 5 sample supplier companies (Shree Ganesh Textiles, Laxmi Fashion House, Royal Garments, Kalyan Silk Mills, Jaipur Prints Co.).
- **Quality**: 72 automated unit tests and 37 end-to-end browser tests, run at desktop and phone size; deployed after every step.

## 3. What the app does today

**Salesman (counter)**
- Log in with name + PIN. Scan a tag with the phone camera, a USB/Bluetooth scanner, or by typing the number.
- See the item's photo, size, colour, MRP, selling price and stock → enter quantity and the bargained price (≤ MRP) → sale recorded, stock drops on every phone.
- **Sale on behalf of a colleague**: the sale is credited to one person and records who entered it.
- **Exchanges**: return part of an earlier sale for another item; the app works out "customer pays / give back"; stock is corrected.
- **My sales**: own totals for today and this month (Indian time).

**Owner (admin)**
- Dashboard: today / month revenue, units, estimated profit, exchanges, sales per salesperson, stock value, low stock, activity log.
- **Reports**: best sellers, items not selling for 30 days, sales by category / company / salesperson for a chosen period; **CSV export** of sales and stock for the accountant.
- **Companies (suppliers)** and **categories** (each with a 2–3 letter SKU code).
- **Add stock**, three ways:
  1. **Quick add**: one company + category, many products, each with its own MRP / selling / purchase price.
  2. **One design in sizes × colours**: every combination gets its own barcode.
  3. **Restock**: scan existing items to add pieces.
- **Barcodes**: generated EAN-13 with the in-store prefix `200` (can't clash with manufacturer codes); manufacturer barcodes accepted too. **Labels**: A4 sheet or **50×25 mm sticker printer**, one per piece.
- **Rates for a whole design** (all sizes/colours at once); past sales keep their prices.
- **Two prices per item**: *selling price* (shown) and *purchase price*, which is secret and admin-only. Optionally the purchase price is printed on tags as a **letter code** (owner's secret 10-letter word, e.g. BLACKHORSE: ₹450 = "CKE"), so staff know the floor and customers can't read it.
- **Staff & permissions**: the owner grants extra rights per salesman:
  - **Catalog** (catalog / QC person)
  - **Prices**
  - **Stock**
  - **Purchase price**

**Catalog / QC person** (a salesman given the Catalog right)
- **Tag old stock** (moving existing inventory into the app):
  1. scan the tag's own barcode if it has one
  2. take photos
  3. category, name, size, colour
  4. MRP / price, pieces counted
  5. save to get a barcode, then "Next item"
  6. print "today's labels" at the end
- **Product photos** (camera or gallery, resized on the phone); the main photo shows at the counter.
- **Needs attention** list: items without a photo, company, stock or purchase price.

**For everyone**: installable on the phone home screen (app icon, full screen); in-app **Help** (`/help`) with a new-user guide, role guides, required vs optional fields, tips and fixes. First-time tip cards on the main screens.

## 4. Key decisions taken (and why)

| Decision | Why |
|---|---|
| Scan-to-sell, **no shopping cart**; bargained price per sale, capped at MRP | Every customer negotiates; selling above MRP is not allowed in India |
| **One barcode per item** (EAN-13), no QR codes on labels | Matches clothing tags and cheap 1D scanners; the phone camera reads both |
| In-store barcodes start with `200` | GS1 reserves 20–29 for a shop's own use, so they never collide with brand barcodes |
| Login by **name + PIN** (not email/password) | Fast on a shared counter phone |
| **Owner-granted permissions** on top of admin/salesman | A salesman can become a catalog/QC or stock person without full admin access |
| Purchase price never sent to staff without the right; optional **code price** on tags | Protect margins while letting trusted staff know the floor |
| Every sale, exchange and stock arrival is **append-only** with a retry-safe ID | No double sales on bad networks; full audit trail |
| Money stored in whole paise; "today" in Indian time | Exact totals; correct daily reports |
| Shared database (Neon Postgres) | Products added on one phone must scan on another |
| Photos stored in the database for now | Works everywhere; move to file storage (Vercel Blob) before ~5,000 photos |

## 5. How we got here (short timeline)

1. Project set-up, quality checks, page outlines.
2. Demo scan-to-sell flow; camera scanning; fixed scanner focus issues and invalid demo barcodes; QR → then **barcode-only** labels (owner's choice).
3. Phone camera reliability (HD picture, the phone's own barcode reader, iPhone fallback fixed).
4. **Plan v2**: shared database, PIN login, roles, products with generated barcodes, stock-in, sale on behalf, exchanges, owner and salesman dashboards.
5. **Owner stock workflow**: suppliers, categories, sizes × colours entry, labels, restock, design-wide rates, phone tab bar.
6. Quick add, code price setting, sample companies/categories, salesman permission audit.
7. **Plan v3**: owner-granted permissions, product photos, Tag old stock, in-app Help, user guide.
8. Sticker-printer labels (verified scannable at 203 dpi), tag-barcode reuse, Needs attention list.
9. Installable phone app (icon, opens to your screen), owner Reports, CSV export for the accountant.

## 6. Open questions for the owner

- **Exchanges**: can money be given back? Is there a time limit (e.g. 7 days)?
- **Refunds** without a replacement item: allowed?
- **Bargaining floor**: a minimum price below which salesmen may not go?
- May a catalog person without the "Prices" right set prices when **creating** an item? (Currently yes.)
- Who are the other staff (six were mentioned, four named)?
- Move photos to Vercel Blob? (Needs the owner's approval on the Vercel account.)

## 7. Not built yet (roadmap)

- **GST**: per-item GST by price slab (Indian apparel), GST invoices/receipts, receipt numbering.
- **Payments**: payment method per sale (cash / UPI / card), day-close cash count.
- **Returns**: refund-only returns, damaged stock handling.
- **Offline**: billing when the internet drops (queued sales).
- **Reports**: reorder suggestions, Tally-format export (basic reports and CSV export exist).
- **Multi-shop**: real multi-shop / multi-retailer accounts. Every record already carries a `store_id` to make this cheaper.

## 8. Ideas worth brainstorming (starting points)

- **Product for other retailers**: positioning, pricing (per shop / per staff / per month), onboarding effort, what makes it better than existing billing apps for small Indian clothing shops (bargaining, code price, phone-only, old-stock tagging).
- **Customer side**: WhatsApp e-receipts, customer phone numbers, loyalty/repeat-customer offers, festival campaigns (Diwali, weddings).
- **Payments & compliance**: UPI QR at the counter, GST invoices, accountant hand-off.
- **Inventory intelligence**: fast/slow movers by size and colour, dead stock alerts, reorder lists per supplier, festival-season planning.
- **Supplier side**: purchase orders to companies, supplier performance, credit tracking.
- **Hardware bundle**: phone + Bluetooth scanner + 50×25 mm sticker printer as a starter kit.
- **Staff**: commissions from "sale credited to", targets, leaderboards.

## 9. Where to read more (in the code repository)

- `docs/USER_GUIDE.md`: how each role uses the app
- `docs/PLAN_V2_SHOP_OPERATIONS.md`, `docs/PLAN_V3_CATALOG_TEAM.md`: plans with flows and data model
- `docs/DECISION_LOG.md`: all decisions (ADR-001 … ADR-012)
- `docs/DECISIONS.md`: open questions
- `docs/PROGRESS.md`: detailed log
- `docs/SOURCE_PRD.pdf`: the original 12-page requirements document
