'use client';

import { useActionState } from 'react';
import { errorBox, input, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { useOperationId } from '@/features/catalog/small-forms';
import { useT } from '@/features/i18n/i18n-provider';
import type { FormState } from '@/server/actions/admin';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className={errorBox}>{state.error}</p>;
  if (state.message) return <p role="status" className={okBox}>{state.message}</p>;
  return null;
}

/**
 * Company accounts (2026-11-20): record money paid to a company — amount, day
 * (today by default), the bill it is for (one of the open bills, or the running
 * account) and a note. Same operation id until the form is edited (one payment
 * per tap).
 */
export function PaymentForm({ action, openBills, today }: { action: Action; openBills: { number: string; dueRupees: string }[]; today: string }) {
  const t = useT();
  const op = useOperationId();
  const [state, formAction, pending] = useActionState((prev: FormState, formData: FormData) => {
    op.stamp(formData);
    return action(prev, formData);
  }, {});
  return (
    <form action={formAction} onChange={op.reset} className="flex flex-col gap-3" data-testid="payment-form">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('cat.acc.pay.amount')}
          <input name="amount" inputMode="decimal" required className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('cat.acc.pay.date')}
          <input name="paidOn" type="date" defaultValue={today} max={today} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('cat.acc.pay.bill')}
        <select name="billNumber" defaultValue="" className={input}>
          <option value="">{t('cat.acc.pay.account')}</option>
          {openBills.map((bill) => (
            <option key={bill.number} value={bill.number}>
              {bill.number} · ₹{bill.dueRupees}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('cat.acc.pay.note')}
        <input name="note" maxLength={200} className={input} />
      </label>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} py-3`}>
        {pending ? t('common.saving') : t('cat.acc.pay.save')}
      </button>
    </form>
  );
}

/** One tap on an open bill: records a payment of what is still due on it, dated today. */
export function MarkPaidForm({ action, billNumber, dueRupees, today }: { action: Action; billNumber: string; dueRupees: string; today: string }) {
  const t = useT();
  const op = useOperationId();
  const [state, formAction, pending] = useActionState((prev: FormState, formData: FormData) => {
    op.stamp(formData);
    return action(prev, formData);
  }, {});
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="amount" value={dueRupees} />
      <input type="hidden" name="paidOn" value={today} />
      <input type="hidden" name="billNumber" value={billNumber} />
      <button type="submit" disabled={pending || !!state.message} className={`${secondaryButton} px-3 py-1.5 text-xs`}>
        {pending ? t('common.saving') : t('cat.acc.markPaid')}
      </button>
      {state.error && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{state.error}</span>}
    </form>
  );
}
