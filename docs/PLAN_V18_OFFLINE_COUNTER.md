# Plan v18 — Selling without internet, and a bigger header

Owner request (2026-11-19): *"Increase the height of the header… looking so small. And give the functionality of the offline support also, such that if salesman is offline and still scan the QR code, then the record is able to maintain when he or she back online again. So build a backup system also."*

## Owner's answers (2026-11-19)

| Question | Answer |
|---|---|
| A sale made offline clashes when it is sent (item sold out, hidden, MRP lowered) | **Let stock go below zero** — the sale is recorded like any other; the owner recounts |
| What works offline | **Sell by hand**, **See unsent sales** — and scanning, because the request names "scan the QR code" |
| Backup | **The phone keeps unsent sales** until they reach the shop (no owner backup download) |

This answers open decisions **D-07** (offline oversell) and **D-14** (offline after sign-off) — see ADR-032.

## What the salesman sees

| Moment | Screen |
|---|---|
| Internet drops | An amber strip under the shop's name: **No internet · the counter still works** |
| Scans a tag (scanner, camera or the tag's QR code) | The item comes from **this phone's copy** (amber note with the copy's time; stock may have changed) |
| Records the sale | **Saved on this phone** card with the amount; the strip counts the saved sales |
| Tag won't scan | **Enter by hand** works the same way |
| Taps the strip | **Saved on this phone** list: each sale, its time, *Waiting*; *Send now* (waits for internet) |
| Internet is back | Sales are sent by themselves; a green message **2 saved sales reached the shop**; the strip goes away |
| Opens the app with no internet | The counter opens (kept by the offline helper); other screens show a short *No internet* page with **Open the counter** |
| Logs out with saved sales | A warning: they stay on the phone and are sent at the next login |
| Exchange screen offline | *Exchange needs internet* — exchanges stay online-only (they look up the bill) |

The owner's **Approvals** show each such sale with a blue **Made offline · time** mark, next to the usual profit / loss mark.

## How it works

| Piece | Where | What it does |
|---|---|---|
| Phone storage | `src/offline/store.ts` | IndexedDB `maa-offline` (stores `outbox`, `kv`); falls back to localStorage. A save resolves only when written. |
| Saved sales | `src/offline/outbox.ts` | One list for every screen and tab (BroadcastChannel). |
| Sending | `src/offline/sync.ts` | Oldest first, one at a time, only the person who made them; sent → removed, refused → kept with the reason, no internet / logged out → stop and keep. One run at a time (`navigator.locks`). |
| Server for sending | `POST /api/offline-sales` | Same `recordSale` as the counter with `offline: { at, mrpPaise }`; retry-safe by `operationId`; must be the person logged in now. |
| The phone's copy | `GET /api/counter-catalogue` → `src/offline/catalogue.ts` | Items in use (never purchase prices) + staff names; refreshed every 5–10 minutes while online and after sending. |
| Reachable? | `src/offline/network.ts`, `GET /api/ping` | The phone's own signal, plus "the shop did not answer in time" (6 s look-up, 12 s sale). |
| Offline helper | `public/sw.js` (service worker, built app only) | Keeps the counter page and the app's files; QR link `/i/<code>` → counter with that item. |
| Screens | `src/features/offline/*`, `pos-screen.tsx`, `role-header.tsx` | Strip, list, logout warning, counter messages. |

## Rules that do not change

- Online sales still refuse: out of stock, more than in stock, hidden item, price above MRP.
- Every salesman sale (offline or not) waits for the owner in Approvals; totals count approved sales only.
- Stock changes only through the same append-only movements (a `sale` movement per sale).
- Salesman screens never receive purchase prices (the copy is built column by column).

## Database change (migration 0009)

| Change | Why |
|---|---|
| `products_stock_nonnegative` check removed | An offline sale may take the count below zero (owner's choice). Online flows keep their own refusals. |
| `sales.offline_at` (time, nullable) | The phone's time when it was made; null = made online. The sale's own time stays the server's (no back-dating). |

## The header (owner: "looking so small")

Badge 52 px, shop name 1.55 rem, name · role line 14 px, अ / ⋯ buttons 48 px, more padding; the offline strip sits under it only when needed.

## Not in this plan

Exchanges offline, an owner backup download, background sending while the app is closed (Background Sync), photos in the phone's copy, a printed offline receipt.
