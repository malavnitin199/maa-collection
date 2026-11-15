import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted, sectionTitle } from '@/components/ui/styles';
import { CategoryForm } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import { createCategoryAction, updateCategoryAction } from '@/server/actions/admin';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories } from '@/server/services/catalog';

async function AddCategory() {
  const [, t] = await Promise.all([requirePermission('catalog'), getT()]);
  return (
    <details className={card}>
        <summary className="cursor-pointer font-medium text-brand-700 dark:text-brand-400">{t('cat.cat.addOpen')}</summary>
        <div className="mt-3">
          <CategoryForm action={createCategoryAction} submitLabel={t('cat.cat.add')} />
        </div>
      </details>
  );
}

async function CategoryList() {
  const [, t] = await Promise.all([requirePermission('catalog'), getT()]);
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
                {!c.active && <span className={`ml-1 text-xs ${muted}`}>{t('cat.inactiveParen')}</span>}
                <span className={`block text-xs ${muted}`}>
                  {t('cat.productsPcs', { products: c.productCount, pcs: c.stockUnits })}
                </span>
                <span data-testid="category-sizes" className={`block text-xs ${muted}`}>
                  {t('cat.cat.sizes', { sizes: c.sizes.length > 0 ? c.sizes.join(' · ') : t('cat.cat.sizesNotSet') })}
                </span>
              </span>
              <span className={`text-sm ${link}`}>{t('cat.cat.edit')}</span>
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <CategoryForm action={updateCategoryAction.bind(null, c.id)} initial={c} submitLabel={t('cat.cat.save')} />
              {c.productCount > 0 && (
                <Link href={`/admin/products?category=${c.id}`} className={`text-sm ${link}`}>
                  {t('cat.cat.viewProducts')}
                </Link>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

export default async function CategoriesPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('nav.categories')}</h1>
        <p className={`text-sm ${muted}`}>{t('cat.cat.subtitle')}</p>
      </div>
      <Suspense fallback={null}>
        <AddCategory />
      </Suspense>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('cat.allCategories')}</h2>
        <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
          <CategoryList />
        </Suspense>
      </section>
    </main>
  );
}
