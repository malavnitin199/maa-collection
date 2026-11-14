import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { ActivityList, StatTile } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { shopDashboard } from '@/server/services/reports';

async function Dashboard() {
  await requireAdmin();
  const d = await shopDashboard(await requestDb(), STORE_ID);
  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div data-testid="quick-actions" className="grid grid-cols-3 gap-2 text-center text-sm font-medium">
          <Link href="/admin/stock/new" className="rounded-xl bg-emerald-600 px-2 py-3 text-white active:bg-emerald-700">
            + New stock
          </Link>
          <Link href="/admin/suppliers" className="rounded-xl border border-zinc-300 px-2 py-3 dark:border-zinc-700">
            Suppliers
          </Link>
          <Link href="/admin/labels" className="rounded-xl border border-zinc-300 px-2 py-3 dark:border-zinc-700">
            Labels
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Today</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Net revenue" value={formatPaise(d.netRevenue.today)} testId="today-revenue" />
          <StatTile label="Units sold" value={String(d.sales.today.units)} sub={`${d.sales.today.count} sales`} testId="today-units" />
          <StatTile label="Est. profit" value={formatPaise(d.estimatedProfit.today)} sub="items with a cost price" />
          <StatTile
            label="Exchanges"
            value={String(d.exchanges.today.count)}
            sub={`net ${formatPaise(d.exchanges.today.differencePaise)}`}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>This month</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Net revenue" value={formatPaise(d.netRevenue.month)} testId="month-revenue" />
          <StatTile label="Units sold" value={String(d.sales.month.units)} sub={`${d.sales.month.count} sales`} />
          <StatTile label="Est. profit" value={formatPaise(d.estimatedProfit.month)} />
          <StatTile
            label="Exchanges"
            value={String(d.exchanges.month.count)}
            sub={`net ${formatPaise(d.exchanges.month.differencePaise)}`}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Sales by salesperson</h2>
        <div className={`${card} overflow-x-auto p-0`}>
          <table data-testid="sales-by-person" className="w-full min-w-[420px] text-left text-sm">
            <thead className={muted}>
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 text-right font-medium">Today</th>
                <th className="px-4 py-2 text-right font-medium">This month</th>
              </tr>
            </thead>
            <tbody>
              {d.salespeople.map((person) => (
                <tr key={person.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    {person.name}
                    {!person.active && <span className={`ml-1 text-xs ${muted}`}>(inactive)</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPaise(person.today.netPaise)} <span className={muted}>· {person.today.units} pcs</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPaise(person.month.netPaise)} <span className={muted}>· {person.month.units} pcs</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Stock</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Pieces in stock" value={String(d.stock.units)} sub={`${d.stock.productCount} products`} />
            <StatTile label="Stock value at MRP" value={formatPaise(d.stock.mrpValue)} sub={`at cost ${formatPaise(d.stock.costValue)}`} />
          </div>
          <h3 className="mt-2 text-sm font-medium">Low stock</h3>
          {d.lowStock.length === 0 ? (
            <p className={`text-sm ${muted}`}>All good.</p>
          ) : (
            <ul data-testid="low-stock" className="flex flex-col gap-1 text-sm">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <Link href={`/admin/products/${p.id}`} className={link}>
                    {p.name} ({p.size}, {p.color})
                  </Link>
                  <span className={p.stock <= 0 ? 'font-medium text-red-600 dark:text-red-400' : 'font-medium text-amber-600'}>
                    {p.stock <= 0 ? 'Out of stock' : `${p.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <ActivityList entries={d.activity} title="Latest activity" testId="latest-activity" />
      </div>
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading dashboard…</p>}>
      <Dashboard />
    </Suspense>
  );
}
