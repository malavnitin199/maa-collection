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
