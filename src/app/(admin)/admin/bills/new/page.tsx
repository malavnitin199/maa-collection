import Link from 'next/link';
import { Suspense } from 'react';
import { IconBack } from '@/components/ui/icons';
import { backButton } from '@/components/ui/styles';
import { BillEditor, type EditorLine } from '@/features/bills/bill-editor';
import { startLine } from '@/features/bills/sheet-parts';
import { rupeesText } from '@/lib/money';
import { STORE_ID } from '@/lib/app-config';
import { browseBillProductsAction } from '@/server/actions/bills';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listSuppliers } from '@/server/services/catalog';
import { getProduct, listDesignVariants, shopToday } from '@/server/services/products';

const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

/**
 * New bill (owner's feedback 2026-11-22, ADR-061): an optional company and the shop's products
 * as lines. `?product=<id>` (Make bill on a product's page): that product's sizes start on the
 * bill — each with its pieces in stock and purchase price — and its company is chosen;
 * `?supplier=<id>` chooses a company.
 */
async function NewBill({ supplier, product }: { supplier?: string; product?: string }) {
  await requirePermission('costs');
  const db = await requestDb();
  const [companies, first] = await Promise.all([listSuppliers(db, STORE_ID), browseBillProductsAction({ offset: 0 })]);
  const usable = companies.filter((c) => !c.deletedAt);
  let supplierId = usable.find((c) => c.id === supplier && c.active)?.id ?? '';
  let lines: EditorLine[] = [];
  const start = product ? await getProduct(db, STORE_ID, product) : null;
  if (start) {
    const variants = (await listDesignVariants(db, STORE_ID, start.id)).filter((v) => v.active);
    const withStock = variants.filter((v) => v.stock > 0);
    lines = (withStock.length ? withStock : variants).map((v) => {
      const box = v.packSize ? (v.packCostPaise ?? (v.costPaise === null ? null : v.costPaise * v.packSize)) : null;
      const start = startLine({ stock: v.stock, costPaise: v.costPaise, pack: v.packSize, boxCostPaise: box });
      return { key: `p-${v.id}`, productId: v.id, name: v.name, size: v.size, color: v.color, pack: v.packSize, qty: start.qty, rate: rupeesText(start.ratePaise) };
    });
    supplierId = usable.find((c) => c.id === start.supplierId && c.active)?.id ?? supplierId;
  }
  return (
    <BillEditor
      key={`${supplier ?? ''}|${product ?? ''}`}
      today={shopToday()}
      companies={usable.filter((c) => c.active).map(({ id, name }) => ({ id, name }))}
      previous={usable.filter((c) => !c.active).map(({ id, name }) => ({ id, name }))}
      first={first}
      initial={{ supplierId, billNumber: '', billDate: shopToday(), note: '', lines }}
    />
  );
}

export default async function NewBillPage(props: PageProps<'/admin/bills/new'>) {
  const t = await getT();
  const params = (await props.searchParams) as { supplier?: string; product?: string };
  return (
    <main className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link href="/admin/bills" aria-label={t('bills.back')} className={backButton}>
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t('bills.newTitle')}</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <NewBill supplier={uuid(typeof params.supplier === 'string' ? params.supplier : undefined)} product={uuid(typeof params.product === 'string' ? params.product : undefined)} />
      </Suspense>
    </main>
  );
}
