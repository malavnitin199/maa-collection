/**
 * Shared Tailwind class strings (plan v8 look). Colours come from the active
 * theme (`brand-*` = the theme's dye, see globals.css); `dark:` follows the
 * day/night switch. Pill buttons with press feedback, soft-cornered cards with
 * a faint shadow in the theme's colour, roomy inputs with a theme focus ring.
 */
export const input =
  'rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base shadow-sm shadow-black/[0.02] transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 dark:border-zinc-700 dark:bg-zinc-900';
export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2 font-semibold text-white shadow-md shadow-brand-700/25 transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100';
export const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white/60 px-4 py-2 text-sm font-medium transition hover:border-brand-400 hover:text-brand-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:text-brand-300';
const cardBase = 'rounded-2xl border border-zinc-200/80 p-4 shadow-sm shadow-brand-900/[0.06] dark:border-zinc-800 dark:shadow-none';
export const card = `${cardBase} bg-surface`;
/** A card that sits back (previews, summaries). */
export const cardMuted = `${cardBase} bg-brand-50/60 dark:bg-zinc-900/60`;
export const sectionTitle = 'text-xs font-bold uppercase tracking-[0.12em] text-brand-800/70 dark:text-brand-200/70';
export const muted = 'text-zinc-500 dark:text-zinc-400';
export const okBox =
  'rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-200';
export const errorBox =
  'rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200';
export const link = 'text-brand-700 underline-offset-4 hover:underline dark:text-brand-300';
/**
 * A labelled button on the coloured header band: icon above a one-word caption,
 * at least 44 px tall, with a clear edge and a press effect — so it reads as a
 * button and says what it does.
 */
const headerChipShape =
  'inline-flex min-h-11 min-w-[3.4rem] flex-col items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 text-[11px] leading-none font-semibold shadow-sm ring-1 shadow-black/10 transition hover:-translate-y-0.5 active:translate-y-0 active:scale-90 disabled:opacity-60';
export const headerChip = `${headerChipShape} bg-white/15 text-white ring-white/35 hover:bg-white/25 active:bg-white/40`;
/** The same chip switched on (sound on): filled, so the state is obvious. Use instead of `headerChip`, not with it. */
export const headerChipOn = `${headerChipShape} bg-white text-brand-800 ring-white hover:bg-white/90 dark:text-brand-900`;
/**
 * Round icon button on the coloured header band (UI clean-up, v15): one small
 * symbol, a tooltip (`title`) and an accessible name; 36 px on narrow phones,
 * 40 px from 390 px wide. Lifts on hover, pops in on press.
 */
export const headerIcon =
  'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/25 transition duration-150 hover:-translate-y-0.5 hover:bg-white/20 active:translate-y-0 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60 min-[390px]:h-12 min-[390px]:w-12';
/** Round icon button on the coloured header band. */
export const headerIconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95';
