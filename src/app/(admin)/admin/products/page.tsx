import Link from 'next/link';
import { Suspense } from 'react';
import { card, input, link, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { LOW_STOCK_THRESHOLD, STORE_ID } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { requireAdmin } from '@/server/auth';
import { listProducts } from '@/server/services/products';

async function ProductList({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = '' } = await searchParams;
  const items = await listProducts(await requestDb(), STORE_ID, q);
  return (
    <>
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search name, SKU, brand, category or barcode" className={`w-full ${input}`} />
        <button type="submit" className={secondaryButton}>
          Search
        </button>
      </form>
      <div className={`${card} overflow-x-auto p-0`}>
        <table data-testid="product-table" className="w-full min-w-[640px] text-left text-sm">
          <thead className={muted}>
            <tr>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">SKU / barcode</th>
              <th className="px-3 py-2 text-right font-medium">MRP</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">Cost</th>
              <th className="px-3 py-2 text-right font-medium">Stock</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">
                  <Link href={`/admin/products/${p.id}`} className={link}>
                    {p.name}
                  </Link>
                  <span className={`block text-xs ${muted}`}>
                    {p.brand} · {p.category} · {p.size} · {p.color}
                    {!p.active && ' · inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {p.sku}
                  <span className={`block ${muted}`}>{p.barcode}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPaise(p.mrpPaise)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPaise(p.pricePaise)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.costPaise === null ? '—' : formatPaise(p.costPaise)}</td>
                <td
                  className={`px-3 py-2 text-right font-medium tabular-nums ${
                    p.stock <= 0 ? 'text-red-600 dark:text-red-400' : p.stock <= LOW_STOCK_THRESHOLD ? 'text-amber-600' : ''
                  }`}
                >
                  {p.stock}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className={`p-4 text-sm ${muted}`}>No products found.</p>}
      </div>
    </>
  );
}

export default function ProductsPage(props: PageProps<'/admin/products'>) {
  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link href="/admin/products/new" className={primaryButton}>
          + Add product
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading products…</p>}>
        <ProductList searchParams={props.searchParams as Promise<{ q?: string }>} />
      </Suspense>
    </main>
  );
}
