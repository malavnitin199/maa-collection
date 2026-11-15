import { en, type MessageKey, type Messages } from './en.ts';
import { hi } from './hi.ts';

export type { MessageKey, Messages };

export const LOCALES = ['en', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const MESSAGES: Record<Locale, Messages> = { en, hi };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export type Vars = Record<string, string | number>;
export type T = (key: MessageKey, vars?: Vars) => string;

/** Fills `{name}` placeholders; unknown placeholders are left as typed. */
export function fill(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** A translate function for one dictionary. */
export function makeT(messages: Messages): T {
  return (key, vars) => fill(messages[key] ?? en[key] ?? key, vars);
}

/** Singular / plural: uses `<base>.one` for 1 and `<base>.other` otherwise; `{n}` is filled. */
export function plural(t: T, base: 'my.pcs' | 'my.sales', n: number, vars: Vars = {}): string {
  return t(`${base}.${n === 1 ? 'one' : 'other'}` as MessageKey, { n, ...vars });
}

/** English translate function — the default for code that runs before a person's language is known. */
export const tEnglish: T = makeT(en);

type DateStyle = 'date' | 'dateTime' | 'dayMonth';
const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { dateStyle: 'medium', timeZone: 'Asia/Kolkata' },
  dateTime: { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' },
  // A plain calendar day (YYYY-MM-DD from the shop's day list): no time zone shift.
  dayMonth: { day: 'numeric', month: 'short', timeZone: 'UTC' },
};

/** Dates in the person's language — Hindi month names ("15 नव॰ 2026"), English otherwise; normal digits in both. Shop time zone. */
export function formatDate(locale: Locale, value: Date | string | number, style: DateStyle = 'date'): string {
  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', DATE_OPTIONS[style]).format(new Date(value));
}
