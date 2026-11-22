'use client';

import { useRef, useState, useTransition } from 'react';
import { input, muted } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { formatPaise } from '@/lib/money';
import { searchBillItemsAction, type BillItemOption } from '@/server/actions/bills';

/** An item on the bill being made, with how many. */
export type PickedItem = BillItemOption & { qty: number };

const MAX = 100_000;
const step =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-base font-bold transition active:scale-90 disabled:opacity-30 dark:border-zinc-700';

/**
 * New bill with no company (owner's feedback 2026-11-22, ADR-060): find the shop's items by
 * name, code or barcode (a scanner's Enter adds the one it finds) and add them one by one;
 * − / + sets how many. Each line shows quantity × purchase price = amount (N/A without one).
 */
export function BillItemsPicker({ items, onChange }: { items: PickedItem[]; onChange: (next: PickedItem[]) => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<BillItemOption[] | null>(null);
  const [searching, startSearch] = useTransition();
  const timer = useRef<number | undefined>(undefined);
  const na = t('common.na');
  const label = (i: { name: string; size: string; color: string }) => [i.name, [i.size, i.color].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const rate = (i: BillItemOption) => (i.costPaise === null ? na : formatPaise(i.costPaise));

  const add = (item: BillItemOption) => {
    const there = items.find((i) => i.id === item.id);
    onChange(there ? items.map((i) => (i.id === item.id ? { ...i, qty: Math.min(MAX, i.qty + 1) } : i)) : [...items, { ...item, qty: 1 }]);
    setQuery('');
    setFound(null);
  };
  const setQty = (id: string, qty: number) => onChange(items.map((i) => (i.id === id ? { ...i, qty: Math.min(MAX, Math.max(1, qty)) } : i)));
  const search = (value: string) => {
    setQuery(value);
    window.clearTimeout(timer.current);
    if (value.trim().length < 2) return setFound(null);
    timer.current = window.setTimeout(() => startSearch(async () => setFound(await searchBillItemsAction(value))), 250);
  };

  return (
    <section data-testid="bill-items" className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{t('bills.items')}</p>
      {items.length > 0 && (
        <ul data-testid="bill-item-lines" className="flex flex-col gap-1.5">
          {items.map((i) => {
            const name = label(i);
            return (
              <li key={i.id} data-testid="bill-item-line" className="flex items-center gap-1.5 rounded-xl bg-brand-50/70 py-1.5 pr-1 pl-3 dark:bg-brand-950/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{name}</span>
                  <span className={`block text-xs tabular-nums ${muted}`}>
                    {i.qty} × {rate(i)} = {i.costPaise === null ? na : formatPaise(i.costPaise * i.qty)}
                  </span>
                </span>
                <button type="button" aria-label={t('bills.itemLess', { name })} disabled={i.qty <= 1} onClick={() => setQty(i.id, i.qty - 1)} className={step}>
                  −
                </button>
                <input
                  inputMode="numeric"
                  aria-label={t('bills.itemQty', { name })}
                  value={String(i.qty)}
                  onChange={(e) => setQty(i.id, Number(e.target.value.replace(/[^\d]/g, '')) || 1)}
                  className={`${input} w-14 px-1 text-center font-bold tabular-nums`}
                />
                <button type="button" aria-label={t('bills.itemMore', { name })} onClick={() => setQty(i.id, i.qty + 1)} className={step}>
                  +
                </button>
                <button
                  type="button"
                  aria-label={t('bills.removeItem', { name })}
                  onClick={() => onChange(items.filter((x) => x.id !== i.id))}
                  className="flex h-9 w-8 shrink-0 items-center justify-center text-zinc-500"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => search(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          // Enter (a scanner ends with it) adds the item when exactly one is found; it never sends the bill.
          e.preventDefault();
          window.clearTimeout(timer.current);
          const value = query;
          if (!value.trim()) return;
          startSearch(async () => {
            const list = await searchBillItemsAction(value);
            if (list.length === 1) add(list[0]);
            else setFound(list);
          });
        }}
        placeholder={t('bills.searchItems')}
        aria-label={t('bills.searchItems')}
        className={input}
      />
      {searching && <p className={`text-xs ${muted}`}>{t('common.loading')}</p>}
      {found && (
        <ul data-testid="bill-item-results" className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {found.length === 0 && <li className={`px-3 py-2 text-sm ${muted}`}>{t('bills.noMatch')}</li>}
          {found.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                aria-label={t('bills.addItem', { name: label(f) })}
                onClick={() => add(f)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-brand-50 active:bg-brand-100 dark:hover:bg-brand-950"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{label(f)}</span>
                  <span className={`block text-xs ${muted}`}>
                    {f.sku} · {t('cat.value.pcs', { pcs: f.stock })}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{rate(f)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
