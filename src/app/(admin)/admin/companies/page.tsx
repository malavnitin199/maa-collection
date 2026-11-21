import { Suspense } from 'react';
import { card, muted, okBox } from '@/components/ui/styles';
import { CompanyBrowser } from '@/features/catalog/company-browser';
import { SupplierForm } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { createSupplierAction } from '@/server/actions/admin';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { companiesOverview } from '@/server/services/company';

/**
 * Companies (owner's feedback 2026-11-21): the list first — search (with the
 * microphone), a Location dropdown and short rows ten at a time; the figures
 * fold away under *Summary*; *+ Add company* is a small chip that opens the
 * form. Each row opens the company's page with everything else.
 */
async function Companies() {
  const [me, t] = await Promise.all([requirePermission('catalog'), getT()]);
  const showMoney = can(me, 'costs');
  const { rows, totals } = await companiesOverview(await requestDb(), STORE_ID, { amounts: showMoney });
  if (rows.length === 0) return <p className={`text-sm ${muted}`}>{t('cat.sup.none')}</p>;
  return (
    <CompanyBrowser
      showMoney={showMoney}
      canDelete={can(me, 'catalog')}
      totals={totals}
      rows={rows.map(({ id, name, location, contactName, phone, active, bills, openBills, collections, amountPaise, duePaise }) => ({
        id, name, location, contactName, phone, active, bills, openBills, collections, amountPaise, duePaise,
      }))}
    />
  );
}

export default async function CompaniesPage(props: PageProps<'/admin/companies'>) {
  const t = await getT();
  const { deleted } = (await props.searchParams) as { deleted?: string };
  return (
    <main className="flex flex-col gap-3">
      {/* After Delete on a company's page (ADR-051): what happened. */}
      {typeof deleted === 'string' && deleted && (
        <p role="status" data-testid="deleted-note" className={okBox}>
          {deleted.slice(0, 300)}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('nav.suppliers')}</h1>
        {/* Small until opened; then the form takes the full width below the title. */}
        <details id="add" className="group open:basis-full">
          <summary className="ml-auto w-fit cursor-pointer list-none rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white select-none active:scale-95 group-open:bg-zinc-200 group-open:text-zinc-800 dark:group-open:bg-zinc-800 dark:group-open:text-zinc-100">
            {t('cat.sup.addOpen')}
          </summary>
          <div className={`${card} mt-2`}>
            <SupplierForm action={createSupplierAction} submitLabel={t('cat.sup.add')} />
          </div>
        </details>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Companies />
      </Suspense>
    </main>
  );
}
