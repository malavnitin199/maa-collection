# Plan v16: the Bahi theme — a billing-app touch (2026-11-17)

Owner request (chat): "There was an app called Bill Book — explore it and copy its theme; give our app one touch of that Bill Book app, deploy it, and I'll test it and give feedback."

## Approach

The app meant is taken to be **myBillBook** (FloBiz), the common Indian billing app. Its **feel** is borrowed, not its brand: no logo, name or trade dress is copied. Its public website (read 2026-11-17) uses an indigo-violet main colour (#4C3CCE, lighter #7063D8, navy #3A4B8D), an orange accent (#DB631A), a light grey page (#F6F7F7) with white cards and thin grey borders (#E0E2E7), near-black / grey text (#292D35 / #667085) and the **Poppins** typeface.

That becomes a sixth theme, **Bahi / बही** (a ledger book), and the **default** for any phone that never picked a theme — so the owner sees it on opening the app. The five dye themes stay one tap away (☀ → colour), and a phone that already chose a theme keeps it.

| Part | Bahi |
|---|---|
| Colours | Indigo scale built on #4C3CCE (white text on the 600 step ≈ 7.6 : 1), orange accent #DB631A (#F08A4B at night) |
| Page | Light grey #F5F6F8 with white cards, near-black text #292D35 (night as the other themes) |
| Type | **Poppins** (Latin + Devanagari) for text, headings and big numbers; the print display face is not used in this theme |
| Signature | The woven zari strip becomes a **plain 3 px orange line** under the header, the login band and the day's revenue card |
| Header | The shop name is a little smaller (Poppins is wider), so the five round symbols always fit (checked at 360 px and 412 px) |
| Kept | Hang-tag tiles, pictures, motion, every screen and word — only the look changes |

## How it is built

- `src/features/appearance/appearance.ts`: `THEMES` gains `bahi` (last in the picker), `DEFAULT_THEME = 'bahi'`, its swatch.
- `src/app/globals.css`: `[data-theme="bahi"]` colour scale and accent; light page and text; Poppins for `body`, `h1`, `.font-display`; a smaller `.header-brand`; `.zari` as a flat line.
- `src/app/layout.tsx`: Poppins via `next/font` (`--font-poppins`); `<html data-theme="bahi">` before the script runs.
- Theme picker: 3 × 2 swatches. Guide picture of the picker keeps the five dye themes (its finger is calibrated on them).
- Words: `theme.bahi` = Bahi / बही.

No database change. To go back: set `DEFAULT_THEME` to `'peacock'` (and the `<html>` attribute), or pick another colour on a phone.

## Tests

`e2e/look.spec.ts` now expects `bahi` as the default; everything else unchanged. Full gate: lint, typecheck, 150 unit tests, build, Playwright (`--workers=3`) 75 passed, 1 skipped, 0 failed. Phone screenshots: login, Sell with an item, Home by night, Products, the picker.
