import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { HangTag } from '@/features/catalog/hang-tag';
import { PrintButton } from '@/features/catalog/print-button';
import { STORE_ID } from '@/lib/app-config';
import { itemLink } from '@/lib/item-link';
import { tagSizeRange } from '@/lib/size-lists';
import { designSizesById } from '@/lib/size-prices';
import { appOrigin } from '@/server/app-origin';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { listCategories } from '@/server/services/catalog';
import { listProducts } from '@/server/services/products';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';

async function Labels() {
  await requireAnyPermission(['catalog', 'stock']);
  const db = await requestDb();
  const [all, settings, origin, categoryRows] = await Promise.all([listProducts(db, STORE_ID), getStoreSettings(db, STORE_ID), appOrigin(), listCategories(db, STORE_ID)]);
  const items = all.filter((p) => p.active);
  const designSizes = designSizesById(all);
  const categorySizes = new Map(categoryRows.map((c) => [c.id, c.sizes]));
  return (
    <>
      {/* A4, 4 × 4 tags per page. */}
      <style>{'@media print { @page { size: A4; margin: 8mm; } }'}</style>
      <ul data-testid="label-sheet" className="flex flex-wrap gap-[3mm]">
        {items.map((item) => (
          <li key={item.id} className="break-inside-avoid">
            <HangTag
              product={item}
              sizes={tagSizeRange((item.categoryId && categorySizes.get(item.categoryId)) || [], designSizes.get(item.id) ?? [], item.size)}
              qrValue={itemLink(origin, item.barcode)}
              priceCode={labelPriceCode(settings, item.costPaise)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function LabelsPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">{t('stk.labels.title')}</h1>
          <p className={`mt-1 text-sm ${muted}`}>{t('stk.labels.subtitle')}</p>
        </div>
        <PrintButton label={t('stk.labels.printAll')} />
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('stk.labels.loading')}</p>}>
        <Labels />
      </Suspense>
    </main>
  );
}
