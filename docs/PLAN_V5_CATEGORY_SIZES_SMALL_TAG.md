# Plan v5: size lists per category + smaller tag with tick boxes (2026-11-15)

Owner request (chat): keep the QR tag but make it **much smaller with little padding**; print **all the sizes of the category** on every tag (e.g. S M L XL XXL) with this piece's size marked, so staff can **tick another size with a pen** on a printed tag later; sizes depend on the category — shirts S–XXL, kurtas M–XXL, jeans by gender (girls 26–32, boys 28–36) — and when stock is entered the app should take the **category first and offer its sizes**.

## Owner decisions (chat, 2026-11-15)

| Question | Decision |
|---|---|
| Tag size | **40 × 60 mm** (was 50 × 80) |
| Jeans by gender | **Two separate categories**: Ladies Jeans (LJ) 26–32, Gents Jeans (GJ) 28–36 |
| Who sets the size lists | **Pre-filled, owner can edit** in Categories |
| Live update | Yes — apply the database update on Neon and deploy after tests pass |

## Changes

| Part | Change |
|---|---|
| Data | `categories.sizes text[]` (migration 0005, adds a column only). Migration also fills the default lists for known category codes (only where empty) and adds Ladies Jeans / Gents Jeans (skipped if they exist). Defaults live in `src/lib/size-lists.ts` (seed uses the same). |
| Categories screen | Each category has **Sizes (in shop order)**, with one-tap presets (S–XXL, M–XXL, 26–32, 28–36, Free) |
| Entering stock | New design and Tag old stock show the **category's sizes first** (others still available); Quick add suggests them while typing |
| Tag | 40 × 60 mm, ~1.5 mm padding: shop + hole, QR (12 mm), size big + colour, **every size of the category with a tick box** (this one filled), name, ART. + code price, barcode (37 mm, 0.33 mm bars), MRP. A4 sheet: 16 tags per page; tag printer 40 × 60 mm; sticker 50 × 25 mm unchanged |

Default size lists (owner can change): T-Shirt, Shirt, Dress, Night Suit S–XXL · Kurta, Kurti M–XXL · Ladies Jeans 26–32 · Gents Jeans 28–36 · Jeans (existing) 26–36 · Saree, Dupatta Free · Lehenga, Leggings empty (owner fills; tags then show the design's sizes).

If a piece's size is not in its category's list (e.g. a shirt in size 40), the tag adds it to the end of the row, marked.
