import { Suspense } from 'react';
import { muted, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { ActivityList, StatTile } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { requireStaff } from '@/server/auth';
import { plural } from '@/lib/i18n';
import { getT, getLocale } from '@/server/i18n';
import { staffDashboard } from '@/server/services/reports';

async function MySales() {
  const [me, t] = await Promise.all([requireStaff(), getT()]);
  const locale = await getLocale();
  const pcs = (n: number) => plural(t, 'my.pcs', n);
  const count = (n: number) => plural(t, 'my.sales', n);
  const data = await staffDashboard(await requestDb(), STORE_ID, me.id);
  const todayNet = data.mine.today.totalPaise + data.exchanges.today.differencePaise;
  const monthNet = data.mine.month.totalPaise + data.exchanges.month.differencePaise;
  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('my.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('my.subtitle', { name: me.name })}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label={t('my.today')} value={formatPaise(todayNet)} sub={`${pcs(data.mine.today.units)} · ${count(data.mine.today.count)}`} testId="my-today" />
        <StatTile label={t('my.month')} value={formatPaise(monthNet)} sub={`${pcs(data.mine.month.units)} · ${count(data.mine.month.count)}`} testId="my-month" />
      </div>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('my.forOthers')}</h2>
        <p data-testid="for-others" className="text-sm">
          {t('my.forOthersLine', {
            today: formatPaise(data.forOthers.today.totalPaise),
            todayCount: data.forOthers.today.count,
            month: formatPaise(data.forOthers.month.totalPaise),
            monthCount: data.forOthers.month.count,
          })}
        </p>
      </section>
      <ActivityList entries={data.activity} title={t('my.activity')} testId="my-activity" t={t} locale={locale} />
    </main>
  );
}

export default function MySalesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">…</p>}>
      <MySales />
    </Suspense>
  );
}
