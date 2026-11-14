# Plan v3: catalog team, permissions, product photos, old-stock tagging, in-app help

Status: **requested by owner 2026-11-15, being implemented** · Builds on plan v2 and the owner stock workflow.

## 1. Why

The owner wants to hand catalog work to staff: a salesman can become a **catalog / QC person** who photographs items, fills in details, generates barcodes and sticks labels — including on **old stock already in the shop**, so the whole inventory moves into the app. The owner decides who may do what. The app must be easy for new users, with a guide inside it.

## 2. Permissions (owner grants per person)

Roles stay `admin` (owner) and `salesman`. On top, the owner ticks **permissions** for each salesman:

| Permission | Lets them | Typical person |
|---|---|---|
| `catalog` | Add/edit products and photos, names, sizes, colours; manage categories and companies; generate barcodes; print labels; tag old stock | Catalog / QC person |
| `prices` | Change MRP and selling price (incl. "rates for the whole design") | Senior salesman, catalog person |
| `stock` | Receive stock (new deliveries, restock, old-stock counts) | Stock keeper |
| `costs` | See and enter the purchase (code) price | Trusted staff only |

Rules:
- Admin has every permission implicitly; only an admin edits staff and permissions, sees the shop dashboard, profit and activity, and changes settings.
- Without `costs`, the purchase price is **never sent** to that person's screens (server-side DTOs) and never accepted from them.
- Without `prices`, MRP/selling price can be set only when **creating** an item (needed to tag it), not changed later. *(Decision D-PERM-1, see §6.)*
- Everything is checked on the server for every page and action; the menu only hides what you can't use.

## 3. Product photos

- Several photos per product: **camera** (rear) or gallery on the phone. Resized in the browser to max 1280 px JPEG (~100–200 KB) before upload, so uploads are fast on mobile data.
- Storage: **Vercel Blob** in production when available (`BLOB_READ_WRITE_TOKEN`); otherwise the image bytes are stored in Postgres (`product_images.data`) and served by `/api/product-images/<id>` with long-lived caching. Local dev and tests always use the database path.
- First photo is the **main** photo; can be changed; photos can be deleted.
- Main photo appears in product lists, on the product page, **and at the counter after a scan**, so the seller can confirm it's the right item.

## 4. "Tag old stock" flow (catalog person, phone-first)

```
Tag old stock
 1. Photo(s)        [📷 Take photo] [Gallery]
 2. What is it?     category · name · (company: optional, default "Old stock") · size · colour
 3. Price & count   MRP · selling price · (purchase price if allowed) · pieces counted
 4. Save → barcode generated → label shown
 5. [Next item]     keeps category / company / size from the last item
 At the end: "Print today's labels" — one sheet with every label I created today.
```

Behind the scenes it is the existing quick-add service (one product, one receipt, retry-safe), plus photos.

## 5. In-app help

`/help`: Getting started (new user), guides per role (owner, salesman, catalog person), "what's required vs optional", tips and suggestions, FAQ, troubleshooting. A dismissible "first time here?" card on the main screens links to it.

## 6. Decisions

| ID | Decision | Why |
|---|---|---|
| ADR-009 | Fine-grained permissions on top of two roles, stored as a list on `staff` | Owner wants to grant catalog/QC work to specific salesmen without making them admins |
| ADR-010 | Photos in Vercel Blob when configured, else in Postgres | Works everywhere (dev/tests/prod) with one code path for callers; Blob scales better |
| ADR-011 | Photos resized on the phone before upload | Phone photos are 3–8 MB; mobile data and server limits |
| D-PERM-1 (open) | Without `prices`, a catalog person can still set prices when creating an item | Old stock can't be tagged without a price; owner can review via Activity/products. Confirm with owner. |

## 7. Steps (each committed, pushed, deployed)

1. This plan.
2. Permissions: schema, server checks, staff screen with toggles, menus by permission, tests.
3. Photos: schema, storage, upload with camera + resize, gallery on product page, photo at the counter, tests.
4. Tag old stock flow + "print today's labels", tests.
5. In-app help + first-time tips.
6. Docs: README, user guide, decisions, progress.
