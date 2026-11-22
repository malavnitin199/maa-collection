'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Dropdown } from '@/components/ui/dropdown';
import { ActionSheet, sheetPrimary, sheetSecondary } from '@/components/ui/selection';
import { errorBox, input, muted, secondaryButton } from '@/components/ui/styles';
import { CompanyPicker } from '@/features/catalog/company-picker';
import { useDone, type DoneInput } from '@/features/feedback/effects';
import { haptic } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';
import { LangText } from '@/features/i18n/lang-text';
import { addPiecesAction, bulkProductsAction, saveItemAction, type ItemSaveInput } from '@/server/actions/admin';

type Option = { id: string; name: string };
/** One size (and colour) of the design, as the item page lists it. */
export type ItemRow = { id: string; size: string; color: string; stock: number; sold: number };
type Rights = { catalog: boolean; prices: boolean; costs: boolean; stock: boolean };

const MAX = 100_000;
const field = 'flex min-w-0 flex-col gap-1 text-sm font-semibold';
const stepper =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 text-2xl font-bold transition active:scale-90 disabled:opacity-30 dark:border-zinc-700';
const clamp = (n: number, min = 0) => Math.min(MAX, Math.max(min, Math.trunc(Number.isFinite(n) ? n : min)));
const label = (r: { size: string; color: string }, na: string) => [r.size.trim() || na, r.color.trim()].filter(Boolean).join(' · ');

/** − n + for a number of pieces, big enough for a thumb. */
function Pieces({ value, onChange, min, name }: { value: number; onChange: (n: number) => void; min: number; name: string }) {
  const t = useT();
  return (
    <span className="flex items-center justify-center gap-3">
      <button type="button" aria-label={t('ied.less', { size: name })} disabled={value <= min} onClick={() => onChange(clamp(value - 1, min))} className={stepper}>
        −
      </button>
      <input
        inputMode="numeric"
        aria-label={t('ied.piecesOf', { size: name })}
        value={String(value)}
        onChange={(e) => onChange(clamp(Number(e.target.value.replace(/[^\d]/g, '')), min))}
        className={`${input} h-14 w-24 text-center text-3xl font-bold tabular-nums`}
      />
      <button type="button" aria-label={t('ied.more', { size: name })} onClick={() => onChange(clamp(value + 1, min))} className={stepper}>
        +
      </button>
    </span>
  );
}

/** Runs a save; on success closes the sheet, shows the Done card and reloads the page's figures. */
function useSave() {
  const t = useT();
  const router = useRouter();
  const done = useDone();
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (work: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: () => DoneInput, close: () => void) => {
    setError(null);
    startBusy(async () => {
      const result = await work();
      if (!result.ok) {
        done.show({ kind: 'error', title: t('done.notSaved'), detail: result.error });
        return setError(result.error);
      }
      haptic(14);
      close();
      done.show(ok());
      router.refresh();
    });
  };
  return { run, busy, error, setError, node: done.node };
}

/**
 * The design's sizes on the item page (owner's feedback 2026-11-22, ADR-061): each size with its
 * pieces and how many sold. + Add = new pieces came in (a stock entry); tapping a size changes
 * its size / colour or corrects its pieces (a count correction); + Add a size.
 */
export function ItemSizes({ productId, rows, can }: { productId: string; rows: ItemRow[]; can: Rights }) {
  const t = useT();
  const na = t('common.na');
  const save = useSave();
  const [adding, setAdding] = useState<ItemRow | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [fix, setFix] = useState({ size: '', color: '', count: 0 });
  const [newSize, setNewSize] = useState<{ size: string; pieces: number } | null>(null);
  const operation = useRef<string | null>(null);
  const close = () => {
    setAdding(null);
    setEditing(null);
    setNewSize(null);
    save.setError(null);
    operation.current = null;
  };

  return (
    <>
      {save.node}
      <ul data-testid="item-sizes" className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((r) => {
          const name = label(r, na);
          return (
            <li key={r.id} data-testid="size-row" className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                aria-label={t('ied.sizeAria', { size: name })}
                disabled={!can.catalog && !can.stock}
                onClick={() => {
                  setFix({ size: r.size, color: r.color, count: Math.max(0, r.stock) });
                  setEditing(r);
                }}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-zinc-50 active:scale-[0.99] disabled:active:scale-100 dark:hover:bg-zinc-900"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold">{name}</span>
                  <span className={`block text-xs ${muted}`}>{t('ied.soldN', { n: r.sold })}</span>
                </span>
                <span className={`shrink-0 text-xl font-bold tabular-nums ${r.stock <= 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {t('cat.value.pcs', { pcs: r.stock })}
                </span>
              </button>
              {can.stock && (
                <button
                  type="button"
                  aria-label={t('ied.addAria', { size: name })}
                  onClick={() => {
                    setAddQty(1);
                    setAdding(r);
                  }}
                  className="min-h-11 shrink-0 rounded-full bg-brand-600 px-4 text-sm font-bold text-white shadow-sm transition active:scale-95"
                >
                  {t('ied.add')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {can.catalog && (
        <button type="button" onClick={() => setNewSize({ size: '', pieces: 1 })} className={`${secondaryButton} mt-1 self-start`}>
          {t('ied.addSize')}
        </button>
      )}

      {adding && (
        <ActionSheet title={t('ied.addTitle', { size: label(adding, na) })} onClose={close}>
          <p className="text-center text-sm font-semibold">{t('ied.addHow')}</p>
          <Pieces value={addQty} onChange={setAddQty} min={1} name={label(adding, na)} />
          {save.error && (
            <p role="alert" className={errorBox}>
              {save.error}
            </p>
          )}
          <button
            type="button"
            disabled={save.busy}
            onClick={() => {
              operation.current ??= crypto.randomUUID();
              const row = adding;
              const qty = addQty;
              save.run(
                () => addPiecesAction(row.id, { quantity: qty, operationId: operation.current as string }),
                () => ({ title: t(qty === 1 ? 'ied.addedN.one' : 'ied.addedN.other', { n: qty }), lines: [{ label: t('ied.size'), value: label(row, na) }] }),
                close,
              );
            }}
            className={sheetPrimary}
          >
            {save.busy ? t('common.saving') : t(addQty === 1 ? 'ied.addYes.one' : 'ied.addYes.other', { n: addQty })}
          </button>
          <button type="button" onClick={close} className={sheetSecondary}>
            {t('common.cancel')}
          </button>
        </ActionSheet>
      )}

      {editing && (
        <ActionSheet title={label(editing, na)} onClose={close}>
          {can.catalog && (
            <div className="grid grid-cols-2 gap-3">
              <label className={field}>
                {t('ied.size')}
                <input value={fix.size} maxLength={20} onChange={(e) => setFix({ ...fix, size: e.target.value })} className={input} />
              </label>
              <label className={field}>
                {t('ied.colour')}
                <input value={fix.color} maxLength={40} onChange={(e) => setFix({ ...fix, color: e.target.value })} className={input} />
              </label>
            </div>
          )}
          {can.stock && (
            <div className="flex flex-col gap-2">
              <p className="text-center text-sm font-semibold">{t('ied.countNow')}</p>
              <Pieces value={fix.count} onChange={(count) => setFix({ ...fix, count })} min={0} name={label(editing, na)} />
            </div>
          )}
          {save.error && (
            <p role="alert" className={errorBox}>
              {save.error}
            </p>
          )}
          <button
            type="button"
            disabled={save.busy}
            onClick={() => {
              const row = editing;
              const input: ItemSaveInput = {};
              if (can.catalog && (fix.size.trim() !== row.size || fix.color.trim() !== row.color)) input.items = { [row.id]: { size: fix.size, color: fix.color } };
              if (can.stock && fix.count !== row.stock) input.counts = { [row.id]: fix.count };
              save.run(
                () => saveItemAction(productId, input),
                () => ({ title: t('ied.saved'), lines: [{ label: t('ied.size'), value: label({ size: fix.size, color: fix.color }, na) }, { label: t('ied.countNow'), value: String(fix.count) }] }),
                close,
              );
            }}
            className={sheetPrimary}
          >
            {save.busy ? t('common.saving') : t('ied.save')}
          </button>
          <button type="button" onClick={close} className={sheetSecondary}>
            {t('common.cancel')}
          </button>
        </ActionSheet>
      )}

      {newSize && (
        <ActionSheet title={t('ied.addSizeTitle')} onClose={close}>
          <label className={field}>
            {t('ied.newSize')}
            <input value={newSize.size} maxLength={20} autoFocus onChange={(e) => setNewSize({ ...newSize, size: e.target.value })} className={`${input} text-lg`} />
          </label>
          <Pieces value={newSize.pieces} onChange={(pieces) => setNewSize({ ...newSize, pieces })} min={0} name={newSize.size || t('ied.newSize')} />
          {save.error && (
            <p role="alert" className={errorBox}>
              {save.error}
            </p>
          )}
          <button
            type="button"
            disabled={save.busy || !newSize.size.trim()}
            onClick={() => {
              operation.current ??= crypto.randomUUID();
              const asked = newSize;
              save.run(
                () => saveItemAction(productId, { newSizes: [asked], operationId: operation.current as string }),
                () => ({ title: t('ied.added.one'), lines: [{ label: t('ied.size'), value: asked.size.trim() }] }),
                close,
              );
            }}
            className={sheetPrimary}
          >
            {save.busy ? t('common.saving') : t('ied.save')}
          </button>
          <button type="button" onClick={close} className={sheetSecondary}>
            {t('common.cancel')}
          </button>
        </ActionSheet>
      )}
    </>
  );
}

/**
 * ✎ Edit details: name (Hindi or English), company, category and the prices — one value for
 * every size; an empty box marked "By size" keeps each size's own. Only what the person may change.
 */
export function EditDetailsButton({
  productId,
  initial,
  mixed,
  companies,
  previous,
  categories,
  can,
}: {
  productId: string;
  initial: { name: string; supplierId: string; categoryId: string; mrp: string; price: string; cost: string };
  mixed: { mrp: boolean; price: boolean; cost: boolean };
  companies: Option[];
  previous: Option[];
  categories: Option[];
  can: Rights;
}) {
  const t = useT();
  const na = t('common.na');
  const save = useSave();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const set = (key: keyof typeof initial) => (value: string) => setValues((v) => ({ ...v, [key]: value }));
  const money = (key: 'mrp' | 'price' | 'cost', title: string) => (
    <label className={field}>
      {title}
      <input inputMode="decimal" value={values[key]} placeholder={mixed[key] ? t('ied.bySize') : ''} onChange={(e) => set(key)(e.target.value)} className={`${input} min-w-0 tabular-nums`} />
    </label>
  );
  if (!can.catalog && !can.prices && !can.costs) return null;
  return (
    <>
      {save.node}
      <button
        type="button"
        data-testid="edit-details"
        onClick={() => {
          setValues(initial);
          setOpen(true);
        }}
        className={`${secondaryButton} py-2`}
      >
        {t('ied.editDetails')}
      </button>
      {open && (
        <ActionSheet title={t('ied.detailsTitle')} onClose={() => setOpen(false)}>
          <div data-testid="details-sheet" className="flex flex-col gap-3">
            {can.catalog && (
              <>
                <label className={field}>
                  {t('ied.name')}
                  <LangText value={values.name} onValueChange={set('name')} maxLength={120} required />
                </label>
                <CompanyPicker label={t('ied.company')} companies={companies} previous={previous} value={values.supplierId} emptyLabel={na} onChange={(id) => set('supplierId')(id)} />
                <Dropdown
                  label={t('ied.category')}
                  value={values.categoryId}
                  placeholder={t('ied.chooseCategory')}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  onChange={set('categoryId')}
                />
              </>
            )}
            {(can.prices || can.costs) && (
              <div className={`grid gap-2 ${can.prices && can.costs ? 'grid-cols-3' : can.prices ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {can.prices && money('mrp', t('ied.mrp'))}
                {can.prices && money('price', t('ied.price'))}
                {can.costs && money('cost', t('ied.cost'))}
              </div>
            )}
            {save.error && (
              <p role="alert" className={errorBox}>
                {save.error}
              </p>
            )}
            <button
              type="button"
              disabled={save.busy}
              onClick={() => {
                const input: ItemSaveInput = {};
                if (can.catalog) Object.assign(input, { name: values.name, supplierId: values.supplierId, categoryId: values.categoryId });
                if (can.prices) Object.assign(input, { mrp: values.mrp, price: values.price });
                if (can.costs) input.cost = values.cost;
                save.run(
                  () => saveItemAction(productId, input),
                  () => ({ title: t('ied.saved'), lines: [{ label: t('ied.name'), value: values.name }] }),
                  () => setOpen(false),
                );
              }}
              className={sheetPrimary}
            >
              {save.busy ? t('common.saving') : t('ied.save')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={sheetSecondary}>
              {t('common.cancel')}
            </button>
          </div>
        </ActionSheet>
      )}
    </>
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
