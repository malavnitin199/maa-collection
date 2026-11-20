'use client';

import { useState, useSyncExternalStore, type InputHTMLAttributes } from 'react';
import { input as inputStyle } from '@/components/ui/styles';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { convertLastWord, convertTrailingWord, toEnglish, toHindi } from '@/lib/transliterate';

export type Script = 'en' | 'hi';
const PREF = 'maa-type-lang';
const listeners = new Set<() => void>();
function readPref(): Script | null {
  try {
    const value = localStorage.getItem(PREF);
    return value === 'hi' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}
function savePref(script: Script) {
  try {
    localStorage.setItem(PREF, script);
  } catch {
    // Private window: the choice lasts until the page is closed.
  }
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** The script the phone types in (one choice for every field; the person's language until they pick). */
export function useTypingScript(): [Script, (next: Script) => void] {
  const locale = useLocale();
  const pref = useSyncExternalStore(subscribe, readPref, () => null);
  return [pref ?? locale, savePref];
}

export const scriptButton =
  'flex min-h-11 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white/60 text-sm font-semibold text-brand-700 transition active:scale-95 active:bg-brand-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-brand-300';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'> & {
  value?: string;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  /** Styles for the box itself (default: the app's input). */
  inputClassName?: string;
  /** Always this script (a Hindi-name field), no toggle. */
  force?: Script;
  /** Extra buttons after the script ones (the microphone). */
  extra?: React.ReactNode;
  testId?: string;
};

/**
 * A text box you can type in Hindi or English (owner's feedback 2026-11-20).
 * **अ / A** switches the script for every field on this phone: in Hindi, each
 * word typed in English letters becomes Devanagari when a space follows it
 * (the phone's Hindi keyboard works too). **⇄** changes what is already typed
 * to the other script. Works as a plain input (`name`, `defaultValue`) or
 * controlled (`value`, `onValueChange`).
 */
export function LangText({ value, defaultValue, onValueChange, inputClassName, className, force, extra, testId, onBlur, ...rest }: Props) {
  const t = useT();
  const [pref, setPref] = useTypingScript();
  const script = force ?? pref;
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? '');
  const text = controlled ? value : inner;
  const update = (next: string) => {
    if (!controlled) setInner(next);
    onValueChange?.(next);
  };
  const other: Script = script === 'hi' ? 'en' : 'hi';
  const flip = () => {
    if (text.trim()) update(other === 'hi' ? toHindi(text) : toEnglish(text));
    if (!force) setPref(other);
  };
  return (
    <div className={`flex items-stretch gap-1 ${className ?? ''}`}>
      <input
        {...rest}
        value={text}
        lang={script}
        data-testid={testId}
        onChange={(e) => update(script === 'hi' ? convertLastWord(e.target.value) : e.target.value)}
        onBlur={(e) => {
          if (script === 'hi') {
            const fixed = convertTrailingWord(text);
            if (fixed !== text) update(fixed);
          }
          onBlur?.(e);
        }}
        className={inputClassName ?? `${inputStyle} min-w-0 flex-1`}
      />
      {!force && (
        <button type="button" onClick={() => setPref(other)} aria-label={t(script === 'hi' ? 'type.english' : 'type.hindi')} aria-pressed={script === 'hi'} title={t(script === 'hi' ? 'type.english' : 'type.hindi')} className={scriptButton}>
          {script === 'hi' ? 'A' : 'अ'}
        </button>
      )}
      {text.trim() !== '' && (
        <button type="button" onClick={flip} aria-label={t(other === 'hi' ? 'type.toHindi' : 'type.toEnglish')} title={t(other === 'hi' ? 'type.toHindi' : 'type.toEnglish')} className={scriptButton}>
          ⇄
        </button>
      )}
      {extra}
    </div>
  );
}
