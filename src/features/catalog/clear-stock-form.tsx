'use client';

import { useActionState, useState } from 'react';
import { errorBox, input, muted, okBox, secondaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import type { FormState } from '@/server/actions/admin';

const dangerButton =
  'inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 font-semibold text-white shadow-md shadow-red-700/25 transition hover:bg-red-700 active:scale-[0.97] disabled:opacity-50';

/**
 * Settings → Clear stock (owner only): two steps so it can't happen by a slip —
 * open the confirmation, then enter the owner's PIN. The server checks the PIN.
 */
export function ClearStockForm({ action, items, pieces }: { action: (prev: FormState, formData: FormData) => Promise<FormState>; items: number; pieces: number }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <p data-testid="stock-now" className="text-sm font-semibold">
        {items > 0 ? t('own.clear.now', { items, pieces }) : t('own.clear.empty')}
      </p>
      {state.message && (
        <p role="status" className={okBox}>
          {state.message}
        </p>
      )}
      {!open ? (
        <button type="button" disabled={items === 0} onClick={() => setOpen(true)} className={`${secondaryButton} w-fit border-red-300 text-red-700 hover:border-red-500 hover:text-red-800 dark:border-red-900 dark:text-red-300`}>
          {t('own.clear.open')}
        </button>
      ) : (
        <form
          action={(formData) => {
            formAction(formData);
            setOpen(false);
          }}
          className="flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40"
        >
          <p className="text-sm font-medium text-red-900 dark:text-red-200">{t('own.clear.warn', { pieces })}</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('own.clear.pin')}
            <input name="pin" type="password" inputMode="numeric" autoComplete="off" required maxLength={6} className={`${input} w-40 tracking-widest`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={dangerButton}>
              {pending ? t('own.clear.working') : t('own.clear.confirm')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
      {pending && <p className={`text-sm ${muted}`}>{t('own.clear.working')}</p>}
    </div>
  );
}
