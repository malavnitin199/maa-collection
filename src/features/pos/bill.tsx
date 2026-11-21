'use client';

import { useRef } from 'react';
import { muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { formatPaise } from '@/lib/money';
import { boxPaise, boxSale, packOf } from '@/lib/packs';
import type { CounterProduct } from '@/server/services/products';
import { StaffSelect, type StaffOption } from './staff-select';

/** One item on the counter's bill (several items, owner's feedback 2026-11-21). Saved as its own sale. */
export type BillLine = {
  key: string;
  product: CounterProduct;
  /** Pieces, or whole boxes when `box` (box packs, ADR-047). */
  qty: number;
  /** The typed price: per piece, or per box when `box`. */
  priceText: string;
  operationId: string;
  fromPhone?: string;
  error?: string;
  box?: boolean;
};
export type PriceMode = 'scan' | 'end';

/** Pieces in one unit of the line: the box size when sold by the box, else 1. */
export function lineUnit(line: Pick<BillLine, 'product' | 'box'>): number {
  return (line.box && packOf(line.product.packSize)) || 1;
}

/** The line's MRP for one unit: a whole box's when sold by the box. */
export function lineMrp(line: Pick<BillLine, 'product' | 'box'>): number {
  const unit = lineUnit(line);
  return unit > 1 ? boxPaise(line.product.mrpPaise, unit, line.product.packMrpPaise) : line.product.mrpPaise;
}

/** What one line records as a sale: pieces, piece price and (for boxes) the exact box total. */
export function lineSale(line: BillLine, price: number): { quantity: number; unitPricePaise: number; totalPaise?: number } {
  const unit = lineUnit(line);
  return unit > 1 ? boxSale(line.qty, unit, price) : { quantity: line.qty, unitPricePaise: price };
}

export function linePrice(line: BillLine): number | null {
  const paise = rupeesToPaise(line.priceText);
  return paise !== null && paise > 0 ? paise : null;
}

/** The bill's total once every line has a price; else null. */
export function billTotal(lines: BillLine[]): number | null {
  let total = 0;
  for (const line of lines) {
    const price = linePrice(line);
    if (price === null) return null;
    total += price * line.qty;
  }
  return total;
}

function Thumb({ product, size = 'h-11 w-11' }: { product: CounterProduct; size?: string }) {
  const t = useT();
  return product.imageSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={product.imageSrc} alt={t('item.photo', { name: product.name })} className={`${size} shrink-0 rounded-xl object-cover`} />
  ) : (
    <span aria-hidden className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-brand-50 font-display text-lg text-brand-700 dark:bg-brand-950 dark:text-brand-300`}>
      {product.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

const priceBox =
  'h-10 w-24 rounded-xl border border-zinc-300 bg-white px-2 text-right text-base font-semibold tabular-nums focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 placeholder:font-normal placeholder:text-zinc-300 focus:outline-none aria-invalid:border-red-500 dark:placeholder:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900';

/**
 * The bill: one table — photo, item, MRP, selling price — with the total worked
 * out as prices go in. Prices can be typed here one by one (Enter moves to the
 * next empty one) or as each item is scanned. Credit once for the whole bill.
 */
export function BillPanel({
  lines,
  mode,
  onMode,
  onPrice,
  onQty,
  onUnit,
  onScanMore,
  onClear,
  onSave,
  saving,
  staff,
  meId,
  creditTo,
  onCredit,
}: {
  lines: BillLine[];
  mode: PriceMode;
  onMode: (mode: PriceMode) => void;
  onPrice: (key: string, text: string) => void;
  onQty: (key: string, qty: number) => void;
  /** Box items: sell this line by the piece or by the box. */
  onUnit: (key: string, box: boolean) => void;
  onScanMore: () => void;
  onClear: () => void;
  onSave: () => void;
  saving: string | null;
  staff: StaffOption[];
  meId: string;
  creditTo: string;
  onCredit: (id: string) => void;
}) {
  const t = useT();
  const table = useRef<HTMLTableElement>(null);
  const total = billTotal(lines);
  const missing = lines.filter((l) => linePrice(l) === null).length;
  const pieces = lines.reduce((n, l) => n + l.qty * lineUnit(l), 0);
  const prices = () => [...(table.current?.querySelectorAll<HTMLInputElement>('input[data-price]') ?? [])];
  const firstEmpty = (after = -1) => prices().find((box, i) => i > after && !rupeesToPaise(box.value));

  return (
    <section data-testid="bill" className="rise-in flex flex-col gap-3 rounded-3xl bg-surface p-3 shadow-lg ring-1 ring-zinc-200 dark:ring-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-lg font-semibold">{t('bill.title', { n: lines.length, pcs: pieces })}</h2>
        <div role="radiogroup" aria-label={t('bill.priceMode')} className="flex rounded-full bg-zinc-100 p-0.5 text-xs font-semibold dark:bg-zinc-800">
          {(['scan', 'end'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => onMode(m)}
              className={`rounded-full px-3 py-1.5 transition ${mode === m ? 'bg-brand-600 text-white shadow' : 'text-zinc-600 dark:text-zinc-300'}`}
            >
              {t(m === 'scan' ? 'bill.asScan' : 'bill.atEnd')}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table ref={table} className="w-full border-separate border-spacing-y-1.5 text-sm">
          <thead>
            <tr className={`text-left text-xs ${muted}`}>
              <th className="px-1 font-medium">
                <span className="sr-only">{t('bill.photo')}</span>
              </th>
              <th className="px-1 font-medium">{t('bill.colItem')}</th>
              <th className="px-1 text-right font-medium">{t('bill.colMrp')}</th>
              <th className="px-1 text-right font-medium">{t('bill.colPrice')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const price = linePrice(line);
              return (
                <tr key={line.key} data-testid="bill-line" className="bill-line align-middle">
                  <td className="rounded-l-2xl bg-brand-50/50 py-1.5 pl-1.5 dark:bg-zinc-900/70">
                    <Thumb product={line.product} />
                  </td>
                  <td className="bg-brand-50/50 px-2 py-1.5 dark:bg-zinc-900/70">
                    <span className="line-clamp-1 font-semibold">{line.product.name}</span>
                    <span className={`block text-xs ${muted}`}>{[line.product.size, line.product.color].filter(Boolean).join(' · ')}</span>
                    <span className="mt-1 flex items-center gap-1">
                      <button type="button" aria-label={t('bill.less', { name: line.product.name })} onClick={() => onQty(line.key, line.qty - 1)} className="h-7 w-7 rounded-full bg-white text-base leading-none font-bold shadow-sm ring-1 ring-zinc-200 active:scale-90 dark:bg-zinc-800 dark:ring-zinc-700">
                        −
                      </button>
                      <span data-testid="bill-qty" className="min-w-7 text-center text-sm font-semibold tabular-nums">×{line.qty}</span>
                      <button type="button" aria-label={t('bill.more', { name: line.product.name })} onClick={() => onQty(line.key, line.qty + 1)} className="h-7 w-7 rounded-full bg-white text-base leading-none font-bold shadow-sm ring-1 ring-zinc-200 active:scale-90 dark:bg-zinc-800 dark:ring-zinc-700">
                        +
                      </button>
                      {packOf(line.product.packSize) && (
                        <span role="radiogroup" aria-label={t('pack.lineUnit', { name: line.product.name })} className="ml-1 inline-flex rounded-full bg-white p-0.5 text-[11px] font-bold ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                          {[false, true].map((box) => (
                            <button
                              key={String(box)}
                              type="button"
                              role="radio"
                              aria-checked={Boolean(line.box) === box}
                              onClick={() => onUnit(line.key, box)}
                              className={`rounded-full px-2 py-0.5 ${Boolean(line.box) === box ? 'bg-brand-600 text-white' : muted}`}
                            >
                              {box ? t('pack.unitBox') : t('pack.unitPcs')}
                            </button>
                          ))}
                        </span>
                      )}
                    </span>
                    {line.box && (
                      <span data-testid="bill-box-pieces" className={`mt-0.5 block text-[11px] ${muted}`}>
                        {t('pack.lineBoxes', { boxes: t(line.qty === 1 ? 'pack.boxes.one' : 'pack.boxes.other', { n: line.qty }), pieces: line.qty * lineUnit(line) })}
                      </span>
                    )}
                    {line.error && (
                      <span role="alert" className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">
                        {line.error}
                      </span>
                    )}
                  </td>
                  <td className="bg-brand-50/50 px-1 py-1.5 text-right text-xs tabular-nums dark:bg-zinc-900/70">
                    <span className={`${price !== null && price < lineMrp(line) ? 'line-through' : ''} ${muted}`}>{formatPaise(lineMrp(line))}</span>
                  </td>
                  <td className="rounded-r-2xl bg-brand-50/50 py-1.5 pr-1.5 text-right dark:bg-zinc-900/70">
                    <input
                      data-price
                      data-testid="bill-price"
                      inputMode="decimal"
                      enterKeyHint={i === lines.length - 1 ? 'done' : 'next'}
                      aria-label={t('bill.priceFor', { name: `${line.product.name} ${line.product.size}` })}
                      aria-invalid={Boolean(line.error)}
                      placeholder={String((line.box ? lineMrp(line) : line.product.pricePaise) / 100)}
                      value={line.priceText}
                      onChange={(e) => onPrice(line.key, e.target.value.replace(/[^\d.]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        (firstEmpty(i) ?? firstEmpty())?.focus();
                      }}
                      className={priceBox}
                    />
                    {price !== null && line.qty > 1 && <span className={`mt-0.5 block text-[11px] tabular-nums ${muted}`}>{formatPaise(price * line.qty)}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-end justify-between gap-3 rounded-2xl bg-brand-700 px-4 py-3 text-white dark:bg-brand-900">
        <span className="text-sm text-white/85">{missing ? t('bill.missing', { n: missing }) : t('bill.total')}</span>
        <span data-testid="bill-total" className="font-display text-3xl leading-none tabular-nums">
          {total !== null ? formatPaise(total) : '—'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {missing > 0 && (
          <button type="button" onClick={() => firstEmpty()?.focus()} className={`${secondaryButton} text-sm`}>
            {t('bill.fillOne')}
          </button>
        )}
        <button type="button" onClick={onScanMore} className={`${secondaryButton} text-sm`}>
          {t('bill.scanMore')}
        </button>
        <button type="button" onClick={onClear} className={`${secondaryButton} ml-auto text-sm text-red-700 dark:text-red-300`}>
          {t('bill.clear')}
        </button>
      </div>

      <StaffSelect label={t('sell.creditTo')} staff={staff} meId={meId} value={creditTo} onChange={onCredit} />
      <button type="button" disabled={Boolean(saving)} onClick={onSave} className={`${primaryButton} w-full py-3.5 text-lg`}>
        {saving ?? (total !== null ? t('bill.save', { total: formatPaise(total) }) : t('bill.saveNoTotal'))}
      </button>
    </section>
  );
}

/** Under the full-screen camera while scanning a bill: the last item added, its price box when pricing as you scan, Done. */
export function CameraBillFooter({ line, lines, mode, onPrice, onDone }: { line: BillLine | null; lines: BillLine[]; mode: PriceMode; onPrice: (key: string, text: string) => void; onDone: () => void }) {
  const t = useT();
  const total = billTotal(lines);
  return (
    <div data-testid="camera-bill" className="flex flex-col gap-3">
      {line ? (
        <div key={`${line.key}-${line.qty}`} className="cam-added flex items-center gap-3 rounded-2xl bg-white/10 p-2.5">
          <Thumb product={line.product} size="h-12 w-12" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              {line.product.name} <span className="font-normal text-white/70">×{line.qty}</span>
            </span>
            <span className="block text-xs text-white/70">
              {[line.product.size, line.product.color].filter(Boolean).join(' · ')} · {t('bill.colMrp')} {formatPaise(lineMrp(line))}
            </span>
          </span>
          {mode === 'scan' && (
            <input
              autoFocus
              inputMode="decimal"
              enterKeyHint="done"
              aria-label={t('bill.priceFor', { name: `${line.product.name} ${line.product.size}` })}
              placeholder={String((line.box ? lineMrp(line) : line.product.pricePaise) / 100)}
              value={line.priceText}
              onChange={(e) => onPrice(line.key, e.target.value.replace(/[^\d.]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
              className={`${priceBox} text-zinc-900 dark:text-zinc-100`}
            />
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-white/70">{t('bill.scanFirst')}</p>
      )}
      <button type="button" onClick={onDone} className="w-full rounded-full bg-emerald-500 py-3.5 text-lg font-bold text-white shadow-lg active:scale-[0.98]">
        {t('bill.done', { n: lines.length })}
        {total !== null && lines.length > 0 && <span className="font-normal"> · {formatPaise(total)}</span>}
      </button>
    </div>
  );
}
