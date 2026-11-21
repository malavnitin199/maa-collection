import Link from 'next/link';
import { Suspense } from 'react';
import { Paged } from '@/components/ui/paged';
import { card, muted, primaryButton } from '@/components/ui/styles';
import { STORE_ID } from '@/lib/app-config';
import { formatDate } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { requirePermission } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listBills } from '@/server/services/bills';

/**
 * Bills (owner's feedback 2026-11-21): the companies' paper bills, newest bill
 * date first, ten at a time — date · bill no. · companies · collections ·
 * total · Due / Paid. "+ New bill" on top. Money, so the purchase-price right.
 */
async function BillList() {
  await requirePermission('costs');
  const [t, locale, db] = await Promise.all([getT(), getLocale(), requestDb()]);
  const rows = await listBills(db, STORE_ID);
  const day = (value: string) => formatDate(locale, `${value}T00:00:00+05:30`, 'date');
  if (rows.length === 0) return <p className={`text-sm ${muted}`}>{t('bills.none')}</p>;
  const due = rows.reduce((n, b) => n + b.duePaise, 0);
  return (
    <div className="flex flex-col gap-2">
      <p data-testid="bills-summary" className={`text-sm ${muted}`}>
        {t('bills.summary', { n: rows.length, amount: formatPaise(due) })}
      </p>
      <Paged
        testId="bill-list"
        className="flex flex-col gap-2"
        items={rows.map((b) => (
          <li key={b.id}>
            <Link href={`/admin/bills/${b.id}`} className={`${card} flex items-center justify-between gap-3 px-3.5 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {day(b.billDate)}
                  {b.billNumber && ` · ${t('cat.bill', { number: b.billNumber })}`}
                </span>
                <span className={`block truncate text-xs ${muted}`}>{b.companies.map((c) => c.name).join(', ')}</span>
                <span className={`block text-xs ${muted}`}>{t('bills.count', { n: b.collections })}</span>
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums">
                <span className="block font-semibold">{formatPaise(b.totalPaise)}</span>
                <span className={`block text-xs ${b.status === 'open' ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {b.status === 'open' ? t('bills.status.open', { amount: formatPaise(b.duePaise) }) : t('bills.status.paid')}
                </span>
              </span>
            </Link>
          </li>
        ))}
      />
    </div>
  );
}

export default async function BillsPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('nav.bills')}</h1>
        <Link href="/admin/bills/new" className={`${primaryButton} px-4 py-1.5 text-sm`}>
          {t('bills.new')}
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <BillList />
      </Suspense>
    </main>
  );
}
