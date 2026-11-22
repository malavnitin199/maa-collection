'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { input, muted, secondaryButton } from '@/components/ui/styles';
import { chip, chipTone } from '@/features/catalog/chips';
import { useT } from '@/features/i18n/i18n-provider';
import { CameraScanner } from '@/features/scanning/camera-scanner';
import { browseBillProductsAction, findBillProductAction, type BillDesign, type BillScanned } from '@/server/actions/bills';

/** A size as a bill shows it; no size = N/A. Never the colour (owner's rule, ADR-049). */
export const sizeLabel = (p: { size: string }, na: string) => p.size.trim() || na;

/**
 * New bill's products (owner's feedback 2026-11-22, ADR-061): the shop's products, newest
 * first, a page at a time — more load by themselves as you scroll (or with Show more); type to
 * search by name, code or barcode; Enter (a barcode gun) or 📷 Scan finds a tag and puts it on
 * the bill. Each design shows its sizes as chips with their pieces: tap one to add that size,
 * or + All sizes. Chips of sizes already on the bill are ticked with their quantity.
 */
export function ProductBrowser({
  first,
  onBill,
  onPick,
  onPickAll,
  onScanned,
  scannedFooter,
}: {
  /** The first page, from the server (no waiting on open). */
  first: { designs: BillDesign[]; more: boolean };
  /** Item id → quantity on the bill. */
  onBill: ReadonlyMap<string, number>;
  /** Tap on a size chip: add it (with its pieces) or one more. */
  onPick: (item: BillScanned) => void;
  onPickAll: (design: BillDesign) => void;
  /** A scanned / typed code's item: one piece more on the bill. */
  onScanned: (item: BillScanned) => void;
  /** Under the camera picture: the last item scanned and its quantity. */
  scannedFooter: (last: BillScanned | null, problem: string | null) => React.ReactNode;
}) {
  const t = useT();
  const na = t('common.na');
  const [query, setQuery] = useState('');
  const [list, setList] = useState(first);
  const [loading, startLoading] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [last, setLast] = useState<BillScanned | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const sentinel = useRef<HTMLDivElement>(null);
  const asked = useRef(query);

  const search = (value: string) => {
    window.clearTimeout(timer.current);
    asked.current = value;
    startLoading(async () => {
      const page = await browseBillProductsAction({ query: value, offset: 0 });
      if (asked.current === value) setList(page);
    });
  };
  const loadMore = () => {
    if (loading || !list.more) return;
    const value = asked.current;
    const offset = list.designs.length;
    startLoading(async () => {
      const page = await browseBillProductsAction({ query: value, offset });
      if (asked.current === value) setList((now) => ({ designs: [...now.designs, ...page.designs.filter((d) => !now.designs.some((x) => x.key === d.key))], more: page.more }));
    });
  };
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });
  // More load by themselves when the end of the list comes into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMoreRef.current(), { rootMargin: '240px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [list.more]);

  /** A tag read by the camera or typed / scanned into the box. */
  const findCode = async (code: string) => {
    const item = await findBillProductAction(code);
    if (!item) {
      setProblem(t('bills.notFoundCode', { code: code.length > 40 ? `${code.slice(0, 40)}…` : code }));
      return false;
    }
    setProblem(null);
    setLast(item);
    onScanned(item);
    return true;
  };

  return (
    <section aria-label={t('bills.items')} data-testid="bill-browser" className="flex flex-col gap-2.5">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setProblem(null);
            const value = e.target.value;
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => search(value.trim()), 250);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            // A barcode gun ends with Enter: put that tag on the bill. It never sends the bill.
            e.preventDefault();
            const value = query.trim();
            if (!value) return;
            startLoading(async () => {
              if (await findCode(value)) {
                setQuery('');
                search('');
              } else {
                search(value);
              }
            });
          }}
          placeholder={t('bills.searchItems')}
          aria-label={t('bills.searchItems')}
          className={`${input} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={() => {
            setProblem(null);
            setLast(null);
            setScanning(true);
          }}
          className={`${secondaryButton} shrink-0 gap-1.5 px-4`}
        >
          <span aria-hidden>📷</span>
          {t('bills.scan')}
        </button>
      </div>
      {problem && !scanning && (
        <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {problem}
        </p>
      )}

      <p className={`text-xs font-bold tracking-wide uppercase ${muted}`}>{query.trim() ? t('bills.results') : t('bills.recent')}</p>
      <ul data-testid="bill-products" className="flex flex-col gap-2">
        {list.designs.map((d) => (
          <li key={d.key} data-testid="bill-product" className="rounded-2xl border border-zinc-200 bg-surface p-3 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{d.name}</span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`${chip} ${chipTone.company}`}>{d.supplierName ?? na}</span>
                  <span className={`${chip} ${chipTone.items}`}>{t('cat.value.pcs', { pcs: d.pieces })}</span>
                </span>
              </span>
              {d.sizes.length > 1 && (
                <button
                  type="button"
                  aria-label={`${t('bills.allSizes')}: ${d.name}`}
                  onClick={() => onPickAll(d)}
                  className="shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition active:scale-95"
                >
                  {t('bills.allSizes')}
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.sizes.map((s) => {
                const label = sizeLabel(s, na);
                const on = onBill.get(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={t('bills.addItem', { name: `${d.name} · ${label}` })}
                    aria-pressed={on !== undefined}
                    onClick={() => onPick({ ...s, name: d.name, supplierName: d.supplierName })}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm transition active:scale-95 ${
                      on !== undefined
                        ? 'border-brand-600 bg-brand-600 font-bold text-white'
                        : 'border-brand-200 bg-brand-50 text-brand-900 hover:border-brand-400 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-100'
                    }`}
                  >
                    <span className="font-semibold">{label}</span>
                    <span className={`tabular-nums ${on !== undefined ? '' : muted}`}>· {s.stock}</span>
                    {on !== undefined && <span aria-hidden>✓{on}</span>}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {!loading && list.designs.length === 0 && <p className={`text-sm ${muted}`}>{t('bills.noMatch')}</p>}
      {loading && <p className={`text-sm ${muted}`}>{t('common.loading')}</p>}
      {list.more && (
        <div ref={sentinel} className="flex justify-center">
          <button type="button" onClick={loadMore} disabled={loading} className={`${secondaryButton} py-1.5`}>
            {t('bills.showMore')}
          </button>
        </div>
      )}

      {scanning && (
        <CameraScanner
          keepOpen
          onDecode={(code) => {
            void findCode(code);
          }}
          onClose={() => setScanning(false)}
          footer={scannedFooter(last, problem)}
        />
      )}
    </section>
  );
}
