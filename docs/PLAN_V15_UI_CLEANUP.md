# Plan v15: a cleaner UI — icon header, pictures, gentle motion (2026-11-16)

Owner request (chat): "Work on the UI part. Make it very clean. Add some animations, small pictures, interactive images, symbols. Make it easier for the sellers, the salesmen and the admin. Change the header for the day/dark theme mode: just put the icon at the top. Clean all of this, then push with proper commits and deploy to Vercel."

The plan below was posted in chat and built straight away (owner said to go ahead).

## What changed

| Area | Before | Now |
|---|---|---|
| **Header** (every screen) | Shop name + user chip, then a second row of five big labelled buttons (Theme, Sound, हिन्दी, Guide, Log out) — about a fifth of a phone screen | **One slim row**: "Maa Collection" with "Name · Role" under it, and five **round symbols**: ☀/☾ (shows day or night; a small dot in the theme's colour; opens colours + day/night), speaker (sound on/off), **अ / A** (the language you switch to), book (Guide), door (log out). Each has a tooltip and keeps its spoken name. 36 px on small phones, 40 px from 390 px wide. |
| **Login** | Labelled Theme / हिन्दी buttons | The same round symbols, and a small gold **hang tag** hanging from the band (it swings; tap nudges it) |
| **Sell** | Scan box, then a plain *Enter by hand* button | A **ready card** under the scan box: an animated tag with a scan line sweeping its barcode, "Scan a tag to sell", the ways to scan, and *Tag won't scan? Enter by hand* with a pencil. *My sales today* is a pill with a ₹ symbol. |
| **Item at the counter** | A two-column table of eight labels | Photo (or a tag symbol), name, **size and colour chips**, the **selling price big**, MRP under it, **pieces in stock as a coloured badge** (theme / amber when few / red when none); SKU, barcode, brand and category in one small grey line. *Sell this item* now fits on the first screen. |
| **Home (owner)** | Every low-stock item (60+ rows with the demo data) and ~20 activity entries | Section titles with symbols (☀ Today, chart This month, people, boxes, clock); number tiles with a small symbol; **Low stock: the first 6** + *Show all N*; **latest 6 entries** + *See all activity*. About a third shorter. |
| **My sales** | Plain tiles; "Waiting for the owner: 1 sales" | Tiles with symbols, rising in; a clock on the waiting note; "1 sale" / "2 sales" |
| **Approvals** | "Nothing is waiting." | A tick that pops in with a twinkle above the same words |
| **Motion** | Page fade only | Tiles and cards **rise in one after another** (Home, My sales, More, Stock, Products); round symbols lift on hover and pop on press; the pictures swing / sweep / twinkle. **All motion stops** when the phone asks for reduced motion. |
| **Scrolling** | The floating dock and the sticky header could cover what the browser scrolled to | `scroll-padding` keeps anything the browser scrolls to (keyboard focus, a jump to a field) clear of the header and the dock |

Guide: *Language and colours* now says "Tap **अ / A** at the top" and "Sun button → pick a colour"; the drawn header in the lessons shows the new symbols, and the finger lands on them.

## How it is built

| Piece | Where |
|---|---|
| Round symbol style | `headerIcon` in `src/components/ui/styles.ts` |
| Header | `src/components/layout/role-header.tsx`; `AppearanceMenu` (☀/☾ + theme dot), `SoundToggle`, `LanguageSwitch onBand` (अ / A) |
| Pictures | `src/components/ui/art.tsx`: `ScanTagArt`, `AllDoneArt` (inline SVG, theme colours via `currentColor` and `--zari`, decorative) |
| Motion | `src/app/globals.css`: `.rise-in`, `.art-swing`, `.art-scan`, `.art-pop`, `.art-twinkle`, `.art-tap`; reduced-motion block; `scroll-padding` |
| Counter card | `src/features/pos/product-card.tsx` (`StockBadge`, `ProductDetails`) |
| Home | `src/app/(admin)/admin/dashboard/page.tsx` (`Title`, `LOW_STOCK_SHOWN`), `StatTile icon`, `ActivityList limit / more / icon` |
| Words | `sell.ready.*`, `activity.seeAll`, `own.dash.showAllLow`; `my.waiting` takes `{sales}`; `sell.myToday` without the arrow — English + Hindi |

No database change. Accessible names of the header controls are unchanged ("Theme and day/night", "Sound and vibration for scans", "Language: English. Switch to Hindi", "Guide", "Log out").

## Tests made reliable on the way

- `pos.spec.ts` camera popup: waits until the scan form stops moving (the page slides in; the first-time tip appears after loading) before measuring; the check itself is unchanged.
- `guide-voice.spec.ts`: hides the dev-only Next.js overlay (`nextjs-portal`), which popped a notice over the story's *Back a step* button on phone size.
- Playwright starts its dev server with `E2E=1`, which sets `devIndicators: false` (the dev badge also sat over buttons). Production is unaffected.
- With the Mac busy (load average 8–12 from other apps), the full suite at default parallelism timed out in random tests; with `--workers=3` it passes fully.
