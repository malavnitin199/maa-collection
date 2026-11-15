import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted, secondaryButton, sectionTitle } from '@/components/ui/styles';
import { StatTile } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { REPORT_PERIODS, salesReport, type GroupRow, type ReportPeriod } from '@/server/services/reports';

const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });

function GroupTable({ title, rows, testId, firstColumn }: { title: string; rows: GroupRow[]; testId: string; firstColumn: string }) {
  const total = rows.reduce((sum, r) => sum + r.revenuePaise, 0);
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>{title}</h2>
      {rows.length === 0 ? (
        <p className={`text-sm ${muted}`}>No sales in this period.</p>
      ) : (
        <div className={`${card} overflow-x-auto p-0`}>
          <table data-testid={testId} className="w-full min-w-[420px] text-left text-sm">
            <thead className={muted}>
              <tr>
                <th className="px-3 py-2 font-medium">{firstColumn}</th>
                <th className="px-3 py-2 text-right font-medium">Pcs</th>
                <th className="px-3 py-2 text-right font-medium">Sales</th>
                <th className="px-3 py-2 text-right font-medium">Share</th>
                <th className="px-3 py-2 text-right font-medium">Est. profit</th>
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
  const { period: param } = await searchParams;
  const period: ReportPeriod = REPORT_PERIODS.some((p) => p.value === param) ? (param as ReportPeriod) : '7d';
  const r = await salesReport(await requestDb(), STORE_ID, period);

  return (
    <>
      <nav aria-label="Period" className="flex flex-wrap gap-2 text-sm">
        {REPORT_PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/admin/reports?period=${p.value}`}
            aria-current={p.value === period ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 ${p.value === period ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Net sales" value={formatPaise(r.totals.netRevenuePaise)} sub="after exchanges" testId="report-net" />
        <StatTile label="Pieces sold" value={String(r.totals.units)} sub={`${r.totals.count} sales`} />
        <StatTile label="Est. profit" value={formatPaise(r.totals.profitPaise)} sub="items with a purchase price" />
        <StatTile label="Exchanges" value={String(r.totals.exchanges.count)} sub={`net ${formatPaise(r.totals.exchanges.differencePaise)}`} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Best sellers</h2>
        {r.topProducts.length === 0 ? (
          <p className={`text-sm ${muted}`}>No sales in this period.</p>
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
                  {p.units} pcs · {formatPaise(p.revenuePaise)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <GroupTable title="By category" rows={r.byCategory} testId="by-category" firstColumn="Category" />
      <GroupTable title="By company" rows={r.bySupplier} testId="by-company" firstColumn="Company" />
      <GroupTable title="By salesperson" rows={r.bySalesperson} testId="by-person" firstColumn="Salesperson" />

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Not selling (no sale in 30 days)</h2>
        <p className={`text-xs ${muted}`}>In stock, biggest stock value first. Ideas: move to the front, bundle, or offer a discount.</p>
        {r.slowMovers.length === 0 ? (
          <p className={`text-sm ${muted}`}>Everything in stock sold at least once in the last 30 days.</p>
        ) : (
          <ul data-testid="slow-movers" className="flex flex-col gap-1 text-sm">
            {r.slowMovers.map((s) => (
              <li key={s.productId} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-1.5 dark:border-zinc-900">
                <Link href={`/admin/products/${s.productId}`} className={`min-w-0 truncate ${link}`}>
                  {s.label}
                </Link>
                <span className="shrink-0 text-right tabular-nums">
                  {s.stock} pcs · {formatPaise(s.mrpValuePaise)}
                  <span className={`block text-xs ${muted}`}>{s.lastSoldAt ? `last sold ${date.format(s.lastSoldAt)}` : 'never sold'}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Download for your accountant</h2>
        <div className="flex flex-wrap gap-2">
          <a href={`/admin/export/sales?period=${period}`} className={secondaryButton} download>
            Sales &amp; exchanges (CSV)
          </a>
          <a href="/admin/export/stock" className={secondaryButton} download>
            Stock list (CSV)
          </a>
        </div>
        <p className={`text-xs ${muted}`}>Opens in Excel or Google Sheets. Includes purchase prices and profit — owner only.</p>
      </section>
    </>
  );
}

export default function ReportsPage(props: PageProps<'/admin/reports'>) {
  return (
    <main className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className={`text-sm ${muted}`}>What sells, what doesn&apos;t, and who sells it. Times are Indian time.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Working out the numbers…</p>}>
        <Report searchParams={props.searchParams as Promise<{ period?: string }>} />
      </Suspense>
    </main>
  );
}
