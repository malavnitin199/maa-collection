import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { ActivityList } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import { requireAdmin } from '@/server/auth';
import { getT, getLocale } from '@/server/i18n';
import { shopActivity } from '@/server/services/reports';

async function Activity() {
  await requireAdmin();
  const t = await getT();
  const locale = await getLocale();
  const entries = await shopActivity(await requestDb(), STORE_ID, 150);
  return <ActivityList entries={entries} title={t('own.act.latest150')} testId="activity-log" t={t} locale={locale} />;
}

export default async function ActivityPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('nav.activity')}</h1>
        <p className={`text-sm ${muted}`}>{t('own.act.subtitle')}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Activity />
      </Suspense>
    </main>
  );
}
