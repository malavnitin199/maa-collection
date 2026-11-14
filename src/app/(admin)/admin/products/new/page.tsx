import Link from 'next/link';
import { Suspense } from 'react';
import { link, muted } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { ProductForm } from '@/features/catalog/product-form';
import { STORE_ID } from '@/lib/app-config';
import { createProductAction } from '@/server/actions/admin';
import { requireAdmin } from '@/server/auth';
import { listProducts } from '@/server/services/products';

async function NewProduct() {
  await requireAdmin();
  const categories = [...new Set((await listProducts(await requestDb(), STORE_ID)).map((p) => p.category))].sort();
  return <ProductForm mode="new" action={createProductAction} categories={categories} />;
}

export default function NewProductPage() {
  return (
    <main className="flex flex-col gap-4">
      <Link href="/admin/products" className={`text-sm ${link}`}>
        ← Products
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Add product</h1>
        <p className={`text-sm ${muted}`}>The SKU and barcode are generated automatically. You get a printable label next.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <NewProduct />
      </Suspense>
    </main>
  );
}
