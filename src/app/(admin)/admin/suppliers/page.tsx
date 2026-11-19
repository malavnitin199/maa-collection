import Link from 'next/link';
import { Suspense } from 'react';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { SelectableItem, SelectionBar, SelectionProvider, SelectToggle } from '@/components/ui/selection';
import { CompanyBulkActions } from '@/features/catalog/bulk-actions';
import { SupplierForm } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import { createSupplierAction } from '@/server/actions/admin';
import { requirePermission } from '@/server/auth';
import { getT, getLocale } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listSuppliers } from '@/server/services/catalog';
import { companySummaries } from '@/server/services/company';
import { formatDate, plural } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';


async function AddSupplier() {
  const [, t] = await Promise.all([requirePermission('catalog'), getT()]);
  return (
    <details className={card}>
        <summary className="cursor-pointer font-medium text-brand-700 dark:text-brand-400">{t('cat.sup.addOpen')}</summary>
        <div className="mt-3">
          <SupplierForm action={createSupplierAction} submitLabel={t('cat.sup.add')} />
        </div>
      </details>
  );
}

async function SupplierList() {
  const [me, t] = await Promise.all([requirePermission('catalog'), getT()]);
  const locale = await getLocale();
  const db = await requestDb();
  // Plan v19: each company's bills, pieces, bill amount (purchase price right only) and last bill.
  const [rows, summaries] = await Promise.all([listSuppliers(db, STORE_ID), companySummaries(db, STORE_ID, { amounts: can(me, 'costs') })]);
  if (rows.length === 0) {
    return <p className={`text-sm ${muted}`}>{t('cat.sup.none')}</p>;
  }
  return (
    <SelectionProvider allIds={rows.map((s) => s.id)}>
    <div className="flex justify-end">
      <SelectToggle testId="select-companies" />
    </div>
    <ul data-testid="supplier-list" className="flex flex-col gap-2">
      {rows.map((s) => (
        <li key={s.id}>
          <SelectableItem ids={[s.id]} label={s.name}>
          <Link href={`/admin/suppliers/${s.id}`} className={`${card} flex items-center justify-between gap-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {s.name}
                {!s.active && <span className={`ml-1 text-xs font-normal ${muted}`}>{t('cat.inactiveParen')}</span>}
              </span>
              <span className={`block text-xs ${muted}`}>
                {[s.contactName, s.phone].filter(Boolean).join(' · ') || t('cat.sup.noContact')}
              </span>
              <span className={`block text-xs ${muted}`}>
                {t('cat.productsInStock', { products: s.productCount, pcs: s.stockUnits })}
              </span>
              {summaries.get(s.id) && (
                <span data-testid="company-summary" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-brand-800 dark:text-brand-300">
                  <span>{plural(t, 'co.bills', summaries.get(s.id)!.bills)}</span>
                  {summaries.get(s.id)!.amountPaise !== null && <span>· {formatPaise(summaries.get(s.id)!.amountPaise!)}</span>}
                  {summaries.get(s.id)!.lastDate && (
                    <span className={`font-normal ${muted}`}>· {t('co.list.lastBill', { date: formatDate(locale, `${summaries.get(s.id)!.lastDate}T00:00:00Z`, 'date') })}</span>
                  )}
                </span>
              )}
            </span>
            <span aria-hidden className={muted}>
              ›
            </span>
          </Link>
          </SelectableItem>
        </li>
      ))}
    </ul>
    <SelectionBar>
      <CompanyBulkActions />
    </SelectionBar>
    </SelectionProvider>
  );
}

export default async function SuppliersPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('nav.suppliers')}</h1>
        <p className={`text-sm ${muted}`}>{t('cat.sup.subtitle')}</p>
      </div>
      <Suspense fallback={null}>
        <AddSupplier />
      </Suspense>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('cat.allSuppliers')}</h2>
        <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
          <SupplierList />
        </Suspense>
      </section>
    </main>
  );
}
