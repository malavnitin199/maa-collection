/**
 * Who an item is for (plan v17, owner request): small tap-tags on New item and
 * the product page. Both are optional; `null` = not set (older items).
 * Stored on `products.for_gender` / `products.age_group`, the same for every
 * size and colour of a design.
 */
import type { MessageKey } from '@/lib/i18n';

export const FOR_GENDERS = ['girls', 'boys', 'both'] as const;
export const AGE_GROUPS = ['adult', 'child'] as const;

export type ForGender = (typeof FOR_GENDERS)[number];
export type AgeGroup = (typeof AGE_GROUPS)[number];
export type ProductTags = { forGender: ForGender | null; ageGroup: AgeGroup | null };

/** `''` / `null` / `undefined` = not set; anything else must be a known value. */
export function parseTag<T extends string>(allowed: readonly T[], value: unknown): T | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : 'invalid';
}

/** Words for the tags (both languages, see `cat.tag.*`). */
export const FOR_LABEL: Record<ForGender, MessageKey> = { girls: 'cat.tag.girls', boys: 'cat.tag.boys', both: 'cat.tag.both' };
export const AGE_LABEL: Record<AgeGroup, MessageKey> = { adult: 'cat.tag.adult', child: 'cat.tag.child' };

/** A stored value back to a tag (anything unknown = not set). */
export const asForGender = (v: string | null | undefined): ForGender | null => ((FOR_GENDERS as readonly string[]).includes(v ?? '') ? (v as ForGender) : null);
export const asAgeGroup = (v: string | null | undefined): AgeGroup | null => ((AGE_GROUPS as readonly string[]).includes(v ?? '') ? (v as AgeGroup) : null);
