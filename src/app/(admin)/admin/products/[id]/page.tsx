import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { card, link, muted, okBox, sectionTitle } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { BarcodeLabel } from '@/features/catalog/barcode-label';
import { PrintButton } from '@/features/catalog/print-button';
import { ProductForm } from '@/features/catalog/product-form';
import { StockInForm } from '@/features/catalog/small-forms';
import { STORE_ID } from '@/lib/app-config';
import { stockInAction, updateProductAction } from '@/server/actions/admin';
import { requireAdmin } from '@/server/auth';
import { getProduct, listMovements, listProducts } from '@/server/services/products';

const REASONS: Record<string, string> = {
  opening: 'Opening stock',
  stock_in: 'Stock received',
  sale: 'Sold',
  exchange_return: 'Exchange — returned',
  exchange_issue: 'Exchange — given out',
};
const time = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const rupees = (paise: number | null) => (paise === null ? '' : (paise / 100).toString());

async function ProductDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await requestDb();
  const product = await getProduct(db, STORE_ID, id);
  if (!product) notFound();
  const [movements, all] = await Promise.all([listMovements(db, STORE_ID, id), listProducts(db, STORE_ID)]);
  const categories = [...new Set(all.map((p) => p.category))].sort();

  return (
    <main className="flex flex-col gap-6">
      <Link href="/admin/products" className={`text-sm ${link} print:hidden`}>
        ← Products
      </Link>
      {created && (
        <p role="status" className={`${okBox} print:hidden`}>
          Product added. SKU <span className="font-mono">{product.sku}</span>, barcode{' '}
          <span className="font-mono">{product.barcode}</span>. Print the label below and stick it on the item.
        </p>
      )}
      <div className="flex flex-wrap items-start gap-6">
        <div className="w-64">
          <BarcodeLabel product={product} />
        </div>
        <div className="flex flex-col gap-2 print:hidden">
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className={`text-sm ${muted}`}>
            {product.brand} · {product.category} · {product.size} · {product.color}
          </p>
          <p data-testid="product-stock" className="text-lg font-semibold">
            {product.stock} in stock
          </p>
          <PrintButton label="Print label" />
        </div>
      </div>

      <section className={`${card} flex flex-col gap-3 print:hidden`}>
        <h2 className={sectionTitle}>Receive stock</h2>
        <StockInForm action={stockInAction.bind(null, product.id)} />
      </section>

      <section className={`${card} flex flex-col gap-3 print:hidden`}>
        <h2 className={sectionTitle}>Edit details and prices</h2>
        <ProductForm
          mode="edit"
          action={updateProductAction.bind(null, product.id)}
          categories={categories}
          initial={{
            name: product.name,
            brand: product.brand,
            category: product.category,
            size: product.size,
            color: product.color,
            mrp: rupees(product.mrpPaise),
            price: rupees(product.pricePaise),
            cost: rupees(product.costPaise),
            active: product.active,
          }}
        />
      </section>

      <section className="flex flex-col gap-2 print:hidden">
        <h2 className={sectionTitle}>Stock history</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {movements.map((m) => (
            <li key={m.id} className="flex justify-between gap-2 border-b border-zinc-100 py-1 dark:border-zinc-900">
              <span>
                {REASONS[m.reason] ?? m.reason}
                <span className={`block text-xs ${muted}`}>
                  {time.format(m.createdAt)}
                  {m.staffName && ` · ${m.staffName}`}
                  {m.note && ` · ${m.note}`}
                </span>
              </span>
              <span className={`font-medium tabular-nums ${m.quantityChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700'}`}>
                {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default function ProductPage(props: PageProps<'/admin/products/[id]'>) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading product…</p>}>
      <ProductDetail params={props.params} searchParams={props.searchParams as Promise<{ created?: string }>} />
    </Suspense>
  );
}
