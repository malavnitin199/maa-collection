# Scanning guide — how to scan items and record a sale

This explains how scanning works today (dummy data, no database yet), how to test it on a phone, and how it will change when the database arrives.

## 1. The sale flow

```
Scan (camera / hardware scanner / typed code)
  → Step 1: item details card — SKU, barcode, brand, category, size, colour, MRP, stock
      → Cancel, or "Sell this item"
  → Step 2: sell card — quantity + bargained sale price (prefilled with MRP)
      → "Record sale"
  → stock deducted, sale saved under the selected salesperson
  → confirmation: "Sold 2 × Classic Crew Tee @ ₹450 each — by Ravi. Stock left: 1"
```

Rules enforced before a sale is saved:

| Rule | What the user sees |
|---|---|
| Unknown code | "No item found for …" |
| Stock is 0 | details still show; "Sell this item" says the item is out of stock |
| Quantity above stock | "Only N left in stock." |
| Price above MRP | "Sale price cannot be above MRP." |
| Empty / invalid price | "Enter a valid sale price." |

## 2. Three ways to scan

### A. Phone camera
On the POS screen tap **Scan with camera**, allow camera access, point at the code. It reads once and closes automatically.

Requirements:
- An **https://** address or `localhost`. Browsers refuse camera access on plain `http://`. The Vercel URL (`https://maa-collection-pi.vercel.app/pos`) works; `http://192.168.x.x:3000` does not.
- Works in Chrome (Android) and Safari (iPhone). Uses the rear camera.
- Reader (`src/features/scanning/camera-scanner.tsx`): the browser's built-in `BarcodeDetector` when available (Chrome on Android), otherwise `@zxing/browser`. It asks for an HD picture with autofocus and reads EAN-13, EAN-8, UPC-A and Code 128 barcodes (and QR codes, in case an item ever carries one). A green box shows where to hold the barcode.

### B. Hardware scanner (USB or Bluetooth)
These scanners act as a keyboard: they type the code and press Enter. Just scan — the scan box is selected when the POS screen opens, and if focus has moved to a button (for example after using the camera), the app still recognises the fast scanner burst and treats it as a scan instead of pressing the button (`src/features/scanning/scanner-keystrokes.ts`). The only time a scan is ignored is while typing in the quantity or price box. No pairing with the app is needed — only with the phone or computer. This is the recommended setup at the counter because it is faster than the camera.

### C. Type the code
Type a SKU (`MAA-TS-001`) or barcode (`8901111000014`) into the scan box and press Enter or **Find**. This is the fallback for a torn label.

## 3. Test barcodes

Every demo item has **one** label, an EAN-13 barcode (the same kind printed on clothing tags). Scanning it, by camera or by a hardware scanner, finds the item (owner decision: one code per item, no separate QR code).

- **EAN-13 barcode** encoding the item's barcode number: `public/barcodes/<SKU>.svg`. Drawn by our own code (`ean13Svg` in `src/features/scanning/ean13.ts`); every one was checked by scanning it through the POS camera.
- Page: **Admin → Labels** (`/admin/labels`) shows the barcode for all eight items with name, size, colour and MRP. Open it on a laptop and scan it with the phone camera from the POS screen, or print it.
- Ready-made sheet: `Maa-Collection-test-labels.pdf` / `.png` in the starter folder (one level above the app).
- Regenerate after changing the catalog: `pnpm labels:generate` (script in `scripts/generate-labels.ts`).

| SKU | Barcode | Item | Demo stock |
|---|---|---|---|
| MAA-TS-001 | 8901111000014 | Classic Crew Tee, M, Black | 3 |
| MAA-TS-002 | 8901111000021 | Classic Crew Tee, L, White | 5 |
| MAA-KU-001 | 8902222000016 | Anarkali Kurta, M, Blue | 4 |
| MAA-KU-002 | 8902222000023 | Anarkali Kurta, L, Red | 2 (low) |
| MAA-JE-001 | 8903333000018 | Slim Fit Jeans, 32, Indigo | 6 |
| MAA-SH-001 | 8905555000012 | Oxford Shirt, 40, Sky Blue | 1 (low) |
| MAA-SA-001 | 8904444000010 | Banarasi Saree, Free, Green | 0 (out of stock) |
| MAA-DR-001 | 8906666000014 | A-Line Dress, S, Maroon | 8 |

Stock numbers are the starting values; they go down as you record sales. **Admin → Dashboard → Reset demo data** restores them.

## 4. Testing on your phone, step by step

1. Open `https://maa-collection-pi.vercel.app/login` on the phone.
2. Tap **Continue as Salesman**.
3. On a laptop, open `https://maa-collection-pi.vercel.app/admin/labels`.
4. On the phone tap **Scan with camera**, allow the camera, hold a barcode on the laptop screen inside the green box.
5. The item details appear. Tap **Sell this item**, enter the price the customer paid, tap **Record sale**.
6. On the phone open **Switch role → Continue as Admin** to see revenue and stock. (The phone and the laptop each keep their own demo data, so check the dashboard on the same device you sold from.)

## 5. Where the data lives today, and what changes with the database

| Today (demo) | After the database phase (P2–P4) |
|---|---|
| Catalog is a fixed list in `src/features/catalog/dummy-catalog.ts` | Catalog comes from PostgreSQL through an API; admin can add items |
| Stock and sales live in the browser's localStorage (`src/features/inventory/dummy-store.ts`) | Stock and sales live on the server; every device sees the same numbers |
| Each device has its own stock | One shared stock; two phones selling the last piece is handled by a database transaction |
| Salesperson is a dropdown | Salesperson comes from the logged-in account |

The scanning code, the two-step screen, and the validation rules (`src/features/inventory/inventory.ts`) stay the same. Only the `recordSale()` and `useInventory()` functions change from localStorage to API calls.

## 6. Troubleshooting

| Problem | Cause / fix |
|---|---|
| "Camera needs HTTPS" | You opened an `http://` address. Use the Vercel URL or `localhost`. |
| "Camera permission was denied" | Allow the camera in the browser's site settings and reload. |
| Camera opens but never reads | Hold the phone steady 15–25 cm away, keep the barcode flat and level inside the green box and wait a moment for it to come into focus; avoid glare on the screen. Increase laptop screen brightness. |
| Hardware scanner types nothing | Check the scanner is paired as a keyboard and set to send Enter after each code. Scans are ignored while the cursor is in the quantity or price box. |
| Page loads but buttons stay disabled | Development only: opened via an IP that isn't allowed. Use `localhost` or add the IP to `allowedDevOrigins` in `next.config.ts`. |
