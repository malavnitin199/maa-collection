import type { ReactNode } from 'react';
import { muted } from '@/components/ui/styles';
import type { T } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { stockValue, type StockValue } from '@/lib/stock-value';

/**
 * Products (ADR-057, owner's feedback): the pieces in stock, the purchase price per piece and
 * the two multiplied — highlighted on every design card and item row, in place of the MRP.
 * Without the Costs right only the pieces (never a purchase price, invariant 4).
 * Server-rendered: the figures arrive as text, nothing is sent to the phone as data.
 */

/** "₹900.00", "₹450.00–₹500.00" when sizes differ, or "—" when no purchase price is entered. */
export function perPieceText(value: StockValue): string {
  const p = value.perPiece;
  if (!p) return '—';
  return p.minPaise === p.maxPaise ? formatPaise(p.minPaise) : `${formatPaise(p.minPaise)}–${formatPaise(p.maxPaise)}`;
}

const band = 'rounded-xl bg-brand-50 px-3 py-2.5 text-brand-950 ring-1 ring-brand-100 dark:bg-brand-950 dark:text-brand-50 dark:ring-brand-900';

/** A design card's strip: `8 pcs × ₹900.00 = ₹7,200.00` with a word under each figure. */
export function StockValueStrip({ value, showCost, t }: { value: StockValue; showCost: boolean; t: T }) {
  if (!showCost) {
    return (
      <p data-testid="stock-value" className={`${band} text-center text-lg font-bold tabular-nums`}>
        {t('cat.value.inStock', { pcs: value.pieces })}
      </p>
    );
  }
  const range = value.perPiece !== null && value.perPiece.minPaise !== value.perPiece.maxPaise;
  const note =
    value.piecesWithoutPrice === 0 ? null : value.perPiece === null ? t('cat.value.noCost') : t('cat.value.missing', { pcs: value.piecesWithoutPrice });
  return (
    <div data-testid="stock-value" className={band}>
      <div className="flex flex-wrap items-start justify-around gap-x-2 gap-y-1 text-center">
        <Figure testId="value-pieces" label={t('cat.value.pieces')}>
          {t('cat.value.pcs', { pcs: value.pieces })}
        </Figure>
        <Sign>×</Sign>
        <Figure testId="value-per-piece" label={t('cat.value.perPiece')} small={range}>
          {perPieceText(value)}
        </Figure>
        <Sign>=</Sign>
        <Figure testId="value-total" label={t('cat.value.total')} strong>
          {value.perPiece === null ? '—' : formatPaise(value.totalPaise)}
        </Figure>
      </div>
      {note && <p className="mt-1.5 text-center text-xs font-semibold text-amber-700 dark:text-amber-300">{note}</p>}
    </div>
  );
}

function Figure({ testId, label, strong = false, small = false, children }: { testId: string; label: string; strong?: boolean; small?: boolean; children: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col items-center">
      <span
        data-testid={testId}
        className={`leading-tight font-bold whitespace-nowrap tabular-nums ${strong ? 'text-xl text-brand-700 dark:text-brand-200' : small ? 'pt-1 text-sm' : 'text-lg'}`}
      >
        {children}
      </span>
      <span className="text-[11px] font-medium text-brand-900/70 dark:text-brand-100/70">{label}</span>
    </span>
  );
}

function Sign({ children }: { children: ReactNode }) {
  return <span className="pt-0.5 text-lg font-semibold text-brand-400 dark:text-brand-500">{children}</span>;
}

/**
 * An item row's line: `8 pcs × ₹900.00 = ₹7,200.00`. The pieces are the real count (red at or
 * below zero, amber when low — `tone`); the total never goes below zero.
 */
export function StockValueLine({ stock, costPaise, showCost, t, tone = '' }: { stock: number; costPaise: number | null; showCost: boolean; t: T; tone?: string }) {
  const pcs = <b className={`tabular-nums ${tone}`}>{t('cat.value.pcs', { pcs: stock })}</b>;
  if (!showCost) {
    return (
      <span data-testid="row-value" className="block text-sm">
        {pcs}
      </span>
    );
  }
  if (costPaise === null) {
    return (
      <span data-testid="row-value" className="block text-sm">
        {pcs} <span className={muted}>· {t('cat.value.noCost')}</span>
      </span>
    );
  }
  return (
    <span data-testid="row-value" className="block text-sm tabular-nums">
      {pcs} <span className={muted}>×</span> {formatPaise(costPaise)} <span className={muted}>=</span>{' '}
      <b className="text-brand-700 dark:text-brand-200">{formatPaise(stockValue([{ stock, costPaise }]).totalPaise)}</b>
    </span>
  );
}
