import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { HangTag } from '@/features/catalog/hang-tag';
import { PrintButton } from '@/features/catalog/print-button';
import { STORE_ID } from '@/lib/app-config';
import { itemLink } from '@/lib/item-link';
import { designSizesById } from '@/lib/size-prices';
import { appOrigin } from '@/server/app-origin';
import { requireAnyPermission } from '@/server/auth';
import { listProducts } from '@/server/services/products';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';

async function Labels() {
  await requireAnyPermission(['catalog', 'stock']);
  const db = await requestDb();
  const [all, settings, origin] = await Promise.all([listProducts(db, STORE_ID), getStoreSettings(db, STORE_ID), appOrigin()]);
  const items = all.filter((p) => p.active);
  const sizes = designSizesById(all);
  return (
    <>
      {/* A4, 3 × 3 tags per page. */}
      <style>{'@media print { @page { size: A4; margin: 8mm; } }'}</style>
      <ul data-testid="label-sheet" className="flex flex-wrap gap-[3mm]">
        {items.map((item) => (
          <li key={item.id} className="break-inside-avoid">
            <HangTag
              product={item}
              sizes={sizes.get(item.id)}
              qrValue={itemLink(origin, item.barcode)}
              priceCode={labelPriceCode(settings, item.costPaise)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

export default function LabelsPage() {
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Test labels</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            One tag per item (50 × 80 mm). Scan the barcode or the QR code with the phone camera on the Sell screen or
            with a USB/Bluetooth scanner, or print this page (9 tags per A4 sheet).
          </p>
        </div>
        <PrintButton label="Print all labels" />
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading labels…</p>}>
        <Labels />
      </Suspense>
    </main>
  );
}
