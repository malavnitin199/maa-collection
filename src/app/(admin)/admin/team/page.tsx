import Link from 'next/link';
import { Suspense } from 'react';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { DailyColumns, formatShare, ShareBars } from '@/features/reports/team-charts';
import { StatTile } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import type { MessageKey } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { getT, getLocale } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { REPORT_PERIODS, teamReport, type ReportPeriod } from '@/server/services/reports';
import '@/features/reports/viz.css';

export const metadata = { title: 'Sales team · Maa Collection' };

/** Period buttons in the reader's language (the English labels are REPORT_PERIODS'). */
const PERIOD_KEYS: Record<ReportPeriod, MessageKey> = {
  today: 'own.period.today',
  '7d': 'own.period.7d',
  '30d': 'own.period.30d',
  month: 'own.period.month',
};

const belowMrp = (salesPaise: number, mrpPaise: number) => (mrpPaise > 0 ? `${Math.round((1 - salesPaise / mrpPaise) * 100)}%` : '—');

async function Team({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const t = await getT();
  const locale = await getLocale();
  const { period: raw } = await searchParams;
  const period: ReportPeriod = REPORT_PERIODS.some((p) => p.value === raw) ? (raw as ReportPeriod) : '7d';
  const r = await teamReport(await requestDb(), STORE_ID, period);
  const max = Math.max(0, ...r.sellers.flatMap((s) => s.daily));
  const anySales = r.sellers.some((s) => s.netPaise !== 0 || s.bills > 0);

  return (
    <>
      <nav aria-label={t('own.period')} className="flex flex-wrap gap-2 text-sm">
        {REPORT_PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/admin/team?period=${p.value}`}
            aria-current={p.value === period ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 ${p.value === period ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
          >
            {t(PERIOD_KEYS[p.value])}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label={t('own.team.salesmen')}
          value={String(r.totals.salesmen)}
          sub={t('own.team.soldInPeriod', { n: r.totals.sold })}
          testId="team-salesmen"
        />
        <StatTile label={t('own.team.teamSales')} value={formatPaise(r.totals.netPaise)} sub={t('own.afterExchanges')} testId="team-sales" />
        <StatTile label={t('own.team.bills')} value={String(r.totals.bills)} />
        <StatTile label={t('own.team.pieces')} value={String(r.totals.units)} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>{t('own.team.shareOfSales')}</h2>
        {anySales ? <ShareBars sellers={r.sellers} t={t} /> : <p className={`text-sm ${muted}`}>{t('own.team.noSalesYet')}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>{t('own.team.dayByDay')}</h2>
        <p className={`text-xs ${muted}`}>{t('own.team.sameScale')}</p>
        <ul data-testid="seller-cards" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.sellers.map((s) => (
            <li key={s.id} aria-label={t('own.team.sellerLabel', { name: s.name })} className={`${card} flex flex-col gap-2`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {s.name}
                  {s.role === 'admin' && <span className={`ml-1 text-xs font-normal ${muted}`}>{t('own.team.owner')}</span>}
                  {!s.active && <span className={`ml-1 text-xs font-normal ${muted}`}>{t('own.inactive')}</span>}
                </span>
                <span className="text-lg font-semibold">{formatPaise(s.netPaise)}</span>
              </div>
              <p className={`text-xs ${muted}`}>
                {t('own.team.cardLine', {
                  share: formatShare(s.sharePct),
                  bills: s.bills,
                  units: s.units,
                  below: belowMrp(s.salesPaise, s.mrpPaise),
                })}
              </p>
              <DailyColumns name={s.name} days={r.days} values={s.daily} max={max} t={t} locale={locale} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('own.team.allNumbers')}</h2>
        <div className={`${card} overflow-x-auto p-0`}>
          <table data-testid="team-table" className="w-full min-w-[560px] text-left text-sm">
            <thead className={muted}>
              <tr>
                <th className="px-3 py-2 font-medium">{t('own.team.col.seller')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.team.bills')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.col.pcs')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.col.sales')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.exchanges')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.team.col.net')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.col.share')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('own.team.col.belowMrp')}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {r.sellers.map((s) => (
                <tr key={s.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 text-right">{s.bills}</td>
                  <td className="px-3 py-2 text-right">{s.units}</td>
                  <td className="px-3 py-2 text-right">{formatPaise(s.salesPaise)}</td>
                  <td className="px-3 py-2 text-right">{formatPaise(s.exchangePaise)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatPaise(s.netPaise)}</td>
                  <td className="px-3 py-2 text-right">{formatShare(s.sharePct)}</td>
                  <td className="px-3 py-2 text-right">{belowMrp(s.salesPaise, s.mrpPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`text-xs ${muted}`}>{t('own.team.note')}</p>
      </section>
    </>
  );
}

export default async function TeamPage(props: PageProps<'/admin/team'>) {
  const t = await getT();
  return (
    <main className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('own.team.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('own.team.subtitle')}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Team searchParams={props.searchParams as Promise<{ period?: string }>} />
      </Suspense>
    </main>
  );
}
