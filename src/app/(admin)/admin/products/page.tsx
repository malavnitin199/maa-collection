import Link from 'next/link';
import { Suspense } from 'react';
import { card, input, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { LOW_STOCK_THRESHOLD, STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { can } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';
import { listProducts } from '@/server/services/products';

type Search = { q?: string; supplier?: string; category?: string };
const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

async function ProductList({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requireAnyPermission(['catalog', 'prices', 'stock']);
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
  return (
    <>
      <form className="flex flex-col gap-2" role="search">
        <div className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search name, SKU, colour, barcode" className={`w-full ${input}`} />
          <button type="submit" className={secondaryButton}>
            Search
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select name="supplier" defaultValue={supplierId ?? ''} aria-label="Supplier" className={input}>
            <option value="">All suppliers</option>
            {supplierRows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={categoryId ?? ''} aria-label="Category" className={input}>
            <option value="">All categories</option>
            {categoryRows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </form>
      <p className={`text-xs ${muted}`}>
        {items.length} products · {items.reduce((n, p) => n + p.stock, 0)} pcs
      </p>
      <ul data-testid="product-list" className="flex flex-col gap-2">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/products/${p.id}`} className={`${card} flex items-center justify-between gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {p.name} <span className={`font-normal ${muted}`}>· {p.color} · {p.size}</span>
                </span>
                <span className={`block truncate text-xs ${muted}`}>
                  {p.sku} · {p.category}
                  {p.supplierName && ` · ${p.supplierName}`}
                  {!p.active && ' · inactive'}
                </span>
                <span className="block text-xs">
                  {formatPaise(p.pricePaise)} <span className={muted}>· MRP {formatPaise(p.mrpPaise)}</span>
                  {can(me, 'costs') && p.costPaise !== null && <span className={muted}> · purchase {formatPaise(p.costPaise)}</span>}
                </span>
              </span>
              <span
                className={`shrink-0 text-right text-lg font-semibold tabular-nums ${
                  p.stock <= 0 ? 'text-red-600 dark:text-red-400' : p.stock <= LOW_STOCK_THRESHOLD ? 'text-amber-600' : ''
                }`}
              >
                {p.stock}
                <span className={`block text-xs font-normal ${muted}`}>pcs</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className={`text-sm ${muted}`}>No products found.</p>}
    </>
  );
}

export default function ProductsPage(props: PageProps<'/admin/products'>) {
  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link href="/admin/stock" className={primaryButton}>
          + Add stock
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading products…</p>}>
        <ProductList searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </main>
  );
}
