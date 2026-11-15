import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { RestockForm } from '@/features/catalog/restock-form';
import { STORE_ID } from '@/lib/app-config';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listSuppliers } from '@/server/services/catalog';

async function Receive({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  await requirePermission('stock');
  const [{ supplier }, db] = await Promise.all([searchParams, requestDb()]);
  const rows = await listSuppliers(db, STORE_ID, { activeOnly: true });
  return (
    <RestockForm
      suppliers={rows.map(({ id, name }) => ({ id, name }))}
      initialSupplierId={rows.some((s) => s.id === supplier) ? supplier : undefined}
    />
  );
}

export default async function ReceiveStockPage(props: PageProps<'/admin/stock/receive'>) {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('stk.receivePage.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('stk.receivePage.subtitle')}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Receive searchParams={props.searchParams as Promise<{ supplier?: string }>} />
      </Suspense>
    </main>
  );
}
