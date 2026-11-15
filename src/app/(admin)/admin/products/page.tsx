import Link from 'next/link';
import { Suspense } from 'react';
import { card, input, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { LOW_STOCK_THRESHOLD, STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';
import { listProducts } from '@/server/services/products';
import { imageSrc, mainImages } from '@/server/services/images';

type Search = { q?: string; supplier?: string; category?: string };
const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

async function ProductList({ searchParams }: { searchParams: Promise<Search> }) {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'prices', 'stock']), getT()]);
  const params = await searchParams;
  const q = params.q ?? '';
  const supplierId = uuid(params.supplier);
  const categoryId = uuid(params.category);
  const db = await requestDb();
  const [items, supplierRows, categoryRows] = await Promise.all([
    listProducts(db, STORE_ID, { search: q, supplierId, categoryId }),
    listSuppliers(db, STORE_ID),
    listCategories(db, STORE_ID),
  ]);
  const photos = await mainImages(db, STORE_ID, items.map((p) => p.id));
  return (
    <>
      <form className="flex flex-col gap-2" role="search">
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
      <p className={`text-xs ${muted}`}>
        {t('cat.productsPcs', { products: items.length, pcs: items.reduce((n, p) => n + p.stock, 0) })}
      </p>
      <ul data-testid="product-list" className="flex flex-col gap-2">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/products/${p.id}`} className={`${card} flex items-center justify-between gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
              {photos.get(p.id) ? (
                // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
                <img src={imageSrc(photos.get(p.id)!)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-md object-cover" />
              ) : (
                <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
                  {t('cat.products.noPhoto')}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {p.name} <span className={`font-normal ${muted}`}>· {p.color} · {p.size}</span>
                </span>
                <span className={`block truncate text-xs ${muted}`}>
                  {p.sku} · {p.category}
                  {p.supplierName && ` · ${p.supplierName}`}
                  {!p.active && ` · ${t('cat.inactive')}`}
                </span>
                <span className="block text-xs">
                  {formatPaise(p.pricePaise)} <span className={muted}>· MRP {formatPaise(p.mrpPaise)}</span>
                  {can(me, 'costs') && p.costPaise !== null && <span className={muted}> · {t('cat.purchase', { amount: formatPaise(p.costPaise) })}</span>}
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
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className={`text-sm ${muted}`}>{t('cat.products.none')}</p>}
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
