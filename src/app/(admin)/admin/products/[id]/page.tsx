import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fragment, Suspense } from 'react';
import { GarmentArt } from '@/components/ui/art';
import { Pill } from '@/components/ui/pill';
import { card, link, muted, okBox, secondaryButton, sectionTitle } from '@/components/ui/styles';
import { HangTag } from '@/features/catalog/hang-tag';
import { DesignTagsForm, ItemTabs } from '@/features/catalog/item-parts';
import { PrintButton } from '@/features/catalog/print-button';
import { AddSizesForm } from '@/features/catalog/add-sizes-form';
import { DeleteItemButton } from '@/features/catalog/delete-products';
import { ProductForm } from '@/features/catalog/product-form';
import { DesignRatesForm, StockInForm } from '@/features/catalog/small-forms';
import { StatTile } from '@/features/reports/widgets';
import { COMPANY_PERIODS, companyPeriod, type CompanyPeriodKey } from '@/lib/company-period';
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
import { getProduct, listDesignVariants, listMovements, shopToday } from '@/server/services/products';
import { productReport } from '@/server/services/product-report';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';
import { imageSrc, listProductImages } from '@/server/services/images';
import { PhotoManager } from '@/features/catalog/photo-manager';
import { formatDate } from '@/lib/i18n';

type Search = { created?: string; period?: string; from?: string; to?: string };
const PERIOD_KEY: Record<CompanyPeriodKey, MessageKey> = {
  all: 'cat.acc.period.all',
  month: 'cat.acc.period.month',
  '30d': 'cat.acc.period.30d',
  year: 'cat.acc.period.year',
  custom: 'cat.acc.period.custom',
};
const STATUS_KEY = { approved: 'cat.prod.sales.approved', waiting: 'cat.prod.sales.waiting', rejected: 'cat.prod.sales.rejected' } as const;
const STATUS_TONE = {
  approved: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  waiting: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  rejected: 'bg-zinc-100 text-zinc-600 line-through dark:bg-zinc-800 dark:text-zinc-300',
} as const;
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

/**
 * The product page (plan v17 layout; figures and tabs from the owner's feedback
 * 2026-11-20, like the company page): a header with the name and small tags on
 * the left and the photo on the right; the design's figures for a period (in
 * stock, sold, came in, profit, last sale, last arrival); one compact row with
 * the company, the prices and the two actions; then top tabs — Details (tag,
 * rates, receive), Colours (every colour × size with its pieces, photos), Sales,
 * Purchases (arrivals, stock history) and Other details (tags, edit).
 */
async function ProductDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'prices', 'stock']), getT()]);
  const locale = await getLocale();
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const { created } = search;
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
  const today = shopToday();
  const period = companyPeriod(search, today);
  const report = await productReport(db, STORE_ID, variants.map((v) => v.id), { amounts: showCost, period });
  const day = (value: string) => formatDate(locale, `${value}T00:00:00+05:30`, 'date');
  const periodHref = (key: CompanyPeriodKey) =>
    key === 'custom' ? `/admin/products/${id}?period=custom&from=${today.slice(0, 7)}-01&to=${today}` : `/admin/products/${id}?period=${key}`;
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

      {/* Owner's feedback 2026-11-22 (ADR-054): edit and add sizes at the top, not under Other details. */}
      {can(me, 'catalog') && (
        <details data-testid="edit-item" className={`${card} group print:hidden`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
            <span>
              <span className="block font-semibold">✎ {t('cat.product.editDetails')}</span>
              <span className={`block text-xs ${muted}`}>{t('cat.product.editHint')}</span>
            </span>
            <span aria-hidden className={`transition group-open:rotate-180 ${muted}`}>▾</span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
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
          </div>
        </details>
      )}
      {can(me, 'catalog') && (
        <details data-testid="add-sizes-card" className={`${card} group print:hidden`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
            {t('cat.addSizes.title')}
            <span aria-hidden className={`transition group-open:rotate-180 ${muted}`}>▾</span>
          </summary>
          <div className="mt-3">
            <AddSizesForm
              productId={product.id}
              offered={categoryRows.find((c) => c.id === product.categoryId)?.sizes ?? []}
              existing={designSizes}
              boxes={product.packSize}
            />
          </div>
        </details>
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

  const salesTab = (
    <div className="flex flex-col gap-3 print:hidden">
      {report.sales.length === 0 ? (
        <p className={`text-sm ${muted}`}>{t('cat.prod.sales.none')}</p>
      ) : (
        <ul data-testid="product-sales" className="flex flex-col text-sm">
          {report.sales.map((sale) => (
            <li key={sale.id} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 dark:border-zinc-900">
              <span className="min-w-0">
                <span className="font-medium">
                  {formatDate(locale, sale.createdAt, 'dateTime')} · {sale.size}
                  {sale.color && ` · ${sale.color}`}
                </span>
                <span className={`block text-xs ${muted}`}>
                  {t('own.pcs', { n: sale.quantity })} × {formatPaise(sale.unitPricePaise)} · {t('cat.byName', { name: sale.soldByName })}
                  {sale.offline && ` · ${t('cat.prod.sales.offline')}`}
                  {sale.profitPaise !== null && ` · ${t(sale.profitPaise < 0 ? 'cat.prod.sales.loss' : 'cat.prod.sales.profit', { amount: formatPaise(Math.abs(sale.profitPaise)) })}`}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-semibold tabular-nums">{formatPaise(sale.totalPaise)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[sale.status]}`}>{t(STATUS_KEY[sale.status])}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const purchasesTab = (
    <div className="flex flex-col gap-4 print:hidden">
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('cat.prod.arr.title')}</h2>
        {report.arrivals.length === 0 ? (
          <p className={`text-sm ${muted}`}>{t('cat.prod.arr.none')}</p>
        ) : (
          <ul data-testid="product-arrivals" className="flex flex-col text-sm">
            {report.arrivals.map((a) => (
              <li key={a.key} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 dark:border-zinc-900">
                <span className="min-w-0">
                  <span className="font-medium">
                    {day(a.day)}
                    {a.billNumber && ` · ${t('cat.bill', { number: a.billNumber })}`}
                  </span>
                  <span className={`block text-xs ${muted}`}>
                    {t(a.reason === 'opening' ? 'cat.prod.arr.opening' : 'cat.prod.arr.stockIn')}
                    {a.supplierId && a.supplierName && (
                      <>
                        {' · '}
                        <Link href={`/admin/companies/${a.supplierId}`} className={link}>
                          {a.supplierName}
                        </Link>
                      </>
                    )}
                    {a.staffName && ` · ${t('cat.byName', { name: a.staffName })}`}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block font-semibold">{t('own.pcs', { n: a.pieces })}</span>
                  {a.amountPaise !== null && (
                    <span className={`block text-xs ${muted}`}>
                      {formatPaise(a.amountPaise)}
                      {a.estimated && ` ${t('cat.acc.estimatedMark')}`}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
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

  const other = (
    <div className="flex flex-col gap-4 print:hidden">
      {can(me, 'catalog') ? (
        <section className={`${card} flex flex-col gap-3`}>
          <DesignTagsForm action={updateDesignTagsAction.bind(null, product.id)} initial={{ forGender, ageGroup }} count={variants.length} />
        </section>
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

      {/* The design's figures for a period (owner's feedback 2026-11-20, like the company page). */}
      <nav aria-label={t('own.period')} className="flex flex-wrap gap-2 text-sm print:hidden">
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
        <form method="get" className="flex flex-wrap items-end gap-2 text-sm print:hidden">
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
      <div data-testid="product-figures" className="grid grid-cols-2 gap-3 print:hidden sm:grid-cols-3">
        <StatTile label={t('cat.prod.fig.stock')} value={String(totalPieces)} sub={t('cat.prod.fig.stockSub', { items: variants.length, n: product.stock })} testId="product-stock" />
        <StatTile
          label={t('cat.prod.fig.sold')}
          value={String(report.totals.soldPieces)}
          sub={report.totals.waiting ? t('cat.prod.fig.waiting', { n: report.totals.waiting }) : t('cat.prod.fig.soldSub', { amount: formatPaise(report.totals.revenuePaise), count: report.totals.soldCount })}
          testId="product-sold"
        />
        <StatTile
          label={t('cat.prod.fig.bought')}
          value={String(report.totals.boughtPieces)}
          sub={report.totals.purchasePaise !== null ? `${t('cat.prod.fig.boughtSub', { amount: formatPaise(report.totals.purchasePaise) })}${report.totals.estimated ? ` ${t('cat.acc.estimatedMark')}` : ''}` : undefined}
          testId="product-bought"
        />
        {showCost && (
          <StatTile label={t('cat.prod.fig.profit')} value={formatPaise(report.totals.profitPaise ?? 0)} sub={report.totals.profitPartial ? t('cat.prod.fig.profitPartial') : undefined} testId="product-profit" />
        )}
        <StatTile label={t('cat.prod.fig.lastSale')} value={report.lastSale ? day(report.lastSale.day) : '—'} sub={report.lastSale ? t('cat.byName', { name: report.lastSale.soldByName }) : t('cat.prod.fig.none')} />
        <StatTile
          label={t('cat.prod.fig.lastArrival')}
          value={report.lastArrival ? day(report.lastArrival.day) : '—'}
          sub={report.lastArrival ? [report.lastArrival.supplierName, report.lastArrival.billNumber && t('cat.bill', { number: report.lastArrival.billNumber })].filter(Boolean).join(' · ') || undefined : t('cat.prod.fig.none')}
        />
      </div>

      {/* The must-haves in one row: company, prices, the two actions. */}
      <section data-testid="product-must-haves" className={`${card} flex flex-col gap-3 print:hidden`}>
        <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          {supplier ? (
            <Link href={`/admin/companies/${supplier.id}`} className={`${link} truncate font-semibold`}>
              {supplier.name}
            </Link>
          ) : (
            <span className={muted}>{t('cat.product.noCompany')}</span>
          )}
          <span className="flex flex-wrap gap-x-3 tabular-nums">
            <span>
              <span className={muted}>MRP </span>
              <span className="font-semibold">{formatPaise(product.mrpPaise)}</span>
            </span>
            <span>
              <span className={muted}>{t('cat.product.selling')} </span>
              <span className="font-semibold">{formatPaise(product.pricePaise)}</span>
            </span>
            {showCost && product.costPaise !== null && (
              <span>
                <span className={muted}>{t('cat.product.purchaseShort')} </span>
                <span className="font-semibold">{formatPaise(product.costPaise)}</span>
              </span>
            )}
          </span>
        </p>
        <div className="flex gap-2">
          <PrintButton label={t('cat.product.printLabel')} />
          {can(me, 'stock') && (
            <Link href={`/admin/stock/receive${supplier ? `?supplier=${supplier.id}` : ''}`} className={`${secondaryButton} py-2`}>
              {t('cat.product.restock')}
            </Link>
          )}
        </div>
      </section>

      <ItemTabs
        idPrefix="product"
        tabs={[
          { id: 'details', label: t('cat.tab.details'), content: details, print: true },
          { id: 'colours', label: t('cat.tab.colours'), content: colours, tone: 'amber' },
          { id: 'sales', label: t('cat.tab.sales'), content: salesTab, tone: 'sky' },
          { id: 'purchases', label: t('cat.tab.purchases'), content: purchasesTab, tone: 'amber' },
          { id: 'other', label: t('cat.tab.other'), content: other, tone: 'slate' },
        ]}
      />
      {/* Owner only (ADR-050): delete for good, after a confirmation. */}
      {me.role === 'admin' && <DeleteItemButton id={product.id} designIds={variants.map((v) => v.id)} />}
    </main>
  );
}

export default async function ProductPage(props: PageProps<'/admin/products/[id]'>) {
  const t = await getT();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{t('cat.product.loading')}</p>}>
      <ProductDetail params={props.params} searchParams={props.searchParams as Promise<Search>} />
    </Suspense>
  );
}
