import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { card, link, muted, primaryButton, sectionTitle } from '@/components/ui/styles';
import { SupplierForm } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { updateSupplierAction } from '@/server/actions/admin';
import { requireAdmin } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { getSupplier, listReceipts } from '@/server/services/catalog';
import { listProducts } from '@/server/services/products';

const time = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

async function SupplierDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
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
        ← Suppliers
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{supplier.name}</h1>
        <p className={`text-sm ${muted}`}>
          {items.length} products · {stock} pcs in stock
          {supplier.phone && (
            <>
              {' · '}
              <a href={`tel:${supplier.phone.replace(/\s/g, '')}`} className={link}>
                Call {supplier.phone}
              </a>
            </>
          )}
        </p>
      </div>
      <Link href={`/admin/stock/quick?supplier=${supplier.id}`} className={`${primaryButton} py-3 text-center`}>
        + Quick add products from {supplier.name}
      </Link>
      <Link
        href={`/admin/stock/new?supplier=${supplier.id}`}
        className="rounded-lg border border-emerald-600 px-5 py-3 text-center font-medium text-emerald-700 dark:text-emerald-400"
      >
        + New design in sizes × colours
      </Link>
      <Link
        href={`/admin/stock/receive?supplier=${supplier.id}`}
        className="rounded-lg border border-emerald-600 px-5 py-3 text-center font-medium text-emerald-700 dark:text-emerald-400"
      >
        Receive more of existing items
      </Link>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Deliveries</h2>
        {receipts.length === 0 ? (
          <p className={`text-sm ${muted}`}>No deliveries recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {receipts.map((r) => (
              <li key={r.id} className={`${card} flex items-center justify-between gap-3 py-3 text-sm`}>
                <span>
                  {time.format(r.createdAt)}
                  {r.billNumber && ` · bill ${r.billNumber}`}
                  <span className={`block text-xs ${muted}`}>
                    {r.lines} items · {r.units} pcs · purchase {formatPaise(r.costValuePaise)} · by {r.staffName}
                  </span>
                </span>
                <Link href={`/admin/labels/print?receipt=${r.id}`} className={`shrink-0 ${link}`}>
                  Labels
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Products from {supplier.name}</h2>
        {items.length === 0 ? (
          <p className={`text-sm ${muted}`}>None yet.</p>
        ) : (
          <Link href={`/admin/products?supplier=${supplier.id}`} className={`text-sm ${link}`}>
            View all {items.length} products →
          </Link>
        )}
      </section>

      <details className={card}>
        <summary className="cursor-pointer font-medium">Edit supplier details</summary>
        <div className="mt-3">
          <SupplierForm action={updateSupplierAction.bind(null, supplier.id)} initial={supplier} submitLabel="Save changes" />
        </div>
      </details>
    </main>
  );
}

export default function SupplierPage(props: PageProps<'/admin/suppliers/[id]'>) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading supplier…</p>}>
      <SupplierDetail params={props.params} />
    </Suspense>
  );
}
