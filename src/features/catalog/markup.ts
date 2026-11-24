import { useSyncExternalStore } from 'react';

/**
 * The sale price worked out from the purchase price (owner, 2026-11-22, ADR-053): purchase + a %,
 * 50 unless the person changed it — remembered on this phone. Shared by New item and Bulk addition.
 */
const KEY = 'maa-markup';
export const DEFAULT_MARKUP = 50;

/** The markup % this phone used last, or null. Storage may be blocked: then nothing. */
export function readMarkup(): string | null {
  try {
    const saved = window.localStorage.getItem(KEY);
    return saved && /^\d{1,3}$/.test(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Remembers the % for the next entry on this phone (digits only; nothing when storage is blocked). */
export function saveMarkup(text: string) {
  try {
    if (text) window.localStorage.setItem(KEY, text);
  } catch {
    // Not remembered; it still works for this entry.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/** The remembered % as typed text, or null (also null on the server and on first paint). */
export function useSavedMarkup(): string | null {
  return useSyncExternalStore(subscribe, readMarkup, () => null);
}

/** "65" → 65; anything unreadable → 50; never above 500. */
export function markupOf(text: string | null): number {
  return text !== null && /^\d{1,3}$/.test(text) ? Math.min(Number(text), 500) : DEFAULT_MARKUP;
}

/** Purchase price + markup %, to whole rupees (in paise); null when there is no purchase price to work from. */
export function saleFromCost(costPaise: number | null, markup: number): number | null {
  return costPaise !== null && costPaise > 0 ? Math.round((costPaise * (100 + markup)) / 10000) * 100 : null;
}
