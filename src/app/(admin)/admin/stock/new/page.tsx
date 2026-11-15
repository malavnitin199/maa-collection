import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { DesignForm } from '@/features/catalog/design-form';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';

async function NewStock({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  const me = await requirePermission('catalog');
  const [{ supplier }, db] = await Promise.all([searchParams, requestDb()]);
  const [supplierRows, categoryRows] = await Promise.all([
    listSuppliers(db, STORE_ID, { activeOnly: true }),
    listCategories(db, STORE_ID, { activeOnly: true }),
  ]);
  return (
    <DesignForm
      suppliers={supplierRows.map(({ id, name }) => ({ id, name }))}
      categories={categoryRows.map(({ id, name, code, sizes }) => ({ id, name, code, sizes }))}
      initialSupplierId={supplierRows.some((s) => s.id === supplier) ? supplier : undefined}
      showCost={can(me, 'costs')}
    />
  );
}

export default async function NewStockPage(props: PageProps<'/admin/stock/new'>) {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('stk.new.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('stk.new.subtitle')}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <NewStock searchParams={props.searchParams as Promise<{ supplier?: string }>} />
      </Suspense>
    </main>
  );
}
