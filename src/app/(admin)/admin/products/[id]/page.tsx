import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fragment, Suspense } from 'react';
import { card, link, muted, okBox } from '@/components/ui/styles';
import { chip, chipTone } from '@/features/catalog/chips';
import { DeleteItemButton } from '@/features/catalog/delete-products';
import { HangTag } from '@/features/catalog/hang-tag';
import { HideDesignButton, ItemEditor } from '@/features/catalog/item-editor';
import { DesignTagsForm } from '@/features/catalog/item-parts';
import { PrintButton } from '@/features/catalog/print-button';
import { STORE_ID } from '@/lib/app-config';
import { itemLink } from '@/lib/item-link';
import { can } from '@/lib/permissions';
import { AGE_LABEL, asAgeGroup, asForGender, FOR_LABEL } from '@/lib/product-tags';
import { tagSizeRange } from '@/lib/size-lists';
import { designSizesById, sortSizes } from '@/lib/size-prices';
import { updateDesignTagsAction } from '@/server/actions/admin';
import { appOrigin } from '@/server/app-origin';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';
import { imageSrc, listProductImages } from '@/server/services/images';
import { getProduct, listDesignVariants } from '@/server/services/products';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';

/** `created`: just made with Add a single product (its code and barcode are shown once). */
type Search = { created?: string };
const rupees = (paise: number | null) => (paise === null ? '' : (paise / 100).toString());
/** A translated sentence with its `{name}` parts drawn by `part` (e.g. in a code font). */
const withParts = (text: string, part: (name: string) => React.ReactNode) =>
  text.split(/\{(\w+)\}/).map((piece, i) => (i % 2 ? <Fragment key={i}>{part(piece)}</Fragment> : piece));

/**
 * The item page (owner's feedback 2026-11-22, ADR-059): every detail of the product on one
 * short screen and one editor — the photo, the name and coloured labels (company, category,
 * items, pieces), then name, company, category, prices, each size's pieces and new sizes,
 * saved in one go for the whole design; Print tag, Hide, For / Age under More, and Delete
 * (owner). The tag is drawn only for printing. Empty fields show N/A.
 */
async function ProductDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'prices', 'stock']), getT()]);
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
  const supplier = supplierRows.find((s) => s.id === product.supplierId);
  // Sizes in shop order, then colour.
  const order = sortSizes([...new Set(variants.map((v) => v.size))]);
  const rows = [...variants].sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size) || a.color.localeCompare(b.color));
  const pieces = variants.reduce((n, v) => n + Math.max(v.stock, 0), 0);
  /** One value for all sizes, or null when they differ. */
  const same = (pick: (v: (typeof variants)[number]) => number | null) => {
    const values = [...new Set(variants.map(pick))];
    return values.length === 1 ? values[0] : undefined;
  };
  const mrp = same((v) => v.mrpPaise);
  const price = same((v) => v.pricePaise);
  const cost = rights.costs ? same((v) => v.costPaise) : null;
  const hidden = variants.filter((v) => !v.active).length;
  const forGender = asForGender(product.forGender);
  const ageGroup = asAgeGroup(product.ageGroup);
  const mainPhoto = photos[0];
  const ids = variants.map((v) => v.id);
  // The editor starts again from these figures after every save.
  const version = [product.name, product.supplierId, product.categoryId, ...variants.map((v) => `${v.id}:${v.stock}:${v.mrpPaise}:${v.pricePaise}:${v.costPaise}`)].join('|');

  return (
    <main className="flex flex-col gap-3">
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

      <section data-testid="item-head" className={`${card} flex items-start gap-3 print:hidden`}>
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
            <span className={`${chip} ${chipTone.items}`}>{t('cat.design.items', { items: variants.length })}</span>
            <span data-testid="item-pieces" className={`${chip} ${chipTone.pieces}`}>
              {t('cat.value.pcs', { pcs: pieces })}
            </span>
            {forGender && <span className={`${chip} ${chipTone.items}`}>{t(FOR_LABEL[forGender])}</span>}
            {ageGroup && <span className={`${chip} ${chipTone.items}`}>{t(AGE_LABEL[ageGroup])}</span>}
            {hidden > 0 && (
              <span data-testid="card-hidden" className={`${chip} ${chipTone.hidden}`}>
                {hidden === variants.length ? t('cat.card.hidden') : t('cat.card.hiddenN', { n: hidden })}
              </span>
            )}
          </p>
        </div>
      </section>

      <ItemEditor
        productId={product.id}
        version={version}
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
        rows={rows.map((v) => ({ id: v.id, size: v.size, color: v.color, stock: v.stock }))}
        can={rights}
      />

      <div className="flex flex-wrap items-center gap-2 print:hidden">
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

      {/* Print tag prints this (and nothing else on the page). */}
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
