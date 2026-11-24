'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { errorBox, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { cleanRate } from '@/features/bills/bill-lines-table';
import { useDone } from '@/features/feedback/effects';
import { haptic } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';
import { useTypingScript } from '@/features/i18n/lang-text';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { formatPaise } from '@/lib/money';
import { convertLastWord, convertTrailingWord } from '@/lib/transliterate';
import { createBulkAction } from '@/server/actions/admin';
import { markupOf, saleFromCost, useSavedMarkup } from './markup';

type Row = { key: number; name: string; price: string; qty: string };
type Cell = 'name' | 'price' | 'qty';

/** Empty rows ready when the table opens. */
const START_ROWS = 5;
/** The most products in one save (the server's `BULK_MAX_ROWS`). */
const MAX_ROWS = 50;

const blank = (key: number): Row => ({ key, name: '', price: '', qty: '' });
/** A row counts once anything is typed in it; empty rows are never saved. */
const used = (row: Row) => Boolean(row.name.trim() || row.price.trim() || row.qty.trim());
/** The typed price in paise (above zero), or null. */
const priceOf = (row: Row) => {
  const paise = row.price.trim() ? rupeesToPaise(row.price) : null;
  return paise !== null && paise > 0 ? paise : null;
};
/** An empty quantity is 1. */
const qtyOf = (row: Row) => (row.qty.trim() ? Number(row.qty) : 1);
const problemOf = (row: Row): 'price' | 'qty' | null => (priceOf(row) === null ? 'price' : qtyOf(row) < 1 ? 'qty' : null);

const box =
  'h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2 text-base font-semibold transition-colors placeholder:font-normal placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-500/25 dark:border-zinc-700 dark:bg-zinc-900';

/** Enter (the phone keyboard's Next) moves to the table's next box; it never saves. */
const nextBox = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const here = e.currentTarget;
  const boxes = [...(here.closest('table')?.querySelectorAll<HTMLInputElement>('input[data-cell]') ?? [])];
  const next = boxes[boxes.indexOf(here) + 1];
  if (next) next.focus();
  else here.blur();
};

/**
 * Bulk addition's table (owner, 2026-11-24, ADR-072): many products of one category typed in one
 * go — product name · purchase price · quantity, one row each — and saved together. There is no
 * "add" button and no card per product: a new empty row is always waiting under the last one typed.
 * The name is optional (blank = "<category> + number"), an empty quantity is 1, and the sale price
 * is worked out from the purchase price (ADR-053). Size, company, photo and the rest are filled in
 * later on each product's page. Without the purchase-price right the price box is the sale price.
 */
export function BulkRows({
  section,
  type,
  showCost,
  onDirty,
  onSaved,
}: {
  section: { id: string; name: string };
  type: { id: string; name: string };
  showCost: boolean;
  /** Something is typed (or nothing any more): the screen's "Start again" and its ask-on-return follow it. */
  onDirty: (dirty: boolean) => void;
  /** So many items were saved in this category. */
  onSaved: (items: number) => void;
}) {
  const t = useT();
  const router = useRouter();
  const done = useDone();
  const keys = useRef(START_ROWS);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: START_ROWS }, (_, i) => blank(i)));
  // Boxes turn red only after a Save that found something missing.
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [script, setScript] = useTypingScript();
  const markup = markupOf(useSavedMarkup());
  // One id per list as it stands: a retried Save never saves twice; any change makes a new entry.
  const operationId = useRef<string | null>(null);
  useEffect(() => {
    operationId.current = null;
  }, [type.id]);

  /** At least the starting rows, and one empty row under the last one typed (up to the limit). */
  const settle = (list: Row[]): Row[] => {
    const next = [...list];
    while (next.length < START_ROWS) next.push(blank(keys.current++));
    if (used(next[next.length - 1]) && next.length < MAX_ROWS) next.push(blank(keys.current++));
    return next;
  };
  const change = (key: number, patch: Partial<Row>) => {
    operationId.current = null;
    setError(null);
    setRows((list) => settle(list.map((row) => (row.key === key ? { ...row, ...patch } : row))));
  };
  const clear = (key: number) => {
    haptic();
    operationId.current = null;
    setError(null);
    setRows((list) => settle(list.filter((row) => row.key !== key)));
  };

  const filled = rows.map((row, i) => ({ row, n: i + 1 })).filter(({ row }) => used(row));
  const pieces = filled.reduce((n, { row }) => n + Math.max(0, qtyOf(row)), 0);
  const total = filled.reduce((n, { row }) => n + (priceOf(row) ?? 0) * Math.max(0, qtyOf(row)), 0);
  const dirty = filled.length > 0;
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  const pcs = (n: number) => t(n === 1 ? 'stk.item.pcs.one' : 'stk.item.pcs.other', { n });
  const products = (n: number) => t(n === 1 ? 'bulk.products.one' : 'bulk.products.other', { n });

  const save = (after: 'stay' | 'print') => {
    if (filled.length === 0) return;
    const bad = filled.find(({ row }) => problemOf(row));
    if (bad) {
      const what = problemOf(bad.row)!;
      setChecked(true);
      setError(t(what === 'qty' ? 'bulk.need.qty' : showCost ? 'bulk.need.cost' : 'bulk.need.sale', { row: bad.n }));
      document.querySelector<HTMLInputElement>(`[data-bulk-row="${bad.row.key}"] input[data-cell="${what}"]`)?.focus();
      return;
    }
    operationId.current ??= crypto.randomUUID();
    const opId = operationId.current;
    setError(null);
    startSaving(async () => {
      const result = await createBulkAction({
        operationId: opId,
        categoryId: type.id,
        rows: filled.map(({ row }) => {
          const paise = priceOf(row)!;
          // With the purchase price: the sale price is purchase + the phone's % (to whole rupees).
          const mrp = showCost ? String((saleFromCost(paise, markup) ?? paise) / 100) : row.price;
          return { name: row.name, cost: showCost ? row.price : '', mrp, quantity: qtyOf(row) };
        }),
      });
      if (!result.ok) {
        done.show({ kind: 'error', title: t('done.notSaved'), detail: result.error });
        return setError(result.error);
      }
      const made = result.items.length;
      const skus = result.items.map((item) => item.sku);
      const lines = [
        { label: t('done.line.type'), value: `${section.name} › ${type.name}` },
        { label: t('done.line.skus'), value: skus.length === 1 ? skus[0] : `${skus[0]} – ${skus[skus.length - 1]}` },
        { label: t('done.line.pieces'), value: pcs(pieces) },
        { label: t('done.line.purchase'), value: showCost ? formatPaise(total) : '' },
      ].filter((line) => line.value);
      // Next keeps this screen alive: the table clears itself (Activity rule).
      operationId.current = null;
      keys.current += START_ROWS;
      const first = keys.current - START_ROWS;
      setRows(Array.from({ length: START_ROWS }, (_, i) => blank(first + i)));
      setChecked(false);
      onSaved(made);
      if (after === 'print') {
        router.push(`/admin/labels/print?receipt=${result.receiptId}&created=${result.created}&bulk=1`);
        return;
      }
      done.show({ title: t(made === 1 ? 'bulk.saved.one' : 'bulk.saved.other', { n: made }), lines });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const priceLabel = showCost ? t('bills.sheet.rate') : t('bulk.col.sale');
  return (
    <div data-testid="bulk-step" className="flex flex-col gap-3">
      {done.node}
      <div className="-mx-4 border-y border-zinc-300 sm:mx-0 sm:overflow-hidden sm:rounded-xl sm:border dark:border-zinc-700">
        <table data-testid="bulk-rows" className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-7" />
            <col />
            <col className="w-[5.25rem]" />
            <col className="w-[3.25rem]" />
            <col className="w-7" />
          </colgroup>
          <thead className="bg-zinc-100 text-[11px] leading-tight dark:bg-zinc-900">
            <tr>
              <th scope="col" className="py-1.5 pr-0.5 pl-2 text-left font-semibold">
                {t('bills.sheet.sn')}
              </th>
              <th scope="col" className="px-1 py-1.5 text-left font-semibold">
                <span className="flex items-center justify-between gap-1">
                  {t('ni.name.optional')}
                  {/* One switch for every name box (the phone's typing script, ADR-036). */}
                  <button
                    type="button"
                    onClick={() => setScript(script === 'hi' ? 'en' : 'hi')}
                    aria-label={t(script === 'hi' ? 'type.english' : 'type.hindi')}
                    aria-pressed={script === 'hi'}
                    title={t(script === 'hi' ? 'type.english' : 'type.hindi')}
                    className="flex h-7 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-xs font-bold text-brand-700 transition active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-brand-300"
                  >
                    {script === 'hi' ? 'A' : 'अ'}
                  </button>
                </span>
              </th>
              <th scope="col" className="px-1 py-1.5 text-right font-semibold">
                {priceLabel}
              </th>
              <th scope="col" className="px-1 py-1.5 text-right font-semibold">
                {t('bills.sheet.qty')}
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const n = i + 1;
              const on = used(row);
              const problem = checked && on ? problemOf(row) : null;
              const input = (cell: Cell) => ({
                type: 'text' as const,
                autoComplete: 'off',
                enterKeyHint: 'next' as const,
                'data-cell': cell,
                onKeyDown: nextBox,
              });
              return (
                <tr key={row.key} data-testid="bulk-row" data-bulk-row={row.key} data-used={on || undefined} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className={`py-1.5 pr-0.5 pl-2 text-[11px] tabular-nums ${muted}`}>{n}.</td>
                  <td className="px-0.5 py-1">
                    <input
                      {...input('name')}
                      lang={script}
                      maxLength={120}
                      aria-label={t('bulk.row.name', { n })}
                      placeholder={t('ni.name.auto', { type: type.name })}
                      value={row.name}
                      onChange={(e) => change(row.key, { name: script === 'hi' ? convertLastWord(e.target.value) : e.target.value })}
                      onBlur={() => {
                        const fixed = script === 'hi' ? convertTrailingWord(row.name) : row.name;
                        if (fixed !== row.name) change(row.key, { name: fixed });
                      }}
                      className={box}
                    />
                  </td>
                  <td className="px-0.5 py-1">
                    <input
                      {...input('price')}
                      inputMode="decimal"
                      aria-label={t(showCost ? 'bulk.row.cost' : 'bulk.row.sale', { n })}
                      aria-invalid={problem === 'price' || undefined}
                      value={row.price}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => change(row.key, { price: cleanRate(e.target.value).slice(0, 9) })}
                      className={`${box} text-right tabular-nums`}
                    />
                  </td>
                  <td className="px-0.5 py-1">
                    <input
                      {...input('qty')}
                      inputMode="numeric"
                      aria-label={t('bulk.row.qty', { n })}
                      aria-invalid={problem === 'qty' || undefined}
                      placeholder="1"
                      value={row.qty}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => change(row.key, { qty: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      className={`${box} px-1 text-right tabular-nums`}
                    />
                  </td>
                  <td className="py-1 pr-1">
                    {on && (
                      <button
                        type="button"
                        aria-label={t('bulk.row.clear', { n })}
                        onClick={() => clear(row.key)}
                        className="flex h-7 w-6 items-center justify-center rounded-full text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90 dark:hover:bg-red-950 dark:hover:text-red-300"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* What Save will make, like a bill's total line. */}
        <p data-testid="bulk-total" className="flex items-baseline justify-between gap-2 border-t-2 border-zinc-400 bg-zinc-50 px-3 py-2.5 text-sm font-semibold tabular-nums dark:border-zinc-600 dark:bg-zinc-900">
          <span>
            {products(filled.length)} · {pcs(pieces)}
          </span>
          {showCost && <b className="text-base whitespace-nowrap">{formatPaise(total)}</b>}
        </p>
      </div>
      {showCost && (
        <p data-testid="bulk-sale-note" className={`px-1 text-xs ${muted}`}>
          {t('bulk.sale.auto', { n: markup })}
        </p>
      )}
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <button type="button" onClick={() => save('stay')} disabled={saving || filled.length === 0} className={`${primaryButton} min-h-12 w-full text-base`}>
        {saving ? t('common.saving') : t('ni.save.only')}
      </button>
      <button type="button" onClick={() => save('print')} disabled={saving || filled.length === 0} className={`${secondaryButton} min-h-12 w-full text-base`}>
        {t('ni.save.print')}
      </button>
    </div>
  );
}
