'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { card, errorBox, input, muted, primaryButton } from '@/components/ui/styles';
import { CompanyPicker } from '@/features/catalog/company-picker';
import { useDone } from '@/features/feedback/effects';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { formatDate } from '@/lib/i18n';
import { rupeesToPaise } from '@/features/inventory/inventory';
import { formatPaise } from '@/lib/money';
import { createBillAction, updateBillAction } from '@/server/actions/bills';
import type { Collection } from '@/server/services/bills';

type Option = { id: string; name: string };
type Line = { supplierId: string; name: string; amount: string };

/** One collection to tick: what it is, whose, when, sizes, pieces, value. */
export function CollectionRow({ c, checked, onToggle, showCompany }: { c: Collection; checked: boolean; onToggle: () => void; showCompany: boolean }) {
  const t = useT();
  const locale = useLocale();
  return (
    <label data-testid="collection-option" className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition ${checked ? 'bg-brand-50 ring-brand-500 dark:bg-brand-950' : 'ring-zinc-200 dark:ring-zinc-800'}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" aria-label={c.names.join(', ')} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{c.names.join(', ')}</span>
        <span className={`block text-xs ${muted}`}>
          {[showCompany ? c.supplierName : null, formatDate(locale, `${c.date}T00:00:00+05:30`, 'date'), c.refNumber ? t('bills.ref', { ref: c.refNumber }) : null].filter(Boolean).join(' · ')}
        </span>
        <span className={`block text-xs ${muted}`}>{t('bills.collectionLine', { sizes: c.sizes.join(' '), pcs: c.pieces })}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPaise(c.valuePaise)}</span>
    </label>
  );
}

/**
 * New bill / Edit bill (owner's feedback 2026-11-21), one card: bill no., bill
 * date, the companies with each one's amount (the total is their sum), a note;
 * on a new bill also the collections waiting for a bill, to tick into it — the
 * chosen companies' ones first, every company's on request.
 */
export function BillForm({
  suppliers,
  previous,
  collections = [],
  today,
  initial,
  billId,
}: {
  suppliers: Option[];
  previous: Option[];
  collections?: Collection[];
  today: string;
  initial?: { billNumber: string; billDate: string; note: string; companies: Line[] };
  billId?: string;
}) {
  const t = useT();
  const router = useRouter();
  const done = useDone();
  const [billNumber, setBillNumber] = useState(initial?.billNumber ?? '');
  const [billDate, setBillDate] = useState(initial?.billDate ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  const [lines, setLines] = useState<Line[]>(initial?.companies ?? []);
  const [picked, setPicked] = useState<string[]>([]);
  const [everyCompany, setEveryCompany] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const operationId = useRef<string | null>(null);

  const total = lines.reduce((n, l) => n + (rupeesToPaise(l.amount || '0') ?? 0), 0);
  const chosen = new Set(lines.map((l) => l.supplierId));
  const shown = useMemo(
    () => (everyCompany ? collections : collections.filter((c) => c.supplierId && chosen.has(c.supplierId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collections, everyCompany, lines],
  );
  const pickedRows = collections.filter((c) => picked.includes(c.receiptId));
  const value = pickedRows.reduce((n, c) => n + c.valuePaise, 0);
  const pieces = pickedRows.reduce((n, c) => n + c.pieces, 0);

  const addCompany = (id: string, name: string) => {
    if (!id || chosen.has(id)) return;
    operationId.current = null;
    setLines([...lines, { supplierId: id, name, amount: '' }]);
  };
  const toggle = (id: string) => {
    operationId.current = null;
    setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id]);
  };

  const save = () => {
    setError(null);
    operationId.current ??= crypto.randomUUID();
    const input = { operationId: operationId.current, billNumber, billDate, note, companies: lines.map(({ supplierId, amount }) => ({ supplierId, amount })), receiptIds: picked };
    startSaving(async () => {
      const result = billId ? await updateBillAction(billId, input) : await createBillAction(input);
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
          { label: t('bills.companies'), value: lines.map((l) => l.name).join(', ') },
          { label: t('bills.collections'), value: picked.length ? String(picked.length) : '' },
        ].filter((line) => line.value),
      });
      if (billId) return router.refresh();
      router.push(`/admin/bills/${'id' in result ? result.id : ''}`);
    });
  };

  return (
    <form
      data-testid="bill-form"
      className={`${card} flex flex-col gap-4`}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onChange={() => (operationId.current = null)}
    >
      {done.node}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('bills.number')}
          <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} maxLength={40} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('bills.date')}
          <input type="date" value={billDate} max={today} onChange={(e) => setBillDate(e.target.value)} className={input} />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t('bills.companies')}</p>
        {lines.map((line) => (
          <div key={line.supplierId} data-testid="bill-company" className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
              <span className="truncate">{lines.length === 1 ? t('bills.amount') : t('bills.amountFor', { name: line.name })}</span>
              <input
                inputMode="decimal"
                value={line.amount}
                onChange={(e) => setLines(lines.map((l) => (l.supplierId === line.supplierId ? { ...l, amount: e.target.value } : l)))}
                className={`${input} text-lg tabular-nums`}
              />
            </label>
            <span className={`mb-3 max-w-[40%] truncate text-sm font-semibold ${lines.length === 1 ? '' : 'hidden'}`}>{line.name}</span>
            <button
              type="button"
              aria-label={t('bills.removeCompany', { name: line.name })}
              onClick={() => setLines(lines.filter((l) => l.supplierId !== line.supplierId))}
              className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ✕
            </button>
          </div>
        ))}
        <CompanyPicker
          key={lines.length}
          label={lines.length ? t('bills.anotherCompany') : t('bills.colCompany')}
          companies={suppliers.filter((s) => !chosen.has(s.id))}
          previous={previous}
          value=""
          emptyLabel={t('bills.addCompany')}
          onChange={addCompany}
        />
        {lines.length > 1 && (
          <p className="flex justify-between text-sm font-semibold">
            <span>{t('bills.total')}</span>
            <span data-testid="bill-sum" className="tabular-nums">{formatPaise(total)}</span>
          </p>
        )}
      </div>

      {!billId && (
        <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t('bills.collections')}</p>
            <label className={`flex items-center gap-1.5 text-xs ${muted}`}>
              <input type="checkbox" checked={everyCompany} onChange={(e) => setEveryCompany(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              {t('bills.allCompanies')}
            </label>
          </div>
          {shown.length === 0 ? (
            <p className={`text-sm ${muted}`}>{lines.length === 0 && !everyCompany ? t('bills.pickCompanyFirst') : t('bills.noCollections')}</p>
          ) : (
            <div data-testid="bill-collections" className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
              {shown.map((c) => (
                <CollectionRow key={c.receiptId} c={c} checked={picked.includes(c.receiptId)} onToggle={() => toggle(c.receiptId)} showCompany={everyCompany || lines.length > 1} />
              ))}
            </div>
          )}
          {picked.length > 0 && (
            <p data-testid="bill-picked" className="text-sm font-semibold">
              {t('bills.picked', { n: picked.length, pcs: pieces, value: formatPaise(value) })}
              {total > 0 && <span className={`block text-xs font-normal ${muted}`}>{t('bills.difference', { total: formatPaise(total), value: formatPaise(value), diff: formatPaise(total - value) })}</span>}
            </p>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('bills.note')}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={input} />
      </label>
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <p className="text-sm">
          {t('bills.total')}: <span data-testid="bill-total" className="text-lg font-bold tabular-nums">{formatPaise(total)}</span>
        </p>
        <button type="submit" disabled={saving || lines.length === 0} className={`${primaryButton} min-h-12 px-6`}>
          {saving ? t('common.saving') : billId ? t('bills.saveChanges') : t('bills.save')}
        </button>
      </div>
    </form>
  );
}
