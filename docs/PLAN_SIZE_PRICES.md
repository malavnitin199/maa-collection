# Plan: prices by size (2026-11-15)

Owner request: a design in several sizes × colours gets **one default MRP, selling price and purchase price**, and the owner can give **any size its own** MRP, selling and/or purchase price. Price follows the **size only**: every colour of a size has the same prices. Colour never changes the price.

## Owner decisions (chat, 2026-11-15)

| Question | Decision |
|---|---|
| MRP: one per design, or by size? | **By size too** (bigger sizes often carry a higher printed MRP). Selling price ≤ MRP is checked per size. |
| Product page "Rates for the whole design" (set one price for all) | **By size too**: the same editor, filled with today's prices, so size prices are never wiped by one tap. |
| Ship | Commit, push, deploy to production, live check. |

## Data model

No migration. Each size × colour is already its own `products` row with its own `mrp_paise`, `price_paise`, `cost_paise`; the DB check `0 < price ≤ mrp` stays. Labels, counter, exchange, restock and reports already read each item's own prices. Past sales keep their snapshots.

## Rules (one place: `src/lib/size-prices.ts`, checked again on the server)

For each size: `MRP = size MRP ?? default MRP`; `selling = size selling ?? default selling ?? that size's MRP`; `purchase = size purchase ?? default purchase`. Server (`createDesign`, `updateDesignRates`) validates every size (MRP > 0, 0 < selling ≤ MRP, purchase ≥ 0, whole paise) and names the size in errors. A price for a size that is not in the design is refused. All money integer paise.

Permissions unchanged: creating a design needs `catalog`; changing rates later needs `prices`; purchase prices (default and per size) are only shown, accepted and saved with `costs` — the server drops them otherwise.

## Screens

- **New design** (`/admin/stock/new`): defaults as today; with 2+ sizes a fold-out **Price by size (optional)** lists each size with MRP / selling / purchase boxes. Empty box = default (shown in grey); a typed number = this size's own price (green), clear it to return to default. Preview shows the price per size and the purchase value.
- **Product page → Rates for the whole design**: same editor; sizes whose colours currently differ are named and made equal on save.

## Not changed

Single product add/edit, quick add, tag old stock, restock, scanning, counter sale, exchanges, labels layout.

## Tests

Unit (PGlite): defaults to all; size MRP / selling / purchase overrides across colours; sizes differ; changing one size leaves others; colour never splits prices; unknown size refused; per-size above-MRP refused; action drops purchase prices without `costs`. E2E (desktop + phone): owner enters size prices → labels show size MRP → rates by size on the product page; catalog person without `costs` sees no purchase boxes.
