import { Suspense } from 'react';
import { NewItemWizard } from '@/features/catalog/new-item-wizard';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { localName } from '@/lib/sections';
import { requirePermission } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listSuppliers } from '@/server/services/catalog';
import { listSections } from '@/server/services/sections';

/**
 * New item, step by step (plan v19, the New item screen since 03a/04b). `supplier`,
 * `section`, `bill`, `date`, `mode` let "Add next item" keep the bill's company, section,
 * number, date and one/many choice; `n` makes each visit a fresh entry (Next keeps the
 * screen alive otherwise). The earlier form lives on at /admin/stock/form.
 */
type Search = { supplier?: string; section?: string; bill?: string; date?: string; mode?: string; n?: string };
const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

async function NewItem({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requirePermission('catalog');
  const [params, db, locale] = await Promise.all([searchParams, requestDb(), getLocale()]);
  const [allSuppliers, { sections }] = await Promise.all([listSuppliers(db, STORE_ID), listSections(db, STORE_ID, { activeOnly: true })]);
  const supplierRows = allSuppliers.filter((s) => s.active);
  const supplier = one(params.supplier);
  const date = one(params.date);
  return (
    <NewItemWizard
      key={new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string')).toString()}
      sections={sections.map((s) => ({
        id: s.id,
        name: localName(s, locale),
        icon: s.icon,
        types: s.types.map((x) => ({ id: x.id, name: localName(x, locale), code: x.code, sizes: x.sizes })),
      }))}
      suppliers={supplierRows.map(({ id, name }) => ({ id, name }))}
      previousSuppliers={allSuppliers.filter((s) => !s.active).map(({ id, name }) => ({ id, name }))}
      initial={{
        sectionId: one(params.section),
        supplierId: supplierRows.some((s) => s.id === supplier) ? supplier : undefined,
        billNumber: one(params.bill)?.slice(0, 60),
        stockDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
        mode: params.mode === 'one' ? 'one' : params.mode === 'many' ? 'many' : undefined,
      }}
      showCost={can(me, 'costs')}
    />
  );
}

export default async function NewItemPage(props: PageProps<'/admin/stock/new'>) {
  const t = await getT();
  return (
    // The wizard draws its own compact top row (back · New item · Start again).
    <main className="flex flex-col">
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <NewItem searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </main>
  );
}
