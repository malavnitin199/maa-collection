'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { card, errorBox, input, muted, primaryButton } from '@/components/ui/styles';
import { CompanyPicker } from '@/features/catalog/company-picker';
import { useDone } from '@/features/feedback/effects';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { formatDate } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { updateBillAction } from '@/server/actions/bills';
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
export function CompanyCollections({ id, name, list, picked, onChange }: { id?: string; name: string; list: Collection[]; picked: string[]; onChange: (picked: string[]) => void }) {
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
        // A company with nothing waiting (e.g. one just added here): say so, and offer New item for it.
        <div data-testid="company-collections-empty" className="flex flex-col items-start gap-1.5 rounded-xl border border-dashed border-zinc-300 px-3 py-2.5 dark:border-zinc-700">
          <p className={`text-xs ${muted}`}>{t('bills.noCollectionsFor')}</p>
          {id && (
            <Link href={`/admin/stock/new?supplier=${id}`} className="text-sm font-semibold text-brand-700 dark:text-brand-300">
              {t('bills.addCollectionFor', { name })}
            </Link>
          )}
        </div>
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
 * Edit bill for a bill of stock entries (the earlier way, ADR-044/045): its number, date,
 * companies and note. New bills — and bills made from items — use the bill editor (ADR-061).
 */
export function BillForm({
  suppliers,
  previous,
  initial,
  billId,
}: {
  suppliers: Option[];
  previous: Option[];
  initial: { billNumber: string; billDate: string; note: string; companies: Option[] };
  billId: string;
  today: string;
}) {
  const t = useT();
  const router = useRouter();
  const done = useDone();
  const [billNumber, setBillNumber] = useState(initial.billNumber);
  const [billDate, setBillDate] = useState(initial.billDate);
  const [note, setNote] = useState(initial.note);
  const [companies, setCompanies] = useState<Option[]>(initial.companies);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const addCompany = (id: string, name: string) => {
    if (!id || companies.some((c) => c.id === id)) return;
    setCompanies([...companies, { id, name }]);
  };
  const save = () => {
    setError(null);
    startSaving(async () => {
      const result = await updateBillAction(billId, { billNumber, billDate, note, companies: companies.map((c) => c.id) });
      if (!result.ok) {
        done.show({ kind: 'error', title: t('done.notSaved'), detail: result.error });
        return setError(result.error);
      }
      done.show({
        title: t('bills.saved'),
        lines: [
          { label: t('bills.number'), value: billNumber.trim() },
          { label: t('bills.date'), value: billDate },
          { label: t('bills.companies'), value: companies.map((c) => c.name).join(', ') },
        ].filter((line) => line.value),
      });
      router.refresh();
    });
  };

  return (
    <form
      data-testid="bill-form"
      data-step="edit"
      className={`${card} flex flex-col gap-4`}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {done.node}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
          {t('bills.number')}
          <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} maxLength={40} className={input} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
          {t('bills.date')}
          <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={`${input} min-w-0`} />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t('bills.companies')}</p>
        {companies.length > 0 && (
          <ul data-testid="bill-company-list" className="flex flex-col gap-1.5">
            {companies.map((c, i) => (
              <li key={c.id} data-testid="bill-company" className="flex items-center gap-2 rounded-xl bg-brand-50/70 py-1.5 pr-1 pl-3 dark:bg-brand-950/60">
                <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                <button
                  type="button"
                  aria-label={t('bills.removeCompany', { name: c.name })}
                  onClick={() => setCompanies(companies.filter((x) => x.id !== c.id))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-white dark:hover:bg-zinc-800"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <CompanyPicker
          label={companies.length ? t('bills.anotherCompany') : t('bills.colCompany')}
          companies={suppliers}
          exclude={companies.map((c) => c.id)}
          previous={previous}
          value=""
          emptyLabel={t('bills.addCompany')}
          onChange={addCompany}
        />
        <p className={`text-xs ${muted}`}>{t('bills.editCompaniesNote')}</p>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('bills.note')}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={input} />
      </label>
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <button type="submit" disabled={saving || companies.length === 0} className={`${primaryButton} min-h-12`}>
        {saving ? t('common.saving') : t('bills.saveChanges')}
      </button>
    </form>
  );
}
