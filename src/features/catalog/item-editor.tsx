'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Dropdown } from '@/components/ui/dropdown';
import { errorBox, input, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
import { CompanyPicker } from '@/features/catalog/company-picker';
import { useDone, type DoneInput } from '@/features/feedback/effects';
import { LangText } from '@/features/i18n/lang-text';
import { useT } from '@/features/i18n/i18n-provider';
import { bulkProductsAction, saveItemAction, type ItemSaveInput } from '@/server/actions/admin';

type Option = { id: string; name: string };
/** One item of the design: its size (and colour, if it has one) and the pieces there are now. */
export type EditorRow = { id: string; size: string; color: string; stock: number };
type Rights = { catalog: boolean; prices: boolean; costs: boolean; stock: boolean };
type Values = { name: string; supplierId: string; categoryId: string; mrp: string; price: string; cost: string };
type NewSize = { key: number; size: string; pieces: number };

const MAX = 100_000;
const field = 'flex min-w-0 flex-col gap-1 text-sm font-medium';
const stepButton =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-lg font-bold transition active:scale-90 disabled:opacity-30 dark:border-zinc-700';

/**
 * The item page's editor (owner's feedback 2026-11-22, ADR-059): every detail of the design
 * in one card and one Save — name, company, category, prices (one value for all sizes; an
 * empty box where sizes differ keeps each its own), each size's pieces (− / +) and new sizes.
 * Only what this person may change is a box; the rest is plain text. After a save the page
 * reloads its figures and the form starts again from them (`version`); the Done card stays.
 */
export function ItemEditor(props: {
  productId: string;
  /** Changes whenever the saved figures change: the form starts again from them. */
  version: string;
  initial: Values;
  /** Which price boxes stand for sizes with different prices (empty = keep each size's own). */
  mixed: { mrp: boolean; price: boolean; cost: boolean };
  companies: Option[];
  previous: Option[];
  categories: Option[];
  rows: EditorRow[];
  can: Rights;
}) {
  const done = useDone();
  return (
    <>
      {done.node}
      <EditorForm key={props.version} {...props} onDone={done.show} />
    </>
  );
}

function EditorForm({
  productId,
  initial,
  mixed,
  companies,
  previous,
  categories,
  rows,
  can,
  onDone,
}: Omit<Parameters<typeof ItemEditor>[0], 'version'> & { onDone: (input: DoneInput) => void }) {
  const t = useT();
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(rows.map((r) => [r.id, r.stock])));
  const [added, setAdded] = useState<NewSize[]>([]);
  /** Rows whose size / colour boxes are open, with what is typed there. */
  const [fixes, setFixes] = useState<Record<string, { size: string; color: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const operationId = useRef<string | null>(null);
  const nextKey = useRef(0);
  const na = t('common.na');
  const set = (key: keyof Values) => (value: string) => setValues((v) => ({ ...v, [key]: value }));
  const label = (r: { size: string; color: string }) => [r.size.trim() || na, r.color.trim()].filter(Boolean).join(' · ');
  const fix = (id: string, key: 'size' | 'color', value: string) => setFixes((f) => ({ ...f, [id]: { ...f[id], [key]: value } }));
  const clamp = (n: number) => Math.min(MAX, Math.max(0, Math.trunc(Number.isFinite(n) ? n : 0)));

  const save = () => {
    setError(null);
    const input: ItemSaveInput = {};
    if (can.catalog) {
      const newSizes = added.filter((a) => a.size.trim()).map((a) => ({ size: a.size, pieces: a.pieces }));
      if (newSizes.length) operationId.current ??= crypto.randomUUID();
      const items = Object.fromEntries(
        rows.filter((r) => fixes[r.id] && (fixes[r.id].size.trim() !== r.size || fixes[r.id].color.trim() !== r.color)).map((r) => [r.id, fixes[r.id]]),
      );
      Object.assign(input, { name: values.name, supplierId: values.supplierId, categoryId: values.categoryId, items, newSizes, operationId: operationId.current ?? undefined });
    }
    if (can.prices) Object.assign(input, { mrp: values.mrp, price: values.price });
    if (can.costs) input.cost = values.cost;
    if (can.stock) input.counts = Object.fromEntries(rows.filter((r) => counts[r.id] !== r.stock).map((r) => [r.id, counts[r.id]]));
    startSaving(async () => {
      const result = await saveItemAction(productId, input);
      if (!result.ok) {
        onDone({ kind: 'error', title: t('done.notSaved'), detail: result.error });
        return setError(result.error);
      }
      operationId.current = null;
      onDone({
        title: t('ied.saved'),
        lines: [
          { label: t('ied.name'), value: values.name },
          result.counted ? { label: t('ied.sizes'), value: t(result.counted === 1 ? 'ied.counted.one' : 'ied.counted.other', { n: result.counted }) } : null,
          result.added ? { label: t('ied.sizes'), value: t(result.added === 1 ? 'ied.added.one' : 'ied.added.other', { n: result.added }) } : null,
        ].filter((line): line is { label: string; value: string } => Boolean(line?.value)),
      });
      router.refresh();
    });
  };

  const money = (key: 'mrp' | 'price' | 'cost', title: string, may: boolean) => (
    <label className={field}>
      {title}
      {may ? (
        <input
          inputMode="decimal"
          value={values[key]}
          placeholder={mixed[key] ? t('ied.bySize') : ''}
          onChange={(e) => set(key)(e.target.value)}
          className={`${input} min-w-0 tabular-nums`}
        />
      ) : (
        <span className="py-2 text-base tabular-nums">{values[key] ? `₹${values[key]}` : mixed[key] ? t('ied.bySize') : na}</span>
      )}
    </label>
  );

  return (
    <form
      data-testid="item-editor"
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-surface p-3 shadow-sm shadow-brand-900/[0.06] print:hidden dark:border-zinc-800 dark:shadow-none"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {can.catalog ? (
        <>
          <label className={field}>
            {t('ied.name')}
            {/* Hindi or English, like every name box (ADR-036). */}
            <LangText value={values.name} onValueChange={set('name')} maxLength={120} required />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompanyPicker
              label={t('ied.company')}
              companies={companies}
              previous={previous}
              value={values.supplierId}
              emptyLabel={na}
              onChange={(id) => set('supplierId')(id)}
            />
            <Dropdown
              label={t('ied.category')}
              value={values.categoryId}
              placeholder={t('ied.chooseCategory')}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              onChange={set('categoryId')}
            />
          </div>
        </>
      ) : (
        <p className={`text-sm ${muted}`}>{values.name}</p>
      )}

      {(can.prices || can.costs) && (
        <div className={`grid gap-2 ${can.costs ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {money('mrp', t('ied.mrp'), can.prices)}
          {money('price', t('ied.price'), can.prices)}
          {can.costs && money('cost', t('ied.cost'), true)}
        </div>
      )}

      <section aria-label={t('ied.sizes')} className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">{t('ied.sizes')}</p>
        <ul data-testid="size-rows" className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r) => {
            const n = counts[r.id];
            const open = fixes[r.id];
            const name = label(open ?? r);
            return (
              <li key={r.id} data-testid="size-row" className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 py-1.5">
                <span className="flex min-w-0 items-center gap-1">
                  <span className="min-w-0 truncate font-semibold">{name}</span>
                  {can.catalog && !open && (
                    <button
                      type="button"
                      aria-label={t('ied.fix', { size: name })}
                      onClick={() => setFixes((f) => ({ ...f, [r.id]: { size: r.size, color: r.color } }))}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${muted} hover:bg-zinc-100 dark:hover:bg-zinc-800`}
                    >
                      ✎
                    </button>
                  )}
                </span>
                {can.stock ? (
                  <span className="flex items-center gap-1.5">
                    <button type="button" aria-label={t('ied.less', { size: name })} disabled={n <= 0} onClick={() => setCounts((c) => ({ ...c, [r.id]: clamp(n - 1) }))} className={stepButton}>
                      −
                    </button>
                    <input
                      inputMode="numeric"
                      aria-label={t('ied.piecesOf', { size: name })}
                      value={String(n)}
                      onChange={(e) => setCounts((c) => ({ ...c, [r.id]: clamp(Number(e.target.value.replace(/[^\d]/g, ''))) }))}
                      className={`${input} w-16 px-1 text-center text-lg font-bold tabular-nums ${n !== r.stock ? 'border-brand-500 bg-brand-50 dark:bg-brand-950' : ''}`}
                    />
                    <button type="button" aria-label={t('ied.more', { size: name })} onClick={() => setCounts((c) => ({ ...c, [r.id]: clamp(n + 1) }))} className={stepButton}>
                      +
                    </button>
                  </span>
                ) : (
                  <span className="text-lg font-bold tabular-nums">{t('cat.value.pcs', { pcs: r.stock })}</span>
                )}
                {open && (
                  <span className="grid w-full grid-cols-2 gap-2">
                    <label className={field}>
                      {t('ied.size')}
                      <input value={open.size} maxLength={20} onChange={(e) => fix(r.id, 'size', e.target.value)} className={input} />
                    </label>
                    <label className={field}>
                      {t('ied.colour')}
                      <input value={open.color} maxLength={40} onChange={(e) => fix(r.id, 'color', e.target.value)} className={input} />
                    </label>
                  </span>
                )}
              </li>
            );
          })}
          {added.map((a) => (
            <li key={a.key} data-testid="new-size-row" className="flex items-center justify-between gap-2 py-1.5">
              <input
                aria-label={t('ied.newSize')}
                placeholder={t('ied.newSize')}
                value={a.size}
                maxLength={20}
                autoFocus
                onChange={(e) => setAdded((list) => list.map((x) => (x.key === a.key ? { ...x, size: e.target.value } : x)))}
                className={`${input} w-24 min-w-0`}
              />
              <span className="flex items-center gap-1.5">
                <button type="button" aria-label={t('ied.less', { size: a.size || t('ied.newSize') })} disabled={a.pieces <= 0} onClick={() => setAdded((list) => list.map((x) => (x.key === a.key ? { ...x, pieces: clamp(x.pieces - 1) } : x)))} className={stepButton}>
                  −
                </button>
                <input
                  inputMode="numeric"
                  aria-label={t('ied.piecesOf', { size: a.size || t('ied.newSize') })}
                  value={String(a.pieces)}
                  onChange={(e) => setAdded((list) => list.map((x) => (x.key === a.key ? { ...x, pieces: clamp(Number(e.target.value.replace(/[^\d]/g, ''))) } : x)))}
                  className={`${input} w-16 px-1 text-center text-lg font-bold tabular-nums`}
                />
                <button type="button" aria-label={t('ied.more', { size: a.size || t('ied.newSize') })} onClick={() => setAdded((list) => list.map((x) => (x.key === a.key ? { ...x, pieces: clamp(x.pieces + 1) } : x)))} className={stepButton}>
                  +
                </button>
                <button type="button" aria-label={t('ied.removeNew')} onClick={() => setAdded((list) => list.filter((x) => x.key !== a.key))} className="flex h-10 w-8 items-center justify-center text-zinc-500">
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
        {can.catalog && (
          <button type="button" onClick={() => setAdded((list) => [...list, { key: ++nextKey.current, size: '', pieces: 1 }])} className={`${secondaryButton} self-start`}>
            {t('ied.addSize')}
          </button>
        )}
      </section>

      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <button type="submit" disabled={saving} className={`${primaryButton} min-h-12 w-full`}>
        {saving ? t('common.saving') : t('ied.save')}
      </button>
    </form>
  );
}

/** Hide the whole design from the counter and lists, or bring it back (Catalog right). */
export function HideDesignButton({ ids, hidden }: { ids: string[]; hidden: boolean }) {
  const t = useT();
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  return (
    <button
      type="button"
      data-testid="item-hide"
      disabled={busy}
      onClick={() =>
        startBusy(async () => {
          const result = await bulkProductsAction(ids, { kind: hidden ? 'show' : 'hide' });
          if (result.ok) router.refresh();
        })
      }
      className={`${secondaryButton} py-2`}
    >
      {hidden ? t('ied.bringBack') : t('ied.hide')}
    </button>
  );
}
