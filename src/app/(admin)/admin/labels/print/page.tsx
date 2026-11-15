import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { link, muted, okBox } from '@/components/ui/styles';
import { BarcodeLabel, StickerLabel } from '@/features/catalog/barcode-label';
import { PrintButton } from '@/features/catalog/print-button';
import { STORE_ID, STORE_TIMEZONE } from '@/lib/app-config';
import { requireAnyPermission } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { getMyLabelsToday, getReceiptForLabels, type ReceiptLabelLine } from '@/server/services/products';
import { getStoreSettings, labelPriceCode, type StoreSettings } from '@/server/services/settings';

type Search = { receipt?: string; each?: string; created?: string; mine?: string; format?: string };
const time = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

/** Builds a link to this page with some query values changed. */
function hrefWith(params: Search, change: Partial<Search>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...change })) {
    if (value && key !== 'created') next.set(key, value);
  }
  return `/admin/labels/print?${next.toString()}`;
}

/** Shared controls + sheet: one label per piece (or per item), A4 sheet or 50×25 mm stickers. */
function LabelSheet({ lines, params, settings }: { lines: ReceiptLabelLine[]; params: Search; settings: StoreSettings }) {
  const onePerItem = params.each === 'item';
  const sticker = params.format === 'sticker';
  const pieces = lines.reduce((n, l) => n + Math.max(l.quantity, 0), 0);
  const labels = lines.flatMap((line, n) =>
    Array.from({ length: onePerItem ? 1 : Math.max(line.quantity, 0) }, (_, i) => ({ key: `${line.id}-${n}-${i}`, line })),
  );
  return (
    <>
      <div className="flex flex-col gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <PrintButton label={`Print ${labels.length} label${labels.length === 1 ? '' : 's'}`} />
          <Link href={hrefWith(params, { each: onePerItem ? undefined : 'item' })} className={`text-sm ${link}`}>
            {onePerItem ? `One per piece (${pieces})` : `One per item instead (${lines.length})`}
          </Link>
        </div>
        <div role="group" aria-label="Label format" className="flex gap-2 text-sm">
          {[
            [undefined, 'A4 sheet'],
            ['sticker', 'Sticker printer 50×25 mm'],
          ].map(([value, label]) => {
            const active = (params.format ?? undefined) === value;
            return (
              <Link
                key={label}
                href={hrefWith(params, { format: value })}
                aria-current={active ? 'true' : undefined}
                className={`rounded-full border px-3 py-1 ${active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        {sticker && (
          <p className={`text-xs ${muted}`}>
            Choose your label printer and set the paper to 50 × 25 mm (no margins). Each sticker prints on its own label.
          </p>
        )}
      </div>
      {sticker ? (
        <>
          {/* One 50×25 mm page per sticker when printing. */}
          <style>{'@media print { @page { size: 50mm 25mm; margin: 0; } }'}</style>
          <ul data-testid="label-sheet" className="mt-4 flex flex-wrap gap-2 print:m-0 print:block">
            {labels.map(({ key, line }) => (
              <li key={key} className="print:break-after-page">
                <StickerLabel product={line} priceCode={labelPriceCode(settings, line.costPaise)} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul data-testid="label-sheet" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 print:mt-0 print:grid-cols-3 print:gap-1">
          {labels.map(({ key, line }) => (
            <li key={key}>
              <BarcodeLabel product={line} compact priceCode={labelPriceCode(settings, line.costPaise)} />
            </li>
          ))}
        </ul>
      )}
      {labels.length === 0 && <p className={`mt-4 text-sm ${muted}`}>No pieces here. Switch to one label per item.</p>}
    </>
  );
}

async function MyLabelsToday({ params }: { params: Search }) {
  const me = await requireAnyPermission(['catalog', 'stock']);
  const db = await requestDb();
  const [lines, settings] = await Promise.all([getMyLabelsToday(db, STORE_ID, me.id, STORE_TIMEZONE), getStoreSettings(db, STORE_ID)]);
  return (
    <>
      <div className="mb-3 print:hidden">
        <h1 className="text-2xl font-semibold">My labels today</h1>
        <p className={`text-sm ${muted}`}>
          {lines.length} item{lines.length === 1 ? '' : 's'} you entered today
        </p>
      </div>
      <LabelSheet lines={lines} params={params} settings={settings} />
    </>
  );
}

async function ReceiptLabels({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAnyPermission(['catalog', 'stock']);
  const params = await searchParams;
  if (params.mine === 'today') return <MyLabelsToday params={params} />;
  if (!params.receipt || !/^[0-9a-f-]{36}$/i.test(params.receipt)) notFound();
  const db = await requestDb();
  const [receipt, settings] = await Promise.all([getReceiptForLabels(db, STORE_ID, params.receipt), getStoreSettings(db, STORE_ID)]);
  if (!receipt) notFound();

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 print:hidden">
        {params.created && (
          <p role="status" className={okBox}>
            Saved {params.created} new item{params.created === '1' ? '' : 's'} with barcodes. Print the labels and stick one on each piece.
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
      </div>
      <LabelSheet lines={receipt.lines} params={params} settings={settings} />
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
