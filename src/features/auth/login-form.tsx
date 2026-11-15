'use client';

import { useActionState, useState } from 'react';
import { IconBackspace } from '@/components/ui/icons';
import { errorBox, primaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { loginAction, type LoginState } from '@/server/actions/auth';

type Person = { id: string; name: string; role: 'admin' | 'salesman' };

const PIN_MAX = 6;
// Each person's circle takes a different shade of the theme's dye.
const SHADES = ['bg-brand-600', 'bg-brand-800', 'bg-brand-500', 'bg-brand-700', 'bg-brand-900'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 1)).toUpperCase();
}

/**
 * Login (plan v8): tap your name circle, then the PIN on a big keypad like a
 * payment app. The PIN box still takes typing (computer keyboards, tests);
 * on phones the keypad is used, so the phone keyboard stays closed.
 */
export function LoginForm({ people }: { people: Person[] }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const t = useT();
  const chosen = people.find((p) => p.id === staffId);

  const press = (key: string) => {
    navigator.vibrate?.(8);
    setPin((p) => (key === 'back' ? p.slice(0, -1) : (p + key).slice(0, PIN_MAX)));
  };

  const keyClass =
    'flex h-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl font-semibold text-brand-900 transition select-none active:scale-90 active:bg-brand-100 dark:bg-zinc-800 dark:text-zinc-100 dark:active:bg-zinc-700';

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">{t('login.who')}</legend>
        <div className="grid grid-cols-3 gap-x-2 gap-y-2.5">
          {people.map((person, i) => {
            const selected = staffId === person.id;
            return (
              <label key={person.id} className="group flex cursor-pointer flex-col items-center gap-1 text-center">
                <input
                  type="radio"
                  name="staffId"
                  value={person.id}
                  checked={selected}
                  onChange={() => setStaffId(person.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`relative flex h-14 w-14 items-center justify-center rounded-full font-display text-2xl text-white shadow-md transition group-active:scale-90 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 ${
                    SHADES[i % SHADES.length]
                  } ${selected ? 'scale-105 ring-4 ring-zari ring-offset-2 ring-offset-surface' : 'opacity-90'}`}
                >
                  {initials(person.name)}
                  {selected && (
                    <svg viewBox="0 0 24 24" className="absolute -right-1 -bottom-1 h-6 w-6 rounded-full bg-zari p-1 text-white shadow" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 12.5l4 4L18 8" />
                    </svg>
                  )}
                </span>
                <span className={`text-sm leading-tight font-semibold ${selected ? 'text-brand-800 dark:text-brand-200' : ''}`}>{person.name}</span>
                <span className="-mt-0.5 text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                  {t(person.role === 'admin' ? 'role.admin' : 'role.salesman')}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 rounded-3xl bg-brand-50/50 p-3 dark:bg-zinc-900/60">
        {chosen && <p className="page-in text-center text-sm font-medium text-brand-800 dark:text-brand-200">{t('login.hello', { name: chosen.name })}</p>}
        <label className="flex flex-col items-center gap-1 text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
          {t('login.pin')}
          <input
            name="pin"
            type="password"
            inputMode="none"
            autoComplete="current-password"
            maxLength={PIN_MAX}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
            className="h-11 w-full rounded-2xl border-0 bg-surface text-center text-3xl tracking-[0.6em] text-zinc-900 shadow-inner ring-1 ring-zinc-200 focus:ring-4 focus:ring-brand-500/20 focus:outline-none dark:text-zinc-100 dark:ring-zinc-700"
          />
        </label>
        <div role="group" aria-label={t('login.keypad')} className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => press(k)} className={keyClass}>
              {k}
            </button>
          ))}
          <span aria-hidden />
          <button type="button" onClick={() => press('0')} className={keyClass}>
            0
          </button>
          <button type="button" onClick={() => press('back')} aria-label={t('login.backspace')} title={t('login.backspace')} className={`${keyClass} bg-transparent text-zinc-500 dark:bg-transparent`}>
            <IconBackspace className="h-7 w-7" />
          </button>
        </div>
      </div>

      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primaryButton} w-full py-3.5 text-lg`}>
        {pending ? t('login.submitting') : t('login.submit')}
      </button>
    </form>
  );
}
