import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { link, muted, okBox } from '@/components/ui/styles';
import { StickerLabel } from '@/features/catalog/barcode-label';
import { HangTag } from '@/features/catalog/hang-tag';
import { PrintButton } from '@/features/catalog/print-button';
import { STORE_ID, STORE_TIMEZONE } from '@/lib/app-config';
import { itemLink } from '@/lib/item-link';
import { appOrigin } from '@/server/app-origin';
import { requireAnyPermission } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { getMyLabelsToday, getReceiptForLabels, tagSizesFor, type ReceiptLabelLine } from '@/server/services/products';
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

type SheetData = { settings: StoreSettings; origin: string; sizes: Map<string, string[]> };

/** Everything the tags need besides the lines: settings (code price), app address (QR), each tag's size row. */
async function sheetData(lines: ReceiptLabelLine[], settings: StoreSettings): Promise<SheetData> {
  const [origin, sizes] = await Promise.all([appOrigin(), tagSizesFor(await requestDb(), STORE_ID, lines)]);
  return { settings, origin, sizes };
}

const FORMATS = [
  [undefined, 'Tags on A4'],
  ['tag', 'Tag printer 40×60 mm'],
  ['sticker', 'Sticker printer 50×25 mm'],
] as const;

/** Shared controls + sheet: one label per piece (or per item); hang tags on A4 or a tag printer, or small stickers. */
function LabelSheet({ lines, params, data }: { lines: ReceiptLabelLine[]; params: Search; data: SheetData }) {
  const { settings, origin, sizes } = data;
  const onePerItem = params.each === 'item';
  const sticker = params.format === 'sticker';
  const tagPrinter = params.format === 'tag';
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
          {FORMATS.map(([value, label]) => {
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
        <p className={`text-xs ${muted}`}>
          {sticker
            ? 'Choose your label printer and set the paper to 50 × 25 mm (no margins). Each sticker prints on its own label (barcode only).'
            : tagPrinter
              ? 'Choose your tag printer and set the paper to 40 × 60 mm (no margins). Each tag prints on its own label.'
              : 'Hang tags, 40 × 60 mm, 16 per A4 page: cut along the border and punch the circle for the thread. Tick a size box with a pen if needed.'}
        </p>
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
        <>
          <style>{tagPrinter ? '@media print { @page { size: 40mm 60mm; margin: 0; } }' : '@media print { @page { size: A4; margin: 8mm; } }'}</style>
          <ul data-testid="label-sheet" className={`mt-4 flex flex-wrap gap-[3mm] print:m-0 ${tagPrinter ? 'print:block' : ''}`}>
            {labels.map(({ key, line }) => (
              <li key={key} className={tagPrinter ? 'print:break-after-page [&>div]:print:border-0' : 'break-inside-avoid'}>
                <HangTag
                  product={line}
                  sizes={sizes.get(line.id)}
                  qrValue={itemLink(origin, line.barcode)}
                  priceCode={labelPriceCode(settings, line.costPaise)}
                />
              </li>
            ))}
          </ul>
        </>
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
      <LabelSheet lines={lines} params={params} data={await sheetData(lines, settings)} />
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
      <LabelSheet lines={receipt.lines} params={params} data={await sheetData(receipt.lines, settings)} />
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
