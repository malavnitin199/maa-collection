import { Suspense } from 'react';
import { muted, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { ActivityList, StatTile } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { requireStaff } from '@/server/auth';
import { staffDashboard } from '@/server/services/reports';

const pcs = (n: number) => `${n} pc${n === 1 ? '' : 's'}`;

async function MySales() {
  const me = await requireStaff();
  const data = await staffDashboard(await requestDb(), STORE_ID, me.id);
  const todayNet = data.mine.today.totalPaise + data.exchanges.today.differencePaise;
  const monthNet = data.mine.month.totalPaise + data.exchanges.month.differencePaise;
  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My sales</h1>
        <p className={`text-sm ${muted}`}>{me.name} · sales credited to you, including exchanges</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Today" value={formatPaise(todayNet)} sub={`${pcs(data.mine.today.units)} · ${data.mine.today.count} sales`} testId="my-today" />
        <StatTile label="This month" value={formatPaise(monthNet)} sub={`${pcs(data.mine.month.units)} · ${data.mine.month.count} sales`} testId="my-month" />
      </div>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Recorded by me for others</h2>
        <p data-testid="for-others" className="text-sm">
          Today {formatPaise(data.forOthers.today.totalPaise)} ({data.forOthers.today.count}) · This month{' '}
          {formatPaise(data.forOthers.month.totalPaise)} ({data.forOthers.month.count})
        </p>
      </section>
      <ActivityList entries={data.activity} title="My recent activity" testId="my-activity" />
    </main>
  );
}

export default function MySalesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <MySales />
    </Suspense>
  );
}
