import Link from 'next/link';
import { IconRupee, IconTag } from '@/components/ui/icons';
import { card, muted } from '@/components/ui/styles';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';
import type { CurrentStaff } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { billsSummary } from '@/server/services/bills';
import { companiesOverview } from '@/server/services/company';
import { collectionsOverview } from '@/server/services/sections';
import { CollectionsPanel } from '@/features/catalog/collections-panel';

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

/** Home → Collections (owner, 2026-11-22, ADR-051): names to edit, items in each, Delete when empty. */
export async function CollectionsLine() {
  const rows = await collectionsOverview(await requestDb(), STORE_ID);
  if (rows.length === 0) return null;
  return <CollectionsPanel rows={rows} />;
}

