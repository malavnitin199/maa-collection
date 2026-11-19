import Link from 'next/link';
import { Suspense } from 'react';
import { IconBack } from '@/components/ui/icons';
import { NewStockWizard } from '@/features/catalog/new-stock-wizard';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listSuppliers } from '@/server/services/catalog';
import { listSections } from '@/server/services/sections';

/** `supplier`, `section`, `bill`, `date`: "Add next item" keeps the bill's company, section, number and date; `n` makes each visit fresh. */
type Search = { supplier?: string; section?: string; bill?: string; date?: string; n?: string };
const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

async function NewItem({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requirePermission('catalog');
  const [params, db] = await Promise.all([searchParams, requestDb()]);
  const [allSuppliers, { sections }] = await Promise.all([listSuppliers(db, STORE_ID), listSections(db, STORE_ID, { activeOnly: true })]);
  const supplierRows = allSuppliers.filter((s) => s.active);
  const supplier = one(params.supplier);
  const date = one(params.date);
  return (
    <NewStockWizard
      // A new address (e.g. "Add next item") starts a fresh entry; Next keeps this screen alive otherwise.
      key={new URLSearchParams(params as Record<string, string>).toString()}
      sections={sections.map((s) => ({ id: s.id, name: s.name, icon: s.icon, types: s.types.map(({ id, name, code, sizes }) => ({ id, name, code, sizes })) }))}
      suppliers={supplierRows.map(({ id, name }) => ({ id, name }))}
      previousSuppliers={allSuppliers.filter((s) => !s.active).map(({ id, name }) => ({ id, name }))}
      initial={{
        sectionId: one(params.section),
        supplierId: supplierRows.some((s) => s.id === supplier) ? supplier : undefined,
        billNumber: one(params.bill)?.slice(0, 60),
        stockDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      }}
      showCost={can(me, 'costs')}
    />
  );
}

export default async function NewItemPage(props: PageProps<'/admin/stock/new'>) {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      {/* Minimal title bar (plan v17): back arrow and the name of the screen only. */}
      <div className="flex items-center gap-2">
        <Link href="/admin/stock" aria-label={t('stk.item.back')} className="-ml-2 rounded-full p-2 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950">
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t('stk.item.title')}</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <NewItem searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </main>
  );
}
