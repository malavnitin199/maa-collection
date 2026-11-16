import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { ActivityList, HeroStat, StatTile } from '@/features/reports/widgets';
import { TagTile } from '@/components/ui/tag-tile';
import { IconBoxes, IconChart, IconCheckList, IconClock, IconRupee, IconScan, IconStockAdd, IconSun, IconSwap, IconTag, IconUsers } from '@/components/ui/icons';
import type { ReactNode } from 'react';
import { FirstTimeTip } from '@/components/layout/first-time-tip';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { getT, getLocale } from '@/server/i18n';
import { pendingCount } from '@/server/services/approvals';
import { shopDashboard } from '@/server/services/reports';

/** A section title with a small symbol before it (UI clean-up, v15). */
function Title({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className={`${sectionTitle} flex items-center gap-1.5 [&>svg]:h-4 [&>svg]:w-4`}>
      {icon}
      {children}
    </h2>
  );
}

/** Low stock on Home: the first few, the rest one tap away. */
const LOW_STOCK_SHOWN = 6;

async function Dashboard() {
  await requireAdmin();
  const t = await getT();
  const locale = await getLocale();
  const db = await requestDb();
  const [d, pending] = await Promise.all([shopDashboard(db, STORE_ID), pendingCount(db, STORE_ID)]);
  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t('nav.dashboard')}</h1>
        <FirstTimeTip id="owner" text={t('own.dash.tip')} helpHref="/guide#for-owner" />
        <div data-testid="quick-actions" className="rise-in grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TagTile href="/admin/stock" primary icon={<IconStockAdd />} title={t('own.dash.newStock')} />
          <TagTile href="/admin/stock/receive" icon={<IconScan />} title={t('own.dash.restock')} />
          <TagTile href="/admin/suppliers" icon={<IconTag />} title={t('nav.suppliers')} />
          <TagTile href="/admin/reports" icon={<IconRupee />} title={t('nav.reports')} />
          <TagTile
            href="/admin/approvals"
            icon={<IconCheckList />}
            title={t('nav.approvals')}
            hint={
              <span data-testid="approvals-waiting" className={pending.total > 0 ? 'font-semibold text-red-700 dark:text-red-300' : undefined}>
                {pending.total > 0 ? t('appr.home.tile', { n: pending.total }) : t('appr.home.tileNone')}
              </span>
            }
          />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <Title icon={<IconSun />}>{t('my.today')}</Title>
        <div className="rise-in grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroStat
            label={t('own.dash.netRevenue')}
            value={formatPaise(d.netRevenue.today)}
            testId="today-revenue"
            sub={`${t('own.dash.unitsSold')}: ${d.sales.today.units} · ${t('own.salesCount', { n: d.sales.today.count })}`}
            subTestId="today-units"
          />
          <StatTile icon={<IconChart />} label={t('own.estProfit')} value={formatPaise(d.estimatedProfit.today)} sub={t('own.dash.withCost')} />
          <StatTile
            icon={<IconSwap />}
            label={t('own.exchanges')}
            value={String(d.exchanges.today.count)}
            sub={t('own.net', { amount: formatPaise(d.exchanges.today.differencePaise) })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Title icon={<IconChart />}>{t('my.month')}</Title>
        <div className="rise-in grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={<IconRupee />} label={t('own.dash.netRevenue')} value={formatPaise(d.netRevenue.month)} testId="month-revenue" />
          <StatTile icon={<IconTag />} label={t('own.dash.unitsSold')} value={String(d.sales.month.units)} sub={t('own.salesCount', { n: d.sales.month.count })} />
          <StatTile icon={<IconChart />} label={t('own.estProfit')} value={formatPaise(d.estimatedProfit.month)} />
          <StatTile
            icon={<IconSwap />}
            label={t('own.exchanges')}
            value={String(d.exchanges.month.count)}
            sub={t('own.net', { amount: formatPaise(d.exchanges.month.differencePaise) })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Title icon={<IconUsers />}>{t('own.dash.bySalesperson')}</Title>
          <Link href="/admin/team" className={`text-sm ${link}`}>
            {t('own.dash.teamGraphs')}
          </Link>
        </div>
        <div className={`${card} overflow-x-auto p-0`}>
          <table data-testid="sales-by-person" className="w-full min-w-[420px] text-left text-sm">
            <thead className={muted}>
              <tr>
                <th className="px-4 py-2 font-medium">{t('own.dash.name')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('my.today')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('my.month')}</th>
              </tr>
            </thead>
            <tbody>
              {d.salespeople.map((person) => (
                <tr key={person.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    {person.name}
                    {!person.active && <span className={`ml-1 text-xs ${muted}`}>{t('own.dash.inactive')}</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPaise(person.today.netPaise)} <span className={muted}>· {t('own.pcs', { n: person.today.units })}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPaise(person.month.netPaise)} <span className={muted}>· {t('own.pcs', { n: person.month.units })}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <Title icon={<IconBoxes />}>{t('own.dash.stock')}</Title>
          <div className="rise-in grid grid-cols-2 gap-3">
            <StatTile icon={<IconBoxes />} label={t('own.dash.piecesInStock')} value={String(d.stock.units)} sub={t('own.dash.products', { n: d.stock.productCount })} />
            <StatTile
              icon={<IconRupee />}
              label={t('own.dash.stockValue')}
              value={formatPaise(d.stock.mrpValue)}
              sub={t('own.dash.atCost', { amount: formatPaise(d.stock.costValue) })}
            />
          </div>
          <h3 className="mt-2 text-sm font-medium">{t('own.dash.lowStock')}</h3>
          {d.lowStock.length === 0 ? (
            <p className={`text-sm ${muted}`}>{t('own.dash.allGood')}</p>
          ) : (
            (() => {
              const row = (p: (typeof d.lowStock)[number]) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <Link href={`/admin/products/${p.id}`} className={link}>
                    {p.name} ({p.size}, {p.color})
                  </Link>
                  <span className={p.stock <= 0 ? 'font-medium text-red-600 dark:text-red-400' : 'font-medium text-amber-600'}>
                    {p.stock <= 0 ? t('own.dash.outOfStock') : t('own.dash.left', { n: p.stock })}
                  </span>
                </li>
              );
              const rest = d.lowStock.slice(LOW_STOCK_SHOWN);
              return (
                <div data-testid="low-stock" className="flex flex-col gap-1 text-sm">
                  <ul className="flex flex-col gap-1">{d.lowStock.slice(0, LOW_STOCK_SHOWN).map(row)}</ul>
                  {rest.length > 0 && (
                    <details className="group/low">
                      <summary className={`cursor-pointer list-none py-1 ${link} [&::-webkit-details-marker]:hidden`}>
                        <span aria-hidden className="mr-1 inline-block transition-transform group-open/low:rotate-90">▸</span>
                        {t('own.dash.showAllLow', { n: d.lowStock.length })}
                      </summary>
                      <ul className="mt-1 flex flex-col gap-1">{rest.map(row)}</ul>
                    </details>
                  )}
                </div>
              );
            })()
          )}
        </section>
        <ActivityList
          entries={d.activity}
          title={t('own.dash.latest')}
          testId="latest-activity"
          t={t}
          locale={locale}
          limit={6}
          more={{ href: '/admin/activity', label: t('activity.seeAll') }}
          icon={<IconClock />}
        />
      </div>
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
