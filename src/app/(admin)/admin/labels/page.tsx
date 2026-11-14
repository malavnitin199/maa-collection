import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { requestDb } from '@/server/request-db';
import { BarcodeLabel } from '@/features/catalog/barcode-label';
import { PrintButton } from '@/features/catalog/print-button';
import { STORE_ID } from '@/lib/app-config';
import { requireAdmin } from '@/server/auth';
import { listProducts } from '@/server/services/products';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';

async function Labels() {
  await requireAdmin();
  const db = await requestDb();
  const [all, settings] = await Promise.all([listProducts(db, STORE_ID), getStoreSettings(db, STORE_ID)]);
  const items = all.filter((p) => p.active);
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <BarcodeLabel product={item} priceCode={labelPriceCode(settings, item.costPaise)} />
        </li>
      ))}
    </ul>
  );
}

export default function LabelsPage() {
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Test labels</h1>
          <p className={`mt-1 text-sm ${muted}`}>
            One barcode per item. Scan it with the phone camera on the POS screen or with a USB/Bluetooth scanner, or
            print this page.
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
