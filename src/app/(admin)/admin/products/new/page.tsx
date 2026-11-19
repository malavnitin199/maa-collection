import Link from 'next/link';
import { Suspense } from 'react';
import { link, muted } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { ProductForm } from '@/features/catalog/product-form';
import { STORE_ID } from '@/lib/app-config';
import { createProductAction } from '@/server/actions/admin';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { listCategories, listSuppliers } from '@/server/services/catalog';
import { typeOptionName } from '@/lib/sections';

async function NewProduct() {
  const [me, t] = await Promise.all([requirePermission('catalog'), getT()]);
  const db = await requestDb();
  const [categoryRows, allSuppliers] = await Promise.all([listCategories(db, STORE_ID, { activeOnly: true }), listSuppliers(db, STORE_ID)]);
  return (
    <ProductForm
      mode="new"
      action={createProductAction}
      categories={categoryRows.map((c) => ({ id: c.id, name: typeOptionName(c, t), code: c.code }))}
      suppliers={allSuppliers.filter((s) => s.active).map(({ id, name }) => ({ id, name }))}
      previousSuppliers={allSuppliers.filter((s) => !s.active).map(({ id, name }) => ({ id, name }))}
      showCost={can(me, 'costs')}
    />
  );
}

export default async function NewProductPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      <Link href="/admin/products" className={`text-sm ${link}`}>
        {t('cat.backProducts')}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{t('cat.new.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('cat.new.intro')}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <NewProduct />
      </Suspense>
    </main>
  );
}
