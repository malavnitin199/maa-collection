'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { errorBox, input, muted, primaryButton } from '@/components/ui/styles';
import { useDone } from '@/features/feedback/effects';
import { useT } from '@/features/i18n/i18n-provider';
import { cleanSizeList } from '@/lib/size-lists';
import { sameSize } from '@/lib/size-prices';
import { addDesignSizesAction } from '@/server/actions/admin';

/**
 * Product page → + Add sizes (owner, 2026-11-22, ADR-054): tap the sizes the design
 * does not have yet (or type one), set their pieces, Save — new items of the same
 * design, same prices, with their tags ready to print.
 */
export function AddSizesForm({ productId, offered, existing, boxes }: { productId: string; offered: string[]; existing: string[]; boxes?: number | null }) {
  const t = useT();
  const router = useRouter();
  const done = useDone();
  const [picked, setPicked] = useState<string[]>([]);
  const [pieces, setPieces] = useState<Record<string, number>>({});
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const operationId = useRef<string | null>(null);
  const has = (size: string) => existing.some((s) => sameSize(s, size));
  const choices = [...offered.filter((s) => !has(s)), ...picked.filter((s) => !offered.some((o) => sameSize(o, s)))];
  const count = (size: string) => pieces[size] ?? 1;
  const unit = boxes && boxes > 1 ? boxes : 1;
  const toggle = (size: string) => {
    operationId.current = null;
    setPicked((list) => (list.some((s) => sameSize(s, size)) ? list.filter((s) => !sameSize(s, size)) : [...list, size]));
  };
  const addOther = () => {
    const size = cleanSizeList([other])[0];
    if (!size) return;
    if (has(size)) return setError(t('cat.addSizes.already', { size }));
    setError(null);
    if (!picked.some((s) => sameSize(s, size))) toggle(size);
    setOther('');
  };
  const save = () => {
    setError(null);
    operationId.current ??= crypto.randomUUID();
    startSaving(async () => {
      const result = await addDesignSizesAction(productId, {
        operationId: operationId.current!,
        sizes: picked,
        quantities: Object.fromEntries(picked.map((s) => [s, count(s) * unit])),
      });
      if (!result.ok) {
        done.show({ kind: 'error', title: t('done.notSaved'), detail: result.error });
        return setError(result.error);
      }
      done.show({ title: t('cat.addSizes.saved', { n: result.created }), lines: [{ label: t('done.line.sizes'), value: picked.join(', ') }] });
      operationId.current = null;
      setPicked([]);
      setPieces({});
      router.refresh();
    });
  };
  return (
    <div data-testid="add-sizes" className="flex flex-col gap-3">
      {done.node}
      {choices.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {choices.map((size) => {
            const on = picked.some((s) => sameSize(s, size));
            return (
              <button
                key={size}
                type="button"
                aria-pressed={on}
                aria-label={t('stk.sizeAria', { size })}
                onClick={() => toggle(size)}
                className={`min-h-10 min-w-11 rounded-xl px-3 text-sm font-bold tabular-nums transition active:scale-95 ${
                  on ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface ring-1 ring-zinc-300 dark:ring-zinc-700'
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      ) : (
        <p className={`text-sm ${muted}`}>{t('cat.addSizes.allThere')}</p>
      )}
      <div className="flex gap-2">
        <input
          value={other}
          maxLength={12}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOther();
            }
          }}
          aria-label={t('ni.sizes.newSize')}
          placeholder={t('stk.design.otherSizePlaceholder')}
          className={`${input} min-w-0 flex-1 py-2 text-sm`}
        />
        <button type="button" onClick={addOther} disabled={!other.trim()} className="min-h-10 shrink-0 rounded-xl border border-brand-300 px-3 text-sm font-bold text-brand-700 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300">
          {t('ni.sizes.addSize')}
        </button>
      </div>
      {picked.length > 0 && (
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {picked.map((size) => (
            <li key={size} className="flex items-center justify-between gap-1 rounded-xl bg-brand-50 py-0.5 pr-0.5 pl-3 dark:bg-brand-950">
              <span className="text-sm font-bold">{size}</span>
              <span className="flex items-center">
                <button type="button" aria-label={unit > 1 ? t('pack.lessBox', { size }) : t('ni.sizes.less', { size })} onClick={() => setPieces({ ...pieces, [size]: Math.max(0, count(size) - 1) })} className="h-9 w-9 rounded-full text-lg font-bold text-brand-700 dark:text-brand-300">
                  −
                </button>
                <input
                  inputMode="numeric"
                  aria-label={unit > 1 ? t('pack.boxesOf', { size }) : t('ni.sizes.piecesOf', { size })}
                  value={String(count(size))}
                  onChange={(e) => setPieces({ ...pieces, [size]: /^\d+$/.test(e.target.value) ? Math.min(999, Number(e.target.value)) : 0 })}
                  className="w-9 bg-transparent text-center font-bold tabular-nums outline-none"
                />
                <button type="button" aria-label={unit > 1 ? t('pack.moreBox', { size }) : t('ni.sizes.more', { size })} onClick={() => setPieces({ ...pieces, [size]: Math.min(999, count(size) + 1) })} className="h-9 w-9 rounded-full text-lg font-bold text-brand-700 dark:text-brand-300">
                  +
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <button type="button" onClick={save} disabled={saving || picked.length === 0} className={`${primaryButton} self-start`}>
        {saving ? t('common.saving') : t(picked.length === 1 ? 'cat.addSizes.save.one' : 'cat.addSizes.save.other', { n: picked.length })}
      </button>
    </div>
  );
}
