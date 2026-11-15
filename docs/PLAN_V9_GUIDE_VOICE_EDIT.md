# Plan v9: edit after tagging, a Guide that talks (2026-11-16)

Owner request (chat): "When we are creating a label, at the end give the option of **edit** too — there is only *Next item* or *Print today's labels*. Improve the **Guide**; if needed add **voice**, translated, and interaction, so it guides a user through. Deploy and commit, and keep the docs (and `PROJECT_CONTEXT.md`) up to date."

> **Update:** the Guide's layout in sections 2 and 4 (long lessons with a ▶ Listen player, Listen to all, tap-the-tag) was replaced the same day by short stories — see `docs/PLAN_V10_SHORT_GUIDE.md`. Edit after tagging, the phone's-voice decision and the practice sale stand.

## Owner decisions (2026-11-16, asked before building)

| Question | Answer |
|---|---|
| Which voice? | **The phone's own voice** (Web Speech API: Google voices on Android, Siri voices on iPhone). Free, no downloads, Hindi + English, always reads exactly what the lesson says. Not recorded audio files (paid service or recording, MBs of audio, re-made whenever a lesson changes). |
| Edit: may it lower a wrongly typed piece count? | **Not now.** That needs a new "stock correction" entry in the stock ledger (a live DB change). Pieces can still be **added**. Recorded as D-ST-2. |

## 1. Edit after making a tag (Tag old stock)

| Part | What happens |
|---|---|
| Finish screen | **✎ Edit this item** next to *Print today's labels* (big *Next item →* stays first); *Open item →* as a small link. |
| Edit mode | The same form comes back filled in, with a note "Editing <name> · barcode <code>". Photos, the tag-barcode scan and the piece count are hidden (they can't change here). **Save changes** / **Cancel**. |
| After saving | "Changes saved. Print the tag again if the name, size, colour or MRP changed." The tag preview shows the new details; *Next item* / *Print today's labels* as before. |
| Rule (server) | `correctTaggedItem` (`src/server/services/products.ts`), action `editTaggedItemAction`: same product row — **barcode, SKU and stock never change**, no stock movement. Name, size, colour, category, company always (with the *catalog* right). **Prices**: with the *Prices* right, or by the **person who created the item while it has never been sold or exchanged** (fixing what they just typed — same spirit as D-PERM-1). Purchase price only with *costs*. Otherwise the old prices stay and the screen says so. |

## 2. The Guide talks (voice, both languages)

| Part | What happens |
|---|---|
| **▶ Listen** on every lesson | The phone reads the lesson in the person's language (en-IN / hi-IN): title + intro, every step, the tip. The step being read **lights up** in the theme colour and scrolls into view. Controls: back a step, pause / continue, next step, stop, **Slow**, "2 of 7". The controls stay under the header while a lesson plays. |
| **Listen to all** | Per part of the Guide (Everyone, Selling, Stock & tags, Owner): plays its lessons one after another. |
| **Tap the tag** | In "Read a tag", a speaker button on each part (QR, size, all sizes, name + ART., barcode, MRP) reads just that part. |
| No voice on the phone | The button only shows where the browser can speak. If the phone has no voice for the language, a hint says how to add one (Settings → Text-to-speech → Google → Hindi). |
| Text → speech | The voice reads the screen text itself (no second copy to keep in sync); emoji, arrows, ✓ ✎ are dropped, `×` becomes "by" / "और" (`forSpeech`). |

## 3. The Guide you can try

**Practice a sale** (inside "Sell an item"): the sample tag → **Scan this tag** (scan "ting") → the item card → **Sell this item** → quantity + price → **Record sale**. A price above MRP shakes with a buzz and says why; a good one shows the real **"Sale done"** card with the chime. **Voice help** (on by default) says what to do at each step. Labels are the real Sell screen's, in Hindi or English. **Nothing is saved** — no server call at all.

## 4. Lessons brought up to date

- **Log in and find your way**: name circles + number keys, the round **Sell** button in the bottom bar, the palette button, the log-out arrow.
- **New lesson: Colours and day/night** (everyone, 1 min, animated swatches and day/night switch).
- **Sell an item**: starts from the round Sell button; practice sale added.
- **Tag stock already in the shop**: new step for **✎ Edit this item**.
- All of it in Hindi too (`lessons.hi.tsx`). The Guide now has **15 lessons**.

## Files

`src/features/guide/voice.ts` (speech helper, queue), `voice-player.tsx` (LessonVoice, ListenAll, HearButton), `practice-sale.tsx`, `illustrations.tsx` (LoginArt redrawn, ThemeArt), `lessons.tsx` / `lessons.hi.tsx`, `guide.css` (`.voice-now`, sound bars), `src/app/(pos)/guide/page.tsx` (`data-voice` / `data-voice-text` marks). Edit: `src/features/catalog/old-stock-form.tsx`, `src/server/actions/admin.ts`, `src/server/services/products.ts`.

## Tests

Unit: `correctTaggedItem` (creator fixes an unsold item; prices kept once sold / for someone else; *Prices* right can; selling ≤ MRP), `forSpeech`. E2E: `e2e/guide-voice.spec.ts` (a stand-in voice records what would be spoken: Listen reads + highlights + next/pause/stop, tap-to-hear, Hindi voice `hi-IN`, practice sale), Edit after tagging in `e2e/admin-setup.spec.ts`.

## Not in this round

Lowering a piece count (D-ST-2); recorded voice files; a guided walk-through over the real screens (coach marks) — possible later if staff want it.
