/**
 * Company page (company accounts, 2026-11-20): which days of a company's
 * bills and payments to show. Shared by the page (address → period) and the
 * service (period → filter), so both read the address the same way.
 */
export const COMPANY_PERIODS = ['all', 'month', '30d', 'year', 'custom'] as const;
export type CompanyPeriodKey = (typeof COMPANY_PERIODS)[number];

/** First and last day to show, YYYY-MM-DD inclusive; an open end means no limit. */
export type DayRange = { key: CompanyPeriodKey; from: string | null; to: string | null };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const cleanDay = (value: string | undefined): string | null => (value && DAY.test(value) ? value : null);

/** Reads `period`, `from` and `to` from the page address; anything odd means "all time". */
export function companyPeriod(params: { period?: string; from?: string; to?: string }, today: string): DayRange {
  const key = (COMPANY_PERIODS as readonly string[]).includes(params.period ?? '') ? (params.period as CompanyPeriodKey) : 'all';
  switch (key) {
    case 'month':
      return { key, from: `${today.slice(0, 7)}-01`, to: today };
    case '30d':
      return { key, from: shiftDays(today, -29), to: today };
    case 'year':
      return { key, from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'custom': {
      const from = cleanDay(params.from);
      const to = cleanDay(params.to);
      if (!from && !to) return { key: 'all', from: null, to: null };
      // Typed the other way round: swap, never show nothing by mistake.
      if (from && to && from > to) return { key, from: to, to: from };
      return { key, from, to };
    }
    default:
      return { key: 'all', from: null, to: null };
  }
}

export function inRange(day: string, range: Pick<DayRange, 'from' | 'to'>): boolean {
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}

function shiftDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
