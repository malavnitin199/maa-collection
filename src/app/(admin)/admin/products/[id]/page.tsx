import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fragment, Suspense } from 'react';
import { GarmentArt } from '@/components/ui/art';
import { Pill } from '@/components/ui/pill';
import { card, link, muted, okBox, sectionTitle } from '@/components/ui/styles';
import { HangTag } from '@/features/catalog/hang-tag';
import { DesignTagsForm, ItemTabs } from '@/features/catalog/item-parts';
import { PrintButton } from '@/features/catalog/print-button';
import { ProductForm } from '@/features/catalog/product-form';
import { DesignRatesForm, StockInForm } from '@/features/catalog/small-forms';
import { LOW_STOCK_THRESHOLD, STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { stockInAction, updateDesignRatesAction, updateDesignTagsAction, updateProductAction } from '@/server/actions/admin';
import type { MessageKey } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { itemLink } from '@/lib/item-link';
import { AGE_LABEL, asAgeGroup, asForGender, FOR_LABEL } from '@/lib/product-tags';
import { tagSizeRange } from '@/lib/size-lists';
import { designSizesById, sortSizes, splitDesignRates } from '@/lib/size-prices';
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
const stockTone = (n: number) => (n <= 0 ? 'text-red-600 dark:text-red-400' : n <= LOW_STOCK_THRESHOLD ? 'text-amber-600' : '');

/** One price on the main card: small label, the amount below. */
function Price({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-brand-50/60 px-2 py-2 text-center dark:bg-zinc-900">
      <p className={`truncate text-xs ${muted}`}>{label}</p>
      <p className="truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * The product page (plan v17, owner's layout): a header with the name and small
 * tags (sizes, category, who it is for) on the left and the photo on the right;
 * the must-haves (company, sale price, purchase price, pieces); then top tabs —
 * Details (tag, rates, receive, history), Colours (every colour × size with its
 * pieces, photos) and Other details (tags, edit). Same actions as before.
 */
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
  const forGender = asForGender(product.forGender);
  const ageGroup = asAgeGroup(product.ageGroup);
  const designSizes = sortSizes([...new Set(variants.map((v) => v.size))]);
  const designColours = [...new Set(variants.map((v) => v.color))];
  const totalPieces = variants.reduce((n, v) => n + v.stock, 0);
  const mainPhoto = photos[0];

  const details = (
    <div className="flex flex-col gap-4">
      <div className="mx-auto">
        <HangTag
          product={product}
          sizes={tagSizeRange(categoryRows.find((c) => c.id === product.categoryId)?.sizes ?? [], designSizesById(variants).get(product.id) ?? [], product.size)}
          qrValue={itemLink(origin, product.barcode)}
          priceCode={labelPriceCode(settings, product.costPaise)}
        />
      </div>

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
    </div>
  );

  const colours = (
    <div className="flex flex-col gap-4 print:hidden">
      {/* Every colour × size of this design and its pieces; tap one to open it. */}
      <section className={`${card} flex flex-col gap-2`}>
        <div className="overflow-x-auto">
          <table data-testid="design-variants" aria-label={t('cat.product.grid')} className="w-full text-center text-sm tabular-nums">
            <thead className={`text-xs ${muted}`}>
              <tr>
                <th className="px-2 py-1 text-left font-medium" />
                {designSizes.map((s) => (
                  <th key={s} className="px-2 py-1 font-medium">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {designColours.map((c) => (
                <tr key={c} className="border-t border-zinc-100 dark:border-zinc-900">
                  <th className="px-2 py-1.5 text-left font-medium">{c}</th>
                  {designSizes.map((s) => {
                    const v = variants.find((x) => x.color === c && x.size === s);
                    return (
                      <td key={s} className="px-1 py-1">
                        {v ? (
                          <Link
                            href={`/admin/products/${v.id}`}
                            aria-current={v.id === product.id ? 'page' : undefined}
                            aria-label={t('cat.product.cellAria', { color: c, size: s, n: v.stock })}
                            className={`block rounded-lg px-2 py-1.5 font-semibold ${stockTone(v.stock)} ${
                              v.id === product.id ? 'bg-brand-600 text-white dark:text-white' : 'hover:bg-brand-50 dark:hover:bg-brand-950'
                            }`}
                          >
                            {v.stock}
                          </Link>
                        ) : (
                          <span className={muted}>·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`text-xs ${muted}`}>{t(variants.length === 1 ? 'cat.product.gridTotal.one' : 'cat.product.gridTotal.other', { n: variants.length, pcs: totalPieces })}</p>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className={sectionTitle}>{t('cat.product.photos')}</h2>
        <PhotoManager productId={product.id} photos={photos.map((p) => ({ id: p.id, src: imageSrc(p) }))} canEdit={can(me, 'catalog')} />
      </section>
    </div>
  );

  const other = (
    <div className="flex flex-col gap-4 print:hidden">
      {can(me, 'catalog') ? (
        <>
          <section className={`${card} flex flex-col gap-3`}>
            <DesignTagsForm action={updateDesignTagsAction.bind(null, product.id)} initial={{ forGender, ageGroup }} count={variants.length} />
          </section>
          <section className={`${card} flex flex-col gap-3`}>
            <h2 className={sectionTitle}>{t('cat.product.editDetails')}</h2>
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
            {!can(me, 'prices') && <p className={`text-xs ${muted}`}>{t('cat.product.noPricesRight')}</p>}
          </section>
        </>
      ) : (
        <p className={`text-sm ${muted}`}>
          {product.brand} · {product.category}
        </p>
      )}
    </div>
  );

  return (
    <main className="flex flex-col gap-4">
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

      {/* Header: name and small tags on the left, the photo on the right. */}
      <section className={`${card} flex items-start gap-3 print:hidden`}>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-xl leading-tight font-semibold">{product.name}</h1>
          <p className={`text-sm ${muted}`}>
            {product.color} · {product.size} · {product.brand}
          </p>
          <div data-testid="item-pills" className="flex flex-wrap gap-1">
            {designSizes.map((s) => (
              <Pill key={s}>{s}</Pill>
            ))}
            <Pill>{product.category}</Pill>
            {forGender && <Pill strong>{t(FOR_LABEL[forGender])}</Pill>}
            {ageGroup && <Pill strong>{t(AGE_LABEL[ageGroup])}</Pill>}
            {!product.active && <Pill>{t('cat.inactive')}</Pill>}
          </div>
        </div>
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl ring-1 ring-brand-100 dark:ring-brand-900">
          {mainPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
            <img src={imageSrc(mainPhoto)} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="cloth-backdrop flex h-full w-full flex-col items-center justify-center" aria-label={t('cat.product.noPhoto')} role="img">
              <GarmentArt className="h-16 w-16 text-brand-700 dark:text-brand-300" />
            </div>
          )}
        </div>
      </section>

      {/* The must-haves: company, sale price, purchase price, pieces. */}
      <section className={`${card} flex flex-col gap-3 print:hidden`}>
        <p className="flex items-center justify-between gap-2 text-sm">
          <span className={muted}>{t('cat.product.company')}</span>
          {supplier ? (
            <Link href={`/admin/suppliers/${supplier.id}`} className={`${link} truncate font-semibold`}>
              {supplier.name}
            </Link>
          ) : (
            <span className={muted}>{t('cat.product.noCompany')}</span>
          )}
        </p>
        <div className={`grid gap-2 ${showCost && product.costPaise !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <Price label="MRP" value={formatPaise(product.mrpPaise)} />
          <Price label={t('cat.product.selling')} value={formatPaise(product.pricePaise)} />
          {showCost && product.costPaise !== null && <Price label={t('cat.product.purchaseShort')} value={formatPaise(product.costPaise)} />}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p data-testid="product-stock" className={`text-lg font-semibold ${stockTone(product.stock)}`}>
            {t('cat.product.inStock', { n: product.stock })}
          </p>
          <div className="flex flex-wrap gap-2">
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
      </section>

      <ItemTabs
        idPrefix="product"
        tabs={[
          { id: 'details', label: t('cat.tab.details'), content: details, print: true },
          { id: 'colours', label: t('cat.tab.colours'), content: colours },
          { id: 'other', label: t('cat.tab.other'), content: other },
        ]}
      />
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
