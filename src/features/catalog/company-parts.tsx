'use client';

import { useActionState, useState } from 'react';
import { errorBox, input, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { useOperationId } from '@/features/catalog/small-forms';
import { useFormDone } from '@/features/feedback/effects';
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
const field = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();

/** The done card's lines for a payment: amount, which bill (or the running account), the day, the note. */
function usePaymentDone(action: Action) {
  const t = useT();
  return useFormDone(action, {
    notSaved: t('done.notSaved'),
    describe: (fd) => ({
      title: t('done.paymentSaved'),
      amount: `₹${field(fd, 'amount')}`,
      lines: [
        { label: t('done.line.bill'), value: field(fd, 'billLabel') || t('done.line.account') },
        { label: t('done.line.day'), value: field(fd, 'paidOn') },
        { label: t('done.line.note'), value: field(fd, 'note') },
      ].filter((line) => line.value),
    }),
  });
}

/** `openBills`: this company's unpaid bills from the Bills section (id, a short label, what is still due). */
export function PaymentForm({ action, openBills, today }: { action: Action; openBills: { id: string; label: string; dueRupees: string }[]; today: string }) {
  const [billLabel, setBillLabel] = useState('');
  const t = useT();
  const op = useOperationId();
  const done = usePaymentDone(action);
  const [state, formAction, pending] = useActionState((prev: FormState, formData: FormData) => {
    op.stamp(formData);
    return done.action(prev, formData);
  }, {});
  return (
    <form action={formAction} onChange={op.reset} className="flex flex-col gap-3" data-testid="payment-form">
      {done.node}
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
        <select name="billId" defaultValue="" onChange={(e) => setBillLabel(e.target.selectedOptions[0]?.dataset.label ?? '')} className={input}>
          <option value="">{t('cat.acc.pay.account')}</option>
          {openBills.map((bill) => (
            <option key={bill.id} value={bill.id} data-label={bill.label}>
              {bill.label} · ₹{bill.dueRupees}
            </option>
          ))}
        </select>
        <input type="hidden" name="billLabel" value={billLabel} />
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
export function MarkPaidForm({ action, billId, billLabel, dueRupees, today }: { action: Action; billId: string; billLabel: string; dueRupees: string; today: string }) {
  const t = useT();
  const op = useOperationId();
  const done = usePaymentDone(action);
  const [state, formAction, pending] = useActionState((prev: FormState, formData: FormData) => {
    op.stamp(formData);
    return done.action(prev, formData);
  }, {});
  return (
    <form action={formAction} className="flex items-center gap-2">
      {done.node}
      <input type="hidden" name="amount" value={dueRupees} />
      <input type="hidden" name="paidOn" value={today} />
      <input type="hidden" name="billId" value={billId} />
      <input type="hidden" name="billLabel" value={billLabel} />
      <button type="submit" disabled={pending || !!state.message} className={`${secondaryButton} px-3 py-1.5 text-xs`}>
        {pending ? t('common.saving') : t('cat.acc.markPaid')}
      </button>
      {state.error && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{state.error}</span>}
    </form>
  );
}
