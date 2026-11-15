'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, makeT, tEnglish, type Locale, type Messages, type T } from '@/lib/i18n';

const I18nContext = createContext<{ locale: Locale; t: T }>({ locale: DEFAULT_LOCALE, t: tEnglish });

/** Gives client components the person's language (filled by `LocaleRoot` in the root layout). */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(messages) }), [locale, messages]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

/** Translate function in client components. */
export function useT(): T {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
