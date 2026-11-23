/**
 * Plan v19 (ADR-033) — who an item is for: Men, Women, Boys, Girls, and any
 * section the owner adds. Each item type (category) sits under one section.
 * Shared by the server (one-time set-up, checks) and the screens (names,
 * pictures). No business rule here reads the database.
 */

/** Pictures a section can have (drawn in `src/features/catalog/section-art.tsx`). */
export const SECTION_ICONS = ['man', 'woman', 'girl', 'boy', 'baby', 'family', 'bag', 'shoe', 'hanger'] as const;
export type SectionIcon = (typeof SECTION_ICONS)[number];

export function asSectionIcon(value: string | null | undefined): SectionIcon {
  return (SECTION_ICONS as readonly string[]).includes(value ?? '') ? (value as SectionIcon) : 'hanger';
}

export type DefaultSectionKey = 'men' | 'women' | 'boys' | 'girls';

/** Every shop starts with these four, in this order (owner, D-V19-1). */
export const DEFAULT_SECTIONS: readonly { key: DefaultSectionKey; name: string; nameHi: string; icon: SectionIcon }[] = [
  { key: 'men', name: 'Men', nameHi: 'पुरुष', icon: 'man' },
  { key: 'women', name: 'Women', nameHi: 'महिला', icon: 'woman' },
  { key: 'boys', name: 'Boys', nameHi: 'लड़के', icon: 'boy' },
  { key: 'girls', name: 'Girls', nameHi: 'लड़कियाँ', icon: 'girl' },
];

/**
 * Owner, 2026-11-22 (ADR-064): Men and Women are the shop's fixed collections — always
 * there, never deleted, renamed or hidden. Known by their stored (English) name, any
 * letter case; every other collection can be edited and deleted.
 */
export type FixedSectionKey = 'men' | 'women';
export const FIXED_SECTIONS = DEFAULT_SECTIONS.filter((s): s is (typeof DEFAULT_SECTIONS)[number] & { key: FixedSectionKey } => s.key === 'men' || s.key === 'women');

/** The fixed collection a stored name is (Men / Women), or null. */
export function fixedSectionKey(name: string): FixedSectionKey | null {
  const key = name.trim().toLowerCase();
  return FIXED_SECTIONS.find((s) => s.name.toLowerCase() === key)?.key ?? null;
}

/** Where a missing fixed collection goes in a list: right after the fixed one before it (Women after Men), else first. */
export function fixedSectionPlace(list: readonly { fixed: FixedSectionKey | null }[], key: FixedSectionKey): number {
  const before = FIXED_SECTIONS.slice(0, FIXED_SECTIONS.findIndex((f) => f.key === key))
    .map((f) => list.findIndex((s) => s.fixed === f.key))
    .filter((i) => i >= 0);
  return before.length > 0 ? Math.max(...before) + 1 : 0;
}

/**
 * A list of collections with Men and Women always in it: one the shop lacks (deleted
 * before ADR-064, or hidden) gets a stand-in in its place, made for real when tapped.
 */
export function withFixedSections<T extends { fixed: FixedSectionKey | null }>(list: readonly T[], standIn: (key: FixedSectionKey) => T): T[] {
  const out = [...list];
  for (const fixed of FIXED_SECTIONS) {
    if (!out.some((s) => s.fixed === fixed.key)) out.splice(fixedSectionPlace(out, fixed.key), 0, standIn(fixed.key));
  }
  return out;
}

const JEANS = ['28', '30', '32', '34'];
const TOPS = ['M', 'L', 'XL', 'XXL'];
const FREE = ['Free'];

export type StarterType = {
  name: string;
  nameHi: string;
  /** The SKU code it gets when free (the codes the shop has always used); else one is suggested. */
  code: string;
  sizes: readonly string[];
  /** Other spellings an existing category may have (compared with `typeKey`). */
  also?: readonly string[];
};

/**
 * The item types a brand-new section starts with (Boys and Girls as the owner
 * listed them; Men and Women as suggested). Added only while setting sections
 * up, and never when the shop already has a category with that name (in any
 * section, or not sorted yet): the owner's own list always wins (D-V19-2).
 */
export const STARTER_TYPES: Record<DefaultSectionKey, readonly StarterType[]> = {
  men: [
    { name: 'Shirt', nameHi: 'शर्ट', code: 'SH', sizes: TOPS, also: ['shirts'] },
    { name: 'T-shirt', nameHi: 'टी-शर्ट', code: 'TS', sizes: TOPS, also: ['tshirts', 'tee', 'tees'] },
    { name: 'Jeans', nameHi: 'जीन्स', code: 'JE', sizes: [...JEANS, '36'], also: ['gentsjeans', 'mensjeans'] },
    { name: 'Kurta', nameHi: 'कुर्ता', code: 'KU', sizes: TOPS, also: ['kurtas'] },
  ],
  women: [
    { name: 'Kurti', nameHi: 'कुर्ती', code: 'KR', sizes: TOPS, also: ['kurtis'] },
    { name: 'Saree', nameHi: 'साड़ी', code: 'SA', sizes: FREE, also: ['sari', 'sarees'] },
    { name: 'Lehenga', nameHi: 'लहंगा', code: 'LE', sizes: TOPS },
    { name: 'Dupatta', nameHi: 'दुपट्टा', code: 'DU', sizes: FREE },
    { name: 'Leggings', nameHi: 'लेगिंग्स', code: 'LG', sizes: TOPS },
    { name: 'Night Suit', nameHi: 'नाइट सूट', code: 'NS', sizes: TOPS, also: ['nightsuits'] },
    { name: 'Tops', nameHi: 'टॉप', code: 'TP', sizes: TOPS, also: ['top'] },
    { name: 'Jeans', nameHi: 'जीन्स', code: 'WJ', sizes: ['26', ...JEANS], also: ['ladiesjeans', 'womensjeans'] },
  ],
  boys: [
    { name: 'Jeans', nameHi: 'जीन्स', code: 'BJ', sizes: JEANS },
    { name: 'Shirt', nameHi: 'शर्ट', code: 'BS', sizes: TOPS, also: ['shirts'] },
    { name: 'T-shirt', nameHi: 'टी-शर्ट', code: 'BT', sizes: TOPS, also: ['tshirts', 'tee', 'tees'] },
  ],
  girls: [
    { name: 'Skirt', nameHi: 'स्कर्ट', code: 'SK', sizes: TOPS },
    { name: 'Dress', nameHi: 'ड्रेस', code: 'DR', sizes: TOPS },
    { name: 'Tops', nameHi: 'टॉप', code: 'GT', sizes: TOPS, also: ['top'] },
    { name: 'Jeans', nameHi: 'जीन्स', code: 'GJ', sizes: JEANS },
  ],
};

/** A type's name for comparing: "T-Shirt", "t shirt" and "TSHIRT" are the same. */
export function typeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Owner, 2026-11-22 (ADR-066): Jeans, Jacket and Shirt are the shop's fixed categories, in
 * any collection — never deleted, renamed or hidden. Known by name ("Shirts" too, any case).
 */
export const FIXED_TYPES = ['Jeans', 'Jacket', 'Shirt'] as const;
const FIXED_TYPE_KEYS = new Set(FIXED_TYPES.flatMap((name) => [typeKey(name), `${typeKey(name)}s`]));
export function isFixedType(name: string): boolean {
  return FIXED_TYPE_KEYS.has(typeKey(name));
}

/**
 * ✎ on a category (ADR-071): which stored name a save changes. The sheet sends what its tile showed (`was`,
 * drawn in Hindi when `hindi`) and what is typed now — the tile may be older than the person's language
 * (अ/A switched later, another phone), so the request's language is not used. Nothing changes unless the
 * name was edited, and never for Jeans / Jacket / Shirt. A new English name drops the old Hindi one (like ✎
 * on a collection); `nameHi` left out = kept.
 */
export function typeNameEdit(
  current: { name: string; nameHi: string | null },
  edit: { typed: string; was: string; hindi: boolean },
): { name: string; nameHi?: string | null } {
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
  const typed = clean(edit.typed);
  if (isFixedType(current.name) || !typed || typed === clean(edit.was)) return { name: current.name };
  if (edit.hindi && current.nameHi?.trim()) return { name: current.name, nameHi: typed };
  return typed.toLowerCase() === current.name.toLowerCase() ? { name: typed } : { name: typed, nameHi: null };
}

/** Every spelling a starter type answers to, as keys. */
export function starterKeys(type: StarterType): string[] {
  return [typeKey(type.name), ...(type.also ?? [])];
}

/** A section's or type's name in the person's language: the Hindi name when there is one, else the stored name. */
export function localName(row: { name: string; nameHi?: string | null }, locale: 'en' | 'hi'): string {
  return locale === 'hi' && row.nameHi?.trim() ? row.nameHi.trim() : row.name;
}

/** "Boys › Jeans" — a type with its section, for lists that show types from every section. */
export function typeLabel(typeName: string, sectionName?: string | null): string {
  return sectionName ? `${sectionName} › ${typeName}` : typeName;
}
