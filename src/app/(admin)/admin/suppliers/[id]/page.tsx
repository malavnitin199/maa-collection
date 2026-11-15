import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { card, link, muted, primaryButton, sectionTitle } from '@/components/ui/styles';
import { SupplierForm } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { updateSupplierAction } from '@/server/actions/admin';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { getT, getLocale } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { getSupplier, listReceipts } from '@/server/services/catalog';
import { listProducts } from '@/server/services/products';
import { formatDate } from '@/lib/i18n';


async function SupplierDetail({ params }: { params: Promise<{ id: string }> }) {
  const [me, t] = await Promise.all([requirePermission('catalog'), getT()]);
  const locale = await getLocale();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await requestDb();
  const supplier = await getSupplier(db, STORE_ID, id);
  if (!supplier) notFound();
  const [receipts, items] = await Promise.all([
    listReceipts(db, STORE_ID, { supplierId: id, limit: 20 }),
    listProducts(db, STORE_ID, { supplierId: id }),
  ]);
  const stock = items.reduce((n, p) => n + p.stock, 0);

  return (
    <main className="flex flex-col gap-5">
      <Link href="/admin/suppliers" className={`text-sm ${link}`}>
        {t('cat.backSuppliers')}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{supplier.name}</h1>
        <p className={`text-sm ${muted}`}>
          {t('cat.productsInStock', { products: items.length, pcs: stock })}
          {supplier.phone && (
            <>
              {' · '}
              <a href={`tel:${supplier.phone.replace(/\s/g, '')}`} className={link}>
                {t('cat.sup.call', { phone: supplier.phone })}
              </a>
            </>
          )}
        </p>
      </div>
      <Link href={`/admin/stock/quick?supplier=${supplier.id}`} className={`${primaryButton} py-3 text-center`}>
        {t('cat.sup.quickAdd', { name: supplier.name })}
      </Link>
      <Link
        href={`/admin/stock/new?supplier=${supplier.id}`}
        className="rounded-lg border border-brand-600 px-5 py-3 text-center font-medium text-brand-700 dark:text-brand-400"
      >
        {t('cat.sup.newDesign')}
      </Link>
      <Link
        href={`/admin/stock/receive?supplier=${supplier.id}`}
        className="rounded-lg border border-brand-600 px-5 py-3 text-center font-medium text-brand-700 dark:text-brand-400"
      >
        {t('cat.sup.receive')}
      </Link>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('cat.sup.deliveries')}</h2>
        {receipts.length === 0 ? (
          <p className={`text-sm ${muted}`}>{t('cat.sup.noDeliveries')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {receipts.map((r) => (
              <li key={r.id} className={`${card} flex items-center justify-between gap-3 py-3 text-sm`}>
                <span>
                  {formatDate(locale, r.createdAt, 'dateTime')}
                  {r.billNumber && ` · ${t('cat.bill', { number: r.billNumber })}`}
                  <span className={`block text-xs ${muted}`}>
                    {t('cat.sup.receiptLine', { lines: r.lines, units: r.units })}
                    {can(me, 'costs') && ` · ${t('cat.purchase', { amount: formatPaise(r.costValuePaise) })}`} · {t('cat.byName', { name: r.staffName })}
                  </span>
                </span>
                <Link href={`/admin/labels/print?receipt=${r.id}`} className={`shrink-0 ${link}`}>
                  {t('nav.labels')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('cat.sup.productsFrom', { name: supplier.name })}</h2>
        {items.length === 0 ? (
          <p className={`text-sm ${muted}`}>{t('cat.sup.noneYet')}</p>
        ) : (
          <Link href={`/admin/products?supplier=${supplier.id}`} className={`text-sm ${link}`}>
            {t('cat.sup.viewAll', { n: items.length })}
          </Link>
        )}
      </section>

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
