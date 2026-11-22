/**
 * Coloured labels on Products cards and the item page (owner's feedback 2026-11-22,
 * ADR-058/059): the company in the theme's accent colour (`zari`), items and pieces in its
 * brand colour — every theme has both, so they stay apart in each.
 */
export const chip = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold';
export const chipTone = {
  company:
    'bg-zari/10 text-[color-mix(in_oklab,var(--zari)_72%,black)] ring-1 ring-zari/35 ring-inset dark:text-[color-mix(in_oklab,var(--zari)_55%,white)]',
  items: 'bg-brand-50 text-brand-800 ring-1 ring-brand-200 ring-inset dark:bg-brand-950 dark:text-brand-100 dark:ring-brand-800',
  pieces: 'bg-brand-600 text-white',
  hidden: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};
