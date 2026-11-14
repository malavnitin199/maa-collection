import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { OldStockForm } from '@/features/catalog/old-stock-form';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';

async function Tagger() {
  const me = await requirePermission('catalog');
  const db = await requestDb();
  const [categoryRows, supplierRows] = await Promise.all([
    listCategories(db, STORE_ID, { activeOnly: true }),
    listSuppliers(db, STORE_ID, { activeOnly: true }),
  ]);
  return (
    <OldStockForm
      categories={categoryRows.map(({ id, name, code }) => ({ id, name, code }))}
      suppliers={supplierRows.map(({ id, name }) => ({ id, name }))}
      showCost={can(me, 'costs')}
    />
  );
}

export default function TagOldStockPage() {
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Tag old stock</h1>
        <p className={`text-sm ${muted}`}>
          For items already in the shop: photo → what it is → price and count → barcode. Category, company and size are
          kept for the next item.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Tagger />
      </Suspense>
    </main>
  );
}
