import Link from 'next/link';
import { Suspense } from 'react';
import { card, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { HeroStat } from '@/features/reports/widgets';
import { TagTile } from '@/components/ui/tag-tile';
import { IconAddStock, IconBulkAdd, IconCheckList, IconRupee, IconSun, IconTag } from '@/components/ui/icons';
import { FirstTimeTip } from '@/components/layout/first-time-tip';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { getT } from '@/server/i18n';
import { pendingCount } from '@/server/services/approvals';
import { shopToday } from '@/server/services/reports';
import { BillsLine, CollectionsLine, CompaniesOverview } from './companies';

/**
 * Owner's Home (plan v17): only the essentials — four actions and today's sales.
 * Month, profit, exchanges and sales per person are on Reports; every entry on
 * Activity; out-of-stock items on Needs attention. Under Today, the companies
 * overview (owner's feedback 2026-11-20).
 *
 * Owner, 2026-11-24 (ADR-072): the fourth action is Bulk addition, where Approvals was.
 * Sales waiting for the owner still show here — one slim line under the actions, only
 * while something waits (Approvals itself is under More).
 */
async function Dashboard() {
  const me = await requireAdmin();
  const t = await getT();
  const db = await requestDb();
  const [today, pending] = await Promise.all([shopToday(db, STORE_ID), pendingCount(db, STORE_ID)]);
  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t('nav.dashboard')}</h1>
        <FirstTimeTip id="owner" text={t('own.dash.tip')} helpHref="/guide#for-owner" />
        <div data-testid="quick-actions" className="rise-in grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Owner, 2026-11-22 (ADR-064): straight to New item (other ways stay on the Stock tab). */}
          <TagTile href="/admin/stock/new" primary icon={<IconAddStock />} title={t('own.dash.newStock')} />
          <TagTile href="/admin/companies" icon={<IconTag />} title={t('nav.suppliers')} />
          <TagTile href="/admin/reports" icon={<IconRupee />} title={t('nav.reports')} />
          <TagTile href="/admin/stock/bulk" icon={<IconBulkAdd />} title={t('bulk.title')} />
        </div>
        {pending.total > 0 && (
          <Link href="/admin/approvals" data-testid="home-approvals" className={`${card} rise-in flex items-center gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300 [&>svg]:h-4.5 [&>svg]:w-4.5">
              <IconCheckList />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t('nav.approvals')}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span data-testid="approvals-waiting" className="font-semibold text-red-700 dark:text-red-300">
                  {t('appr.home.tile', { n: pending.total })}
                </span>
                {/* Plan v17: sales sold below their purchase price stand out. */}
                {pending.losses > 0 && (
                  <span data-testid="approvals-losses" className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                    {t('appr.home.losses', { n: pending.losses })}
                  </span>
                )}
              </span>
            </span>
            <span aria-hidden className="text-zinc-500 dark:text-zinc-400">
              ›
            </span>
          </Link>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className={`${sectionTitle} flex items-center gap-1.5 [&>svg]:h-4 [&>svg]:w-4`}>
          <IconSun />
          {t('my.today')}
        </h2>
        <div className="rise-in grid grid-cols-2 gap-3">
          <HeroStat
            label={t('own.dash.netRevenue')}
            value={formatPaise(today.netRevenuePaise)}
            testId="today-revenue"
            sub={`${t('own.dash.unitsSold')}: ${today.sales.units} · ${t('own.salesCount', { n: today.sales.count })}`}
            subTestId="today-units"
          />
        </div>
      </section>

      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <div className="flex flex-col gap-2">
          <CollectionsLine />
          <CompaniesOverview me={me} />
          <BillsLine />
        </div>
      </Suspense>
    </main>
  );
}

export default async function AdminDashboardPage() {
  const t = await getT();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{t('own.dash.loading')}</p>}>
      <Dashboard />
    </Suspense>
  );
}
