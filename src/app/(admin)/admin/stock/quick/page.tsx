import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { QuickAddForm } from '@/features/catalog/quick-add-form';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';

async function Quick({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  const me = await requirePermission('catalog');
  const [{ supplier }, db] = await Promise.all([searchParams, requestDb()]);
  const [supplierRows, categoryRows] = await Promise.all([
    listSuppliers(db, STORE_ID, { activeOnly: true }),
    listCategories(db, STORE_ID, { activeOnly: true }),
  ]);
  return (
    <QuickAddForm
      suppliers={supplierRows.map(({ id, name }) => ({ id, name }))}
      categories={categoryRows.map(({ id, name, code, sizes }) => ({ id, name, code, sizes }))}
      initialSupplierId={supplierRows.some((s) => s.id === supplier) ? supplier : undefined}
      showCost={can(me, 'costs')}
    />
  );
}

export default async function QuickAddPage(props: PageProps<'/admin/stock/quick'>) {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('stk.quickPage.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('stk.quickPage.subtitle')}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Quick searchParams={props.searchParams as Promise<{ supplier?: string }>} />
      </Suspense>
    </main>
  );
}
