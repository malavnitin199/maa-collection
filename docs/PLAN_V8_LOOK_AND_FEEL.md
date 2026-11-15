# Plan v8: look and feel — themes, day/night, a shop-made design (2026-11-16)

Owner request (chat): make the app easier to use and more catchy for retailers — several themes, play with colours, a day/night mode, more interactive, creative (not plain rectangles), take references.

## Direction: "the shop's own fabric"

Subject: the counter and stockroom of an Indian clothing shop, used on phones by the owner and (Hindi-speaking) salesmen. Each screen has one job — sell fast, add stock fast, see the day. The look is drawn from the shop's own materials: dyed fabric, the zari border of a saree, and the hang tags the app prints.

| Token | Choice |
|---|---|
| Themes (per phone) | **Peacock / मोर** teal + zari gold (default) · **Marigold / गेंदा** saffron + maroon · **Rani / रानी** rani pink + mustard · **Neel / नील** indigo + haldi · **Mehendi / मेहंदी** henna green + terracotta. Each is a full `brand-50…950` scale whose 600 step keeps white text ≥ 4.5:1, plus an accent colour. |
| Day / night | Day, Night, or Follow the phone. Stored per phone; set before the first paint (no flash). Tailwind's `dark:` follows `data-mode`. |
| Type | **Rozha One** (Indian print headline face, Latin + Devanagari) for page titles and the big numbers only; **Mukta** (humanist sans, Latin + Devanagari) for everything else; Geist Mono for SKUs and codes. |
| Signature | **Zari border** — a woven saree-border strip under the header (and on the "done" card), in the theme's accent. The one decorative flourish; everything else stays quiet. |
| Shapes | Primary action tiles are **hang-tag shaped** (notched corners + punch hole) — the app's own tags — instead of plain rectangles. Cards: soft 2xl corners, gentle tinted shadow. Buttons: pill shaped, press feedback. |
| Navigation | Floating bottom **dock** with a raised round **Sell** button in the middle (the most used action, like the scan button in payment apps); line icons instead of symbols. |
| Login | Staff as name circles (initials), and a big **number keypad** for the PIN, like UPI apps. |

References (ideas, not copies): Indian UPI apps (central scan button, keypad PIN, completion card), Shopify POS (clear action tiles), saree borders and bandhani/block-print motifs (the zari strip), and the app's own 40 × 60 mm hang tag.

## Status (2026-11-16): built, tested, deployed

Everything in the table above is in the app, plus: today's net revenue as a dyed hero card on Home, the scan zone (dyed panel with zari viewfinder corners) on Sell / Exchange / Restock / Tag old stock, and the More menu as grouped lists with icons. The picker is a bottom sheet on phones. Tests: `e2e/look.spec.ts` + the full suite at desktop and phone size. Developer notes: `docs/TECHNICAL_REFERENCE.md` §17; decision ADR-018.

Quality floor: works at 360 px wide, visible keyboard focus, reduced motion respected, printed tags/labels unaffected (print stays plain white), English and Hindi both fit.
