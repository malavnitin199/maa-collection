'use client';

import { muted } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import type { SheetPart } from '@/features/bills/sheet-parts';

const numbers = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Rupees the way the paper bill prints them: 6,120.00 (no ₹ in the cells). */
const amount = (paise: number) => numbers.format(paise / 100);
/** A quantity: whole, or to 2 places for a part box. */
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** S.N · Description of goods · Qty · Rate · Amount, then Total and units — like the paper. */
export function BillSheet({ parts }: { parts: SheetPart[] }) {
  const t = useT();
  const units = parts.reduce((n, p) => n + p.units, 0);
  const total = parts.reduce((n, p) => n + p.totalPaise, 0);
  const many = parts.length > 1;
  const cell = 'px-1.5 py-1.5';
  return (
    <div data-testid="bill-sheet" className="overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-700">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-7" />
          <col />
          <col className="w-10" />
          <col className="w-[4.5rem]" />
          <col className="w-[5.5rem]" />
        </colgroup>
        <thead className="bg-zinc-100 text-xs dark:bg-zinc-900">
          <tr className="text-left">
            <th className={`${cell} font-semibold`}>{t('bills.sheet.sn')}</th>
            <th className={`${cell} font-semibold`}>{t('bills.sheet.goods')}</th>
            <th className={`${cell} text-right font-semibold`}>{t('bills.sheet.qty')}</th>
            <th className={`${cell} text-right font-semibold`}>{t('bills.sheet.rate')}</th>
            <th className={`${cell} text-right font-semibold`}>{t('bills.sheet.amount')}</th>
          </tr>
        </thead>
        {parts.map((part) => (
          <tbody key={part.supplierId} data-testid="bill-sheet-part" className="tabular-nums">
            {many && (
              <tr className="border-t border-zinc-300 bg-brand-50/60 dark:border-zinc-700 dark:bg-brand-950/50">
                <th colSpan={5} scope="colgroup" className={`${cell} text-left text-xs font-semibold`}>
                  {part.name}
                </th>
              </tr>
            )}
            {part.lines.map((line, i) => (
              <tr key={`${line.name}\u0000${line.ratePaise}`} data-testid="bill-sheet-line" className="border-t border-zinc-200 align-top dark:border-zinc-800">
                <td className={`${cell} text-xs ${muted}`}>{i + 1}.</td>
                <td className={cell}>
                  <span className="block font-medium break-words">{line.pack ? t('pack.goods', { name: line.name, n: line.pack }) : line.name}</span>
                  {line.sizes.length > 0 && <span className={`block text-xs break-words ${muted}`}>{line.sizes.join(' ')}</span>}
                </td>
                <td className={`${cell} text-right`}>{qty(line.qty)}</td>
                <td className={`${cell} text-right`}>{amount(line.ratePaise)}</td>
                <td className={`${cell} text-right font-medium`}>{amount(line.amountPaise)}</td>
              </tr>
            ))}
            {many && (
              <tr className="border-t border-zinc-200 text-xs dark:border-zinc-800">
                <td />
                <td className={`${cell} text-right ${muted}`}>{t('bills.sheet.subtotal')}</td>
                <td className={`${cell} text-right`}>{qty(part.units)}</td>
                <td />
                <td className={`${cell} text-right font-semibold`}>{amount(part.totalPaise)}</td>
              </tr>
            )}
          </tbody>
        ))}
        <tfoot className="tabular-nums">
          <tr className="border-t-2 border-zinc-400 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900">
            <td />
            <td className={`${cell} text-right font-semibold`}>{t('bills.sheet.total')}</td>
            <td data-testid="bill-sheet-units" className={`${cell} text-right font-semibold`}>
              {qty(units)}
            </td>
            <td />
            <td data-testid="bill-sheet-total" className={`${cell} text-right font-bold`}>
              {amount(total)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className={`border-t border-zinc-200 px-2 py-1.5 text-right text-xs dark:border-zinc-800 ${muted}`}>{t('bills.sheet.units', { n: qty(units) })}</p>
    </div>
  );
}
