import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { card, link, muted, okBox, sectionTitle } from '@/components/ui/styles';
import { BarcodeLabel } from '@/features/catalog/barcode-label';
import { PrintButton } from '@/features/catalog/print-button';
import { ProductForm } from '@/features/catalog/product-form';
import { DesignRatesForm, StockInForm } from '@/features/catalog/small-forms';
import { LOW_STOCK_THRESHOLD, STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { stockInAction, updateDesignRatesAction, updateProductAction } from '@/server/actions/admin';
import { can } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';
import { getProduct, listDesignVariants, listMovements } from '@/server/services/products';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';
import { imageSrc, listProductImages } from '@/server/services/images';
import { PhotoManager } from '@/features/catalog/photo-manager';

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
  const me = await requireAnyPermission(['catalog', 'prices', 'stock']);
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await requestDb();
  const product = await getProduct(db, STORE_ID, id);
  if (!product) notFound();
  const [movements, variants, categoryRows, supplierRows, settings, photos] = await Promise.all([
    listMovements(db, STORE_ID, id),
    listDesignVariants(db, STORE_ID, id),
    listCategories(db, STORE_ID),
    listSuppliers(db, STORE_ID),
    getStoreSettings(db, STORE_ID),
    listProductImages(db, STORE_ID, id),
  ]);
  const supplier = supplierRows.find((s) => s.id === product.supplierId);

  return (
    <main className="flex flex-col gap-5">
      <Link href="/admin/products" className={`text-sm ${link} print:hidden`}>
        ← Products
      </Link>
      {created && (
        <p role="status" className={`${okBox} print:hidden`}>
          Product added. SKU <span className="font-mono">{product.sku}</span>, barcode{' '}
          <span className="font-mono">{product.barcode}</span>. Print the label below and stick it on the item.
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="mx-auto w-60 sm:mx-0">
          <BarcodeLabel product={product} priceCode={labelPriceCode(settings, product.costPaise)} />
        </div>
        <div className="flex flex-col gap-1 print:hidden">
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className={`text-sm ${muted}`}>
            {product.color} · {product.size} · {product.category} · {product.brand}
            {!product.active && ' · inactive'}
          </p>
          {supplier && (
            <p className="text-sm">
              From{' '}
              <Link href={`/admin/suppliers/${supplier.id}`} className={link}>
                {supplier.name}
              </Link>
            </p>
          )}
          <p className="text-sm">
            {formatPaise(product.pricePaise)} <span className={muted}>· MRP {formatPaise(product.mrpPaise)}</span>
            {can(me, 'costs') && product.costPaise !== null && (
              <span className={muted}> · purchase {formatPaise(product.costPaise)}</span>
            )}
          </p>
          <p data-testid="product-stock" className="text-lg font-semibold">
            {product.stock} in stock
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <PrintButton label="Print label" />
            {can(me, 'stock') && (
            <Link
              href={`/admin/stock/receive${supplier ? `?supplier=${supplier.id}` : ''}`}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Restock
            </Link>
            )}
          </div>
        </div>
      </div>

      <section className={`${card} flex flex-col gap-3 print:hidden`}>
        <h2 className={sectionTitle}>Photos</h2>
        <PhotoManager productId={product.id} photos={photos.map((p) => ({ id: p.id, src: imageSrc(p) }))} canEdit={can(me, 'catalog')} />
      </section>

      {variants.length > 1 && (
        <section className={`${card} flex flex-col gap-2 print:hidden`}>
          <h2 className={sectionTitle}>This design: {variants.length} sizes / colours</h2>
          <ul data-testid="design-variants" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {variants.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/admin/products/${v.id}`}
                  aria-current={v.id === product.id ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                    v.id === product.id ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950' : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <span>
                    {v.color} · {v.size}
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      v.stock <= 0 ? 'text-red-600 dark:text-red-400' : v.stock <= LOW_STOCK_THRESHOLD ? 'text-amber-600' : ''
                    }`}
                  >
                    {v.stock}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {can(me, 'prices') && (
      <section className={`${card} flex flex-col gap-3 print:hidden`}>
        <h2 className={sectionTitle}>Rates{variants.length > 1 ? ' for the whole design' : ''}</h2>
        <DesignRatesForm
          action={updateDesignRatesAction.bind(null, product.id)}
          count={variants.length}
          showCost={can(me, 'costs')}
          initial={{ mrp: rupees(product.mrpPaise), price: rupees(product.pricePaise), cost: can(me, 'costs') ? rupees(product.costPaise) : '' }}
        />
        <p className={`text-xs ${muted}`}>Past sales keep the prices they were sold at.</p>
      </section>
      )}

      {can(me, 'stock') && (
        <section className={`${card} flex flex-col gap-3 print:hidden`}>
          <h2 className={sectionTitle}>Receive stock of this item</h2>
          <StockInForm action={stockInAction.bind(null, product.id)} />
        </section>
      )}

      {can(me, 'catalog') && (
      <details className={`${card} print:hidden`}>
        <summary className="cursor-pointer font-medium">Edit details (name, size, colour, category, supplier)</summary>
        <div className="mt-3">
          <ProductForm
            mode="edit"
            action={updateProductAction.bind(null, product.id)}
            categories={categoryRows.filter((c) => c.active || c.id === product.categoryId).map(({ id, name, code }) => ({ id, name, code }))}
            suppliers={supplierRows.filter((s) => s.active || s.id === product.supplierId).map(({ id, name }) => ({ id, name }))}
            initial={{
              name: product.name,
              brand: product.brand,
              categoryId: product.categoryId ?? '',
              supplierId: product.supplierId ?? '',
              size: product.size,
              color: product.color,
              mrp: rupees(product.mrpPaise),
              price: rupees(product.pricePaise),
              cost: can(me, 'costs') ? rupees(product.costPaise) : '',
              active: product.active,
            }}
            showCost={can(me, 'costs')}
          />
          {!can(me, 'prices') && <p className={`mt-2 text-xs ${muted}`}>Price changes here are ignored: ask the owner for the &ldquo;Prices&rdquo; right.</p>}
        </div>
      </details>
      )}

      <section className="flex flex-col gap-2 print:hidden">
        <h2 className={sectionTitle}>Stock history</h2>
        <ul data-testid="stock-history" className="flex flex-col gap-1 text-sm">
          {movements.map((m) => (
            <li key={m.id} className="flex justify-between gap-2 border-b border-zinc-100 py-1 dark:border-zinc-900">
              <span>
                {REASONS[m.reason] ?? m.reason}
                {m.supplierName && ` · ${m.supplierName}`}
                {m.billNumber && ` · bill ${m.billNumber}`}
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
