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
 * The size row on a tag: the category's whole list (shop order), else the
 * sizes this design is made in; the piece's own size is added if missing.
 */
export function tagSizeRange(categorySizes: readonly string[], designSizes: readonly string[], size: string): string[] {
  const base = categorySizes.length > 0 ? [...categorySizes] : [...designSizes];
  return base.some((s) => sameSize(s, size)) ? base : [...base, size];
}
