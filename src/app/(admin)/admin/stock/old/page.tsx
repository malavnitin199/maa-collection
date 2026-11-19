import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { OldStockForm } from '@/features/catalog/old-stock-form';
import { FirstTimeTip } from '@/components/layout/first-time-tip';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';
import { typeOptionName } from '@/lib/sections';

async function Tagger() {
  const [me, t] = await Promise.all([requirePermission('catalog'), getT()]);
  const db = await requestDb();
  const [categoryRows, allSuppliers] = await Promise.all([listCategories(db, STORE_ID, { activeOnly: true }), listSuppliers(db, STORE_ID)]);
  return (
    <OldStockForm
      categories={categoryRows.map((c) => ({ id: c.id, name: typeOptionName(c, t), code: c.code, sizes: c.sizes }))}
      suppliers={allSuppliers.filter((s) => s.active).map(({ id, name }) => ({ id, name }))}
      previousSuppliers={allSuppliers.filter((s) => !s.active).map(({ id, name }) => ({ id, name }))}
      showCost={can(me, 'costs')}
    />
  );
}

export default async function TagOldStockPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('stk.hub.old.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('stk.oldPage.subtitle')}</p>
      </div>
      <FirstTimeTip id="old-stock" text={t('stk.oldPage.tip')} helpHref="/guide#old-stock" />
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Tagger />
      </Suspense>
    </main>
  );
}
