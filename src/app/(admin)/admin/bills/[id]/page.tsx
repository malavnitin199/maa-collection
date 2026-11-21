import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { IconBack } from '@/components/ui/icons';
import { card, link, muted, sectionTitle } from '@/components/ui/styles';
import { BillForm } from '@/features/bills/bill-form';
import { BillSheet } from '@/features/bills/bill-sheet';
import { sheetParts } from '@/features/bills/sheet-parts';
import { AddCollections, DeleteBill, RemoveCollection } from '@/features/bills/bill-parts';
import { MarkPaidForm } from '@/features/catalog/company-parts';
import { STORE_ID } from '@/lib/app-config';
import { formatDate } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { addSupplierPaymentAction } from '@/server/actions/admin';
import { requirePermission } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { getBill, listCollections } from '@/server/services/bills';
import { listSuppliers } from '@/server/services/catalog';
import { shopToday } from '@/server/services/products';

const rupees = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, '');

/**
 * One bill (owner's feedback 2026-11-21): number, bill date and the day it was
 * entered, each company's amount / paid / due (Mark paid), the goods laid out
 * like the paper bill (S.N · goods · qty · rate · amount), the collections on it
 * (take one off, or + Add collections); Edit and Delete at the end.
 */
async function BillDetail({ id }: { id: string }) {
  await requirePermission('costs');
  const [t, locale, db] = await Promise.all([getT(), getLocale(), requestDb()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const bill = await getBill(db, STORE_ID, id);
  if (!bill) notFound();
  const [waiting, companies] = await Promise.all([listCollections(db, STORE_ID, { unbilled: true }), listSuppliers(db, STORE_ID)]);
  const today = shopToday();
  const day = (value: string) => formatDate(locale, `${value}T00:00:00+05:30`, 'date');
  const label = [bill.billNumber ? t('cat.bill', { number: bill.billNumber }) : null, day(bill.billDate)].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-4">
      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{label}</h1>
            <p className={`text-xs ${muted}`}>{t('bills.entered', { date: day(bill.createdOn) })}</p>
          </div>
          <div className="shrink-0 text-right">
            <p data-testid="bill-detail-total" className="text-xl font-bold tabular-nums">
              {formatPaise(bill.totalPaise)}
            </p>
            <p className={`text-xs font-semibold ${bill.status === 'open' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {bill.status === 'open' ? t('bills.status.open', { amount: formatPaise(bill.duePaise) }) : t('bills.status.paid')}
            </p>
          </div>
        </div>
        <table data-testid="bill-companies" className="w-full text-sm">
          <thead className={`text-left text-xs ${muted}`}>
            <tr>
              <th className="py-1 font-medium">{t('bills.colCompany')}</th>
              <th className="py-1 text-right font-medium">{t('bills.colAmount')}</th>
              <th className="py-1 text-right font-medium">{t('bills.colDue')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {bill.companies.map((c) => (
              <tr key={c.supplierId} className="border-t border-zinc-100 align-top dark:border-zinc-900">
                <td className="py-2">
                  {c.deleted ? (
                    <span>
                      {c.name} <span className={`text-xs ${muted}`}>{t('bills.companyDeleted')}</span>
                    </span>
                  ) : (
                    <Link href={`/admin/suppliers/${c.supplierId}`} className={link}>
                      {c.name}
                    </Link>
                  )}
                  {c.paidPaise > 0 && <span className={`block text-xs ${muted}`}>{t('bills.paid', { amount: formatPaise(c.paidPaise) })}</span>}
                </td>
                <td className="py-2 text-right">{formatPaise(c.amountPaise)}</td>
                <td className="py-2 text-right">
                  {c.duePaise > 0 ? (
                    <span className="flex flex-col items-end gap-1">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">{formatPaise(c.duePaise)}</span>
                      <MarkPaidForm action={addSupplierPaymentAction.bind(null, c.supplierId)} billId={bill.id} billLabel={label} dueRupees={rupees(c.duePaise)} today={today} />
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-300">{t('bills.status.paid')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bill.note && <p className={`text-sm ${muted}`}>{bill.note}</p>}
      </section>

      {bill.list.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={sectionTitle}>{t('bills.sheet.title')}</h2>
          <BillSheet parts={sheetParts(bill.companies.map((c) => ({ id: c.supplierId, name: c.name })), bill.list)} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('bills.collections')}</h2>
        <p data-testid="bill-value" className="text-sm">
          {t('bills.picked', { n: bill.collections, pcs: bill.pieces, value: formatPaise(bill.valuePaise) })}
        </p>
        {bill.list.length > 0 && (
          <ul data-testid="bill-collection-list" className="flex flex-col gap-2">
            {bill.list.map((c) => (
              <li key={c.receiptId} className={`${card} flex items-start justify-between gap-3 px-3.5 py-3 text-sm`}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.names.join(', ')}</span>
                  <span className={`block text-xs ${muted}`}>{[c.supplierName, day(c.date), c.refNumber ? t('bills.ref', { ref: c.refNumber }) : null].filter(Boolean).join(' · ')}</span>
                  <span className={`block text-xs ${muted}`}>{t('bills.collectionLine', { sizes: c.sizes.join(' '), pcs: c.pieces })}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-semibold tabular-nums">{formatPaise(c.valuePaise)}</span>
                  <RemoveCollection billId={bill.id} receiptId={c.receiptId} name={c.names.join(', ')} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <AddCollections billId={bill.id} collections={waiting} companies={bill.companies.map((c) => ({ id: c.supplierId, name: c.name }))} />
      </section>

      <details className={card}>
        <summary className="cursor-pointer font-medium">{t('bills.editTitle')}</summary>
        <div className="mt-3">
          <BillForm
            billId={bill.id}
            suppliers={companies.filter((c) => c.active).map(({ id: sid, name }) => ({ id: sid, name }))}
            previous={companies.filter((c) => !c.active).map(({ id: sid, name }) => ({ id: sid, name }))}
            today={today}
            initial={{
              billNumber: bill.billNumber ?? '',
              billDate: bill.billDate,
              note: bill.note ?? '',
              companies: bill.companies.map((c) => ({ id: c.supplierId, name: c.name })),
            }}
          />
        </div>
      </details>
      {!bill.hasPayments && <DeleteBill billId={bill.id} />}
    </div>
  );
}

export default async function BillPage(props: PageProps<'/admin/bills/[id]'>) {
  const t = await getT();
  const { id } = await props.params;
  return (
    <main className="flex flex-col gap-3">
      <Link href="/admin/bills" className={`flex items-center gap-1 text-sm ${link}`}>
        <IconBack className="h-4 w-4" />
        {t('bills.back')}
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <BillDetail id={id} />
      </Suspense>
    </main>
  );
}
