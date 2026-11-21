'use client';

import { useActionState, useRef, useState, useSyncExternalStore } from 'react';
import { IconBackspace } from '@/components/ui/icons';
import { errorBox, primaryButton } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { forgetSavedPages } from '@/offline/helper';
import { loginAction, type LoginState } from '@/server/actions/auth';

type Person = { id: string; name: string; role: 'admin' | 'salesman' };

const PIN_MAX = 6;
const PIN_MIN = 4;
/** Show a name search once the team is bigger than this. */
const SEARCH_FROM = 7;
const LAST = 'maa-last-staff';
// Each person's circle takes a different shade of the theme's dye.
const SHADES = ['bg-brand-600', 'bg-brand-800', 'bg-brand-500', 'bg-brand-700', 'bg-brand-900'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 1)).toUpperCase();
}

/** The person who last logged in on this phone (login clean-up, 2026-11-21). */
function readLast(): string | null {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
}
const noSubscribe = () => () => {};

/**
 * Login (plan v8; clean-up 2026-11-21): tap your name circle — the person who
 * last logged in on this phone is already picked — then the PIN on a big
 * keypad. Dots show how many digits are in; *Log in* lights up once a name and
 * at least four digits are there; a wrong PIN shakes and clears. A bigger team
 * gets a name search. The PIN box still takes typing (computers, tests).
 */
export function LoginForm({ people }: { people: Person[] }) {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [query, setQuery] = useState('');
  const [wrong, setWrong] = useState(0);
  const keypadRef = useRef<HTMLDivElement>(null);
  const last = useSyncExternalStore(noSubscribe, readLast, () => null);
  // Plan v18: a new login never sees the last person's counter page saved for offline use.
  const [state, formAction, pending] = useActionState<LoginState, FormData>(async (previous, data) => {
    try {
      localStorage.setItem(LAST, String(data.get('staffId') ?? ''));
    } catch {
      // Private mode: nothing remembered, nothing lost.
    }
    await forgetSavedPages();
    const result = await loginAction(previous, data);
    if (result.error) {
      setPin('');
      setWrong((n) => n + 1);
      navigator.vibrate?.([30, 40, 30]);
    }
    return result;
  }, {});
  const t = useT();
  const chosenId = staffId ?? (people.some((p) => p.id === last) ? last! : '');
  const chosen = people.find((p) => p.id === chosenId);
  const q = query.trim().toLowerCase();
  const shown = q ? people.filter((p) => p.name.toLowerCase().includes(q) || p.id === chosenId) : people;
  const ready = Boolean(chosen) && pin.length >= PIN_MIN && !pending;

  const press = (key: string) => {
    navigator.vibrate?.(8);
    setPin((p) => (key === 'back' ? p.slice(0, -1) : (p + key).slice(0, PIN_MAX)));
  };
  const choose = (id: string) => {
    setStaffId(id);
    setPin('');
    // On a phone the keypad may be below the fold: bring it up.
    keypadRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };

  const keyClass =
    'flex h-13 items-center justify-center rounded-2xl bg-brand-50 text-2xl font-semibold text-brand-900 shadow-sm shadow-brand-900/5 transition select-none active:scale-90 active:bg-brand-100 dark:bg-zinc-800 dark:text-zinc-100 dark:active:bg-zinc-700';

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">{t('login.who')}</legend>
        {people.length >= SEARCH_FROM && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('login.findName')}
            aria-label={t('login.findName')}
            className="mb-3 h-10 w-full rounded-full border-0 bg-brand-50/70 px-4 text-sm ring-1 ring-zinc-200 focus:ring-4 focus:ring-brand-500/20 focus:outline-none dark:bg-zinc-900 dark:ring-zinc-700"
          />
        )}
        <div className="grid grid-cols-3 gap-x-2 gap-y-3">
          {shown.map((person, i) => {
            const selected = chosenId === person.id;
            return (
              <label
                key={person.id}
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                className="login-pop group flex cursor-pointer flex-col items-center gap-1 text-center"
              >
                <input
                  type="radio"
                  name="staffId"
                  value={person.id}
                  checked={selected}
                  onChange={() => choose(person.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`relative flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl text-white shadow-md transition duration-200 group-active:scale-90 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 ${
                    SHADES[people.indexOf(person) % SHADES.length]
                  } ${selected ? 'scale-110 ring-4 ring-zari ring-offset-2 ring-offset-surface' : chosen ? 'opacity-60' : 'opacity-95'}`}
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

      <div ref={keypadRef} className="flex flex-col gap-3 rounded-3xl bg-brand-50/50 p-3 dark:bg-zinc-900/60">
        <p aria-live="polite" className="text-center text-sm font-medium text-brand-800 dark:text-brand-200">
          {chosen ? t('login.hello', { name: chosen.name }) : t('login.pickFirst')}
        </p>
        {/* The PIN: dots fill as digits go in; a wrong PIN shakes them. The box under the dots still takes typing. */}
        <label key={wrong} className={`relative flex flex-col items-center gap-1 ${wrong ? 'login-shake' : ''}`}>
          <span className="sr-only">{t('login.pin')}</span>
          <span aria-hidden className="flex h-11 items-center justify-center gap-3">
            {Array.from({ length: Math.max(PIN_MIN, pin.length) }, (_, i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full transition duration-150 ${i < pin.length ? 'scale-110 bg-brand-700 dark:bg-brand-300' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              />
            ))}
          </span>
          <input
            name="pin"
            type="password"
            inputMode="none"
            autoComplete="current-password"
            maxLength={PIN_MAX}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
            className="absolute inset-0 h-full w-full cursor-default rounded-2xl border-0 bg-transparent text-transparent caret-transparent focus:ring-4 focus:ring-brand-500/20 focus:outline-none"
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
          <button type="button" onClick={() => press('back')} aria-label={t('login.backspace')} title={t('login.backspace')} className={`${keyClass} bg-transparent text-zinc-500 shadow-none dark:bg-transparent`}>
            <IconBackspace className="h-7 w-7" />
          </button>
        </div>
      </div>

      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
      <button
        type="submit"
        aria-disabled={!ready}
        onClick={(e) => {
          if (!ready) e.preventDefault();
        }}
        className={`${primaryButton} w-full py-3.5 text-lg transition ${ready ? 'shadow-lg shadow-brand-700/30' : 'cursor-not-allowed opacity-45 shadow-none'}`}
      >
        {pending ? t('login.submitting') : t('login.submit')}
      </button>
    </form>
  );
}
