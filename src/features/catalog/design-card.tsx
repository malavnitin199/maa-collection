import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconPrinter } from '@/components/ui/icons';
import { card, link, muted } from '@/components/ui/styles';
import type { DesignGroup } from '@/lib/design-groups';
import type { T } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { QrCode } from './qr-code';

/**
 * One design on screen (plan v14): items with the same name, company and MRP.
 * Photos side by side, every size with its pieces, one QR that opens
 * the design, and the separate items / tags folded away under "Show N …".
 * Server-rendered: nothing about the items is sent to the phone as data.
 */
export function DesignCard({
  design,
  t,
  photos,
  href,
  qrValue,
  printHref,
  expandLabel,
  value,
  children,
}: {
  design: DesignGroup<{ id: string }>;
  t: T;
  /** Photo addresses of its items, first ones first (up to 3 shown). */
  photos: string[];
  /** Where the name and the QR lead: one of its items (whose page lists the whole design). */
  href: string;
  qrValue: string | null;
  printHref: string | null;
  expandLabel: string;
  /**
   * Products (ADR-057): the highlighted strip — pieces × purchase price = total — in place of
   * the MRP and count lines. All tags passes none and keeps them.
   */
  value?: ReactNode;
  /** The separate items or tags, shown when opened. */
  children: ReactNode;
}) {
  const shown = [...new Set(photos)].slice(0, 3);
  const selling =
    design.minPricePaise === design.maxPricePaise
      ? design.minPricePaise === design.mrpPaise
        ? null
        : t('cat.design.selling', { price: formatPaise(design.minPricePaise) })
      : t('cat.design.sellingRange', { min: formatPaise(design.minPricePaise), max: formatPaise(design.maxPricePaise) });
  const chip = (out: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
      out ? 'border-zinc-200 text-zinc-400 line-through dark:border-zinc-800 dark:text-zinc-500' : 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-100'
    }`;
  return (
    <article data-testid="design-card" className={`${card} flex h-full flex-col gap-2.5`}>
      <div className="flex items-start gap-3">
        <div className="flex shrink-0" aria-hidden>
          {shown.length === 0 ? (
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-100 text-[10px] text-zinc-400 dark:bg-zinc-800">{t('cat.products.noPhoto')}</span>
          ) : (
            shown.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
              <img key={src} src={src} alt="" loading="lazy" className={`h-14 w-14 rounded-lg object-cover ring-2 ring-white dark:ring-zinc-900 ${i > 0 ? '-ml-7' : ''}`} />
            ))
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={href} className="block leading-tight font-semibold hover:underline">
            {design.name}
          </Link>
          {value ? (
            <p className={`mt-0.5 text-xs ${muted}`}>
              {design.supplierName ?? t('stk.lib.noCompany')} · {t('cat.design.items', { items: design.items.length })}
            </p>
          ) : (
            <>
              <p className={`mt-0.5 text-xs ${muted}`}>
                {design.supplierName ?? t('stk.lib.noCompany')} · {t('cat.design.mrp', { mrp: formatPaise(design.mrpPaise) })}
                {selling && ` · ${selling}`}
              </p>
              <p className={`text-xs ${muted}`}>{t('cat.design.count', { items: design.items.length, pcs: design.pieces })}</p>
            </>
          )}
        </div>
        {qrValue && <QrCode value={qrValue} label={t('cat.design.qr', { name: design.name })} className="h-14 w-14 shrink-0 rounded bg-white p-0.5" />}
      </div>

      {value}

      <dl className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <dt className={`w-14 shrink-0 text-xs ${muted}`}>{t('cat.design.sizes')}</dt>
          <dd data-testid="design-sizes" className="flex flex-wrap gap-1">
            {design.sizes.map((s) => (
              <span key={s.size} className={chip(s.pieces === 0)}>
                {s.size} · <b className="tabular-nums">{s.pieces}</b>
              </span>
            ))}
          </dd>
        </div>
      </dl>

      {/* One line: open the separate items on the left, print on the right; the items open below at full width. */}
      <div className="relative mt-auto">
        <details className="group/design">
          <summary className="-ml-3 inline-flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-full px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="inline-block transition-transform group-open/design:rotate-90">▸</span>
            {expandLabel}
          </summary>
          <div className="mt-2">{children}</div>
        </details>
        {printHref && (
          <Link href={printHref} className={`absolute top-0 right-0 inline-flex min-h-10 items-center gap-1 text-sm ${link}`}>
            <IconPrinter className="h-4 w-4" />
            {t('cat.design.printTags')}
          </Link>
        )}
      </div>
    </article>
  );
}
