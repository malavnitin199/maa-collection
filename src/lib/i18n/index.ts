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

/** Every `<base>` that has both `<base>.one` and `<base>.other`. */
export type PluralBase = {
  [K in MessageKey]: K extends `${infer B}.one` ? (`${B}.other` extends MessageKey ? B : never) : never;
}[MessageKey];

/** Singular / plural: uses `<base>.one` for 1 and `<base>.other` otherwise; `{n}` is filled. */
export function plural(t: T, base: PluralBase, n: number, vars: Vars = {}): string {
  return t(`${base}.${n === 1 ? 'one' : 'other'}` as MessageKey, { n, ...vars });
}

/** English translate function — the default for code that runs before a person's language is known. */
export const tEnglish: T = makeT(en);

type DateStyle = 'date' | 'dateTime' | 'dayMonth' | 'time' | 'dayTime';
const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { dateStyle: 'medium', timeZone: 'Asia/Kolkata' },
  dateTime: { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' },
  time: { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' },
  dayTime: { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' },
  // A plain calendar day (YYYY-MM-DD from the shop's day list): no time zone shift.
  dayMonth: { day: 'numeric', month: 'short', timeZone: 'UTC' },
};

/** A moment as people say it: "4:12 pm" today, "18 Nov, 4:12 pm" before (shop time zone). */
export function formatWhen(locale: Locale, value: Date | string | number, now: Date = new Date()): string {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  return formatDate(locale, value, day(new Date(value)) === day(now) ? 'time' : 'dayTime');
}

/** Dates in the person's language — Hindi month names ("15 नव॰ 2026"), English otherwise; normal digits in both. Shop time zone. */
export function formatDate(locale: Locale, value: Date | string | number, style: DateStyle = 'date'): string {
  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', DATE_OPTIONS[style]).format(new Date(value));
}
