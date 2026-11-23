/**
 * Size lists per category (ADR-015). Each category has the sizes it comes in,
 * in shop order; tags print the whole list with tick boxes so a size can be
 * marked by pen, and stock entry offers these sizes first. The owner edits
 * them in Categories; these are the starting lists.
 */
import { sameSize } from './size-prices.ts'; // .ts: also loaded by node scripts (db seed)

export const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: 'S–XXL', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'M–XXL', sizes: ['M', 'L', 'XL', 'XXL'] },
  { label: 'Ladies 26–32', sizes: ['26', '28', '30', '32'] },
  { label: 'Gents 28–36', sizes: ['28', '30', '32', '34', '36'] },
  { label: 'Free', sizes: ['Free'] },
];

const [S_XXL, M_XXL, LADIES_WAIST, GENTS_WAIST, FREE] = SIZE_PRESETS.map((p) => p.sizes);

/** Starting lists by category code (same values as migration 0005). */
export const DEFAULT_CATEGORY_SIZES: Record<string, string[]> = {
  TS: S_XXL,
  SH: S_XXL,
  DR: S_XXL,
  NS: S_XXL,
  KU: M_XXL,
  KR: M_XXL,
  LJ: LADIES_WAIST,
  GJ: GENTS_WAIST,
  JE: ['26', '28', '30', '32', '34', '36'],
  SA: FREE,
  DU: FREE,
};

export const MAX_SIZES = 20;

/**
 * Sizes to tap when a category is made (owner's feedback 2026-11-21: a category
 * may come in one size, S–M, S–XL …): groups of common sizes, in shop order, and
 * quick ranges that pick several at once.
 */
export const SIZE_CHOICES: { group: 'letters' | 'waist' | 'kids' | 'other'; sizes: string[] }[] = [
  { group: 'letters', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'] },
  { group: 'waist', sizes: ['24', '26', '28', '30', '32', '34', '36', '38', '40', '42'] },
  { group: 'kids', sizes: ['0-1Y', '1-2Y', '2-3Y', '3-4Y', '4-5Y', '5-6Y', '6-7Y', '7-8Y', '8-9Y', '9-10Y', '10-11Y', '11-12Y', '12-13Y', '13-14Y'] },
  { group: 'other', sizes: ['Free'] },
];
export const SIZE_RANGES: string[][] = [
  ['S', 'M'],
  ['S', 'M', 'L', 'XL'],
  ['S', 'M', 'L', 'XL', 'XXL'],
  ['M', 'L', 'XL', 'XXL'],
  ['26', '28', '30', '32'],
  ['28', '30', '32', '34', '36'],
];

/** Shop order for a picked set: the choice lists' order first, then anything typed, as typed. */
export function orderSizes(picked: readonly string[]): string[] {
  const known = SIZE_CHOICES.flatMap((c) => c.sizes);
  const has = (size: string) => picked.some((p) => sameSize(p, size));
  return [...known.filter(has), ...picked.filter((p) => !known.some((k) => sameSize(k, p)))];
}

/** Typed list ("S, M, L") or array → trimmed, no blanks, no repeats (case ignored), in the given order. */
export function cleanSizeList(input: string | readonly string[]): string[] {
  const values = typeof input === 'string' ? input.split(',') : input;
  const out: string[] = [];
  for (const raw of values) {
    const size = raw.trim().replace(/\s+/g, ' ');
    if (size && !out.some((s) => sameSize(s, size))) out.push(size);
  }
  return out;
}

/**
 * ✎ on a category (ADR-071): the sheet may hold an old copy of the list (a page kept alive, another phone),
 * so only what it changed is applied — the sizes it removed from or added to `was` (what it started from) —
 * on top of today's list `current`; a size someone else added meanwhile stays. Null when nothing changed.
 */
export function mergeSizeEdit(current: readonly string[], was: readonly string[], picked: readonly string[]): string[] | null {
  const before = cleanSizeList(was);
  const after = cleanSizeList(picked);
  const removed = before.filter((s) => !after.some((p) => sameSize(p, s)));
  const added = after.filter((p) => !before.some((s) => sameSize(s, p)));
  if (removed.length === 0 && added.length === 0) return null;
  const kept = current.filter((s) => !removed.some((r) => sameSize(r, s)));
  return orderSizes([...kept, ...added.filter((a) => !kept.some((k) => sameSize(k, a)))]);
}

/**
 * The size row on a tag: the category's whole list (shop order), else the
 * sizes this design is made in; the piece's own size is added if missing.
 */
export function tagSizeRange(categorySizes: readonly string[], designSizes: readonly string[], size: string): string[] {
  const base = categorySizes.length > 0 ? [...categorySizes] : [...designSizes];
  return base.some((s) => sameSize(s, size)) ? base : [...base, size];
}
