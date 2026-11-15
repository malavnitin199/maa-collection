# Plan v10: a short Guide — stories with animations (2026-11-16)

Owner feedback (chat): "The layout and colours are very good. Inside the Guide it is very lengthy — minimise it, explain in minimum words with better animations and better guidance. It is too long for people to take guidance from."

## What was wrong

The Guide had 15 lessons, about **1,600 words** in ~66 long sentences, all on one long page with one drawing per lesson.

## Owner decision (asked before building)

**Story player** (not a short list): a lesson opens one step at a time, like a story — a big animation, a few words, progress bars; tap Next or swipe; the voice reads each step and moves on by itself.

## What it is now

| Part | Before | Now |
|---|---|---|
| Words on screen | ~1,600 | **under 450** (test-enforced); every step **≤ 7 words**, title ≤ 4, tip ≤ 12 |
| Steps per lesson | 3–6 long sentences | **2–5** short ones |
| Pictures | one drawing per lesson | **one animated scene per step**: a small phone in the app's theme shows the exact control; a round "finger" taps it; PIN dots and prices type in; the scan line sweeps; ticks pop; bars grow; the real tag with one part ringed |
| Voice | read the long text | reads a **fuller friendly line** per step (`say`), so the screen stays short; when it finishes, the next step comes by itself. Voice on/off is remembered on the phone |
| Page | one long scroll | **Pick your part** (Everyone / Selling / Stock & tags / Owner — preselected from who is logged in) → only that part's lessons as tiles → tap → story |
| End of a lesson | — | what you get in one line, the tip, **Open the screen**, **Practice a sale** (Sell), **Got it ✓** ticks the lesson |
| Links | `/guide#sell` scrolled to a lesson | `/guide#sell` **opens** the lesson; `/guide#for-owner` picks a part; the phone's Back button closes a lesson |

The 15 lessons: Log in · Language and colours · Read a tag · Sell an item · Open from the QR · Exchange · New design · Tag old stock · Print tags · More pieces arrived · Keep stock right · Prices · Staff and rights · Sales team · Reports. Hindi for every line.

## How it is built

- `src/features/guide/stories.ts` — all lessons as data, English and Hindi side by side: `text` (shown, `**bold**` = the button), `say` (spoken), `scene` (what the phone shows).
- `scenes.tsx` — `PhoneScene`: 22 scene kinds drawn with the app's own colours and icons (names, keypad, dock, header, swatches, day/night, tag part, scan, item card, field, done, chips, price table, print, photo, edit, count, buttons, toggles, bars, columns, list). The tag scenes use the real `HangTag`.
- `guide.css` — the animations (`st-*`, one 2.8 s loop); with reduced motion each scene is a still picture of its end state.
- `story-player.tsx` — `GuideBrowser` (part chips, tiles, address-based open/close) and the full-screen `StoryPlayer` (progress bars, swipe, arrow keys, Escape, voice, auto-advance, final card).
- Removed: the long `lessons.tsx` / `lessons.hi.tsx`, the per-lesson drawings, the page-level Listen player and "Listen to all" (plan v9) — the story player replaces them. Kept: `voice.ts`, the practice sale, the ✓ learned store.

## Tests

- Unit `stories.test.ts`: every lesson 2–5 steps; step text ≤ 7 words, spoken line ≤ 26; Hindi on every line; whole guide < 450 words.
- E2E `guide-voice.spec.ts`: a story plays (short text, fuller spoken line, auto-advance, Next/Back/arrow keys, voice off, Got it ticks it), links open a lesson / a part, Hindi voice `hi-IN`, practice sale inside the lesson. `admin-setup.spec.ts` / `pos.spec.ts` guide checks updated.
- Screenshots of all 63 steps at phone size, plus Hindi in a night theme.
