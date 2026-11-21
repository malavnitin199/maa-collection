import Link from 'next/link';
import { Suspense } from 'react';
import { card, input, muted, okBox, primaryButton, secondaryButton, sectionTitle } from '@/components/ui/styles';
import { SelectableItem, SelectionBar, SelectionProvider, SelectToggle } from '@/components/ui/selection';
import { ProductBulkActions } from '@/features/catalog/bulk-actions';
import { DesignCard } from '@/features/catalog/design-card';
import { LOW_STOCK_THRESHOLD, STORE_ID } from '@/lib/app-config';
import { groupDesigns } from '@/lib/design-groups';
import type { T } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';
import { appOrigin } from '@/server/app-origin';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';
import { listProducts, type ProductListRow } from '@/server/services/products';
import { imageSrc, mainImages } from '@/server/services/images';

type Search = { q?: string; supplier?: string; category?: string; show?: string; deleted?: string };
const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

/** This page with the same search and filters, combined (default) or every item. */
type Show = 'combined' | 'items' | 'hidden';
function listHref(params: { q: string; supplierId?: string; categoryId?: string }, show: Show) {
  const s = new URLSearchParams();
  if (params.q) s.set('q', params.q);
  if (params.supplierId) s.set('supplier', params.supplierId);
  if (params.categoryId) s.set('category', params.categoryId);
  if (show !== 'combined') s.set('show', show);
  const query = s.toString();
  return query ? `/admin/products?${query}` : '/admin/products';
}

/** One item (one size × colour) as a row: photo, name, prices, pieces. `selectable`: it can be ticked (plan v17). */
function ProductRow({ p, photo, showCost, t, selectable = false }: { p: ProductListRow; photo?: string; showCost: boolean; t: T; selectable?: boolean }) {
  const row = (
      <Link href={`/admin/products/${p.id}`} className={`${card} flex items-center justify-between gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
          <img src={photo} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-md object-cover" />
        ) : (
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
            {t('cat.products.noPhoto')}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {p.name} <span className={`font-normal ${muted}`}>· {p.size}</span>
          </span>
          <span className={`block truncate text-xs ${muted}`}>
            {p.sku} · {p.category}
            {p.supplierName && ` · ${p.supplierName}`}
            {!p.active && ` · ${t('cat.inactive')}`}
          </span>
          <span className="block text-xs">
            {formatPaise(p.pricePaise)} <span className={muted}>· MRP {formatPaise(p.mrpPaise)}</span>
            {showCost && p.costPaise !== null && <span className={muted}> · {t('cat.purchase', { amount: formatPaise(p.costPaise) })}</span>}
          </span>
        </span>
        <span
          className={`shrink-0 text-right text-lg font-semibold tabular-nums ${
            p.stock <= 0 ? 'text-red-600 dark:text-red-400' : p.stock <= LOW_STOCK_THRESHOLD ? 'text-amber-600' : ''
          }`}
        >
          {p.stock}
          <span className={`block text-xs font-normal ${muted}`}>{t('cat.pcs')}</span>
        </span>
      </Link>
  );
  return (
    <li>
      {selectable ? (
        <SelectableItem ids={[p.id]} label={`${p.name} ${p.size}`} gutter>
          {row}
        </SelectableItem>
      ) : (
        row
      )}
    </li>
  );
}

async function ProductList({ searchParams }: { searchParams: Promise<Search> }) {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'prices', 'stock']), getT()]);
  const params = await searchParams;
  const q = params.q ?? '';
  const supplierId = uuid(params.supplier);
  const categoryId = uuid(params.category);
  const show: Show = params.show === 'items' || params.show === 'hidden' ? params.show : 'combined';
  const db = await requestDb();
  const [items, supplierRows, categoryRows, origin] = await Promise.all([
    // Hidden items (plan v17) only in their own view.
    listProducts(db, STORE_ID, { search: q, supplierId, categoryId, active: show !== 'hidden' }),
    listSuppliers(db, STORE_ID),
    listCategories(db, STORE_ID),
    appOrigin(),
  ]);
  const photos = await mainImages(db, STORE_ID, items.map((p) => p.id));
  const photoOf = (id: string) => {
    const image = photos.get(id);
    return image ? imageSrc(image) : undefined;
  };
  const showCost = can(me, 'costs');
  const canPrint = can(me, 'catalog') || can(me, 'stock');
  const canSelect = can(me, 'catalog') || can(me, 'prices') || canPrint;
  const designs = groupDesigns(items);
  const pieces = items.reduce((n, p) => n + p.stock, 0);
  const base = { q, supplierId, categoryId };

  return (
    <>
      {/* After Delete on a product page (ADR-050): what happened. */}
      {params.deleted && (
        <p role="status" data-testid="deleted-note" className={okBox}>
          {params.deleted.slice(0, 300)}
        </p>
      )}
      <form className="flex flex-col gap-2" role="search">
        {show !== 'combined' && <input type="hidden" name="show" value={show} />}
        <div className="flex gap-2">
          <input name="q" defaultValue={q} placeholder={t('cat.products.searchPlaceholder')} className={`w-full ${input}`} />
          <button type="submit" className={secondaryButton}>
            {t('cat.products.search')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select name="supplier" defaultValue={supplierId ?? ''} aria-label={t('cat.supplier')} className={input}>
            <option value="">{t('cat.allSuppliers')}</option>
            {supplierRows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={categoryId ?? ''} aria-label={t('item.category')} className={input}>
            <option value="">{t('cat.allCategories')}</option>
            {categoryRows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </form>

      <SelectionProvider allIds={canSelect ? items.map((p) => p.id) : []}>
      <div className="flex flex-wrap items-center justify-between gap-2">
      <nav aria-label={t('cat.view.show')} className="flex flex-wrap items-center gap-2">
        <span className={`${sectionTitle} mr-1`}>{t('cat.view.show')}</span>
        {(['combined', 'items', 'hidden'] as const).map((v) => (
          <Link
            key={v}
            href={listHref(base, v)}
            scroll={false}
            aria-current={v === show ? 'true' : undefined}
            className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition active:scale-95 ${
              v === show ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-zinc-300 hover:border-brand-400 dark:border-zinc-700'
            }`}
          >
            {t(v === 'combined' ? 'cat.view.combined' : v === 'items' ? 'cat.view.items' : 'cat.view.hidden')}
          </Link>
        ))}
      </nav>
      <SelectToggle testId="select-products" />
      </div>

      <p className={`text-xs ${muted}`}>
        {show === 'combined'
          ? t('cat.design.summary', { designs: designs.length, items: items.length, pcs: pieces })
          : t('cat.productsPcs', { products: items.length, pcs: pieces })}
        {show === 'combined' && designs.length < items.length && (
          <>
            <br />
            {t('cat.design.hint')}
          </>
        )}
      </p>

      {show === 'combined' ? (
        <ul data-testid="design-list" className="rise-in grid gap-3 sm:grid-cols-2">
          {designs.map((d) => (
            <li key={d.key}>
              <SelectableItem ids={d.items.map((p) => p.id)} label={d.name}>
              <DesignCard
                design={d}
                t={t}
                photos={d.items.map((p) => photoOf(p.id)).filter((src): src is string => Boolean(src))}
                href={`/admin/products/${d.items[0].id}`}
                qrValue={`${origin}/admin/products/${d.items[0].id}`}
                printHref={canPrint ? `/admin/labels/print?${new URLSearchParams({ list: '1', design: d.key })}` : null}
                expandLabel={t(d.items.length === 1 ? 'cat.design.showItems.one' : 'cat.design.showItems.other', { n: d.items.length })}
              >
                <ul data-testid="design-items" className="flex flex-col gap-2">
                  {d.items.map((p) => (
                    <ProductRow key={p.id} p={p} photo={photoOf(p.id)} showCost={showCost} t={t} />
                  ))}
                </ul>
              </DesignCard>
              </SelectableItem>
            </li>
          ))}
        </ul>
      ) : (
        <ul data-testid="product-list" className="flex flex-col gap-2">
          {items.map((p) => (
            <ProductRow key={p.id} p={p} photo={photoOf(p.id)} showCost={showCost} t={t} selectable />
          ))}
        </ul>
      )}
      {items.length === 0 && <p className={`text-sm ${muted}`}>{t(show === 'hidden' ? 'cat.products.noneHidden' : 'cat.products.none')}</p>}
      <SelectionBar>
        <ProductBulkActions
          companies={supplierRows.filter((x) => x.active).map(({ id, name }) => ({ id, name }))}
          categories={categoryRows.filter((c) => c.active).map(({ id, name, code }) => ({ id, name, code }))}
          canCatalog={can(me, 'catalog')}
          canPrices={can(me, 'prices')}
          canPrint={canPrint}
          canDelete={me.role === 'admin'}
          hiddenView={show === 'hidden'}
        />
      </SelectionBar>
      </SelectionProvider>
    </>
  );
}

export default async function ProductsPage(props: PageProps<'/admin/products'>) {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('nav.products')}</h1>
        <Link href="/admin/stock" className={primaryButton}>
          {t('nav.addStock')}
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('cat.products.loading')}</p>}>
        <ProductList searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </main>
  );
}
