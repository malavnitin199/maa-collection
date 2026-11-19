import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { IconChevron, IconPrint } from '@/components/ui/icons';
import { card, link, muted, primaryButton } from '@/components/ui/styles';
import { ItemTabs } from '@/features/catalog/item-parts';
import { SupplierForm } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import { formatDate, plural, type Locale, type T } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';
import { sectionName, typeLabel } from '@/lib/sections';
import { updateSupplierAction } from '@/server/actions/admin';
import { requirePermission } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { getSupplier } from '@/server/services/catalog';
import { companyReport, type CompanyReport } from '@/server/services/company';
import { listProducts } from '@/server/services/products';

const monthName = (locale: Locale, month: string) =>
  new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
const dayName = (locale: Locale, day: string) => formatDate(locale, `${day}T00:00:00Z`, 'date');

/** A row's share of the largest, as a bar (by amount, or by pieces when amounts are hidden). */
function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-brand-50 dark:bg-brand-950">
      <span className="block h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${width}%` }} />
    </span>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-surface p-3 text-center shadow-sm ring-1 ring-brand-100 dark:ring-brand-900">
      <span data-testid={testId} className="text-xl font-bold tabular-nums">
        {value}
      </span>
      <span className={`text-[11px] font-semibold tracking-wide uppercase ${muted}`}>{label}</span>
    </div>
  );
}

function Bills({ report, t, locale }: { report: CompanyReport; t: T; locale: Locale }) {
  if (report.bills.length === 0) return <p className={`text-sm ${muted}`}>{t('co.noBills')}</p>;
  return (
    <ul data-testid="company-bills" className="flex flex-col gap-2">
      {report.bills.map((bill) => (
        <li key={bill.key}>
          <details className={`${card} group p-0`}>
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {dayName(locale, bill.date)} · {bill.billNumber ? t('co.bill.number', { number: bill.billNumber }) : t('co.bill.noNumber')}
                </span>
                <span className={`block text-sm ${muted}`}>
                  {plural(t, 'stk.item.count', bill.items)} · {plural(t, 'stk.item.pcs', bill.pieces)}
                </span>
              </span>
              {bill.amountPaise !== null && <span className="shrink-0 text-base font-bold tabular-nums">{formatPaise(bill.amountPaise)}</span>}
              <IconChevron className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-90" />
            </summary>
            <div className="flex flex-col gap-3 border-t border-zinc-100 px-4 pt-3 pb-4 dark:border-zinc-800">
              <ul className="flex flex-col gap-1.5 text-sm">
                {bill.lines.map((line, i) => (
                  <li key={`${line.productId}-${i}`} className="flex items-center justify-between gap-3">
                    <Link href={`/admin/products/${line.productId}`} className="min-w-0 truncate hover:underline">
                      {line.name} · {line.size} · {line.color}
                      <span className={`ml-1 text-xs ${muted}`}>{typeLabel({ name: line.type }, sectionName(line.section, t))}</span>
                    </Link>
                    <span className="shrink-0 tabular-nums">
                      {plural(t, 'stk.item.pcs', line.pieces)}
                      {line.amountPaise !== null && <span className={`ml-2 ${muted}`}>{formatPaise(line.amountPaise)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {bill.receiptIds.map((receiptId, i) => (
                  <Link
                    key={receiptId}
                    href={`/admin/labels/print?receipt=${receiptId}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 active:scale-95 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950"
                  >
                    <IconPrint className="h-4 w-4" />
                    {bill.receiptIds.length > 1 ? t('co.bill.printPart', { n: i + 1 }) : t('co.bill.print')}
                  </Link>
                ))}
              </div>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

function Months({ report, t, locale }: { report: CompanyReport; t: T; locale: Locale }) {
  if (report.months.length === 0) return <p className={`text-sm ${muted}`}>{t('co.noBills')}</p>;
  const size = (m: CompanyReport['months'][number]) => m.amountPaise ?? m.pieces;
  const max = Math.max(...report.months.map(size));
  return (
    <ul data-testid="company-months" className="flex flex-col gap-2">
      {report.months.map((m) => (
        <li key={m.month} className={`${card} flex flex-col gap-2 py-3`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{monthName(locale, m.month)}</span>
            {m.amountPaise !== null && <span className="font-bold tabular-nums">{formatPaise(m.amountPaise)}</span>}
          </div>
          <Bar value={size(m)} max={max} />
          <span className={`text-sm ${muted}`}>
            {plural(t, 'co.bills', m.bills)} · {plural(t, 'stk.item.count', m.items)} · {plural(t, 'stk.item.pcs', m.pieces)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Categories({ report, t }: { report: CompanyReport; t: T }) {
  if (report.types.length === 0) return <p className={`text-sm ${muted}`}>{t('co.noBills')}</p>;
  const size = (row: CompanyReport['types'][number]) => row.amountPaise ?? row.pieces;
  const max = Math.max(...report.types.map(size));
  return (
    <ul data-testid="company-categories" className="flex flex-col gap-2">
      {report.types.map((row) => (
        <li key={`${row.section}-${row.type}`} className={`${card} flex flex-col gap-2 py-3`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{typeLabel({ name: row.type }, sectionName(row.section, t))}</span>
            {row.amountPaise !== null && <span className="font-bold tabular-nums">{formatPaise(row.amountPaise)}</span>}
          </div>
          <Bar value={size(row)} max={max} />
          <span className={`text-sm ${muted}`}>
            {plural(t, 'stk.item.count', row.items)} · {plural(t, 'stk.item.pcs', row.pieces)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A company (plan v19): who they are, everything bought from them — number of
 * bills, items, pieces and the bills' amount (purchase price right only) —
 * then Bills (tap one: its items, print its tags), Months and Categories.
 */
async function SupplierDetail({ params }: { params: Promise<{ id: string }> }) {
  const [me, t, locale] = await Promise.all([requirePermission('catalog'), getT(), getLocale()]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await requestDb();
  const supplier = await getSupplier(db, STORE_ID, id);
  if (!supplier) notFound();
  const amounts = can(me, 'costs');
  const [report, items] = await Promise.all([companyReport(db, STORE_ID, id, { amounts }), listProducts(db, STORE_ID, { supplierId: id })]);
  const stock = items.reduce((n, p) => n + p.stock, 0);
  const initials = supplier.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  const itemsTab = (
    <div className={`${card} flex flex-col gap-2`}>
      <p className="text-sm">{t('cat.productsInStock', { products: items.length, pcs: stock })}</p>
      {items.length === 0 ? (
        <p className={`text-sm ${muted}`}>{t('cat.sup.noneYet')}</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href={`/admin/products?supplier=${supplier.id}`} className={`text-sm ${link}`}>
            {t('cat.sup.viewAll', { n: items.length })}
          </Link>
          <Link href={`/admin/labels?supplier=${supplier.id}&group=delivery`} className={`text-sm ${link}`}>
            {t('stk.lib.companyTags')}
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <main className="flex flex-col gap-5">
      <Link href="/admin/suppliers" className={`text-sm ${link}`}>
        {t('cat.backSuppliers')}
      </Link>
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-md">
          {initials || '?'}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-semibold">{supplier.name}</h1>
          <p className={`text-sm ${muted}`}>
            {[supplier.contactName].filter(Boolean).join(' · ')}
            {supplier.contactName && supplier.phone && ' · '}
            {supplier.phone && (
              <a href={`tel:${supplier.phone.replace(/\s/g, '')}`} className={link}>
                {t('cat.sup.call', { phone: supplier.phone })}
              </a>
            )}
          </p>
        </div>
      </div>

      <div className={`grid gap-2 ${amounts ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <Stat label={t('co.stat.bills')} value={String(report.totals.bills)} testId="company-bills-count" />
        <Stat label={t('co.stat.items')} value={String(report.totals.items)} testId="company-items-count" />
        <Stat label={t('co.stat.pieces')} value={String(report.totals.pieces)} testId="company-pieces" />
        {report.totals.amountPaise !== null && <Stat label={t('co.stat.amount')} value={formatPaise(report.totals.amountPaise)} testId="company-amount" />}
      </div>
      {!amounts && <p className={`text-xs ${muted}`}>{t('co.amountsHidden')}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/admin/stock/new?supplier=${supplier.id}`} className={`${primaryButton} flex-1 py-3 text-center`}>
          {t('cat.sup.newItem', { name: supplier.name })}
        </Link>
        <Link
          href={`/admin/stock/receive?supplier=${supplier.id}`}
          className="flex-1 rounded-lg border border-brand-600 px-5 py-3 text-center font-medium text-brand-700 dark:text-brand-400"
        >
          {t('cat.sup.receive')}
        </Link>
      </div>

      <ItemTabs
        idPrefix="company"
        tabs={[
          { id: 'bills', label: t('co.tab.bills'), content: <Bills report={report} t={t} locale={locale} /> },
          { id: 'months', label: t('co.tab.months'), content: <Months report={report} t={t} locale={locale} />, tone: 'amber' },
          { id: 'categories', label: t('co.tab.categories'), content: <Categories report={report} t={t} />, tone: 'slate' },
          { id: 'items', label: t('co.tab.items'), content: itemsTab },
        ]}
      />

      <details className={card}>
        <summary className="cursor-pointer font-medium">{t('cat.sup.edit')}</summary>
        <div className="mt-3">
          <SupplierForm action={updateSupplierAction.bind(null, supplier.id)} initial={supplier} submitLabel={t('cat.saveChanges')} />
        </div>
      </details>
    </main>
  );
}

export default async function SupplierPage(props: PageProps<'/admin/suppliers/[id]'>) {
  const t = await getT();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{t('cat.sup.loading')}</p>}>
      <SupplierDetail params={props.params} />
    </Suspense>
  );
}
