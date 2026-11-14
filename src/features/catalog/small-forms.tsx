'use client';

import { useActionState, useRef } from 'react';
import { errorBox, input, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
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
  const op = useOperationId();
  const [state, formAction, pending] = useActionState((prev: FormState, formData: FormData) => {
    op.stamp(formData);
    return action(prev, formData);
  }, {});
  return (
    <form action={formAction} onChange={op.reset} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Pieces received
          <input name="quantity" inputMode="numeric" required className={`${input} w-32`} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Note (optional)
          <input name="note" placeholder="e.g. supplier bill no." className={input} />
        </label>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? 'Adding…' : 'Add stock'}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function AddStaffForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input name="name" required maxLength={40} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Role
          <select name="role" defaultValue="salesman" className={input}>
            <option value="salesman">Salesman</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          PIN (4–6 digits)
          <input name="pin" inputMode="numeric" required maxLength={6} className={`${input} w-32`} />
        </label>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? 'Adding…' : 'Add staff'}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function ResetPinForm({ action, name }: { action: Action; name: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="pin" inputMode="numeric" maxLength={6} placeholder="New PIN" aria-label={`New PIN for ${name}`} className={`${input} w-28 py-1`} />
      <button type="submit" disabled={pending} className={`${secondaryButton} py-1`}>
        Set PIN
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.message && <span className="text-xs text-emerald-700">{state.message}</span>}
    </form>
  );
}

export function ToggleActiveForm({ action, active }: { action: (state: FormState) => Promise<FormState>; active: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex items-center gap-2">
      <button type="submit" disabled={pending} className={`${secondaryButton} py-1`}>
        {active ? 'Deactivate' : 'Activate'}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
