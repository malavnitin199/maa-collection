import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { IconBack } from '@/components/ui/icons';
import { backButton } from '@/components/ui/styles';
import { BillEditor } from '@/features/bills/bill-editor';
import { rupeesText } from '@/lib/money';
import { STORE_ID } from '@/lib/app-config';
import { browseBillProductsAction } from '@/server/actions/bills';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { getBill } from '@/server/services/bills';
import { listSuppliers } from '@/server/services/catalog';
import { shopToday } from '@/server/services/products';

/**
 * Edit bill for a bill made from items (owner's feedback 2026-11-22, ADR-061): the same editor
 * as New bill, starting from the bill's own lines (quantities and rates can change, lines go or
 * come). A bill of stock entries is changed on its page instead.
 */
async function EditBill({ id }: { id: string }) {
  await requirePermission('costs');
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await requestDb();
  const bill = await getBill(db, STORE_ID, id);
  if (!bill) notFound();
  if (bill.collections > 0) redirect(`/admin/bills/${id}`);
  const [companies, first] = await Promise.all([listSuppliers(db, STORE_ID), browseBillProductsAction({ offset: 0 })]);
  const usable = companies.filter((c) => !c.deletedAt || bill.companies.some((b) => b.supplierId === c.id));
  return (
    <BillEditor
      billId={bill.id}
      today={shopToday()}
      companies={usable.filter((c) => c.active).map(({ id: sid, name }) => ({ id: sid, name }))}
      previous={usable.filter((c) => !c.active).map(({ id: sid, name }) => ({ id: sid, name }))}
      first={first}
      initial={{
        supplierId: bill.companies[0]?.supplierId ?? '',
        billNumber: bill.billNumber ?? '',
        billDate: bill.billDate,
        note: bill.note ?? '',
        lines: bill.itemLines.map((l) => ({
          key: `line-${l.id}`,
          lineId: l.id,
          productId: l.productId,
          name: l.name,
          size: l.size,
          color: l.color,
          pack: l.pack,
          qty: l.qty,
          rate: rupeesText(l.ratePaise),
        })),
      }}
    />
  );
}

export default async function EditBillPage(props: PageProps<'/admin/bills/[id]/edit'>) {
  const t = await getT();
  const { id } = await props.params;
  return (
    <main className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link href={`/admin/bills/${id}`} aria-label={t('bills.back')} className={backButton}>
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t('bills.editTitle')}</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <EditBill id={id} />
      </Suspense>
    </main>
  );
}
