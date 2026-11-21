import Link from 'next/link';
import { Suspense } from 'react';
import { IconBack } from '@/components/ui/icons';
import { BillForm } from '@/features/bills/bill-form';
import { STORE_ID } from '@/lib/app-config';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCollections } from '@/server/services/bills';
import { listSuppliers } from '@/server/services/catalog';
import { shopToday } from '@/server/services/products';

/** New bill (owner's feedback 2026-11-21): one card, with the recent collections waiting for a bill to tick. */
async function NewBill({ supplier }: { supplier?: string }) {
  await requirePermission('costs');
  const db = await requestDb();
  const [companies, collections] = await Promise.all([listSuppliers(db, STORE_ID), listCollections(db, STORE_ID, { unbilled: true })]);
  const start = companies.find((c) => c.id === supplier && c.active);
  return (
    <BillForm
      key={supplier ?? ''}
      suppliers={companies.filter((c) => c.active).map(({ id, name }) => ({ id, name }))}
      previous={companies.filter((c) => !c.active).map(({ id, name }) => ({ id, name }))}
      collections={collections}
      today={shopToday()}
      initial={start ? { billNumber: '', billDate: shopToday(), note: '', companies: [{ supplierId: start.id, name: start.name, amount: '' }] } : undefined}
    />
  );
}

export default async function NewBillPage(props: PageProps<'/admin/bills/new'>) {
  const t = await getT();
  const params = (await props.searchParams) as { supplier?: string };
  return (
    <main className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Link href="/admin/bills" aria-label={t('bills.back')} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950">
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t('bills.newTitle')}</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <NewBill supplier={typeof params.supplier === 'string' ? params.supplier : undefined} />
      </Suspense>
    </main>
  );
}
