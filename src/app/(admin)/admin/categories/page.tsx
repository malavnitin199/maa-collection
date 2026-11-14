import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted, sectionTitle } from '@/components/ui/styles';
import { CategoryForm } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import { createCategoryAction, updateCategoryAction } from '@/server/actions/admin';
import { requirePermission } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { listCategories } from '@/server/services/catalog';

async function AddCategory() {
  await requirePermission('catalog');
  return (
    <details className={card}>
        <summary className="cursor-pointer font-medium text-emerald-700 dark:text-emerald-400">+ Add category</summary>
        <div className="mt-3">
          <CategoryForm action={createCategoryAction} submitLabel="Add category" />
        </div>
      </details>
  );
}

async function CategoryList() {
  await requirePermission('catalog');
  const rows = await listCategories(await requestDb(), STORE_ID);
  return (
    <ul data-testid="category-list" className="flex flex-col gap-2">
      {rows.map((c) => (
        <li key={c.id}>
          <details className={card}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">{c.code}</span>
                {!c.active && <span className={`ml-1 text-xs ${muted}`}>(inactive)</span>}
                <span className={`block text-xs ${muted}`}>
                  {c.productCount} products · {c.stockUnits} pcs
                </span>
              </span>
              <span className={`text-sm ${link}`}>Edit</span>
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <CategoryForm action={updateCategoryAction.bind(null, c.id)} initial={c} submitLabel="Save category" />
              {c.productCount > 0 && (
                <Link href={`/admin/products?category=${c.id}`} className={`text-sm ${link}`}>
                  View its products →
                </Link>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

export default function CategoriesPage() {
  return (
    <main className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className={`text-sm ${muted}`}>The kinds of items you sell. Each has a short code used in SKUs.</p>
      </div>
      <Suspense fallback={null}>
        <AddCategory />
      </Suspense>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>All categories</h2>
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <CategoryList />
        </Suspense>
      </section>
    </main>
  );
}
