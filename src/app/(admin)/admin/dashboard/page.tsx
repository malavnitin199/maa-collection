import { Suspense } from 'react';
import { sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { HeroStat } from '@/features/reports/widgets';
import { TagTile } from '@/components/ui/tag-tile';
import { IconCheckList, IconRupee, IconStockAdd, IconSun, IconTag } from '@/components/ui/icons';
import { FirstTimeTip } from '@/components/layout/first-time-tip';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { getT } from '@/server/i18n';
import { pendingCount } from '@/server/services/approvals';
import { shopToday } from '@/server/services/reports';
import { BillsLine, CompaniesOverview } from './companies';

/**
 * Owner's Home (plan v17): only the essentials — four actions and today's sales.
 * Month, profit, exchanges and sales per person are on Reports; every entry on
 * Activity; out-of-stock items on Needs attention. Under Today, the companies
 * overview (owner's feedback 2026-11-20).
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
          <TagTile href="/admin/stock" primary icon={<IconStockAdd />} title={t('own.dash.newStock')} />
          <TagTile href="/admin/suppliers" icon={<IconTag />} title={t('nav.suppliers')} />
          <TagTile href="/admin/reports" icon={<IconRupee />} title={t('nav.reports')} />
          <TagTile
            href="/admin/approvals"
            icon={<IconCheckList />}
            title={t('nav.approvals')}
            hint={
              <span data-testid="approvals-waiting" className={pending.total > 0 ? 'font-semibold text-red-700 dark:text-red-300' : undefined}>
                {pending.total > 0 ? t('appr.home.tile', { n: pending.total }) : t('appr.home.tileNone')}
                {/* Plan v17: sales sold below their purchase price stand out. */}
                {pending.losses > 0 && (
                  <span data-testid="approvals-losses" className="mt-1 block w-fit rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                    {t('appr.home.losses', { n: pending.losses })}
                  </span>
                )}
              </span>
            }
          />
        </div>
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
