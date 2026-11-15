import Link from 'next/link';
import { Suspense } from 'react';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { DailyColumns, formatShare, ShareBars } from '@/features/reports/team-charts';
import { StatTile } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { REPORT_PERIODS, teamReport, type ReportPeriod } from '@/server/services/reports';
import '@/features/reports/viz.css';

export const metadata = { title: 'Sales team · Maa Collection' };

const belowMrp = (salesPaise: number, mrpPaise: number) => (mrpPaise > 0 ? `${Math.round((1 - salesPaise / mrpPaise) * 100)}%` : '—');

async function Team({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const { period: raw } = await searchParams;
  const period: ReportPeriod = REPORT_PERIODS.some((p) => p.value === raw) ? (raw as ReportPeriod) : '7d';
  const r = await teamReport(await requestDb(), STORE_ID, period);
  const max = Math.max(0, ...r.sellers.flatMap((s) => s.daily));
  const anySales = r.sellers.some((s) => s.netPaise !== 0 || s.bills > 0);

  return (
    <>
      <nav aria-label="Period" className="flex flex-wrap gap-2 text-sm">
        {REPORT_PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/admin/team?period=${p.value}`}
            aria-current={p.value === period ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 ${p.value === period ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Salesmen" value={String(r.totals.salesmen)} sub={`${r.totals.sold} sold in this period`} testId="team-salesmen" />
        <StatTile label="Team sales" value={formatPaise(r.totals.netPaise)} sub="after exchanges" testId="team-sales" />
        <StatTile label="Bills" value={String(r.totals.bills)} />
        <StatTile label="Pieces" value={String(r.totals.units)} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Share of sales</h2>
        {anySales ? <ShareBars sellers={r.sellers} /> : <p className={`text-sm ${muted}`}>No sales in this period yet.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Each seller, day by day</h2>
        <p className={`text-xs ${muted}`}>Same scale for everyone. Hover or long-press a day to see its amount.</p>
        <ul data-testid="seller-cards" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.sellers.map((s) => (
            <li key={s.id} aria-label={`Seller ${s.name}`} className={`${card} flex flex-col gap-2`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {s.name}
                  {s.role === 'admin' && <span className={`ml-1 text-xs font-normal ${muted}`}>owner</span>}
                  {!s.active && <span className={`ml-1 text-xs font-normal ${muted}`}>inactive</span>}
                </span>
                <span className="text-lg font-semibold">{formatPaise(s.netPaise)}</span>
              </div>
              <p className={`text-xs ${muted}`}>
                {formatShare(s.sharePct)} of team · {s.bills} bills · {s.units} pcs · {belowMrp(s.salesPaise, s.mrpPaise)} below MRP on average
              </p>
              <DailyColumns name={s.name} days={r.days} values={s.daily} max={max} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>All numbers</h2>
        <div className={`${card} overflow-x-auto p-0`}>
          <table data-testid="team-table" className="w-full min-w-[560px] text-left text-sm">
            <thead className={muted}>
              <tr>
                <th className="px-3 py-2 font-medium">Seller</th>
                <th className="px-3 py-2 text-right font-medium">Bills</th>
                <th className="px-3 py-2 text-right font-medium">Pcs</th>
                <th className="px-3 py-2 text-right font-medium">Sales</th>
                <th className="px-3 py-2 text-right font-medium">Exchanges</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                <th className="px-3 py-2 text-right font-medium">Share</th>
                <th className="px-3 py-2 text-right font-medium">Below MRP</th>
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
        <p className={`text-xs ${muted}`}>
          Sales are credited to the person chosen in &ldquo;Credit sale to&rdquo;. &ldquo;Below MRP&rdquo; = how much lower than MRP they sold,
          on average (bargaining).
        </p>
      </section>
    </>
  );
}

export default function TeamPage(props: PageProps<'/admin/team'>) {
  return (
    <main className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Sales team</h1>
        <p className={`text-sm ${muted}`}>How many sellers you have, each one&apos;s share of sales, and their sales day by day.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Team searchParams={props.searchParams as Promise<{ period?: string }>} />
      </Suspense>
    </main>
  );
}
