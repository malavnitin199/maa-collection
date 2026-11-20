import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { card, link, muted, primaryButton, secondaryButton, sectionTitle } from '@/components/ui/styles';
import { MarkPaidForm, PaymentForm } from '@/features/catalog/company-parts';
import { ItemTabs } from '@/features/catalog/item-parts';
import { SupplierForm } from '@/features/catalog/setup-forms';
import { StatTile } from '@/features/reports/widgets';
import { STORE_ID } from '@/lib/app-config';
import { COMPANY_PERIODS, companyPeriod, type CompanyPeriodKey } from '@/lib/company-period';
import { groupDesigns } from '@/lib/design-groups';
import { formatDate } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';
import { addSupplierPaymentAction, updateSupplierAction } from '@/server/actions/admin';
import { requirePermission } from '@/server/auth';
import { getT, getLocale } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { getSupplier } from '@/server/services/catalog';
import { companyReport, type BillStatus } from '@/server/services/company';
import { listProducts, shopToday } from '@/server/services/products';

type Search = { period?: string; from?: string; to?: string };

const PERIOD_KEY: Record<CompanyPeriodKey, MessageKey> = {
  all: 'cat.acc.period.all',
  month: 'cat.acc.period.month',
  '30d': 'cat.acc.period.30d',
  year: 'cat.acc.period.year',
  custom: 'cat.acc.period.custom',
};
const STATUS_TONE: Record<BillStatus, string> = {
  open: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  closed: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  noPrice: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
};
const rupees = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, '');

/**
 * The company page (company accounts, owner's feedback 2026-11-20): the figures
 * on top — bills (open / paid), purchases, dues now, pieces, collections, last
 * bill — for the chosen period (all time · this month · last 30 days · this
 * year · own dates); two small buttons (New item, Receive more); then top tabs
 * Bills · Payments · Products · By type · Details. Amounts and payments only
 * with the purchase-price right; dues are always all-time.
 */
async function CompanyDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [me, t] = await Promise.all([requirePermission('catalog'), getT()]);
  const locale = await getLocale();
  const [{ id }, search] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await requestDb();
  const supplier = await getSupplier(db, STORE_ID, id);
  if (!supplier) notFound();
  const today = shopToday();
  const period = companyPeriod(search, today);
  const showMoney = can(me, 'costs');
  const [report, items] = await Promise.all([
    companyReport(db, STORE_ID, id, { amounts: showMoney, period }),
    listProducts(db, STORE_ID, { supplierId: id }),
  ]);
  const designs = groupDesigns(items);
  const stock = items.reduce((n, p) => n + p.stock, 0);
  const day = (value: string) => formatDate(locale, `${value}T00:00:00+05:30`, 'date');
  const money = (paise: number | null) => (paise === null ? '—' : formatPaise(paise));
  const periodHref = (key: CompanyPeriodKey) =>
    key === 'custom' ? `/admin/suppliers/${id}?period=custom&from=${today.slice(0, 7)}-01&to=${today}` : `/admin/suppliers/${id}?period=${key}`;
  const openBills = report.bills
    .filter((bill) => bill.status === 'open' && bill.billNumber && bill.duePaise)
    .map((bill) => ({ number: bill.billNumber!, dueRupees: rupees(bill.duePaise!) }));
  const payAction = addSupplierPaymentAction.bind(null, supplier.id);
  const contactBits = [supplier.location, supplier.contactName].filter(Boolean).join(' · ');

  const billsTab = (
    <div className="flex flex-col gap-4">
      {report.bills.length === 0 ? (
        <p className={`text-sm ${muted}`}>{t('cat.acc.noBills')}</p>
      ) : (
        <ul data-testid="company-bills" className="flex flex-col gap-2">
          {report.bills.map((bill) => (
            <li key={bill.key} className={`${card} flex flex-col gap-2 py-3 text-sm`}>
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium">
                    {day(bill.date)} · {bill.billNumber ? t('cat.bill', { number: bill.billNumber }) : t('cat.acc.noNumber')}
                  </span>
                  <span className={`block text-xs ${muted}`}>
                    {t('cat.acc.billLine', { items: bill.items, pieces: bill.pieces })}
                    {bill.amountPaise !== null && ` · ${t('cat.purchase', { amount: formatPaise(bill.amountPaise) })}`}
                    {bill.estimated && bill.amountPaise !== null && ` ${t('cat.acc.estimatedMark')}`}
                  </span>
                </span>
                {showMoney && (
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[bill.status]}`}>
                    {bill.status === 'open' ? t('cat.acc.status.open', { amount: formatPaise(bill.duePaise ?? 0) }) : t(`cat.acc.status.${bill.status}`)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link href={`/admin/labels/print?receipt=${bill.receiptIds[0]}`} className={`text-xs ${link}`}>
                  {t('nav.labels')}
                </Link>
                <details className="text-xs">
                  <summary className={`cursor-pointer ${link}`}>{t('cat.acc.lines')}</summary>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {bill.lines.map((line, i) => (
                      <li key={`${line.productId}-${i}`} className="flex justify-between gap-3">
                        <Link href={`/admin/products/${line.productId}`} className={`min-w-0 truncate ${link}`}>
                          {line.name} · {line.size}
                          {line.color && ` · ${line.color}`}
                        </Link>
                        <span className="shrink-0 tabular-nums">
                          {t('own.pcs', { n: line.pieces })}
                          {line.amountPaise !== null && ` · ${formatPaise(line.amountPaise)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
                {showMoney && bill.status === 'open' && bill.billNumber && (
                  <span className="ml-auto">
                    <MarkPaidForm action={payAction} billNumber={bill.billNumber} dueRupees={rupees(bill.duePaise ?? 0)} today={today} />
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {report.months.length > 1 && (
        <section className="flex flex-col gap-1">
          <h3 className={sectionTitle}>{t('cat.acc.months')}</h3>
          <ul className="flex flex-col text-sm">
            {report.months.map((m) => (
              <li key={m.month} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-1.5 dark:border-zinc-900">
                <span>{formatDate(locale, `${m.month}-01T00:00:00+05:30`, 'month')}</span>
                <span className={`tabular-nums ${muted}`}>
                  {t('cat.acc.monthLine', { bills: m.bills, pieces: m.pieces })}
                  {m.amountPaise !== null && ` · ${formatPaise(m.amountPaise)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  const paymentsTab = (
    <div className="flex flex-col gap-4">
      {showMoney ? (
        <section className={`${card} flex flex-col gap-2`}>
          <h3 className={sectionTitle}>{t('cat.acc.pay.title')}</h3>
          <PaymentForm action={payAction} openBills={openBills} today={today} />
        </section>
      ) : (
        <p className={`text-sm ${muted}`}>{t('cat.acc.pay.needCosts')}</p>
      )}
      {report.payments.length === 0 ? (
        <p className={`text-sm ${muted}`}>{t('cat.acc.pay.none')}</p>
      ) : (
        <ul data-testid="company-payments" className="flex flex-col text-sm">
          {report.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 dark:border-zinc-900">
              <span className="min-w-0">
                <span className="font-medium">{day(p.paidOn)}</span>
                <span className={`block text-xs ${muted}`}>
                  {p.billNumber ? t('cat.acc.pay.forBill', { number: p.billNumber }) : t('cat.acc.pay.onAccount')}
                  {p.note && ` · ${p.note}`} · {t('cat.byName', { name: p.staffName })}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{showMoney ? formatPaise(p.amountPaise) : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const productsTab = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href={`/admin/products?supplier=${supplier.id}`} className={link}>
          {t('cat.sup.viewAll', { n: items.length })}
        </Link>
        <Link href={`/admin/labels?supplier=${supplier.id}&group=delivery`} className={link}>
          {t('stk.lib.companyTags')}
        </Link>
      </div>
      {designs.length === 0 ? (
        <p className={`text-sm ${muted}`}>{t('cat.sup.noneYet')}</p>
      ) : (
        <ul data-testid="company-designs" className="flex flex-col text-sm">
          {designs.map((d) => (
            <li key={d.key} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 dark:border-zinc-900">
              <span className="min-w-0">
                <Link href={`/admin/products/${d.items[0].id}`} className={`block truncate font-medium ${link}`}>
                  {d.name}
                </Link>
                <span className={`block text-xs ${muted}`}>
                  {t('cat.acc.sizes', { sizes: d.sizes.map((s) => s.size).join(', ') })} · {formatPaise(d.mrpPaise)}
                </span>
              </span>
              <span className={`shrink-0 text-xs tabular-nums ${muted}`}>{t('cat.acc.inStock', { pcs: d.pieces })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const typesTab =
    report.types.length === 0 ? (
      <p className={`text-sm ${muted}`}>{t('cat.acc.noBills')}</p>
    ) : (
      <table data-testid="company-types" className="w-full text-sm">
        <thead className={`text-left text-xs ${muted}`}>
          <tr>
            <th className="py-1 font-medium">{t('cat.acc.tab.types')}</th>
            <th className="py-1 text-right font-medium">{t('cat.acc.typeItems')}</th>
            <th className="py-1 text-right font-medium">{t('cat.acc.typePieces')}</th>
            {showMoney && <th className="py-1 text-right font-medium">{t('cat.acc.typeAmount')}</th>}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {report.types.map((row) => (
            <tr key={`${row.section}-${row.type}`} className="border-t border-zinc-100 dark:border-zinc-900">
              <td className="py-1.5">
                {row.section && <span className={muted}>{row.section} › </span>}
                {row.type}
              </td>
              <td className="py-1.5 text-right">{row.items}</td>
              <td className="py-1.5 text-right">{row.pieces}</td>
              {showMoney && <td className="py-1.5 text-right">{money(row.amountPaise)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    );

  const detailsTab = (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {[
          [t('cat.supf.contact'), supplier.contactName],
          [t('cat.supf.phone'), supplier.phone],
          [t('cat.supf.location'), supplier.location],
          [t('cat.supf.gstin'), supplier.gstin],
          [t('cat.supf.notes'), supplier.notes],
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className={muted}>{String(label).replace(/\s*\(.*\)$/, '')}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
      </dl>
      {!supplier.contactName && !supplier.phone && !supplier.location && !supplier.gstin && !supplier.notes && (
        <p className={`text-sm ${muted}`}>{t('cat.acc.noDetails')}</p>
      )}
      <details className={card}>
        <summary className="cursor-pointer font-medium">{t('cat.sup.edit')}</summary>
        <div className="mt-3">
          <SupplierForm action={updateSupplierAction.bind(null, supplier.id)} initial={supplier} submitLabel={t('cat.saveChanges')} />
        </div>
      </details>
    </div>
  );

  return (
    <main className="flex flex-col gap-4">
      <Link href="/admin/suppliers" className={`text-sm ${link}`}>
        {t('cat.backSuppliers')}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{supplier.name}</h1>
        <p className={`text-sm ${muted}`}>
          {contactBits}
          {supplier.phone && (
            <>
              {contactBits && ' · '}
              <a href={`tel:${supplier.phone.replace(/\s/g, '')}`} className={link}>
                {t('cat.sup.call', { phone: supplier.phone })}
              </a>
            </>
          )}
          {!contactBits && !supplier.phone && t('cat.productsInStock', { products: items.length, pcs: stock })}
        </p>
      </div>

      <nav aria-label={t('own.period')} className="flex flex-wrap gap-2 text-sm">
        {COMPANY_PERIODS.map((key) => (
          <Link
            key={key}
            href={periodHref(key)}
            aria-current={key === period.key ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 ${key === period.key ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
          >
            {t(PERIOD_KEY[key])}
          </Link>
        ))}
      </nav>
      {period.key === 'custom' && (
        <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="period" value="custom" />
          <label className="flex flex-col gap-1 font-medium">
            {t('cat.acc.from')}
            <input type="date" name="from" defaultValue={period.from ?? ''} max={today} className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900" />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            {t('cat.acc.to')}
            <input type="date" name="to" defaultValue={period.to ?? ''} max={today} className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900" />
          </label>
          <button type="submit" className={`${secondaryButton} py-1.5`}>
            {t('cat.acc.show')}
          </button>
        </form>
      )}

      <div data-testid="company-figures" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label={t('cat.acc.bills')}
          value={String(report.totals.bills)}
          sub={showMoney ? t('cat.acc.billsSub', { open: report.totals.openBills, closed: report.totals.closedBills }) : undefined}
          testId="company-bills-count"
        />
        {showMoney && (
          <StatTile
            label={t('cat.acc.purchases')}
            value={money(report.totals.amountPaise)}
            sub={report.totals.estimated ? t('cat.acc.estimated') : undefined}
            testId="company-purchases"
          />
        )}
        {showMoney && (
          <StatTile label={t('cat.acc.dues')} value={money(report.account.duePaise)} sub={t('cat.acc.duesSub', { amount: money(report.account.paidPaise) })} testId="company-dues" />
        )}
        <StatTile label={t('cat.acc.pieces')} value={String(report.totals.pieces)} sub={t('cat.acc.piecesSub', { items: report.totals.items })} testId="company-pieces" />
        <StatTile label={t('cat.acc.collections')} value={String(report.totals.designs)} sub={t('cat.acc.collectionsSub', { types: report.totals.types })} testId="company-collections" />
        <StatTile
          label={t('cat.acc.lastBill')}
          value={report.account.lastDate ? day(report.account.lastDate) : '—'}
          sub={report.account.firstDate ? t('cat.acc.since', { date: day(report.account.firstDate) }) : undefined}
        />
      </div>

      <div className="flex gap-2">
        <Link href={`/admin/stock/new?supplier=${supplier.id}`} aria-label={t('cat.sup.newItem', { name: supplier.name })} className={`${primaryButton} flex-1 py-2.5 text-center text-sm`}>
          {t('cat.acc.newItem')}
        </Link>
        <Link href={`/admin/stock/receive?supplier=${supplier.id}`} aria-label={t('cat.sup.receive')} className={`${secondaryButton} flex-1 py-2.5 text-sm`}>
          {t('cat.acc.receive')}
        </Link>
      </div>

      <ItemTabs
        idPrefix="company"
        tabs={[
          { id: 'bills', label: t('cat.acc.tab.bills'), content: billsTab, tone: 'sky' },
          { id: 'payments', label: t('cat.acc.tab.payments'), content: paymentsTab, tone: 'amber' },
          { id: 'products', label: t('cat.acc.tab.products'), content: productsTab, tone: 'slate' },
          { id: 'types', label: t('cat.acc.tab.types'), content: typesTab, tone: 'sky' },
          { id: 'details', label: t('cat.acc.tab.details'), content: detailsTab, tone: 'slate' },
        ]}
      />
    </main>
  );
}

export default async function SupplierPage(props: PageProps<'/admin/suppliers/[id]'>) {
  const t = await getT();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{t('cat.sup.loading')}</p>}>
      <CompanyDetail params={props.params} searchParams={props.searchParams as Promise<Search>} />
    </Suspense>
  );
}
