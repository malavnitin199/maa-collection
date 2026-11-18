import Link from 'next/link';
import { Suspense } from 'react';
import { IconBack } from '@/components/ui/icons';
import { NewItemForm } from '@/features/catalog/new-item-form';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';

type Search = { supplier?: string; category?: string };

async function NewItem({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requirePermission('catalog');
  const [{ supplier, category }, db] = await Promise.all([searchParams, requestDb()]);
  const [allSuppliers, categoryRows] = await Promise.all([listSuppliers(db, STORE_ID), listCategories(db, STORE_ID, { activeOnly: true })]);
  const supplierRows = allSuppliers.filter((s) => s.active);
  return (
    <NewItemForm
      suppliers={supplierRows.map(({ id, name }) => ({ id, name }))}
      previousSuppliers={allSuppliers.filter((s) => !s.active).map(({ id, name }) => ({ id, name }))}
      categories={categoryRows.map(({ id, name, code, sizes }) => ({ id, name, code, sizes }))}
      // "Add next item" on the labels page keeps the company and category.
      initialSupplierId={supplierRows.some((s) => s.id === supplier) ? supplier : undefined}
      initialCategoryId={categoryRows.some((c) => c.id === category) ? category : undefined}
      showCost={can(me, 'costs')}
    />
  );
}

export default async function NewItemPage(props: PageProps<'/admin/stock/new'>) {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      {/* Minimal title bar (plan v17): back arrow and the name of the screen only. */}
      <div className="flex items-center gap-2">
        <Link href="/admin/stock" aria-label={t('stk.item.back')} className="-ml-2 rounded-full p-2 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950">
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t('stk.item.title')}</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <NewItem searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </main>
  );
}
