'use client';

import { useActionState, useState } from 'react';
import { errorBox, input, primaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { loginAction, type LoginState } from '@/server/actions/auth';

type Person = { id: string; name: string; role: 'admin' | 'salesman' };

export function LoginForm({ people }: { people: Person[] }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [staffId, setStaffId] = useState('');
  const t = useT();

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('login.who')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {people.map((person) => (
            <label
              key={person.id}
              className={`cursor-pointer rounded-xl border px-4 py-3 text-center font-medium ${
                staffId === person.id
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'border-zinc-300 dark:border-zinc-700'
              }`}
            >
              <input
                type="radio"
                name="staffId"
                value={person.id}
                checked={staffId === person.id}
                onChange={() => setStaffId(person.id)}
                className="sr-only"
              />
              <span className="block">{person.name}</span>
              <span className="block text-xs font-normal text-zinc-500">
                {t(person.role === 'admin' ? 'role.admin' : 'role.salesman')}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('login.pin')}
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={6}
          className={`${input} tracking-widest`}
        />
      </label>
      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primaryButton} py-3 text-lg`}>
        {pending ? t('login.submitting') : t('login.submit')}
      </button>
    </form>
  );
}
