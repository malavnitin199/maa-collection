import type { T } from '@/lib/i18n';

/**
 * Plan v19 — who an item is for (Man, Woman, Girl, Boy, and more the owner
 * adds) and the item types each starts with. Shared by the server (first-time
 * set-up) and the screens (pictures, labels).
 */

/** Pictures a section can have (drawn in `src/features/catalog/section-art.tsx`). */
export const SECTION_ICONS = ['man', 'woman', 'girl', 'boy', 'baby', 'family', 'bag', 'shoe', 'hanger'] as const;
export type SectionIcon = (typeof SECTION_ICONS)[number];

export function asSectionIcon(value: string | null | undefined): SectionIcon {
  return (SECTION_ICONS as readonly string[]).includes(value ?? '') ? (value as SectionIcon) : 'hanger';
}

export type DefaultSectionKey = 'man' | 'woman' | 'girl' | 'boy';

/** Every shop starts with these four (owner, 2026-11-19), in this order. */
export const DEFAULT_SECTIONS: readonly { key: DefaultSectionKey; name: string; icon: SectionIcon }[] = [
  { key: 'man', name: 'Man', icon: 'man' },
  { key: 'woman', name: 'Woman', icon: 'woman' },
  { key: 'girl', name: 'Girl', icon: 'girl' },
  { key: 'boy', name: 'Boy', icon: 'boy' },
];

const JEANS = ['28', '30', '32', '34'];
const TOPS = ['M', 'L', 'XL', 'XXL'];
const FREE = ['Free'];

export type SuggestedType = { name: string; sizes: readonly string[]; /** Other names an existing type may have (compared with `typeKey`). */ also?: readonly string[] };

/**
 * The item types each section starts with: Boy and Girl as the owner listed
 * them; Man and Woman as suggested and chosen by the owner. An existing type
 * with the same name (or one of `also`) is used instead of adding another.
 */
export const SUGGESTED_TYPES: Record<DefaultSectionKey, readonly SuggestedType[]> = {
  man: [
    { name: 'Shirt', sizes: TOPS, also: ['shirts'] },
    { name: 'T-shirt', sizes: TOPS, also: ['tshirts', 'tee', 'tees'] },
    { name: 'Jeans', sizes: [...JEANS, '36'], also: ['gentsjeans', 'mensjeans'] },
    { name: 'Kurta', sizes: TOPS, also: ['kurtas'] },
  ],
  woman: [
    { name: 'Kurti', sizes: TOPS, also: ['kurtis'] },
    { name: 'Saree', sizes: FREE, also: ['sari', 'sarees'] },
    { name: 'Lehenga', sizes: TOPS },
    { name: 'Dupatta', sizes: FREE },
    { name: 'Leggings', sizes: TOPS },
    { name: 'Night Suit', sizes: TOPS, also: ['nightsuits'] },
    { name: 'Tops', sizes: TOPS, also: ['top'] },
    { name: 'Jeans', sizes: ['26', ...JEANS], also: ['ladiesjeans', 'womensjeans'] },
  ],
  girl: [
    { name: 'Skirt', sizes: TOPS },
    { name: 'Dress', sizes: TOPS },
    { name: 'Tops', sizes: TOPS, also: ['top'] },
    { name: 'Jeans', sizes: JEANS },
  ],
  boy: [
    { name: 'Jeans', sizes: JEANS },
    { name: 'Shirt', sizes: TOPS, also: ['shirts'] },
    { name: 'T-shirt', sizes: TOPS, also: ['tshirts', 'tee', 'tees'] },
  ],
};

/**
 * Existing types that go under Man when the sections are first set up; every
 * other existing type goes under Woman (owner's choice, 2026-11-19).
 */
export const MAN_TYPE_KEYS: readonly string[] = ['shirt', 'shirts', 'tshirt', 'tshirts', 'tee', 'tees', 'kurta', 'kurtas', 'gentsjeans', 'mensjeans'];

/** A type's name for comparing: "T-Shirt", "t shirt" and "TSHIRT" are the same. */
export function typeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** One of the four starting sections, by its stored name (so it can be shown in the person's language). */
export function defaultSectionKey(name: string | null | undefined): DefaultSectionKey | null {
  return DEFAULT_SECTIONS.find((d) => d.name === name)?.key ?? null;
}

/** "Boy › Jeans" — a type with its section, for lists that show types from every section. */
export function typeLabel(type: { name: string }, sectionName?: string | null): string {
  return sectionName ? `${sectionName} › ${type.name}` : type.name;
}

/** A section's name in the person's language: the four starting ones are translated, the owner's own stay as typed. */
export function sectionName(name: string | null | undefined, t: T): string | null {
  if (!name) return null;
  const key = defaultSectionKey(name);
  return key ? t(`sec.default.${key}`) : name;
}

/** A type for a list of every type: "Boy › Jeans" (the same name can sit under two sections). */
export function typeOptionName(type: { name: string; sectionName?: string | null }, t: T): string {
  return typeLabel(type, sectionName(type.sectionName, t));
}
