import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted, secondaryButton, sectionTitle } from '@/components/ui/styles';
import { FreshAddress } from '@/features/forms/fresh-address';
import { StatTile } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import type { MessageKey, T } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { getT, getLocale } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { REPORT_PERIODS, salesReport, type GroupRow, type ReportPeriod } from '@/server/services/reports';
import { formatDate } from '@/lib/i18n';


/** Period buttons in the reader's language (the English labels are REPORT_PERIODS'). */
const PERIOD_KEYS: Record<ReportPeriod, MessageKey> = {
  today: 'own.period.today',
  '7d': 'own.period.7d',
  '30d': 'own.period.30d',
  month: 'own.period.month',
};

function GroupTable({ title, rows, testId, firstColumn, t }: { title: string; rows: GroupRow[]; testId: string; firstColumn: string; t: T }) {
  const total = rows.reduce((sum, r) => sum + r.revenuePaise, 0);
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>{title}</h2>
      {rows.length === 0 ? (
        <p className={`text-sm ${muted}`}>{t('own.noSalesPeriod')}</p>
      ) : (
        <div className={`${card} overflow-x-auto p-0`}>
          <table data-testid={testId} className="w-full min-w-[420px] text-left text-sm">
            <thead className={muted}>
              <tr>
                <th className="px-3 py-2 font-medium">{firstColumn}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.col.pcs')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.col.sales')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.col.share')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.estProfit')}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right">{r.units}</td>
                  <td className="px-3 py-2 text-right">{formatPaise(r.revenuePaise)}</td>
                  <td className="px-3 py-2 text-right">{total ? Math.round((r.revenuePaise / total) * 100) : 0}%</td>
                  <td className="px-3 py-2 text-right">{formatPaise(r.profitPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function Report({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const t = await getT();
  const locale = await getLocale();
  const { period: param } = await searchParams;
  const period: ReportPeriod = REPORT_PERIODS.some((p) => p.value === param) ? (param as ReportPeriod) : '7d';
  const r = await salesReport(await requestDb(), STORE_ID, period);

  return (
    <>
      <nav aria-label={t('own.period')} className="flex flex-wrap gap-2 text-sm">
        {REPORT_PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/admin/reports?period=${p.value}`}
            aria-current={p.value === period ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 ${p.value === period ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
          >
            {t(PERIOD_KEYS[p.value])}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('own.rep.netSales')} value={formatPaise(r.totals.netRevenuePaise)} sub={t('own.afterExchanges')} testId="report-net" />
        <StatTile label={t('own.rep.piecesSold')} value={String(r.totals.units)} sub={t('own.salesCount', { n: r.totals.count })} />
        <StatTile label={t('own.estProfit')} value={formatPaise(r.totals.profitPaise)} sub={t('own.rep.withPurchase')} />
        <StatTile
          label={t('own.exchanges')}
          value={String(r.totals.exchanges.count)}
          sub={t('own.net', { amount: formatPaise(r.totals.exchanges.differencePaise) })}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('own.rep.bestSellers')}</h2>
        {r.topProducts.length === 0 ? (
          <p className={`text-sm ${muted}`}>{t('own.noSalesPeriod')}</p>
        ) : (
          <ol data-testid="top-products" className="flex flex-col gap-1 text-sm">
            {r.topProducts.map((p, i) => (
              <li key={p.productId} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-1.5 dark:border-zinc-900">
                <span className="min-w-0 truncate">
                  <span className={`mr-2 tabular-nums ${muted}`}>{i + 1}.</span>
                  <Link href={`/admin/products/${p.productId}`} className={link}>
                    {p.label}
                  </Link>
                </span>
                <span className="shrink-0 tabular-nums">
                  {t('own.pcs', { n: p.units })} · {formatPaise(p.revenuePaise)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <GroupTable title={t('own.rep.byCategory')} rows={r.byCategory} testId="by-category" firstColumn={t('own.rep.category')} t={t} />
      <GroupTable title={t('own.rep.byCompany')} rows={r.bySupplier} testId="by-company" firstColumn={t('own.rep.company')} t={t} />
      <GroupTable title={t('own.rep.bySalesperson')} rows={r.bySalesperson} testId="by-person" firstColumn={t('own.rep.salesperson')} t={t} />

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('own.rep.notSelling')}</h2>
        <p className={`text-xs ${muted}`}>{t('own.rep.notSellingHint')}</p>
        {r.slowMovers.length === 0 ? (
          <p className={`text-sm ${muted}`}>{t('own.rep.allSold')}</p>
        ) : (
          <ul data-testid="slow-movers" className="flex flex-col gap-1 text-sm">
            {r.slowMovers.map((s) => (
              <li key={s.productId} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-1.5 dark:border-zinc-900">
                <Link href={`/admin/products/${s.productId}`} className={`min-w-0 truncate ${link}`}>
                  {s.label}
                </Link>
                <span className="shrink-0 text-right tabular-nums">
                  {t('own.pcs', { n: s.stock })} · {formatPaise(s.mrpValuePaise)}
                  <span className={`block text-xs ${muted}`}>
                    {s.lastSoldAt ? t('own.rep.lastSold', { date: formatDate(locale, s.lastSoldAt) }) : t('own.rep.neverSold')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('own.rep.download')}</h2>
        <div className="flex flex-wrap gap-2">
          <a href={`/admin/export/sales?period=${period}`} className={secondaryButton} download>
            {t('own.rep.salesCsv')}
          </a>
          <a href="/admin/export/stock" className={secondaryButton} download>
            {t('own.rep.stockCsv')}
          </a>
        </div>
        <p className={`text-xs ${muted}`}>{t('own.rep.csvHint')}</p>
      </section>
    </>
  );
}

export default async function ReportsPage(props: PageProps<'/admin/reports'>) {
  const t = await getT();
  return (
    <main className="flex flex-col gap-5">
      {/* Back from another screen: this month again (ADR-068). */}
      <FreshAddress drop={['period']} />
      <div>
        <h1 className="text-2xl font-semibold">{t('nav.reports')}</h1>
        <p className={`text-sm ${muted}`}>{t('own.rep.subtitle')}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('own.rep.loading')}</p>}>
        <Report searchParams={props.searchParams as Promise<{ period?: string }>} />
      </Suspense>
    </main>
  );
}
