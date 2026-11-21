'use client';

import { IconTag } from '@/components/ui/icons';
import { card, muted } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { LOW_STOCK_THRESHOLD } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { boxPaise, packOf } from '@/lib/packs';
import type { CounterProduct } from '@/server/services/products';

/** Pieces in stock as a coloured badge: plenty (theme), few (amber), none (red). */
function StockBadge({ stock }: { stock: number }) {
  const t = useT();
  const tone =
    stock <= 0
      ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900'
      : stock <= LOW_STOCK_THRESHOLD
        ? 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900'
        : 'bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-900';
  return (
    <div className={`shrink-0 rounded-2xl px-3 py-1.5 text-center ring-1 ${tone}`}>
      <span data-testid="details-stock" className="block text-2xl leading-none font-bold tabular-nums">
        {stock}
      </span>
      <span className="mt-1 block text-[10px] font-semibold tracking-wide uppercase">{t('item.inStock')}</span>
    </div>
  );
}

/**
 * What the seller needs at a glance (UI clean-up, v15): the selling price big,
 * MRP under it, pieces in stock as a badge; the codes in one small grey line.
 * Counter view: never the purchase price.
 */
export function ProductDetails({ product }: { product: CounterProduct }) {
  const t = useT();
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={`text-xs ${muted}`}>{t('item.price')}</p>
          <p className="text-[1.75rem] leading-tight font-bold tabular-nums">{formatPaise(product.pricePaise)}</p>
          <p className={`text-sm ${muted}`}>
            {t('item.mrp')} <span className="tabular-nums">{formatPaise(product.mrpPaise)}</span>
          </p>
          {packOf(product.packSize) && (
            <p data-testid="item-pack" className="mt-1 inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {t('pack.label', { n: product.packSize! })} · {formatPaise(boxPaise(product.mrpPaise, product.packSize!, product.packMrpPaise))}
            </p>
          )}
        </div>
        <StockBadge stock={product.stock} />
      </div>
      <p className={`flex flex-wrap gap-x-2 gap-y-0.5 text-xs ${muted}`}>
        <span>
          {t('item.sku')} <span className="font-mono">{product.sku}</span>
        </span>
        <span>
          {t('item.barcode')} <span className="font-mono">{product.barcode}</span>
        </span>
        <span>
          {product.brand} · {product.category}
        </span>
      </p>
    </div>
  );
}

export function ProductCard({ product, children }: { product: CounterProduct; children?: React.ReactNode }) {
  const t = useT();
  return (
    <section data-testid="item-details" className={`${card} fb-card`}>
      <div className="flex items-start gap-3">
        {product.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
          <img src={product.imageSrc} alt={t('item.photo', { name: product.name })} className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-sm" />
        ) : (
          <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            <IconTag className="h-9 w-9" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-semibold">{product.name}</h2>
          <div role="group" className="mt-2 flex flex-wrap gap-1.5" aria-label={t('item.sizeColour')}>
            <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-sm font-bold text-white">{product.size}</span>
            <span className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-sm dark:border-zinc-700">{product.color}</span>
          </div>
        </div>
      </div>
      <ProductDetails product={product} />
      {children}
    </section>
  );
}
