'use client';

import { useState } from 'react';
import { muted } from '@/components/ui/styles';
import type { EditorLine } from '@/features/bills/bill-editor';
import { sizeLabel } from '@/features/bills/product-browser';
import { useT } from '@/features/i18n/i18n-provider';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { formatPaise, paperRupees } from '@/lib/money';

const MAX = 100_000;
/** A bill line's quantity: a whole number, 1 … 100000. */
export const clampQty = (n: number) => Math.min(MAX, Math.max(1, Math.trunc(Number.isFinite(n) ? n : 1)));

/** A typed price kept to rupees and paise: digits, one point, two places (commas, ₹ and spaces dropped). */
export const cleanRate = (value: string) => {
  const [whole, ...rest] = value.replace(/[^\d.]/g, '').split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

/** A price box left half-typed is tidied: "12." → "12", ".5" → "0.5". */
const settleRate = (value: string) => (value.endsWith('.') ? value.slice(0, -1) : value).replace(/^\./, '0.');

/** A line's total in paise, or null when it has no price (N/A). */
export const lineAmount = (l: Pick<EditorLine, 'qty' | 'rate'>) => {
  const paise = l.rate.trim() ? rupeesToPaise(l.rate) : null;
  return paise === null ? null : paise * l.qty;
};

/** Enter (the phone keyboard's Next) moves to the table's next box; it never sends the bill. */
const nextBox = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const box = e.currentTarget;
  const boxes = [...(box.closest('table')?.querySelectorAll<HTMLInputElement>('input[data-cell]') ?? [])];
  const at = boxes.indexOf(box);
  const next = at >= 0 ? boxes[at + 1] : undefined;
  if (next) next.focus();
  else box.blur();
};

/**
 * A quantity box: everything is selected on focus so typing replaces it; while it is empty (or 0)
 * the line keeps its last good number, which comes back when you leave the box.
 */
export function QtyInput({ value, onValue, label, className, cell = false }: { value: number; onValue: (qty: number) => void; label: string; className: string; cell?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="next"
      data-cell={cell ? 'qty' : undefined}
      aria-label={label}
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
        setDraft(digits);
        if (Number(digits) >= 1) onValue(clampQty(Number(digits)));
      }}
      onKeyDown={nextBox}
      onBlur={() => setDraft(null)}
      className={className}
    />
  );
}

const box =
  'h-10 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-1.5 text-right text-base font-semibold tabular-nums transition-colors placeholder:font-normal placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:border-zinc-700 dark:bg-zinc-900';

/**
 * The bill being made, as a table like the company's paper bill (owner's feedback 2026-11-22,
 * ADR-062): S.N · Product · Qty · Purchase ₹ · Total ₹, then the bill's total. Quantity and
 * purchase price are typed straight into their boxes (Enter = next box); ✕ takes a line off and
 * an Undo row stays in its place for a few seconds.
 */
export function BillLinesTable({
  lines,
  flash,
  removed,
  onChange,
  onRemove,
  onUndo,
}: {
  lines: EditorLine[];
  /** The item just added: its row glows for a moment. */
  flash: string | null;
  /** The line just taken off, while it can still come back. */
  removed: { line: EditorLine; at: number } | null;
  onChange: (key: string, patch: Partial<EditorLine>) => void;
  onRemove: (key: string) => void;
  onUndo: () => void;
}) {
  const t = useT();
  const na = t('common.na');
  const units = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + (lineAmount(l) ?? 0), 0);

  const rows = lines.map((l, i) => {
    const name = `${l.name} · ${sizeLabel(l, na)}`;
    const amount = lineAmount(l);
    return (
      <tr
        key={l.key}
        data-testid="bill-line"
        data-line-of={l.productId ?? undefined}
        className={`border-t border-zinc-200 transition-colors duration-500 dark:border-zinc-800 ${flash && flash === l.productId ? 'bg-brand-50 dark:bg-brand-950' : ''}`}
      >
        <td className={`py-2 pr-0.5 pl-2 text-[11px] tabular-nums ${muted}`}>{i + 1}.</td>
        <td className="px-1 py-1.5">
          <span className="block text-sm leading-snug font-semibold break-words">{l.name}</span>
          <span className="flex items-center gap-1">
            <span className={`min-w-0 flex-1 truncate text-xs ${muted}`}>
              {sizeLabel(l, na)}
              {l.pack ? ` · ${t('pack.sizeOf', { n: l.pack })}` : ''}
            </span>
            <button
              type="button"
              aria-label={t('bills.removeItem', { name })}
              onClick={() => onRemove(l.key)}
              className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90 dark:hover:bg-red-950 dark:hover:text-red-300"
            >
              ✕
            </button>
          </span>
        </td>
        <td className="px-0.5 py-1.5">
          <QtyInput cell value={l.qty} onValue={(qty) => onChange(l.key, { qty })} label={t('bills.itemQty', { name })} className={box} />
        </td>
        <td className="px-0.5 py-1.5">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            data-cell="rate"
            aria-label={t('bills.lineRate', { name })}
            value={l.rate}
            placeholder={na}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onChange(l.key, { rate: cleanRate(e.target.value) })}
            onBlur={() => settleRate(l.rate) !== l.rate && onChange(l.key, { rate: settleRate(l.rate) })}
            onKeyDown={nextBox}
            className={box}
          />
        </td>
        <td data-testid="bill-line-amount" className="py-2 pr-2 pl-1 text-right text-[13px] font-semibold whitespace-nowrap tabular-nums">
          {amount === null ? na : paperRupees(amount)}
        </td>
      </tr>
    );
  });
  if (removed) {
    rows.splice(
      Math.min(removed.at, rows.length),
      0,
      <tr key="removed" data-testid="bill-line-removed" className="rise-in border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
        <td colSpan={5} className="py-1 pr-1 pl-2">
          <span className="flex items-center justify-between gap-2 text-xs">
            <span className={`min-w-0 truncate ${muted}`}>{t('bills.removed', { name: `${removed.line.name} · ${sizeLabel(removed.line, na)}` })}</span>
            <button
              type="button"
              onClick={onUndo}
              className="min-h-8 shrink-0 rounded-full px-3 text-xs font-bold text-brand-700 transition hover:bg-brand-50 active:scale-95 dark:text-brand-300 dark:hover:bg-brand-950"
            >
              {t('bills.undo')}
            </button>
          </span>
        </td>
      </tr>,
    );
  }

  return (
    <div className="-mx-4 border-y border-zinc-300 sm:mx-0 sm:overflow-hidden sm:rounded-xl sm:border dark:border-zinc-700">
      <table data-testid="bill-lines" className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-7" />
          <col />
          <col className="w-11" />
          <col className="w-[4.5rem]" />
          <col className="w-20" />
        </colgroup>
        <thead className="bg-zinc-100 text-[11px] leading-tight dark:bg-zinc-900">
          <tr>
            <th scope="col" className="py-2 pr-0.5 pl-2 text-left font-semibold">
              {t('bills.sheet.sn')}
            </th>
            <th scope="col" className="px-1 py-2 text-left font-semibold">
              {t('bills.sheet.goods')}
            </th>
            <th scope="col" className="px-1 py-2 text-right font-semibold">
              {t('bills.sheet.qty')}
            </th>
            <th scope="col" className="px-1 py-2 text-right font-semibold">
              {t('bills.sheet.rate')}
            </th>
            <th scope="col" className="py-2 pr-2 pl-1 text-right font-semibold">
              {t('bills.sheet.amount')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows
          ) : (
            <tr>
              <td colSpan={5} data-testid="bill-lines-empty" className={`px-3 py-5 text-center text-sm ${muted}`}>
                {t('bills.linesEmpty')}
              </td>
            </tr>
          )}
        </tbody>
        {lines.length > 0 && (
          <tfoot className="tabular-nums">
            <tr className="border-t-2 border-zinc-400 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900">
              <td />
              <td className="px-1 py-2.5 text-right text-sm font-semibold">{t('bills.sheet.total')}</td>
              <td data-testid="bill-units" className="py-2.5 pr-2 pl-1 text-right text-sm font-semibold">
                {units}
              </td>
              <td colSpan={2} data-testid="bill-total" className="py-2.5 pr-2 pl-1 text-right text-base font-bold whitespace-nowrap">
                {formatPaise(total)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
