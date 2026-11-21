'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { card, errorBox, input, muted, primaryButton } from '@/components/ui/styles';
import { CompanyPicker } from '@/features/catalog/company-picker';
import { useDone } from '@/features/feedback/effects';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { formatDate } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { createBillAction, updateBillAction } from '@/server/actions/bills';
import type { Collection } from '@/server/services/bills';

type Option = { id: string; name: string };

/**
 * One collection to tick (owner's feedback 2026-11-21: no overlapping boxes):
 * the whole row is the tick — a small round tick on the left, what it is, when,
 * sizes · pieces, and its value on the right.
 */
export function CollectionRow({ c, checked, onToggle }: { c: Collection; checked: boolean; onToggle: () => void }) {
  const t = useT();
  const locale = useLocale();
  const name = c.names.join(', ');
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={name}
      data-testid="collection-option"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
        checked ? 'border-brand-500 bg-brand-50 dark:bg-brand-950' : 'border-zinc-200 bg-surface dark:border-zinc-800'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
          checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 text-transparent dark:border-zinc-600'
        }`}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className={`block truncate text-xs ${muted}`}>
          {[formatDate(locale, `${c.date}T00:00:00+05:30`, 'date'), c.refNumber ? t('bills.ref', { ref: c.refNumber }) : null, t('bills.collectionLine', { sizes: c.sizes.join(' '), pcs: c.pieces })]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPaise(c.valuePaise)}</span>
    </button>
  );
}

/** One company's waiting collections, under its name, with "Select all". */
export function CompanyCollections({ name, list, picked, onChange }: { name: string; list: Collection[]; picked: string[]; onChange: (picked: string[]) => void }) {
  const t = useT();
  const ids = list.map((c) => c.receiptId);
  const all = ids.length > 0 && ids.every((id) => picked.includes(id));
  return (
    <section data-testid="company-collections-group" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold">{name}</h3>
        {ids.length > 1 && (
          <button
            type="button"
            onClick={() => onChange(all ? picked.filter((p) => !ids.includes(p)) : [...new Set([...picked, ...ids])])}
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950"
          >
            {all ? t('bills.selectNone') : t('bills.selectAll')}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className={`text-xs ${muted}`}>{t('bills.noCollectionsFor')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((c) => (
            <CollectionRow
              key={c.receiptId}
              c={c}
              checked={picked.includes(c.receiptId)}
              onToggle={() => onChange(picked.includes(c.receiptId) ? picked.filter((p) => p !== c.receiptId) : [...picked, c.receiptId])}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * New bill / Edit bill (owner's feedback 2026-11-21), one card: bill no. and
 * date; companies added one after another and listed one under the other; on a
 * new bill each company's collections waiting for a bill, to tick. Nothing is
 * typed as an amount: the total is the value of the ticked collections.
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
  initial?: { billNumber: string; billDate: string; note: string; companies: Option[] };
  billId?: string;
}) {
  const t = useT();
  const router = useRouter();
  const done = useDone();
  const [billNumber, setBillNumber] = useState(initial?.billNumber ?? '');
  const [billDate, setBillDate] = useState(initial?.billDate ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  const [companies, setCompanies] = useState<Option[]>(initial?.companies ?? []);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const operationId = useRef<string | null>(null);

  const of = (id: string) => collections.filter((c) => c.supplierId === id);
  const pickedRows = collections.filter((c) => picked.includes(c.receiptId));
  const value = (rows: Collection[]) => rows.reduce((n, c) => n + c.valuePaise, 0);
  const total = value(pickedRows);
  const pieces = pickedRows.reduce((n, c) => n + c.pieces, 0);
  const touched = () => (operationId.current = null);

  const addCompany = (id: string, name: string) => {
    if (!id || companies.some((c) => c.id === id)) return;
    touched();
    setCompanies([...companies, { id, name }]);
  };
  const removeCompany = (id: string) => {
    touched();
    setCompanies(companies.filter((c) => c.id !== id));
    setPicked(picked.filter((p) => !of(id).some((c) => c.receiptId === p)));
  };

  const save = () => {
    setError(null);
    operationId.current ??= crypto.randomUUID();
    const input = { operationId: operationId.current, billNumber, billDate, note, companies: companies.map((c) => c.id), receiptIds: picked };
    startSaving(async () => {
      const result = billId ? await updateBillAction(billId, input) : await createBillAction(input);
      if (!result.ok) {
        done.show({ kind: 'error', title: t('done.notSaved'), detail: result.error });
        return setError(result.error);
      }
      done.show({
        title: t('bills.saved'),
        amount: billId ? undefined : formatPaise(total),
        lines: [
          { label: t('bills.number'), value: billNumber.trim() },
          { label: t('bills.date'), value: billDate },
          { label: t('bills.companies'), value: companies.map((c) => c.name).join(', ') },
          { label: t('bills.collections'), value: billId ? '' : t('bills.picked', { n: picked.length, pcs: pieces, value: formatPaise(total) }) },
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
      onChange={touched}
    >
      {done.node}
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

      {/* Companies: chosen ones one under the other, then the box to add the next. */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t('bills.companies')}</p>
        {companies.length > 0 && (
          <ul data-testid="bill-company-list" className="flex flex-col gap-1.5">
            {companies.map((c, i) => {
              const mine = pickedRows.filter((r) => r.supplierId === c.id);
              return (
                <li key={c.id} data-testid="bill-company" className="flex items-center gap-2 rounded-xl bg-brand-50/70 py-1.5 pr-1 pl-3 dark:bg-brand-950/60">
                  <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    {!billId && <span className={`block text-xs ${muted}`}>{t('bills.companyLine', { n: mine.length, value: formatPaise(value(mine)) })}</span>}
                  </span>
                  <button
                    type="button"
                    aria-label={t('bills.removeCompany', { name: c.name })}
                    onClick={() => removeCompany(c.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-white dark:hover:bg-zinc-800"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <CompanyPicker
          key={companies.length}
          label={companies.length ? t('bills.anotherCompany') : t('bills.colCompany')}
          companies={suppliers.filter((s) => !companies.some((c) => c.id === s.id))}
          previous={previous}
          value=""
          emptyLabel={t('bills.addCompany')}
          onChange={addCompany}
        />
        {billId && <p className={`text-xs ${muted}`}>{t('bills.editCompaniesNote')}</p>}
      </div>

      {!billId && (
        <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <p className="text-sm font-semibold">{t('bills.collections')}</p>
          {companies.length === 0 ? (
            <p className={`text-sm ${muted}`}>{t('bills.pickCompanyFirst')}</p>
          ) : (
            companies.map((c) => <CompanyCollections key={c.id} name={c.name} list={of(c.id)} picked={picked} onChange={(next) => (touched(), setPicked(next))} />)
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
        {billId ? (
          <span />
        ) : (
          <p className="min-w-0 text-sm">
            <span data-testid="bill-picked" className={`block text-xs ${muted}`}>{t('bills.footer', { n: picked.length, pcs: pieces })}</span>
            <span className="font-semibold">
              {t('bills.total')}: <span data-testid="bill-total" className="text-lg font-bold tabular-nums">{formatPaise(total)}</span>
            </span>
          </p>
        )}
        <button type="submit" disabled={saving || companies.length === 0 || (!billId && picked.length === 0)} className={`${primaryButton} min-h-12 shrink-0 px-6`}>
          {saving ? t('common.saving') : billId ? t('bills.saveChanges') : t('bills.save')}
        </button>
      </div>
    </form>
  );
}
