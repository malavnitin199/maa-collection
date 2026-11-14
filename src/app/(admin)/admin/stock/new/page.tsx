import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { DesignForm } from '@/features/catalog/design-form';
import { STORE_ID } from '@/lib/app-config';
import { requireAdmin } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';

async function NewStock({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  await requireAdmin();
  const [{ supplier }, db] = await Promise.all([searchParams, requestDb()]);
  const [supplierRows, categoryRows] = await Promise.all([
    listSuppliers(db, STORE_ID, { activeOnly: true }),
    listCategories(db, STORE_ID, { activeOnly: true }),
  ]);
  return (
    <DesignForm
      suppliers={supplierRows.map(({ id, name }) => ({ id, name }))}
      categories={categoryRows.map(({ id, name, code }) => ({ id, name, code }))}
      initialSupplierId={supplierRows.some((s) => s.id === supplier) ? supplier : undefined}
    />
  );
}

export default function NewStockPage(props: PageProps<'/admin/stock/new'>) {
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">New items from a supplier</h1>
        <p className={`text-sm ${muted}`}>
          One design in all its sizes and colours. Each combination gets its own SKU and barcode, ready to print.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <NewStock searchParams={props.searchParams as Promise<{ supplier?: string }>} />
      </Suspense>
    </main>
  );
}
