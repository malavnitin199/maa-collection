import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { ActivityList, HeroStat, StatTile } from '@/features/reports/widgets';
import { TagTile } from '@/components/ui/tag-tile';
import { IconRupee, IconScan, IconStockAdd, IconTag } from '@/components/ui/icons';
import { FirstTimeTip } from '@/components/layout/first-time-tip';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { getT, getLocale } from '@/server/i18n';
import { shopDashboard } from '@/server/services/reports';

async function Dashboard() {
  await requireAdmin();
  const t = await getT();
  const locale = await getLocale();
  const d = await shopDashboard(await requestDb(), STORE_ID);
  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t('nav.dashboard')}</h1>
        <FirstTimeTip id="owner" text={t('own.dash.tip')} helpHref="/guide#for-owner" />
        <div data-testid="quick-actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TagTile href="/admin/stock" primary icon={<IconStockAdd />} title={t('own.dash.newStock')} />
          <TagTile href="/admin/stock/receive" icon={<IconScan />} title={t('own.dash.restock')} />
          <TagTile href="/admin/suppliers" icon={<IconTag />} title={t('nav.suppliers')} />
          <TagTile href="/admin/reports" icon={<IconRupee />} title={t('nav.reports')} />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('my.today')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroStat
            label={t('own.dash.netRevenue')}
            value={formatPaise(d.netRevenue.today)}
            testId="today-revenue"
            sub={`${t('own.dash.unitsSold')}: ${d.sales.today.units} · ${t('own.salesCount', { n: d.sales.today.count })}`}
            subTestId="today-units"
          />
          <StatTile label={t('own.estProfit')} value={formatPaise(d.estimatedProfit.today)} sub={t('own.dash.withCost')} />
          <StatTile
            label={t('own.exchanges')}
            value={String(d.exchanges.today.count)}
            sub={t('own.net', { amount: formatPaise(d.exchanges.today.differencePaise) })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('my.month')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t('own.dash.netRevenue')} value={formatPaise(d.netRevenue.month)} testId="month-revenue" />
          <StatTile label={t('own.dash.unitsSold')} value={String(d.sales.month.units)} sub={t('own.salesCount', { n: d.sales.month.count })} />
          <StatTile label={t('own.estProfit')} value={formatPaise(d.estimatedProfit.month)} />
          <StatTile
            label={t('own.exchanges')}
            value={String(d.exchanges.month.count)}
            sub={t('own.net', { amount: formatPaise(d.exchanges.month.differencePaise) })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className={sectionTitle}>{t('own.dash.bySalesperson')}</h2>
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
          <h2 className={sectionTitle}>{t('own.dash.stock')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label={t('own.dash.piecesInStock')} value={String(d.stock.units)} sub={t('own.dash.products', { n: d.stock.productCount })} />
            <StatTile
              label={t('own.dash.stockValue')}
              value={formatPaise(d.stock.mrpValue)}
              sub={t('own.dash.atCost', { amount: formatPaise(d.stock.costValue) })}
            />
          </div>
          <h3 className="mt-2 text-sm font-medium">{t('own.dash.lowStock')}</h3>
          {d.lowStock.length === 0 ? (
            <p className={`text-sm ${muted}`}>{t('own.dash.allGood')}</p>
          ) : (
            <ul data-testid="low-stock" className="flex flex-col gap-1 text-sm">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <Link href={`/admin/products/${p.id}`} className={link}>
                    {p.name} ({p.size}, {p.color})
                  </Link>
                  <span className={p.stock <= 0 ? 'font-medium text-red-600 dark:text-red-400' : 'font-medium text-amber-600'}>
                    {p.stock <= 0 ? t('own.dash.outOfStock') : t('own.dash.left', { n: p.stock })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <ActivityList entries={d.activity} title={t('own.dash.latest')} testId="latest-activity" t={t} locale={locale} />
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
