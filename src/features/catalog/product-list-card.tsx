import Link from 'next/link';
import { muted } from '@/components/ui/styles';
import type { DesignGroup } from '@/lib/design-groups';
import type { T } from '@/lib/i18n';
import { stockValue } from '@/lib/stock-value';
import { StockValueLine } from './stock-value';

type Item = { id: string; active: boolean; stock: number; costPaise: number | null };

const chip = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold';
/** The company in the theme's accent colour, items and pieces in its brand colour (each theme has both). */
const tone = {
  company:
    'bg-zari/10 text-[color-mix(in_oklab,var(--zari)_72%,black)] ring-1 ring-zari/35 ring-inset dark:text-[color-mix(in_oklab,var(--zari)_55%,white)]',
  items: 'bg-brand-50 text-brand-800 ring-1 ring-brand-200 ring-inset dark:bg-brand-950 dark:text-brand-100 dark:ring-brand-800',
  pieces: 'bg-brand-600 text-white',
  hidden: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};
const sizeChip = (out: boolean) =>
  `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
    out ? 'border-zinc-200 text-zinc-400 line-through dark:border-zinc-800 dark:text-zinc-500' : 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-100'
  }`;

/**
 * One design on Products (ADR-058, owner's feedback): a compact card — photo, name, then
 * coloured chips for the company, the items and the pieces in stock, the purchase line
 * (Costs right only), and the sizes with their pieces. Anything empty shows N/A. No QR code,
 * no folding list of items, no print link (tags print from All tags or the item's page).
 * Server-rendered: nothing about the items is sent to the phone as data.
 */
export function ProductListCard({ design, photo, href, showCost, t }: { design: DesignGroup<Item>; photo?: string; href: string; showCost: boolean; t: T }) {
  const na = t('common.na');
  const hidden = design.items.filter((p) => !p.active).length;
  return (
    <article
      data-testid="product-card"
      className="flex h-full flex-col gap-2 rounded-2xl border border-zinc-200/80 bg-surface p-3 shadow-sm shadow-brand-900/[0.06] dark:border-zinc-800 dark:shadow-none"
    >
      <div className="flex items-start gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
          <img src={photo} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <span data-testid="card-photo-na" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-400 dark:bg-zinc-800">
            {na}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate leading-tight font-semibold hover:underline">
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
    </article>
  );
}
