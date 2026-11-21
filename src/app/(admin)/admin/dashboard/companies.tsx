import Link from 'next/link';
import { IconTag } from '@/components/ui/icons';
import { card, muted } from '@/components/ui/styles';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';
import type { CurrentStaff } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { companiesOverview } from '@/server/services/company';

/**
 * Home's Companies line (owner's feedback 2026-11-21): one small row under
 * Today — how many companies and the dues — that opens the Companies page,
 * where the search, filters and figures live.
 */
export async function CompaniesOverview({ me }: { me: CurrentStaff }) {
  const [t, db] = await Promise.all([getT(), requestDb()]);
  const showMoney = can(me, 'costs');
  const { totals } = await companiesOverview(db, STORE_ID, { amounts: showMoney });
  return (
    <Link
      href="/admin/suppliers"
      data-testid="home-companies"
      className={`${card} rise-in flex items-center gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}
    >
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300 [&>svg]:h-4.5 [&>svg]:w-4.5">
        <IconTag />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('own.co.title')}</span>
        <span data-testid="home-companies-line" className={`block truncate text-xs ${muted}`}>
          {t('own.co.short', { n: totals.companies, bills: totals.bills })}
          {showMoney && totals.duePaise ? ` · ${t('own.co.due', { amount: formatPaise(totals.duePaise) })}` : ''}
        </span>
      </span>
      <span aria-hidden className={muted}>
        ›
      </span>
    </Link>
  );
}
