import Link from 'next/link';
import { IconChevron } from '@/components/ui/icons';
import { muted } from '@/components/ui/styles';
import type { DesignGroup } from '@/lib/design-groups';
import type { T } from '@/lib/i18n';
import { stockValue } from '@/lib/stock-value';
import { chip, chipTone as tone } from './chips';
import { StockValueLine } from './stock-value';

type Item = { id: string; active: boolean; stock: number; costPaise: number | null };

const sizeChip = (out: boolean) =>
  `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
    out ? 'border-zinc-200 text-zinc-400 line-through dark:border-zinc-800 dark:text-zinc-500' : 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-100'
  }`;

/**
 * One design on Products (ADR-058, owner's feedback): a compact card — photo, name, then
 * coloured chips for the company, the items and the pieces in stock, the purchase line
 * (Costs right only), and the sizes with their pieces. Anything empty shows N/A. No QR code,
 * no folding list of items, no print link (tags print from All tags or the item's page).
 *
 * The whole card opens the product (owner, 2026-11-23, ADR-068): the name's link covers the
 * card, a round › on the right says "this opens", and the card lifts on hover and presses in
 * on a tap. While selecting, the › steps aside (a tap ticks the card instead).
 * Server-rendered: nothing about the items is sent to the phone as data.
 */
export function ProductListCard({ design, photo, href, showCost, t }: { design: DesignGroup<Item>; photo?: string; href: string; showCost: boolean; t: T }) {
  const na = t('common.na');
  const hidden = design.items.filter((p) => !p.active).length;
  return (
    <article
      data-testid="product-card"
      className="group relative flex h-full items-center gap-2 rounded-2xl border border-zinc-200/80 bg-surface p-3 shadow-sm shadow-brand-900/[0.06] transition duration-150 hover:-translate-y-px hover:border-brand-300 hover:shadow-md hover:shadow-brand-900/10 active:translate-y-0 active:scale-[0.985] active:bg-brand-50/60 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-500 dark:border-zinc-800 dark:shadow-none dark:hover:border-brand-700 dark:active:bg-brand-950/40"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
            <img src={photo} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-800" />
          ) : (
            <span data-testid="card-photo-na" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs font-semibold text-zinc-400 dark:bg-zinc-800">
              {na}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {/* The ::after box stretches this link over the whole card. */}
            <Link
              href={href}
              className="block truncate text-[0.95rem] leading-tight font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']"
            >
              {design.name}
            </Link>
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              <span data-testid="card-company" className={`${chip} ${tone.company}`}>
                {design.supplierName ?? na}
              </span>
              <span data-testid="card-items" className={`${chip} ${tone.items}`}>
                {t('cat.design.items', { items: design.items.length })}
              </span>
              <span data-testid="card-pieces" className={`${chip} ${tone.pieces}`}>
                {t('cat.value.pcs', { pcs: design.pieces })}
              </span>
              {hidden > 0 && (
                <span data-testid="card-hidden" className={`${chip} ${tone.hidden}`}>
                  {hidden === design.items.length ? t('cat.card.hidden') : t('cat.card.hiddenN', { n: hidden })}
                </span>
              )}
            </p>
            {showCost && <StockValueLine value={stockValue(design.items)} t={t} />}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`shrink-0 text-xs ${muted}`}>{t('cat.design.sizes')}</span>
          <span data-testid="design-sizes" className="flex flex-wrap gap-1">
            {design.sizes.map((s) => (
              <span key={s.size} className={sizeChip(s.pieces === 0)}>
                {s.size || na} · <b className="tabular-nums">{s.pieces}</b>
              </span>
            ))}
          </span>
        </div>
      </div>
      <span
        aria-hidden
        data-testid="card-open"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 transition ring-inset group-hover:translate-x-0.5 group-hover:bg-brand-600 group-hover:text-white group-active:bg-brand-600 group-active:text-white dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-800 [html[data-selecting]_&]:opacity-0"
      >
        <IconChevron className="h-5 w-5" />
      </span>
    </article>
  );
}
