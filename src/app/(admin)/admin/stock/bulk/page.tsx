import { Suspense } from 'react';
import { NewItemWizard } from '@/features/catalog/new-item-wizard';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { newItemSections } from '@/server/services/sections';

/**
 * Bulk addition (owner, 2026-11-24, ADR-072; Home → Bulk addition): the collection, the
 * category, then one table for many products of that category — product name, purchase
 * price, quantity — saved together. The first two steps are New item's own. `section` +
 * `type` ("Add more <category>" on the tags page) open straight on that category's table;
 * `n` makes each such visit a fresh entry (Next keeps the screen alive otherwise).
 */
type Search = { section?: string; type?: string; n?: string };
const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

async function Bulk({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requirePermission('catalog');
  const [params, db, locale] = await Promise.all([searchParams, requestDb(), getLocale()]);
  const sections = await newItemSections(db, STORE_ID, locale);
  return (
    <NewItemWizard
      key={new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string')).toString()}
      mode="bulk"
      sections={sections}
      suppliers={[]}
      previousSuppliers={[]}
      initial={{ sectionId: one(params.section), typeId: one(params.type) }}
      showCost={can(me, 'costs')}
      isOwner={me.role === 'admin'}
    />
  );
}

export default async function BulkAdditionPage(props: PageProps<'/admin/stock/bulk'>) {
  const t = await getT();
  return (
    // The screen draws its own compact top row (back · Bulk addition · Start again).
    <main className="flex flex-col">
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Bulk searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </main>
  );
}
