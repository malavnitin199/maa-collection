import Link from 'next/link';
import { Paged } from '@/components/ui/paged';
import { IconTag } from '@/components/ui/icons';
import { card, link, muted, sectionTitle } from '@/components/ui/styles';
import { StatTile } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import { formatDate } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';
import type { CurrentStaff } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { companiesOverview } from '@/server/services/company';

/**
 * Companies overview on Home (owner's feedback 2026-11-20), under Today: the
 * totals (companies, bills, collections, spend, dues) and one line per company
 * — location, working since (the owner's date, may be before the app) or the
 * day it was added, bills · collections · pieces, spend and dues — ten at a
 * time. Each line opens the company's page. Money only with the purchase-price
 * right (the owner always has it).
 */
export async function CompaniesOverview({ me }: { me: CurrentStaff }) {
  const [t, locale, db] = await Promise.all([getT(), getLocale(), requestDb()]);
  const showMoney = can(me, 'costs');
  const { totals, rows } = await companiesOverview(db, STORE_ID, { amounts: showMoney });
  const day = (value: string) => formatDate(locale, `${value}T00:00:00+05:30`, 'date');
  const money = (paise: number | null) => (paise === null ? '—' : formatPaise(paise));
  return (
    <section data-testid="home-companies" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className={`${sectionTitle} flex items-center gap-1.5 [&>svg]:h-4 [&>svg]:w-4`}>
          <IconTag />
          {t('own.co.title')}
        </h2>
        <span className="flex items-center gap-3 text-sm">
          <Link href="/admin/suppliers" className={link}>
            {t('own.co.all')}
          </Link>
          <Link href="/admin/suppliers#add" className={link}>
            {t('own.co.add')}
          </Link>
        </span>
      </div>
      <div data-testid="home-company-figures" className="rise-in grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label={t('own.co.companies')} value={String(totals.companies)} testId="home-companies-count" />
        <StatTile label={t('own.co.bills')} value={String(totals.bills)} sub={showMoney ? t('own.co.billsSub', { open: totals.openBills }) : undefined} testId="home-bills-count" />
        <StatTile label={t('own.co.collections')} value={String(totals.collections)} sub={t('own.co.collectionsSub', { pieces: totals.pieces })} testId="home-collections-count" />
        {showMoney && <StatTile label={t('own.co.spend')} value={money(totals.purchasesPaise)} testId="home-spend" />}
        {showMoney && <StatTile label={t('own.co.dues')} value={money(totals.duePaise)} testId="home-dues" />}
      </div>
      {rows.length === 0 ? (
        <p className={`text-sm ${muted}`}>{t('own.co.none')}</p>
      ) : (
        <Paged
          testId="home-company-rows"
          className="flex flex-col gap-2"
          items={rows.map((row) => (
            <li key={row.id}>
              <Link href={`/admin/suppliers/${row.id}`} className={`${card} flex items-center justify-between gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {row.name}
                    {!row.active && <span className={`ml-1 text-xs font-normal ${muted}`}>({t('own.co.hidden')})</span>}
                  </span>
                  <span className={`block truncate text-xs ${muted}`}>
                    {[row.location, row.workingSince ? t('own.co.since', { date: day(row.workingSince) }) : t('own.co.added', { date: day(row.addedOn) })].filter(Boolean).join(' · ')}
                  </span>
                  <span className={`block text-xs ${muted}`}>
                    {row.bills === 0 && row.collections === 0 ? t('own.co.noBills') : t('own.co.line', { bills: row.bills, collections: row.collections, pieces: row.pieces })}
                  </span>
                </span>
                {showMoney && (
                  <span className="shrink-0 text-right text-xs tabular-nums">
                    <span className="block">{t('own.co.spent', { amount: money(row.amountPaise) })}</span>
                    <span className={`block ${row.duePaise ? 'font-semibold text-amber-700 dark:text-amber-300' : muted}`}>{t('own.co.due', { amount: money(row.duePaise) })}</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        />
      )}
    </section>
  );
}
