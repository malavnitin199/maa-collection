import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { ActivityList } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import { requireAdmin } from '@/server/auth';
import { shopActivity } from '@/server/services/reports';

async function Activity() {
  await requireAdmin();
  const entries = await shopActivity(await requestDb(), STORE_ID, 150);
  return <ActivityList entries={entries} title="Latest 150 sales and exchanges" testId="activity-log" />;
}

export default function ActivityPage() {
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className={`text-sm ${muted}`}>Every sale and exchange: who it is credited to, and who recorded it.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Activity />
      </Suspense>
    </main>
  );
}
