import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconChevron } from '@/components/ui/icons';
import { muted } from '@/components/ui/styles';
import type { DesignGroup } from '@/lib/design-groups';
import type { T } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { stockValue } from '@/lib/stock-value';
import { chip, chipTone as tone } from './chips';

type Item = { id: string; active: boolean; stock: number; costPaise: number | null };

/** ₹680 for whole rupees, ₹499.50 otherwise: the card is short, every character counts. */
const money = (paise: number) => formatPaise(paise).replace(/\.00$/, '');

/**
 * One design on Stocks (owner's feedback 2026-11-23, ADR-070): one short row — the photo, the
 * name, then only the figures that matter: the pieces in stock, the purchase price per piece
 * (Costs right only, invariant 4; N/A when none was entered; lowest–highest when sizes differ)
 * and the MRP. No company, item count, "pieces × price = total" line or sizes row any more —
 * they said the same pieces again and again; the product page has all of it.
 *
 * The whole card opens the product (ADR-068): the name's link covers the card and a round ›
 * says so. `label` is the small QR button (ADR-070) that shows the product's label in a sheet;
 * it sits above the link. While selecting, both step aside (a tap ticks the card instead).
 * Server-rendered: nothing about the items is sent to the phone as data.
 */
export function ProductListCard({
  design,
  photo,
  href,
  showCost,
  label,
  t,
}: {
  design: DesignGroup<Item>;
  photo?: string;
  href: string;
  showCost: boolean;
  /** The QR button (for people who may see tags), or nothing. */
  label?: ReactNode;
  t: T;
}) {
  const na = t('common.na');
  const hidden = design.items.filter((p) => !p.active).length;
  const perPiece = showCost ? stockValue(design.items).perPiece : null;
  return (
    <article
      data-testid="product-card"
      data-items={design.items.length}
      className="group relative flex h-full items-center gap-2.5 rounded-2xl border border-zinc-200/80 bg-surface p-2.5 shadow-sm shadow-brand-900/[0.06] transition duration-150 hover:-translate-y-px hover:border-brand-300 hover:shadow-md hover:shadow-brand-900/10 active:translate-y-0 active:scale-[0.985] active:bg-brand-50/60 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-500 dark:border-zinc-800 dark:shadow-none dark:hover:border-brand-700 dark:active:bg-brand-950/40 [&:has(button:active)]:scale-100 [&:has(button:active)]:bg-surface"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
        <img src={photo} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-800" />
      ) : (
        <span data-testid="card-photo-na" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs font-semibold text-zinc-400 dark:bg-zinc-800">
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
        <p data-testid="card-figures" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-tight tabular-nums">
          <span data-testid="card-pieces" className={`${chip} ${tone.pieces}`}>
            {t('cat.value.pcs', { pcs: design.pieces })}
          </span>
          {showCost && (
            <b data-testid="card-cost" className="text-brand-700 dark:text-brand-200">
              {perPiece
                ? t('cat.card.perPiece', {
                    price: perPiece.minPaise === perPiece.maxPaise ? money(perPiece.minPaise) : `${money(perPiece.minPaise)}–${money(perPiece.maxPaise)}`,
                  })
                : t('cat.card.noCost')}
            </b>
          )}
          <span data-testid="card-mrp" className={`text-xs ${muted}`}>
            {t('cat.design.mrp', { mrp: money(design.mrpPaise) })}
          </span>
          {hidden > 0 && (
            <span data-testid="card-hidden" className={`${chip} ${tone.hidden}`}>
              {hidden === design.items.length ? t('cat.card.hidden') : t('cat.card.hiddenN', { n: hidden })}
            </span>
          )}
        </p>
      </div>
      {label}
      <span
        aria-hidden
        data-testid="card-open"
        className="pointer-events-none flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 transition ring-inset group-hover:translate-x-0.5 group-hover:bg-brand-600 group-hover:text-white group-active:bg-brand-600 group-active:text-white dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-800 [html[data-selecting]_&]:opacity-0"
      >
        <IconChevron className="h-4.5 w-4.5" />
      </span>
    </article>
  );
}
