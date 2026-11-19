import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { categories, products, sections, type Category, type Section } from '@/db/schema';
import { asSectionIcon, DEFAULT_SECTIONS, MAN_TYPE_KEYS, SUGGESTED_TYPES, typeKey, type DefaultSectionKey, type SectionIcon } from '@/lib/sections';
import { MAX_SIZES } from '@/lib/size-lists';
import { sameSize } from '@/lib/size-prices';
import { checkedSizes, createCategory, suggestSectionCode } from './catalog';
import { DomainError, isUniqueViolation } from './errors';

/**
 * Plan v19 — Man / Woman / Girl / Boy (and any section the owner adds), each
 * with its item types; a type's sizes are what the New item screen offers.
 */
export type SectionType = { id: string; name: string; code: string; sizes: string[]; active: boolean; productCount: number };
export type SectionWithTypes = { id: string; name: string; icon: SectionIcon; sort: number; active: boolean; types: SectionType[] };

const int = (expression: ReturnType<typeof sql>) => sql<number>`${expression}`.mapWith(Number);

/**
 * The first time a shop needs sections: the four sections, every existing type
 * sorted under one (men's names → Man, the rest → Woman, the owner's choice),
 * then the starting types a section still lacks. Runs once — after that the
 * owner's own changes (hidden types, renamed sections) are never undone.
 */
export async function ensureSections(db: Db, storeId: string): Promise<void> {
  const [any] = await db.select({ id: sections.id }).from(sections).where(eq(sections.storeId, storeId)).limit(1);
  if (any) return;
  try {
    await db.transaction(async (tx) => {
      const created = await tx
        .insert(sections)
        .values(DEFAULT_SECTIONS.map((s, i) => ({ storeId, name: s.name, icon: s.icon, sort: i + 1 })))
        .returning({ id: sections.id, name: sections.name });
      const idOf = (key: DefaultSectionKey) => created.find((row) => row.name === DEFAULT_SECTIONS.find((d) => d.key === key)!.name)!.id;

      const unsorted = await tx
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(and(eq(categories.storeId, storeId), isNull(categories.sectionId)));
      const have: Record<DefaultSectionKey, Set<string>> = { man: new Set(), woman: new Set(), girl: new Set(), boy: new Set() };
      for (const type of unsorted) {
        const key: DefaultSectionKey = MAN_TYPE_KEYS.includes(typeKey(type.name)) ? 'man' : 'woman';
        await tx.update(categories).set({ sectionId: idOf(key) }).where(eq(categories.id, type.id));
        have[key].add(typeKey(type.name));
      }

      const taken = new Set((await tx.select({ code: categories.code }).from(categories).where(eq(categories.storeId, storeId))).map((r) => r.code));
      for (const section of DEFAULT_SECTIONS) {
        for (const suggestion of SUGGESTED_TYPES[section.key]) {
          const names = [typeKey(suggestion.name), ...(suggestion.also ?? [])];
          if (names.some((n) => have[section.key].has(n))) continue;
          const code = suggestSectionCode(section.name, suggestion.name, taken);
          taken.add(code);
          await tx.insert(categories).values({ storeId, sectionId: idOf(section.key), name: suggestion.name, code, sizes: [...suggestion.sizes] });
          have[section.key].add(typeKey(suggestion.name));
        }
      }
    });
  } catch (error) {
    // Another screen set them up at the same moment: theirs stands.
    if (isUniqueViolation(error)) return;
    throw error;
  }
}

/** Sections in shop order with their types (A–Z); sets them up the first time. */
export async function listSections(db: Db, storeId: string, { activeOnly = false } = {}): Promise<{ sections: SectionWithTypes[]; unsorted: SectionType[] }> {
  await ensureSections(db, storeId);
  const [sectionRows, typeRows] = await Promise.all([
    db
      .select()
      .from(sections)
      .where(and(eq(sections.storeId, storeId), activeOnly ? eq(sections.active, true) : undefined))
      .orderBy(asc(sections.sort), asc(sections.name)),
    db
      .select({
        id: categories.id,
        sectionId: categories.sectionId,
        name: categories.name,
        code: categories.code,
        sizes: categories.sizes,
        active: categories.active,
        productCount: int(sql`count(${products.id})`),
      })
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .where(and(eq(categories.storeId, storeId), activeOnly ? eq(categories.active, true) : undefined))
      .groupBy(categories.id)
      .orderBy(asc(categories.name)),
  ]);
  const toType = (row: (typeof typeRows)[number]): SectionType => ({
    id: row.id,
    name: row.name,
    code: row.code,
    sizes: row.sizes,
    active: row.active,
    productCount: row.productCount,
  });
  return {
    sections: sectionRows.map((s) => ({
      id: s.id,
      name: s.name,
      icon: asSectionIcon(s.icon),
      sort: s.sort,
      active: s.active,
      types: typeRows.filter((t) => t.sectionId === s.id).map(toType),
    })),
    unsorted: typeRows.filter((t) => !t.sectionId || !sectionRows.some((s) => s.id === t.sectionId)).map(toType),
  };
}

function cleanSectionName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 30) throw new DomainError('Enter a name (up to 30 characters).', { key: 'sec.err.name' });
  return name;
}

async function assertFreeSectionName(db: Db, storeId: string, name: string, exceptId?: string) {
  const [same] = await db
    .select({ id: sections.id })
    .from(sections)
    .where(and(eq(sections.storeId, storeId), sql`lower(${sections.name}) = lower(${name})`, exceptId ? sql`${sections.id} <> ${exceptId}` : undefined))
    .limit(1);
  if (same) throw new DomainError('That name is already in the list.', { key: 'sec.err.exists' });
}

/** The owner adds a section (e.g. Kids, Accessories) with a picture; it goes last. */
export async function createSection(db: Db, storeId: string, input: { name: string; icon?: string | null }): Promise<Section> {
  await ensureSections(db, storeId);
  const name = cleanSectionName(input.name);
  await assertFreeSectionName(db, storeId, name);
  const [{ last }] = await db.select({ last: int(sql`coalesce(max(${sections.sort}), 0)`) }).from(sections).where(eq(sections.storeId, storeId));
  try {
    const [created] = await db.insert(sections).values({ storeId, name, icon: asSectionIcon(input.icon), sort: last + 1 }).returning();
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('That name is already in the list.', { key: 'sec.err.exists' });
    throw error;
  }
}

/** Rename, new picture, or hide / bring back (hidden sections leave the New item screen; nothing is deleted). */
export async function updateSection(db: Db, storeId: string, id: string, input: { name: string; icon?: string | null; active: boolean }): Promise<Section> {
  const name = cleanSectionName(input.name);
  await assertFreeSectionName(db, storeId, name, id);
  const [updated] = await db
    .update(sections)
    .set({ name, active: input.active, ...(input.icon ? { icon: asSectionIcon(input.icon) } : {}) })
    .where(and(eq(sections.storeId, storeId), eq(sections.id, id)))
    .returning();
  if (!updated) throw new DomainError('Choose Man, Woman, Girl or Boy.', { key: 'sec.err.sectionNotFound' });
  return updated;
}

/** New item → "+ Add": a type under a section, with its sizes (code made from both names). */
export async function createType(db: Db, storeId: string, input: { sectionId: string; name: string; sizes: string | readonly string[] }): Promise<Category> {
  return createCategory(db, storeId, { name: input.name, sizes: input.sizes, sectionId: input.sectionId });
}

/** New item → "+ Add size": the type keeps it for next time. Returns the type's sizes. */
export async function addTypeSize(db: Db, storeId: string, categoryId: string, rawSize: string): Promise<string[]> {
  const size = rawSize.trim().replace(/\s+/g, ' ');
  if (!size) throw new DomainError('Type a size.', { key: 'sec.err.size' });
  const [type] = await db
    .select({ sizes: categories.sizes })
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.id, categoryId)))
    .limit(1);
  if (!type) throw new DomainError('Category not found.', { key: 'cat.err.categoryNotFound' });
  if (type.sizes.some((s) => sameSize(s, size))) return type.sizes;
  if (type.sizes.length >= MAX_SIZES) throw new DomainError(`Up to ${MAX_SIZES} sizes per category.`, { key: 'cat.err.tooManySizes', vars: { n: MAX_SIZES } });
  const sizes = checkedSizes([...type.sizes, size]);
  await db.update(categories).set({ sizes }).where(eq(categories.id, categoryId));
  return sizes;
}

/** The section a type sits under (null if none) — e.g. for "Add next item". */
export async function sectionOfType(db: Db, storeId: string, categoryId: string | null | undefined): Promise<string | null> {
  if (!categoryId) return null;
  const [row] = await db
    .select({ sectionId: categories.sectionId })
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.id, categoryId)))
    .limit(1);
  return row?.sectionId ?? null;
}
