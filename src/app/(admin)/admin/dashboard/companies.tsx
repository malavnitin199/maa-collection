import Link from 'next/link';
import { IconLayers, IconRupee, IconTag } from '@/components/ui/icons';
import { card, muted } from '@/components/ui/styles';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';
import type { CurrentStaff } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { billsSummary } from '@/server/services/bills';
import { companiesOverview } from '@/server/services/company';
import { collectionsSummary } from '@/server/services/sections';

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
      href="/admin/companies"
      data-testid="home-companies"
      className={`${card} rise-in flex items-center gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}
    >
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300 [&>svg]:h-4.5 [&>svg]:w-4.5">
        <IconTag />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('own.co.title')}</span>
        <span data-testid="home-companies-line" className={`block truncate text-xs ${muted}`}>
          {t('own.co.short', { n: totals.companies })}
          {showMoney && totals.duePaise ? ` · ${t('own.co.due', { amount: formatPaise(totals.duePaise) })}` : ''}
        </span>
      </span>
      <span aria-hidden className={muted}>
        ›
      </span>
    </Link>
  );
}

/** Home's Bills line (owner's feedback 2026-11-21): just the way in — how many bills, how many open, the dues on them. */
export async function BillsLine() {
  const [t, db] = await Promise.all([getT(), requestDb()]);
  const summary = await billsSummary(db, STORE_ID);
  return (
    <Link href="/admin/bills" data-testid="home-bills" className={`${card} rise-in flex items-center gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300 [&>svg]:h-4.5 [&>svg]:w-4.5">
        <IconRupee />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('nav.bills')}</span>
        <span data-testid="home-bills-line" className={`block truncate text-xs ${muted}`}>
          {summary.bills === 0 ? t('bills.homeNone') : t('bills.home', { n: summary.bills, open: summary.open })}
          {summary.duePaise > 0 ? ` · ${t('own.co.due', { amount: formatPaise(summary.duePaise) })}` : ''}
        </span>
      </span>
      <span aria-hidden className={muted}>
        ›
      </span>
    </Link>
  );
}

/**
 * Home's Collections line (owner, 2026-11-22, ADR-066): like Companies and Bills — how many
 * collections, categories and products — and it opens Categories, where everything else is.
 */
export async function CollectionsLine() {
  const [t, db] = await Promise.all([getT(), requestDb()]);
  const summary = await collectionsSummary(db, STORE_ID);
  return (
    <Link href="/admin/categories" data-testid="home-collections" className={`${card} rise-in flex items-center gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300 [&>svg]:h-4.5 [&>svg]:w-4.5">
        <IconLayers />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('col.title')}</span>
        <span data-testid="home-collections-line" className={`block text-xs ${muted}`}>
          {[
            t(summary.collections === 1 ? 'sec.n.collections.one' : 'sec.n.collections.other', { n: summary.collections }),
            t(summary.categories === 1 ? 'sec.n.categories.one' : 'sec.n.categories.other', { n: summary.categories }),
            t(summary.products === 1 ? 'sec.n.products.one' : 'sec.n.products.other', { n: summary.products }),
          ].join(' · ')}
        </span>
      </span>
      <span aria-hidden className={muted}>
        ›
      </span>
    </Link>
  );
}
