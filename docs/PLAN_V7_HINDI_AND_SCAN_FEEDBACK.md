# Plan v7: Hindi + English, and payment-app style scan feedback (2026-11-15)

Owner request (chat): (1) **multi-language support, Hindi and English for now** — each user picks a language and can switch smoothly; (2) when a salesman's scan succeeds, show a **completion effect with a sound**, like payment apps. Record every approach in `docs/`.

## Owner decisions (chat, 2026-11-15)

| Question | Decision |
|---|---|
| How much Hindi in this round | **Salesman screens first**: login, header/menus/tabs, Sell, Exchange, My sales, scanning (box + camera), sale/exchange messages and their errors, first-time tips, and the Guide (page + the everyone/selling lessons). Owner/catalog screens (stock forms, products, categories, labels, reports, team, settings), Help and the remaining Guide lessons next round. |
| Where the choice is kept | **Per person** (`staff.language`, migration 0006), falling back to this phone's last choice (cookie `maa-lang`), then English |
| Sounds | **On by default**, with a 🔊/🔇 button (per phone) |

## Approach — languages

- **No i18n library.** Dictionaries in `src/lib/i18n/`: `en.ts` is the source (flat keys like `sell.record`), `hi.ts` must have exactly the same keys (TypeScript `Record<MessageKey, string>` — a missing Hindi key fails the build; a unit test also checks the `{placeholders}` match). `makeT(messages)` → `t(key, vars)` with `{name}` interpolation and `.one` / `.other` plurals.
- **Where the locale comes from** (`src/server/i18n.ts`, `getLocale()`, cached per request): the logged-in person's `staff.language`, else the `maa-lang` cookie, else `en`.
- **Server components** call `await getT()`. **Client components** use `useT()` from `I18nProvider`, which the root layout fills inside one `<Suspense>` (`LocaleRoot`), wrapping the page in `<div lang="hi|en" class="contents">` so screen readers and fonts know the language.
- **Switching** (`LanguageSwitch`, in the header and on the login page): `setLanguageAction` saves `staff.language` (when logged in) and the cookie, then `router.refresh()` re-renders in place — no reload, scroll and form state of client components stay.
- **Server messages**: `DomainError` can carry a message key + values; the counter actions translate it for the person (`translateError`). The English text stays as the fallback, so untranslated owner screens are unaffected.
- **What is not translated**: product names, sizes, colours, brands, staff names, SKUs, barcodes, and money (₹1,299.00, Indian digits) — the shop's own data stays as typed. (Dates follow the language since round 2.)
- Devanagari uses the phone's system font (Geist has no Devanagari).

## Round 2 (2026-11-16): owner and catalog screens

Owner asked to translate the owner and catalog screens too (and, seeing the live Home dashboard, named "Net revenue", "Net profit", "Sold", "Exchange", "This month"). Done in one pass:

- **Dictionaries per area** in `src/lib/i18n/modules/`: `stock.ts` (`stk.*`, stock entry + labels), `catalog.ts` (`cat.*`, products, suppliers, categories, catalog forms, menu), `owner.ts` (`own.*`, dashboard, reports, team, staff, settings, activity), `help.ts` (`help.*`, Help page, Guide routine), `actions.ts` (`act.*`, owner/catalog server-action messages). `en.ts` / `hi.ts` merge them; Hindi is type-checked to have every key.
- **Server messages**: every rule error in `products.ts`, `images.ts`, `catalog.ts`, `staff.ts`, `settings.ts` and the owner/catalog actions carries a key; `failure()` in `admin.ts` translates for the person. English messages unchanged.
- **Help page and all 14 Guide lessons** in Hindi (words inside the Guide drawings too).
- **Dates follow the language** (`formatDate`): "15 नव॰ 2026, 4:00 pm" in Hindi, "15 Nov 2026, 4:00 pm" in English; digits stay normal.
- **Work split**: four helpers translated disjoint file sets in parallel with one shared word list (docs/TECHNICAL_REFERENCE.md §15); then one integration pass. English text is byte-identical (all e2e assert English).
- **Checked by machine**: a crawler logs in as the owner in Hindi, opens all 26 screens (folded sections opened) and lists English left in visible text, placeholders, aria-labels and titles. Final result: only shop data (names, sizes, colours, SKU codes), the "English" switch button and "Bluetooth".
- **Stays English on purpose**: printed tags and stickers (customers read them), CSV exports (accountant), browser-tab page titles, shop data, and the rare photo-resize error from the phone ("This phone cannot process photos.").

## Approach — scan feedback

- `src/features/feedback/`: **sounds made in the browser** with the Web Audio API (no audio files, no licences): a short bright "ting" on a good scan, a two-tone rising chime when a sale/exchange is done, a soft low buzz on a failed scan. A short **vibration** on phones (`navigator.vibrate`).
- **Visual**: a green tick that pops with a ripple at the scan box on a good scan; the scan box shakes and flashes red on a failed one; a **"Sale done ✓" card** with the amount (checkmark drawn, card rises) after a sale or exchange — it closes by itself after ~1.6 s, on a tap, or when the next scan starts.
- **Sound setting** per phone (`localStorage` `maa-sound`, default on) — the 🔊/🔇 button in the header. The audio is unlocked on the first tap/key press (phones block sound until a touch).
- **Reduced motion** (phone setting): no pops, ripples or shakes — the tick and card simply appear.
- Used on Sell, Exchange and More of existing items (restock scanning).
