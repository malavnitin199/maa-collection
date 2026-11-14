import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { QuickAddForm } from '@/features/catalog/quick-add-form';
import { STORE_ID } from '@/lib/app-config';
import { requireAdmin } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';

async function Quick({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  await requireAdmin();
  const [{ supplier }, db] = await Promise.all([searchParams, requestDb()]);
  const [supplierRows, categoryRows] = await Promise.all([
    listSuppliers(db, STORE_ID, { activeOnly: true }),
    listCategories(db, STORE_ID, { activeOnly: true }),
  ]);
  return (
    <QuickAddForm
      suppliers={supplierRows.map(({ id, name }) => ({ id, name }))}
      categories={categoryRows.map(({ id, name, code }) => ({ id, name, code }))}
      initialSupplierId={supplierRows.some((s) => s.id === supplier) ? supplier : undefined}
    />
  );
}

export default function QuickAddPage(props: PageProps<'/admin/stock/quick'>) {
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Quick add products</h1>
        <p className={`text-sm ${muted}`}>
          Same company and category, different products: give each a name and its prices. Every product gets its own
          barcode and labels.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Quick searchParams={props.searchParams as Promise<{ supplier?: string }>} />
      </Suspense>
    </main>
  );
}
