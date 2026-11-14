import Link from 'next/link';
import { Suspense } from 'react';
import { link, muted } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { ProductForm } from '@/features/catalog/product-form';
import { STORE_ID } from '@/lib/app-config';
import { createProductAction } from '@/server/actions/admin';
import { requireAdmin } from '@/server/auth';
import { listCategories, listSuppliers } from '@/server/services/catalog';

async function NewProduct() {
  await requireAdmin();
  const db = await requestDb();
  const [categoryRows, supplierRows] = await Promise.all([
    listCategories(db, STORE_ID, { activeOnly: true }),
    listSuppliers(db, STORE_ID, { activeOnly: true }),
  ]);
  return (
    <ProductForm
      mode="new"
      action={createProductAction}
      categories={categoryRows.map(({ id, name, code }) => ({ id, name, code }))}
      suppliers={supplierRows.map(({ id, name }) => ({ id, name }))}
    />
  );
}

export default function NewProductPage() {
  return (
    <main className="flex flex-col gap-4">
      <Link href="/admin/products" className={`text-sm ${link}`}>
        ← Products
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Add product</h1>
        <p className={`text-sm ${muted}`}>One size and colour, e.g. an item with the manufacturer&rsquo;s barcode already on its tag. For a design in several sizes/colours use “+ Stock”.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <NewProduct />
      </Suspense>
    </main>
  );
}
