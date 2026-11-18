import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { errorBox, link, muted, okBox, secondaryButton } from '@/components/ui/styles';
import { StickerLabel } from '@/features/catalog/barcode-label';
import { HangTag } from '@/features/catalog/hang-tag';
import { PrintButton } from '@/features/catalog/print-button';
import { STORE_ID, STORE_TIMEZONE } from '@/lib/app-config';
import type { MessageKey, T } from '@/lib/i18n';
import { itemLink } from '@/lib/item-link';
import { appOrigin } from '@/server/app-origin';
import { requireAnyPermission } from '@/server/auth';
import { getT, getLocale } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { getMyLabelsToday, getReceiptForLabels, tagSizesFor, type ReceiptLabelLine } from '@/server/services/products';
import { getStoreSettings, labelPriceCode, type StoreSettings } from '@/server/services/settings';
import { listTagLibrary } from '@/server/services/tag-library';
import { groupNote, groupTitle } from '@/features/tag-library/group-title';
import { formatDate } from '@/lib/i18n';
import { designKey } from '@/lib/design-groups';
import { formatPaise } from '@/lib/money';
import { groupTags, parseTagParams, tagFilter, tagLibraryHref, TAG_PRINT_MAX } from '@/lib/tag-library';

type Search = {
  receipt?: string;
  each?: string;
  created?: string;
  mine?: string;
  format?: string;
  photos?: string;
  /** From All tags (plan v13): `list=1` plus its filters, and `key` for one group. */
  list?: string;
  q?: string;
  supplier?: string;
  category?: string;
  made?: string;
  when?: string;
  stock?: string;
  group?: string;
  key?: string;
  design?: string;
};

/** Builds a link to this page with some query values changed. */
function hrefWith(params: Search, change: Partial<Search>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...change })) {
    if (value && key !== 'created' && key !== 'photos') next.set(key, value);
  }
  return `/admin/labels/print?${next.toString()}`;
}

/** "Add next item" (plan v17): the New item screen with this delivery's company and category chosen. */
function nextItemHref(supplierId?: string | null, categoryId?: string | null) {
  const next = new URLSearchParams();
  if (supplierId) next.set('supplier', supplierId);
  if (categoryId) next.set('category', categoryId);
  const query = next.toString();
  return query ? `/admin/stock/new?${query}` : '/admin/stock/new';
}

type SheetData = { settings: StoreSettings; origin: string; sizes: Map<string, string[]> };

/** Everything the tags need besides the lines: settings (code price), app address (QR), each tag's size row. */
async function sheetData(lines: ReceiptLabelLine[], settings: StoreSettings): Promise<SheetData> {
  const [origin, sizes] = await Promise.all([appOrigin(), tagSizesFor(await requestDb(), STORE_ID, lines)]);
  return { settings, origin, sizes };
}

const FORMATS: readonly (readonly [string | undefined, MessageKey])[] = [
  [undefined, 'stk.labels.format.a4'],
  ['tag', 'stk.labels.format.tag'],
  ['sticker', 'stk.labels.format.sticker'],
];

/** Shared controls + sheet: one label per piece (or per item); hang tags on A4 or a tag printer, or small stickers. */
function LabelSheet({ lines, params, data, t }: { lines: ReceiptLabelLine[]; params: Search; data: SheetData; t: T }) {
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
          <PrintButton label={t(labels.length === 1 ? 'stk.labels.printN.one' : 'stk.labels.printN.other', { n: labels.length })} />
          <Link href={hrefWith(params, { each: onePerItem ? undefined : 'item' })} className={`text-sm ${link}`}>
            {onePerItem ? t('stk.labels.perPiece', { n: pieces }) : t('stk.labels.perItem', { n: lines.length })}
          </Link>
          <Link href="/admin/labels" className={`text-sm ${link}`}>
            {t('stk.lib.seeAll')}
          </Link>
        </div>
        <div role="group" aria-label={t('stk.labels.formatAria')} className="flex gap-2 text-sm">
          {FORMATS.map(([value, label]) => {
            const active = (params.format ?? undefined) === value;
            return (
              <Link
                key={label}
                href={hrefWith(params, { format: value })}
                aria-current={active ? 'true' : undefined}
                className={`rounded-full border px-3 py-1 ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
              >
                {t(label)}
              </Link>
            );
          })}
        </div>
        <p className={`text-xs ${muted}`}>
          {t(sticker ? 'stk.labels.hint.sticker' : tagPrinter ? 'stk.labels.hint.tag' : 'stk.labels.hint.a4')}
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
      {labels.length === 0 && <p className={`mt-4 text-sm ${muted}`}>{t('stk.labels.noPieces')}</p>}
    </>
  );
}

async function MyLabelsToday({ params }: { params: Search }) {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'stock']), getT()]);
  const db = await requestDb();
  const [lines, settings] = await Promise.all([getMyLabelsToday(db, STORE_ID, me.id, STORE_TIMEZONE), getStoreSettings(db, STORE_ID)]);
  return (
    <>
      <div className="mb-3 print:hidden">
        <h1 className="text-2xl font-semibold">{t('stk.labels.mineTitle')}</h1>
        <p className={`text-sm ${muted}`}>{t(lines.length === 1 ? 'stk.labels.mine.one' : 'stk.labels.mine.other', { n: lines.length })}</p>
      </div>
      <LabelSheet lines={lines} params={params} data={await sheetData(lines, settings)} t={t} />
    </>
  );
}

/** What the All tags page shows (its filters), or one group of it: one tag per piece in stock, or one per item. */
async function LibraryLabels({ params }: { params: Search }) {
  const [, t] = await Promise.all([requireAnyPermission(['catalog', 'stock']), getT()]);
  const locale = await getLocale();
  const filters = parseTagParams(params);
  const db = await requestDb();
  const [rows, settings] = await Promise.all([listTagLibrary(db, STORE_ID, tagFilter(filters)), getStoreSettings(db, STORE_ID)]);
  const group = filters.key ? groupTags(rows, filters.group).find((g) => g.key === filters.key) : undefined;
  const inGroup = filters.key ? (group?.items ?? []) : rows;
  // One design (plan v14): same name, company and MRP.
  const picked = filters.design ? inGroup.filter((row) => designKey(row) === filters.design) : inGroup;
  const design = filters.design ? picked[0] : undefined;
  const lines: ReceiptLabelLine[] = picked.slice(0, TAG_PRINT_MAX).map((row) => ({ ...row, quantity: row.stock }));
  const note = design
    ? `${design.supplierName ?? t('stk.lib.noCompany')} · ${t('cat.design.mrp', { mrp: formatPaise(design.mrpPaise) })}`
    : group
      ? groupNote(group, t, locale)
      : null;
  return (
    <>
      <div className="mb-3 flex flex-col gap-1 print:hidden">
        <Link href={tagLibraryHref(filters)} className={`text-sm ${link}`}>
          {t('stk.lib.backToAll')}
        </Link>
        <h1 className="text-2xl font-semibold">{design ? design.name : group ? groupTitle(group, t, locale) : t('stk.lib.printTitle')}</h1>
        <p className={`text-sm ${muted}`}>
          {note && `${note} · `}
          {t('stk.lib.printCount', { n: lines.length })}
        </p>
        {picked.length > TAG_PRINT_MAX && (
          <p role="status" className={errorBox}>
            {t('stk.lib.printCapped', { n: TAG_PRINT_MAX })}
          </p>
        )}
      </div>
      <LabelSheet lines={lines} params={params} data={await sheetData(lines, settings)} t={t} />
    </>
  );
}

async function ReceiptLabels({ searchParams }: { searchParams: Promise<Search> }) {
  const [, t] = await Promise.all([requireAnyPermission(['catalog', 'stock']), getT()]);
  const locale = await getLocale();
  const params = await searchParams;
  if (params.mine === 'today') return <MyLabelsToday params={params} />;
  if (params.list === '1') return <LibraryLabels params={params} />;
  if (!params.receipt || !/^[0-9a-f-]{36}$/i.test(params.receipt)) notFound();
  const db = await requestDb();
  const [receipt, settings] = await Promise.all([getReceiptForLabels(db, STORE_ID, params.receipt), getStoreSettings(db, STORE_ID)]);
  if (!receipt) notFound();

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 print:hidden">
        {params.photos === 'failed' && (
          <p role="alert" className={errorBox}>
            {t('stk.labels.photoFailed')}
          </p>
        )}
        {params.created && (
          <div className="flex flex-col gap-2">
            <p role="status" className={okBox}>
              {t(params.created === '1' ? 'stk.labels.created.one' : 'stk.labels.created.other', { n: params.created })}
            </p>
            {/* Plan v17: straight on to the next item, same company and category. */}
            <Link href={nextItemHref(receipt.supplierId, receipt.lines[0]?.categoryId)} className={`${secondaryButton} w-fit`}>
              {t('stk.labels.addNext')}
            </Link>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">{t('stk.labels.heading')}</h1>
          <p className={`text-sm ${muted}`}>
            {receipt.supplierName ?? t('stk.noSupplier')}
            {receipt.billNumber && ` · ${t('stk.labels.bill', { bill: receipt.billNumber })}`} · {formatDate(locale, receipt.createdAt, 'dateTime')} ·{' '}
            {t('stk.labels.by', { name: receipt.staffName })}
          </p>
        </div>
        <ul data-testid="receipt-lines" className="flex flex-col gap-1 text-sm">
          {receipt.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-2 border-b border-zinc-100 py-1 dark:border-zinc-900">
              <Link href={`/admin/products/${line.id}`} className={link}>
                {line.name} · {line.color} · {line.size}
              </Link>
              <span className="tabular-nums">{t('stk.labels.pcs', { n: line.quantity })}</span>
            </li>
          ))}
        </ul>
      </div>
      <LabelSheet lines={receipt.lines} params={params} data={await sheetData(receipt.lines, settings)} t={t} />
    </>
  );
}

export default async function PrintLabelsPage(props: PageProps<'/admin/labels/print'>) {
  const t = await getT();
  return (
    <main>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('stk.labels.loading')}</p>}>
        <ReceiptLabels searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </main>
  );
}
