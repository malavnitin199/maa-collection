import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fragment, Suspense } from 'react';
import { card, link, muted, okBox, sectionTitle } from '@/components/ui/styles';
import { HangTag } from '@/features/catalog/hang-tag';
import { PrintButton } from '@/features/catalog/print-button';
import { ProductForm } from '@/features/catalog/product-form';
import { DesignRatesForm, StockInForm } from '@/features/catalog/small-forms';
import { LOW_STOCK_THRESHOLD, STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { stockInAction, updateDesignRatesAction, updateProductAction } from '@/server/actions/admin';
import type { MessageKey } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { itemLink } from '@/lib/item-link';
import { tagSizeRange } from '@/lib/size-lists';
import { designSizesById, splitDesignRates } from '@/lib/size-prices';
import { appOrigin } from '@/server/app-origin';
import { requireAnyPermission } from '@/server/auth';
import { getT, getLocale } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';
import { getProduct, listDesignVariants, listMovements } from '@/server/services/products';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';
import { imageSrc, listProductImages } from '@/server/services/images';
import { PhotoManager } from '@/features/catalog/photo-manager';
import { formatDate } from '@/lib/i18n';

const REASONS: Record<string, MessageKey> = {
  opening: 'cat.reason.opening',
  stock_in: 'cat.reason.stockIn',
  sale: 'cat.reason.sale',
  exchange_return: 'cat.reason.exchangeReturn',
  exchange_issue: 'cat.reason.exchangeIssue',
  cleared: 'cat.reason.cleared',
};
const rupees = (paise: number | null) => (paise === null ? '' : (paise / 100).toString());
/** A translated sentence with its `{name}` parts drawn by `part` (e.g. as a link or in a code font). */
const withParts = (text: string, part: (name: string) => React.ReactNode) =>
  text.split(/\{(\w+)\}/).map((piece, i) => (i % 2 ? <Fragment key={i}>{part(piece)}</Fragment> : piece));

async function ProductDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'prices', 'stock']), getT()]);
  const locale = await getLocale();
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await requestDb();
  const product = await getProduct(db, STORE_ID, id);
  if (!product) notFound();
  const [movements, variants, categoryRows, supplierRows, settings, photos, origin] = await Promise.all([
    listMovements(db, STORE_ID, id),
    listDesignVariants(db, STORE_ID, id),
    listCategories(db, STORE_ID),
    listSuppliers(db, STORE_ID),
    getStoreSettings(db, STORE_ID),
    listProductImages(db, STORE_ID, id),
    appOrigin(),
  ]);
  const supplier = supplierRows.find((s) => s.id === product.supplierId);
  // Today's rates as a default + each size's own; purchase prices only with the "costs" right.
  const showCost = can(me, 'costs');
  const rates = splitDesignRates(
    variants.map((v) => ({ size: v.size, mrpPaise: v.mrpPaise, pricePaise: v.pricePaise, costPaise: showCost ? v.costPaise : null })),
  );

  return (
    <main className="flex flex-col gap-5">
      <Link href="/admin/products" className={`text-sm ${link} print:hidden`}>
        {t('cat.backProducts')}
      </Link>
      {created && (
        <p role="status" className={`${okBox} print:hidden`}>
          {withParts(t('cat.product.added'), (name) => (
            <span className="font-mono">{name === 'sku' ? product.sku : product.barcode}</span>
          ))}
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="mx-auto sm:mx-0">
          <HangTag
            product={product}
            sizes={tagSizeRange(categoryRows.find((c) => c.id === product.categoryId)?.sizes ?? [], designSizesById(variants).get(product.id) ?? [], product.size)}
            qrValue={itemLink(origin, product.barcode)}
            priceCode={labelPriceCode(settings, product.costPaise)}
          />
        </div>
        <div className="flex flex-col gap-1 print:hidden">
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className={`text-sm ${muted}`}>
            {product.color} · {product.size} · {product.category} · {product.brand}
            {!product.active && ` · ${t('cat.inactive')}`}
          </p>
          {supplier && (
            <p className="text-sm">
              {withParts(t('cat.product.from'), () => (
                <Link href={`/admin/suppliers/${supplier.id}`} className={link}>
                  {supplier.name}
                </Link>
              ))}
            </p>
          )}
          <p className="text-sm">
            {formatPaise(product.pricePaise)} <span className={muted}>· MRP {formatPaise(product.mrpPaise)}</span>
            {can(me, 'costs') && product.costPaise !== null && (
              <span className={muted}> · {t('cat.purchase', { amount: formatPaise(product.costPaise) })}</span>
            )}
          </p>
          <p data-testid="product-stock" className="text-lg font-semibold">
            {t('cat.product.inStock', { n: product.stock })}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <PrintButton label={t('cat.product.printLabel')} />
            {can(me, 'stock') && (
            <Link
              href={`/admin/stock/receive${supplier ? `?supplier=${supplier.id}` : ''}`}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              {t('cat.product.restock')}
            </Link>
            )}
          </div>
        </div>
      </div>

      <section className={`${card} flex flex-col gap-3 print:hidden`}>
        <h2 className={sectionTitle}>{t('cat.product.photos')}</h2>
        <PhotoManager productId={product.id} photos={photos.map((p) => ({ id: p.id, src: imageSrc(p) }))} canEdit={can(me, 'catalog')} />
      </section>

      {variants.length > 1 && (
        <section className={`${card} flex flex-col gap-2 print:hidden`}>
          <h2 className={sectionTitle}>{t('cat.product.designVariants', { n: variants.length })}</h2>
          <ul data-testid="design-variants" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {variants.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/admin/products/${v.id}`}
                  aria-current={v.id === product.id ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                    v.id === product.id ? 'border-brand-600 bg-brand-50 dark:bg-brand-950' : 'border-zinc-200 dark:border-zinc-800'
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
        <h2 className={sectionTitle}>{t(variants.length > 1 ? 'cat.rates.titleDesign' : 'cat.rates.title')}</h2>
        <DesignRatesForm
          action={updateDesignRatesAction.bind(null, product.id)}
          count={variants.length}
          showCost={showCost}
          initial={{ mrp: rupees(rates.defaults.mrpPaise), price: rupees(rates.defaults.pricePaise), cost: rupees(rates.defaults.costPaise) }}
          sizes={rates.sizes}
          initialOwn={Object.fromEntries(
            rates.own.map((o) => [o.size, { mrp: rupees(o.mrpPaise ?? null), price: rupees(o.pricePaise ?? null), cost: rupees(o.costPaise ?? null) }]),
          )}
          mixedSizes={rates.mixedSizes}
        />
        <p className={`text-xs ${muted}`}>
          {rates.sizes.length > 1 ? `${t('cat.rates.sameBySize')} ` : ''}
          {t('cat.rates.pastSales')}
        </p>
      </section>
      )}

      {can(me, 'stock') && (
        <section className={`${card} flex flex-col gap-3 print:hidden`}>
          <h2 className={sectionTitle}>{t('cat.product.receiveTitle')}</h2>
          <StockInForm action={stockInAction.bind(null, product.id)} />
        </section>
      )}

      {can(me, 'catalog') && (
      <details className={`${card} print:hidden`}>
        <summary className="cursor-pointer font-medium">{t('cat.product.editDetails')}</summary>
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
          {!can(me, 'prices') && <p className={`mt-2 text-xs ${muted}`}>{t('cat.product.noPricesRight')}</p>}
        </div>
      </details>
      )}

      <section className="flex flex-col gap-2 print:hidden">
        <h2 className={sectionTitle}>{t('cat.product.history')}</h2>
        <ul data-testid="stock-history" className="flex flex-col gap-1 text-sm">
          {movements.map((m) => (
            <li key={m.id} className="flex justify-between gap-2 border-b border-zinc-100 py-1 dark:border-zinc-900">
              <span>
                {REASONS[m.reason] ? t(REASONS[m.reason]) : m.reason}
                {m.supplierName && ` · ${m.supplierName}`}
                {m.billNumber && ` · ${t('cat.bill', { number: m.billNumber })}`}
                <span className={`block text-xs ${muted}`}>
                  {formatDate(locale, m.createdAt, 'dateTime')}
                  {m.staffName && ` · ${m.staffName}`}
                  {m.note && ` · ${m.note}`}
                </span>
              </span>
              <span className={`font-medium tabular-nums ${m.quantityChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-brand-700'}`}>
                {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default async function ProductPage(props: PageProps<'/admin/products/[id]'>) {
  const t = await getT();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{t('cat.product.loading')}</p>}>
      <ProductDetail params={props.params} searchParams={props.searchParams as Promise<{ created?: string }>} />
    </Suspense>
  );
}
