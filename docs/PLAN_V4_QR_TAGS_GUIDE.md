# Plan v4: QR hang tags + Guide section (2026-11-15)

Owner request (chat, with a photo of a fashion-store hang tag): print tags like that one — **QR code, product name, barcode, the size boxed big and a row of the design's sizes (S M L XL …) with this item's size highlighted** — replace the current label images and regenerate the test labels; and build a **Guide** section that teaches every part of the app (steps, animations), including how to manage inventory. Owner is away; work proceeds with the decisions below (marked *assumption* where the owner should confirm).

## Tasks

> Tag size and size row updated by plan v5 (`docs/PLAN_V5_CATEGORY_SIZES_SMALL_TAG.md`): 40 × 60 mm, every size of the category with tick boxes.

| # | Task | Status |
|---|---|---|
| 1 | New **hang tag** (50 × 80 mm): shop name, QR, size box (size + colour), size row with this size highlighted, name + brand, ART. = SKU, EAN-13 barcode, MRP box, code price | ✅ Done |
| 2 | QR → item link `/i/<barcode>`: staff phone camera opens the item (owner/catalog → product page, salesman → counter with the item loaded); logged-out → login. In-app scanners and USB scanners accept the link too | ✅ Done |
| 3 | Label formats: **Tags on A4** (default, 9 per page) · **Tag printer 50×80 mm** · Sticker printer 50×25 mm (unchanged, barcode only — too small for a QR next to a scannable barcode) | ✅ Done |
| 4 | Regenerate `Maa-Collection-test-labels.png/.pdf` (project folder) with the new tags | ✅ Done (QR → live app) |
| 5 | **Guide** section `/guide`: lessons by role with animated illustrations, steps, "open this screen" links, inventory routine; linked from the header, menu and login | ✅ Done |
| 6 | Tests (unit + e2e desktop/phone), docs, commits, push, deploy, live check | see `docs/PROGRESS.md` |

## Decisions

- **ADR-014** (owner, chat): tags carry a **QR code** in addition to the EAN-13 barcode. This reverses the "no QR on labels" part of ADR-005; the EAN-13 stays the item's identity (all existing tags and scanners keep working).
- *Assumption (D-QR-1):* the QR holds a link to the item in this app, `https://<app>/i/<barcode>`, not public product information. The domain is the one the tags are printed from (or `APP_URL` if set). If the domain ever changes, in-app scanning of old tags still works (the code is read from the end of the link); only opening with a plain phone camera would need the old address.
- *Assumption:* the tag shows **MRP only** (as before) — the selling price is bargained at the counter. Text "(incl. of all taxes)" is the legal meaning of MRP in India.
- The size row lists the sizes this design was made in (from the catalogue), in shop order; with a single size the row is left out.

## Not changed

Barcode numbers, SKUs, sale/stock logic, permissions. `/help` stays as the quick reference & FAQ; `/guide` is the learning path.
