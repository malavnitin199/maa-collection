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
- **What is not translated**: product names, sizes, colours, brands, staff names, SKUs, barcodes, money (₹1,299.00, Indian digits) and dates in English month names (Indian format) — the shop's own data stays as typed.
- Devanagari uses the phone's system font (Geist has no Devanagari).

## Approach — scan feedback

- `src/features/feedback/`: **sounds made in the browser** with the Web Audio API (no audio files, no licences): a short bright "ting" on a good scan, a two-tone rising chime when a sale/exchange is done, a soft low buzz on a failed scan. A short **vibration** on phones (`navigator.vibrate`).
- **Visual**: a green tick that pops with a ripple at the scan box on a good scan; the scan box shakes and flashes red on a failed one; a **"Sale done ✓" card** with the amount (checkmark drawn, card rises) after a sale or exchange — it closes by itself after ~1.6 s, on a tap, or when the next scan starts.
- **Sound setting** per phone (`localStorage` `maa-sound`, default on) — the 🔊/🔇 button in the header. The audio is unlocked on the first tap/key press (phones block sound until a touch).
- **Reduced motion** (phone setting): no pops, ripples or shakes — the tick and card simply appear.
- Used on Sell, Exchange and More of existing items (restock scanning).
