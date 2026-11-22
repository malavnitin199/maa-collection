import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fragment, Suspense } from 'react';
import { IconBack } from '@/components/ui/icons';
import { backButton, card, muted, okBox, sectionTitle } from '@/components/ui/styles';
import { chip, chipTone } from '@/features/catalog/chips';
import { DeleteItemButton } from '@/features/catalog/delete-products';
import { HangTag } from '@/features/catalog/hang-tag';
import { EditDetailsButton, HideDesignButton, ItemSizes } from '@/features/catalog/item-page';
import { DesignTagsForm } from '@/features/catalog/item-parts';
import { PrintButton } from '@/features/catalog/print-button';
import { STORE_ID } from '@/lib/app-config';
import { formatDate } from '@/lib/i18n';
import { itemLink } from '@/lib/item-link';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';
import { AGE_LABEL, asAgeGroup, asForGender, FOR_LABEL } from '@/lib/product-tags';
import { tagSizeRange } from '@/lib/size-lists';
import { designSizesById, sortSizes } from '@/lib/size-prices';
import { stockValue } from '@/lib/stock-value';
import { updateDesignTagsAction } from '@/server/actions/admin';
import { appOrigin } from '@/server/app-origin';
import { requireAnyPermission } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';
import { imageSrc, listProductImages } from '@/server/services/images';
import { productReport } from '@/server/services/product-report';
import { getProduct, listDesignVariants } from '@/server/services/products';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';

/** `created`: just made with Add a single product (its code and barcode are shown once). */
type Search = { created?: string };
const rupees = (paise: number | null) => (paise === null ? '' : (paise / 100).toString());
/** A translated sentence with its `{name}` parts drawn by `part` (e.g. in a code font). */
const withParts = (text: string, part: (name: string) => React.ReactNode) =>
  text.split(/\{(\w+)\}/).map((piece, i) => (i % 2 ? <Fragment key={i}>{part(piece)}</Fragment> : piece));
/** One price, or the lowest–highest when sizes differ. */
const priceText = (values: number[]) => {
  if (values.length === 0) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? formatPaise(lo) : `${formatPaise(lo)}–${formatPaise(hi)}`;
};

/**
 * The item page (owner's feedback 2026-11-22, ADR-061): a short, readable detail page — the
 * photo, name and coloured labels; three figures (in stock, sold, and the stock's purchase
 * value — or the last sale for people without that right); the prices; Make bill at the top;
 * each size with its pieces, how many sold and + Add; then Edit details, Print label, Hide,
 * More (For / Age) and Delete. Changing anything here never changes a bill made earlier:
 * bills keep their own copy (ADR-054/060).
 */
async function ProductDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'prices', 'stock']), getT()]);
  const locale = await getLocale();
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await requestDb();
  const product = await getProduct(db, STORE_ID, id);
  if (!product) notFound();
  const [variants, categoryRows, supplierRows, settings, photos, origin] = await Promise.all([
    listDesignVariants(db, STORE_ID, id),
    listCategories(db, STORE_ID),
    listSuppliers(db, STORE_ID),
    getStoreSettings(db, STORE_ID),
    listProductImages(db, STORE_ID, id),
    appOrigin(),
  ]);
  const na = t('common.na');
  const rights = { catalog: can(me, 'catalog'), prices: can(me, 'prices'), costs: can(me, 'costs'), stock: can(me, 'stock') };
  const ids = variants.map((v) => v.id);
  const report = await productReport(db, STORE_ID, ids, { amounts: rights.costs });
  const supplier = supplierRows.find((s) => s.id === product.supplierId);
  // Sizes in shop order, then colour; each with the pieces sold (approved sales).
  const order = sortSizes([...new Set(variants.map((v) => v.size))]);
  const sold = (v: { size: string; color: string }) =>
    report.sales.filter((s) => s.status === 'approved' && s.size === v.size && s.color === v.color).reduce((n, s) => n + s.quantity, 0);
  const rows = [...variants]
    .sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size) || a.color.localeCompare(b.color))
    .map((v) => ({ id: v.id, size: v.size, color: v.color, stock: v.stock, sold: sold(v) }));
  const value = stockValue(variants);
  const soldTotal = rows.reduce((n, r) => n + r.sold, 0);
  /** One value for all sizes, or undefined when they differ. */
  const same = (pick: (v: (typeof variants)[number]) => number | null) => {
    const values = [...new Set(variants.map(pick))];
    return values.length === 1 ? values[0] : undefined;
  };
  const mrp = same((v) => v.mrpPaise);
  const price = same((v) => v.pricePaise);
  const cost = rights.costs ? same((v) => v.costPaise) : null;
  const costs = variants.map((v) => v.costPaise).filter((c): c is number => c !== null);
  const hidden = variants.filter((v) => !v.active).length;
  const forGender = asForGender(product.forGender);
  const ageGroup = asAgeGroup(product.ageGroup);
  const mainPhoto = photos[0];
  const day = (value: string) => formatDate(locale, `${value}T00:00:00+05:30`, 'date');
  const figure = (testId: string, big: string, small: string) => (
    <div className="flex flex-col items-center rounded-xl bg-brand-50/70 px-2 py-2.5 text-center dark:bg-brand-950/50">
      <span data-testid={testId} className="text-xl leading-tight font-bold tabular-nums">
        {big}
      </span>
      <span className={`text-xs ${muted}`}>{small}</span>
    </div>
  );

  return (
    <main className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link href="/admin/products" aria-label={t('cat.backProductsAria')} className={backButton}>
          <IconBack className="h-5 w-5" />
        </Link>
        {rights.costs && (
          <Link
            href={`/admin/bills/new?product=${product.id}`}
            data-testid="make-bill"
            className="ui-primary inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-sm font-bold text-white shadow-md shadow-brand-700/25 transition active:scale-95"
          >
            <span aria-hidden>🧾</span>
            {t('ied.makeBill')}
          </Link>
        )}
      </div>
      {created && (
        <p role="status" className={`${okBox} print:hidden`}>
          {withParts(t('cat.product.added'), (name) => (
            <span className="font-mono">{name === 'sku' ? product.sku : product.barcode}</span>
          ))}
        </p>
      )}

      <section data-testid="item-head" className={`${card} flex flex-col gap-3 print:hidden`}>
        <div className="flex items-start gap-3">
          {mainPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
            <img src={imageSrc(mainPhoto)} alt={product.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          ) : (
            <span data-testid="item-photo-na" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-400 dark:bg-zinc-800">
              {na}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-tight font-semibold">{product.name}</h1>
            <p data-testid="item-chips" className="mt-1.5 flex flex-wrap gap-1.5">
              {supplier ? (
                <Link href={`/admin/companies/${supplier.id}`} data-testid="item-company" className={`${chip} ${chipTone.company}`}>
                  {supplier.name}
                </Link>
              ) : (
                <span data-testid="item-company" className={`${chip} ${chipTone.company}`}>
                  {na}
                </span>
              )}
              <span className={`${chip} ${chipTone.items}`}>{product.category || na}</span>
              {forGender && <span className={`${chip} ${chipTone.items}`}>{t(FOR_LABEL[forGender])}</span>}
              {ageGroup && <span className={`${chip} ${chipTone.items}`}>{t(AGE_LABEL[ageGroup])}</span>}
              {hidden > 0 && (
                <span data-testid="card-hidden" className={`${chip} ${chipTone.hidden}`}>
                  {hidden === variants.length ? t('cat.card.hidden') : t('cat.card.hiddenN', { n: hidden })}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {figure('item-pieces', String(value.pieces), t('ied.inStock'))}
          {figure('item-sold', String(soldTotal), t('ied.sold'))}
          {rights.costs
            ? figure('item-value', value.perPiece === null ? na : formatPaise(value.totalPaise), t('ied.value'))
            : figure('item-last-sale', report.lastSale ? day(report.lastSale.day) : t('ied.notYet'), t('ied.lastSale'))}
        </div>
        <p data-testid="item-prices" className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums">
          <span>
            <span className={muted}>MRP </span>
            <span className="font-semibold">{priceText(variants.map((v) => v.mrpPaise))}</span>
          </span>
          <span>
            <span className={muted}>{t('ied.selling')} </span>
            <span className="font-semibold">{priceText(variants.map((v) => v.pricePaise))}</span>
          </span>
          {rights.costs && (
            <span>
              <span className={muted}>{t('ied.purchase')} </span>
              <span className="font-semibold">{priceText(costs) ?? na}</span>
            </span>
          )}
        </p>
      </section>

      <section className={`${card} flex flex-col gap-1 print:hidden`}>
        <h2 className={sectionTitle}>{t('ied.sizes')}</h2>
        <ItemSizes productId={product.id} rows={rows} can={rights} />
      </section>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <EditDetailsButton
          productId={product.id}
          initial={{
            name: product.name,
            supplierId: product.supplierId ?? '',
            categoryId: product.categoryId ?? '',
            mrp: rupees(mrp ?? null),
            price: rupees(price ?? null),
            cost: rupees(cost ?? null),
          }}
          mixed={{ mrp: mrp === undefined, price: price === undefined, cost: rights.costs && cost === undefined }}
          companies={supplierRows.filter((s) => s.active && !s.deletedAt).map(({ id: sid, name }) => ({ id: sid, name }))}
          previous={supplierRows.filter((s) => !s.active && !s.deletedAt).map(({ id: sid, name }) => ({ id: sid, name }))}
          categories={categoryRows.filter((c) => c.active || c.id === product.categoryId).map(({ id: cid, name }) => ({ id: cid, name }))}
          can={rights}
        />
        <PrintButton label={t('cat.product.printLabel')} />
        {rights.catalog && <HideDesignButton ids={ids} hidden={hidden === variants.length} />}
      </div>

      {rights.catalog && (
        <details data-testid="item-more" className={`${card} group print:hidden`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
            {t('ied.moreSection')}
            <span aria-hidden className={`transition group-open:rotate-180 ${muted}`}>
              ▾
            </span>
          </summary>
          <div className="mt-3">
            <DesignTagsForm action={updateDesignTagsAction.bind(null, product.id)} initial={{ forGender, ageGroup }} count={variants.length} />
          </div>
        </details>
      )}

      {/* Owner only (ADR-050): delete for good, after a confirmation. */}
      {me.role === 'admin' && <DeleteItemButton id={product.id} designIds={ids} />}

      {/* Print label prints this (and nothing else on the page). */}
      <div data-testid="item-print-tag" className="hidden print:block">
        <HangTag
          product={product}
          sizes={tagSizeRange(categoryRows.find((c) => c.id === product.categoryId)?.sizes ?? [], designSizesById(variants).get(product.id) ?? [], product.size)}
          qrValue={itemLink(origin, product.barcode)}
          priceCode={labelPriceCode(settings, product.costPaise)}
        />
      </div>
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
