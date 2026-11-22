import { muted } from '@/components/ui/styles';
import type { T } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import type { StockValue } from '@/lib/stock-value';

/**
 * Products (ADR-057, made slim by ADR-058): one line on each card — the pieces in stock × the
 * purchase price per piece = the total. Only for people with the Costs right (the card leaves
 * it out otherwise, invariant 4). No purchase price entered → N/A.
 */
export function StockValueLine({ value, t }: { value: StockValue; t: T }) {
  const p = value.perPiece;
  const na = t('common.na');
  const perPiece = !p ? na : p.minPaise === p.maxPaise ? formatPaise(p.minPaise) : `${formatPaise(p.minPaise)}–${formatPaise(p.maxPaise)}`;
  const missing = p !== null && value.piecesWithoutPrice > 0 ? t('cat.value.missing', { pcs: value.piecesWithoutPrice }) : null;
  return (
    <p data-testid="stock-value" className="mt-1 text-sm leading-snug tabular-nums">
      <b data-testid="value-pieces">{t('cat.value.pcs', { pcs: value.pieces })}</b> <span className={muted}>×</span>{' '}
      <b data-testid="value-per-piece">{perPiece}</b> <span className={muted}>=</span>{' '}
      <b data-testid="value-total" className="text-brand-700 dark:text-brand-200">
        {p ? formatPaise(value.totalPaise) : na}
      </b>
      {missing && <span className="block text-xs font-semibold text-amber-700 dark:text-amber-300">{missing}</span>}
    </p>
  );
}
