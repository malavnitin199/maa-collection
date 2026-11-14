import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { link, muted, okBox } from '@/components/ui/styles';
import { BarcodeLabel } from '@/features/catalog/barcode-label';
import { PrintButton } from '@/features/catalog/print-button';
import { STORE_ID } from '@/lib/app-config';
import { requireAdmin } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { getReceiptForLabels } from '@/server/services/products';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';

type Search = { receipt?: string; each?: string; created?: string };
const time = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

async function ReceiptLabels({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const { receipt: receiptId, each, created } = await searchParams;
  if (!receiptId || !/^[0-9a-f-]{36}$/i.test(receiptId)) notFound();
  const db = await requestDb();
  const [receipt, settings] = await Promise.all([getReceiptForLabels(db, STORE_ID, receiptId), getStoreSettings(db, STORE_ID)]);
  if (!receipt) notFound();
  const onePerItem = each === 'item';
  const pieces = receipt.lines.reduce((n, l) => n + Math.max(l.quantity, 0), 0);
  const labels = receipt.lines.flatMap((line) =>
    Array.from({ length: onePerItem ? 1 : Math.max(line.quantity, 0) }, (_, i) => ({ key: `${line.id}-${i}`, line })),
  );
  const base = `/admin/labels/print?receipt=${receipt.id}`;

  return (
    <>
      <div className="flex flex-col gap-3 print:hidden">
        {created && (
          <p role="status" className={okBox}>
            Saved {created} new item{created === '1' ? '' : 's'} with barcodes. Print the labels and stick one on each piece.
          </p>
        )}
        <div>
          <h1 className="text-2xl font-semibold">Labels</h1>
          <p className={`text-sm ${muted}`}>
            {receipt.supplierName ?? 'No supplier'}
            {receipt.billNumber && ` · bill ${receipt.billNumber}`} · {time.format(receipt.createdAt)} · by {receipt.staffName}
          </p>
        </div>
        <ul data-testid="receipt-lines" className="flex flex-col gap-1 text-sm">
          {receipt.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-2 border-b border-zinc-100 py-1 dark:border-zinc-900">
              <Link href={`/admin/products/${line.id}`} className={link}>
                {line.name} · {line.color} · {line.size}
              </Link>
              <span className="tabular-nums">{line.quantity} pcs</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <PrintButton label={`Print ${labels.length} label${labels.length === 1 ? '' : 's'}`} />
          {onePerItem ? (
            <Link href={base} className={`text-sm ${link}`}>
              One per piece ({pieces})
            </Link>
          ) : (
            <Link href={`${base}&each=item`} className={`text-sm ${link}`}>
              One per item instead ({receipt.lines.length})
            </Link>
          )}
        </div>
      </div>
      <ul data-testid="label-sheet" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 print:mt-0 print:grid-cols-3 print:gap-1">
        {labels.map(({ key, line }) => (
          <li key={key}>
            <BarcodeLabel product={line} compact priceCode={labelPriceCode(settings, line.costPaise)} />
          </li>
        ))}
      </ul>
      {labels.length === 0 && <p className={`text-sm ${muted}`}>No pieces in this delivery. Switch to one label per item.</p>}
    </>
  );
}

export default function PrintLabelsPage(props: PageProps<'/admin/labels/print'>) {
  return (
    <main>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading labels…</p>}>
        <ReceiptLabels searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </main>
  );
}
