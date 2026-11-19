import { Suspense } from 'react';
import { IconChart, IconClock, IconSun, IconUsers } from '@/components/ui/icons';
import { muted, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { SavedSalesSection } from '@/features/offline/saved-section';
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
      <SavedSalesSection me={{ id: me.id }} />
      <div className="rise-in grid grid-cols-2 gap-3">
        <StatTile icon={<IconSun />} label={t('my.today')} value={formatPaise(todayNet)} sub={`${pcs(data.mine.today.units)} · ${count(data.mine.today.count)}`} testId="my-today" />
        <StatTile icon={<IconChart />} label={t('my.month')} value={formatPaise(monthNet)} sub={`${pcs(data.mine.month.units)} · ${count(data.mine.month.count)}`} testId="my-month" />
      </div>
      {data.waiting.month.count > 0 && (
        <p data-testid="my-waiting" className="flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <IconClock className="h-4 w-4 shrink-0" />
          {t('my.waiting', { sales: count(data.waiting.month.count), amount: formatPaise(data.waiting.month.totalPaise) })}
        </p>
      )}
      <section className="flex flex-col gap-2">
        <h2 className={`${sectionTitle} flex items-center gap-1.5`}>
          <IconUsers className="h-4 w-4" />
          {t('my.forOthers')}
        </h2>
        <p data-testid="for-others" className="text-sm">
          {t('my.forOthersLine', {
            today: formatPaise(data.forOthers.today.totalPaise),
            todayCount: data.forOthers.today.count,
            month: formatPaise(data.forOthers.month.totalPaise),
            monthCount: data.forOthers.month.count,
          })}
        </p>
      </section>
      <ActivityList entries={data.activity} title={t('my.activity')} testId="my-activity" t={t} locale={locale} icon={<IconClock />} />
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
