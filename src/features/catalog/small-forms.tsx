'use client';

import { useActionState, useRef, useState } from 'react';
import { errorBox, input, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { SizeRatesEditor, type OwnRatesText, type RatesText } from '@/features/catalog/size-rates-editor';
import { useT } from '@/features/i18n/i18n-provider';
import type { FormState } from '@/server/actions/admin';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className={errorBox}>{state.error}</p>;
  if (state.message) return <p role="status" className={okBox}>{state.message}</p>;
  return null;
}

/**
 * Wraps a server action with an idempotency key: the same id is sent until the
 * form is edited, so a double tap or a retried request is applied only once.
 */
export function useOperationId() {
  const ref = useRef<string | null>(null);
  return {
    stamp: (formData: FormData) => formData.set('operationId', (ref.current ??= crypto.randomUUID())),
    reset: () => {
      ref.current = null;
    },
  };
}

export function StockInForm({ action }: { action: Action }) {
  const t = useT();
  const op = useOperationId();
  const [state, formAction, pending] = useActionState((prev: FormState, formData: FormData) => {
    op.stamp(formData);
    return action(prev, formData);
  }, {});
  return (
    <form action={formAction} onChange={op.reset} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('cat.stockIn.pieces')}
          <input name="quantity" inputMode="numeric" required className={`${input} w-32`} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          {t('cat.stockIn.note')}
          <input name="note" placeholder={t('cat.stockIn.notePlaceholder')} className={input} />
        </label>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? t('cat.adding') : t('cat.stockIn.submit')}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function AddStaffForm({ action }: { action: Action }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('cat.staff.name')}
          <input name="name" required maxLength={40} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('cat.staff.role')}
          <select name="role" defaultValue="salesman" className={input}>
            <option value="salesman">{t('role.salesman')}</option>
            <option value="admin">{t('role.admin')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('cat.staff.pin')}
          <input name="pin" inputMode="numeric" required maxLength={6} className={`${input} w-32`} />
        </label>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? t('cat.adding') : t('cat.staff.add')}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function ResetPinForm({ action, name }: { action: Action; name: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="pin" inputMode="numeric" maxLength={6} placeholder={t('cat.staff.newPin')} aria-label={t('cat.staff.newPinFor', { name })} className={`${input} w-28 py-1`} />
      <button type="submit" disabled={pending} className={`${secondaryButton} py-1`}>
        {t('cat.staff.setPin')}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.message && <span className="text-xs text-brand-700">{state.message}</span>}
    </form>
  );
}

/**
 * Staff page (plan v17): **Remove** a person (asks once: they can't log in any
 * more, their past sales stay) or **Bring back** a removed one. Nothing is deleted.
 */
export function ToggleActiveForm({ action, active, name }: { action: (state: FormState) => Promise<FormState>; active: boolean; name: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  const [asking, setAsking] = useState(false);
  if (active && !asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${secondaryButton} py-1 text-red-700 dark:text-red-300`}>
        {t('cat.staff.deactivate')}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {active && <span className="text-sm text-red-800 dark:text-red-200">{t('cat.staff.removeConfirm', { name })}</span>}
      <button
        type="submit"
        disabled={pending}
        className={active ? 'inline-flex items-center rounded-full bg-red-600 px-4 py-1 text-sm font-semibold text-white disabled:opacity-50' : `${secondaryButton} py-1`}
      >
        {active ? t('cat.staff.removeYes') : t('cat.staff.activate')}
      </button>
      {active && (
        <button type="button" onClick={() => setAsking(false)} className={`${secondaryButton} py-1`}>
          {t('cat.staff.keep')}
        </button>
      )}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function DesignRatesForm({
  action,
  initial,
  count,
  showCost = true,
  sizes = [],
  initialOwn = {},
  mixedSizes = [],
}: {
  action: Action;
  /** The design's defaults (rupees). */
  initial: RatesText;
  count: number;
  showCost?: boolean;
  /** The design's sizes in shop order; 2+ shows "Price by size". */
  sizes?: string[];
  /** Sizes' own rates today (rupees). */
  initialOwn?: OwnRatesText;
  /** Sizes whose colours have different prices today. */
  mixedSizes?: string[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  const [rates, setRates] = useState(initial);
  const [own, setOwn] = useState(initialOwn);
  const field = (key: keyof RatesText) => ({
    name: key,
    value: rates[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRates({ ...rates, [key]: e.target.value }),
  });
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className={`grid gap-2 ${showCost ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('cat.mrpRupees')}
          <input {...field('mrp')} inputMode="decimal" required className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('cat.rates.price')}
          <input {...field('price')} inputMode="decimal" placeholder={rates.mrp || '= MRP'} className={input} />
        </label>
        {showCost && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('cat.rates.purchase')}
            <input {...field('cost')} inputMode="decimal" placeholder="—" className={input} />
          </label>
        )}
      </div>
      {sizes.length >= 2 && <SizeRatesEditor sizes={sizes} defaults={rates} own={own} onChange={setOwn} showCost={showCost} named />}
      {mixedSizes.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t('cat.rates.mixed', { sizes: mixedSizes.join(', ') })}
        </p>
      )}
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? t('common.saving') : t(count === 1 ? 'cat.rates.applyOne' : 'cat.rates.applyMany', { n: count })}
      </button>
    </form>
  );
}

export function PermissionsForm({
  action,
  granted,
  name,
  options,
}: {
  action: Action;
  granted: string[];
  name: string;
  options: { value: string; label: string; description: string }[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2" aria-label={t('cat.perm.formLabel', { name })}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t('cat.perm.legend', { name })}</legend>
        {options.map((option) => (
          <label key={option.value} className="flex items-start gap-3 rounded-lg border border-zinc-200 p-2 text-sm dark:border-zinc-800">
            <input
              type="checkbox"
              name="permissions"
              value={option.value}
              defaultChecked={granted.includes(option.value)}
              aria-label={t('cat.perm.optionFor', { label: option.label, name })}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>
              <span className="font-medium">{option.label}</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={`${primaryButton} py-1.5`}>
          {pending ? t('common.saving') : t('cat.perm.save')}
        </button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state.message && <span role="status" className="text-xs text-brand-700">{state.message}</span>}
      </div>
    </form>
  );
}
