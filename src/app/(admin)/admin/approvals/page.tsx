import { Suspense } from 'react';
import { FirstTimeTip } from '@/components/layout/first-time-tip';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { ApprovalsScreen } from '@/features/approvals/approvals-screen';
import { STORE_ID } from '@/lib/app-config';
import { formatDate, type MessageKey } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { pendingCount, pendingForOwner, recentDecisions, type RejectReason } from '@/server/services/approvals';

const REASON_KEY: Record<RejectReason, MessageKey> = {
  wrong_price: 'appr.reason.wrong_price',
  wrong_item: 'appr.reason.wrong_item',
  duplicate: 'appr.reason.duplicate',
  not_sold: 'appr.reason.not_sold',
  other: 'appr.reason.other',
};

async function Approvals() {
  await requireAdmin();
  const [t, locale, db] = await Promise.all([getT(), getLocale(), requestDb()]);
  const [days, count, recent] = await Promise.all([pendingForOwner(db, STORE_ID), pendingCount(db, STORE_ID), recentDecisions(db, STORE_ID, 50)]);
  return (
    <>
      <ApprovalsScreen days={days} total={count.total} />
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('appr.recent.title')}</h2>
        {recent.length === 0 ? (
          <p className={`text-sm ${muted}`}>{t('appr.recent.none')}</p>
        ) : (
          <ul data-testid="recent-decisions" className={`${card} divide-y divide-zinc-200 p-0 text-sm dark:divide-zinc-800`}>
            {recent.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-3 py-2">
                <span className="min-w-0">
                  <span
                    className={`mr-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                      d.decision === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                    }`}
                  >
                    {t(d.decision === 'approved' ? 'appr.status.approved' : 'appr.status.rejected')}
                  </span>
                  {d.saleId ? t('appr.recent.sale', { name: d.saleName ?? '' }) : t('appr.recent.exchange')}
                  {d.saleManual && <span className={`ml-1 text-xs ${muted}`}>({t('appr.byHand')})</span>}
                  {d.reason && <span className={`ml-1 ${muted}`}>· {t(REASON_KEY[d.reason])}</span>}
                  {d.note && <span className="block italic">{d.note}</span>}
                  <span className={`block text-xs ${muted}`}>
                    {formatDate(locale, d.at, 'dateTime')} · {d.decidedBy}
                  </span>
                </span>
                {d.saleTotalPaise !== null && <span className="tabular-nums">{formatPaise(d.saleTotalPaise)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default async function ApprovalsPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t('appr.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('appr.subtitle')}</p>
        <FirstTimeTip id="approvals" text={t('appr.tip')} helpHref="/guide#approve" />
      </div>
      <Suspense fallback={<p className={`text-sm ${muted}`}>{t('common.loading')}</p>}>
        <Approvals />
      </Suspense>
    </main>
  );
}
