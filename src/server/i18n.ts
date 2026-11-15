import { cookies } from 'next/headers';
import { cache } from 'react';
import { DEFAULT_LOCALE, isLocale, makeT, MESSAGES, type Locale, type T } from '@/lib/i18n';
import { getCurrentStaff } from '@/server/auth';
import { DomainError } from '@/server/services/errors';

/** This phone's last language choice (used before login, and for people who haven't chosen). */
export const LOCALE_COOKIE = 'maa-lang';

/** The screen language for this request: the person's choice, else this phone's, else English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const me = await getCurrentStaff();
  if (isLocale(me?.language)) return me.language;
  const fromPhone = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(fromPhone) ? fromPhone : DEFAULT_LOCALE;
});

/** Translate function for server components and actions. */
export async function getT(): Promise<T> {
  return makeT(MESSAGES[await getLocale()]);
}

/** A rule error in the person's language when it carries a key; its English text otherwise. */
export function errorText(error: DomainError, t: T): string {
  return error.key ? t(error.key, error.vars) : error.message;
}
