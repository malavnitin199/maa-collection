'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { card, errorBox, input, muted, primaryButton } from '@/components/ui/styles';
import { BillSheet } from '@/features/bills/bill-sheet';
import { ProductBrowser, sizeLabel } from '@/features/bills/product-browser';
import { itemsPart, startLine } from '@/features/bills/sheet-parts';
import { CompanyPicker } from '@/features/catalog/company-picker';
import { useDone } from '@/features/feedback/effects';
import { useT } from '@/features/i18n/i18n-provider';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { formatPaise, rupeesText } from '@/lib/money';
import { saveItemBillAction, type BillDesign, type BillScanned } from '@/server/actions/bills';

type Option = { id: string; name: string };
/** A line of the bill being made or changed: a new item (`productId`) or one already on the bill (`lineId`). */
export type EditorLine = {
  key: string;
  lineId?: string;
  productId: string | null;
  name: string;
  size: string;
  color: string;
  /** Pieces in stock (null on a saved line). */
  stock: number | null;
  /** A box item (ADR-047): quantity in boxes, the rate per box. */
  pack: number | null;
  qty: number;
  rate: string;
};

const MAX = 100_000;
const stepper =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-lg font-bold transition active:scale-90 disabled:opacity-30 dark:border-zinc-700';
const clamp = (n: number) => Math.min(MAX, Math.max(1, Math.trunc(Number.isFinite(n) ? n : 1)));

/**
 * New bill and Edit bill (owner's feedback 2026-11-22, ADR-061). A bill stands on its own:
 * a company if you like (one), and the shop's products as lines. Lines start with what the
 * product has now — its pieces and purchase price — and both can be changed; − / + and ✕ per
 * line. Products come from the list below (newest first, more as you scroll), a search, a
 * barcode gun or the camera (each tag scanned = one piece more, its quantity right under the
 * picture). Step 2 shows the bill like the paper to check, with its number, date and note.
 * The saved bill keeps its own copy of every line: changing the products later never changes it.
 */
export function BillEditor({
  billId,
  today,
  companies,
  previous,
  first,
  initial,
}: {
  billId?: string;
  today: string;
  companies: Option[];
  previous: Option[];
  first: { designs: BillDesign[]; more: boolean };
  initial: { supplierId: string; billNumber: string; billDate: string; note: string; lines: EditorLine[] };
}) {
  const t = useT();
  const router = useRouter();
  const done = useDone();
  const na = t('common.na');
  const [supplier, setSupplier] = useState<Option | null>(() => [...companies, ...previous].find((c) => c.id === initial.supplierId) ?? null);
  const [lines, setLines] = useState<EditorLine[]>(initial.lines);
  const [billNumber, setBillNumber] = useState(initial.billNumber);
  const [billDate, setBillDate] = useState(initial.billDate);
  const [note, setNote] = useState(initial.note);
  const [step, setStep] = useState<'pick' | 'check'>('pick');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const operationId = useRef<string | null>(null);
  const keys = useRef(0);
  const touched = () => (operationId.current = null);

  const amountOf = (l: EditorLine) => {
    const paise = l.rate.trim() ? rupeesToPaise(l.rate) : null;
    return paise === null ? null : paise * l.qty;
  };
  const total = lines.reduce((n, l) => n + (amountOf(l) ?? 0), 0);
  const pieces = lines.reduce((n, l) => n + l.qty, 0);
  const onBill = useMemo(() => new Map(lines.filter((l) => l.productId).map((l) => [l.productId as string, l.qty])), [lines]);
  const nameOf = (l: { name: string; size: string; color: string }) => `${l.name} · ${sizeLabel(l, na)}`;

  /** Puts an item on the bill — `qty` pieces, or (from the list) its pieces in stock — or adds to its line. */
  const put = (item: BillScanned, qty?: number) => {
    touched();
    setFlash(item.id);
    setLines((list) => {
      const there = list.find((l) => l.productId === item.id);
      if (there) return list.map((l) => (l === there ? { ...l, qty: clamp(l.qty + (qty ?? 1)) } : l));
      keys.current += 1;
      const start = startLine(item);
      return [
        ...list,
        {
          key: `new-${keys.current}`,
          productId: item.id,
          name: item.name,
          size: item.size,
          color: item.color,
          stock: item.stock,
          pack: item.pack,
          qty: clamp(qty ?? start.qty),
          rate: rupeesText(start.ratePaise),
        },
      ];
    });
  };
  const putAll = (design: BillDesign) => {
    for (const s of design.sizes) if (!onBill.has(s.id)) put({ ...s, name: design.name, supplierName: design.supplierName });
  };
  const change = (key: string, patch: Partial<EditorLine>) => {
    touched();
    setLines((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  // The line just added glows for a moment and comes into view.
  useEffect(() => {
    if (!flash) return;
    document.querySelector(`[data-line-of="${flash}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const timer = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(timer);
  }, [flash, lines]);

  // The phone's back button on the check step goes back to the lines, not off the page.
  const guarded = useRef(false);
  const skipPop = useRef(false);
  useEffect(() => {
    if (step === 'check' && !guarded.current) {
      window.history.pushState(window.history.state, '');
      guarded.current = true;
    } else if (step === 'pick' && guarded.current) {
      guarded.current = false;
      skipPop.current = true;
      window.history.back();
    }
  }, [step]);
  useEffect(() => {
    const onPop = () => {
      if (skipPop.current) {
        skipPop.current = false;
        return;
      }
      if (!guarded.current) return;
      guarded.current = false;
      setStep('pick');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const goTo = (next: 'pick' | 'check') => {
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = () => {
    setError(null);
    operationId.current ??= crypto.randomUUID();
    const input = {
      operationId: operationId.current,
      billNumber,
      billDate,
      note,
      supplierId: supplier?.id ?? '',
      lines: lines.map((l) => ({ lineId: l.lineId, productId: l.lineId ? undefined : (l.productId ?? undefined), quantity: l.qty, rate: l.rate })),
    };
    startSaving(async () => {
      const result = await saveItemBillAction(input, billId);
      if (!result.ok) {
        done.show({ kind: 'error', title: t('done.notSaved'), detail: result.error });
        return setError(result.error);
      }
      done.show({
        title: t('bills.saved'),
        amount: formatPaise(total),
        lines: [
          { label: t('bills.number'), value: billNumber.trim() },
          { label: t('bills.date'), value: billDate },
          { label: t('bills.colCompany'), value: supplier?.name ?? t('bills.noCompany') },
          { label: t('bills.items'), value: t('bills.itemsFooter', { n: lines.length, pcs: pieces }) },
        ].filter((line) => line.value),
      });
      guarded.current = false;
      operationId.current = null;
      if (!billId) {
        // Next keeps this page alive: start clean for the next bill.
        setStep('pick');
        setLines([]);
        setBillNumber('');
        setBillDate(today);
        setNote('');
      }
      router.push(`/admin/bills/${result.id}`);
    });
  };

  const totals = (
    <p className="min-w-0 text-sm">
      <span data-testid="bill-picked" className={`block text-xs ${muted}`}>
        {t('bills.itemsFooter', { n: lines.length, pcs: pieces })}
      </span>
      <span className="font-semibold">
        {t('bills.total')}: <span data-testid="bill-total" className="text-lg font-bold tabular-nums">{formatPaise(total)}</span>
      </span>
    </p>
  );

  return (
    <form
      data-testid="bill-editor"
      data-step={step}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 'pick') return lines.length > 0 && goTo('check');
        save();
      }}
    >
      {done.node}
      <div className={`${card} flex flex-col gap-3`}>
        <p className={`text-xs font-semibold ${muted}`}>
          {t('bills.step', { n: step === 'pick' ? 1 : 2 })} · {step === 'pick' ? t('bills.step.pickItems') : t('bills.step.check')}
        </p>

        {step === 'pick' ? (
          <>
            <CompanyPicker
              label={t('bills.companyOptional')}
              companies={companies}
              previous={previous}
              value={supplier?.id ?? ''}
              emptyLabel={na}
              onChange={(id, name) => {
                touched();
                setSupplier(id ? { id, name } : null);
              }}
            />
            <section aria-label={t('bills.items')} className="flex flex-col gap-2">
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{t('bills.items')}</span>
              </p>
              {lines.length === 0 ? (
                <p data-testid="bill-lines-empty" className={`rounded-xl border border-dashed border-zinc-300 px-3 py-4 text-center text-sm dark:border-zinc-700 ${muted}`}>
                  {t('bills.linesEmpty')}
                </p>
              ) : (
                <ul data-testid="bill-lines" className="flex flex-col gap-2">
                  {lines.map((l) => {
                    const name = nameOf(l);
                    const amount = amountOf(l);
                    return (
                      <li
                        key={l.key}
                        data-testid="bill-line"
                        data-line-of={l.productId ?? undefined}
                        className={`rounded-2xl border p-3 transition-colors duration-500 ${
                          flash && flash === l.productId ? 'border-brand-500 bg-brand-50 dark:bg-brand-950' : 'border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{l.name}</span>
                            <span className={`block text-xs ${muted}`}>
                              {sizeLabel(l, na)}
                              {l.pack && ` · ${t('pack.sizeOf', { n: l.pack })}`}
                              {l.stock !== null && ` · ${t('bills.inStock', { n: l.stock })}`}
                            </span>
                          </span>
                          <button
                            type="button"
                            aria-label={t('bills.removeItem', { name })}
                            onClick={() => {
                              touched();
                              setLines((list) => list.filter((x) => x.key !== l.key));
                            }}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span className="flex items-center gap-1.5">
                            <button type="button" aria-label={t('bills.itemLess', { name })} disabled={l.qty <= 1} onClick={() => change(l.key, { qty: clamp(l.qty - 1) })} className={stepper}>
                              −
                            </button>
                            <input
                              inputMode="numeric"
                              aria-label={t('bills.itemQty', { name })}
                              value={String(l.qty)}
                              onChange={(e) => change(l.key, { qty: clamp(Number(e.target.value.replace(/[^\d]/g, '')) || 1) })}
                              className={`${input} w-16 px-1 text-center text-lg font-bold tabular-nums`}
                            />
                            <button type="button" aria-label={t('bills.itemMore', { name })} onClick={() => change(l.key, { qty: clamp(l.qty + 1) })} className={stepper}>
                              +
                            </button>
                          </span>
                          <label className="flex items-center gap-1 text-sm font-medium">
                            <span className={muted}>×</span>₹
                            <input
                              inputMode="decimal"
                              aria-label={t('bills.lineRate', { name })}
                              value={l.rate}
                              placeholder={na}
                              onChange={(e) => change(l.key, { rate: e.target.value })}
                              className={`${input} w-24 px-2 tabular-nums`}
                            />
                          </label>
                          <span data-testid="bill-line-amount" className="ml-auto text-base font-bold tabular-nums">
                            {amount === null ? na : formatPaise(amount)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        ) : (
          <div className="rise-in flex flex-col gap-3">
            <div data-testid="bill-party" className="flex flex-col gap-0.5">
              <span className={`text-xs font-medium ${muted}`}>{t('bills.sheet.party')}</span>
              <span className="text-sm font-semibold">{supplier?.name ?? t('bills.noCompany')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
                {t('bills.number')}
                <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} maxLength={40} className={input} />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
                {t('bills.date')}
                <input type="date" value={billDate} max={today} onChange={(e) => setBillDate(e.target.value)} className={`${input} min-w-0`} />
              </label>
            </div>
            <BillSheet
              parts={itemsPart(
                lines.map((l) => {
                  const rate = l.rate.trim() ? rupeesToPaise(l.rate) : null;
                  return { name: l.name, size: l.size, color: l.color, pack: l.pack, qty: l.qty, ratePaise: rate, amountPaise: rate === null ? 0 : rate * l.qty };
                }),
              )}
            />
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('bills.note')}
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={input} />
            </label>
          </div>
        )}

        {error && (
          <p role="alert" className={errorBox}>
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {totals}
          <span className="flex shrink-0 items-center gap-2">
            {step === 'check' && (
              <button type="button" onClick={() => goTo('pick')} className="min-h-12 rounded-xl border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-700">
                {t('bills.back.step')}
              </button>
            )}
            <button type="submit" disabled={saving || lines.length === 0} className={`${primaryButton} min-h-12 shrink-0 px-6`}>
              {saving ? t('common.saving') : step === 'pick' ? t('bills.next') : billId ? t('bills.saveChanges') : t('bills.save')}
            </button>
          </span>
        </div>
      </div>

      {step === 'pick' && (
        <div className={`${card} flex flex-col gap-2`}>
          <ProductBrowser
            first={first}
            onBill={onBill}
            onPick={(item) => put(item)}
            onPickAll={putAll}
            onScanned={(item) => put(item, 1)}
            scannedFooter={(last, problem) => {
              if (problem) return <p className="text-center text-sm font-semibold text-amber-300">{problem}</p>;
              const line = last ? lines.find((l) => l.productId === last.id) : undefined;
              if (!last || !line) return null;
              const name = nameOf(line);
              return (
                <div data-testid="scan-line" className="flex flex-col gap-2 text-white">
                  <p className="text-center text-sm">
                    <span className="font-semibold">{t('bills.scanned', { name })}</span>
                    {startLine(last).ratePaise !== null && <span className="opacity-80"> · {formatPaise(startLine(last).ratePaise as number)}</span>}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button type="button" aria-label={t('bills.itemLess', { name })} disabled={line.qty <= 1} onClick={() => change(line.key, { qty: clamp(line.qty - 1) })} className={`${stepper} border-white/40`}>
                      −
                    </button>
                    <input
                      inputMode="numeric"
                      aria-label={t('bills.itemQty', { name })}
                      value={String(line.qty)}
                      onChange={(e) => change(line.key, { qty: clamp(Number(e.target.value.replace(/[^\d]/g, '')) || 1) })}
                      className="h-11 w-20 rounded-xl border border-white/30 bg-white/10 text-center text-xl font-bold text-white tabular-nums"
                    />
                    <button type="button" aria-label={t('bills.itemMore', { name })} onClick={() => change(line.key, { qty: clamp(line.qty + 1) })} className={`${stepper} border-white/40`}>
                      +
                    </button>
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}
    </form>
  );
}
