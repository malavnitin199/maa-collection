import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { categories, products, sections, type Category, type Section } from '@/db/schema';
import { asSectionIcon, DEFAULT_SECTIONS, STARTER_TYPES, starterKeys, typeKey, type SectionIcon } from '@/lib/sections';
import { MAX_SIZES } from '@/lib/size-lists';
import { sameSize } from '@/lib/size-prices';
import { assertFreeTypeName, checkedSizes, cleanHindi, createCategory, suggestSectionCode } from './catalog';
import { DomainError, isUniqueViolation } from './errors';

/**
 * Plan v19 (ADR-033) — Men / Women / Boys / Girls (and any section the owner
 * adds), each with its item types; a type's sizes are what New item offers.
 * Setting the sections up is an explicit, one-time step (`backfillSections`,
 * run by the owner's script or the seed) — never a side effect of a page read.
 */
export type SectionType = { id: string; name: string; nameHi: string | null; code: string; sizes: string[]; active: boolean; productCount: number };
export type SectionWithTypes = { id: string; name: string; nameHi: string | null; icon: SectionIcon; sort: number; active: boolean; types: SectionType[] };

const int = (expression: ReturnType<typeof sql>) => sql<number>`${expression}`.mapWith(Number);

export type BackfillResult = {
  /** false = the shop already had sections; nothing was changed. */
  created: boolean;
  sections: { name: string; id: string }[];
  /** Starter types added, as "Section › Type". */
  typesAdded: string[];
  /** Starter types skipped because the shop already has a category with that name. */
  typesSkipped: string[];
  /** Existing categories left in "Needs sorting" (the owner sorts them once). */
  unsorted: string[];
};

/**
 * The one-time set-up of a shop's sections (D-V19-1 / D-V19-2): the four
 * sections with their Hindi names; every existing category is left for the
 * owner to sort (never guessed); each starter type is added only when no
 * category in the shop already has that name. Runs once — a shop that has
 * sections is left exactly as it is. `dryRun` reports without writing.
 */
export async function backfillSections(db: Db, storeId: string, { dryRun = false } = {}): Promise<BackfillResult> {
  const [any] = await db.select({ id: sections.id }).from(sections).where(eq(sections.storeId, storeId)).limit(1);
  const existing = await db.select({ id: categories.id, name: categories.name, code: categories.code }).from(categories).where(eq(categories.storeId, storeId));
  const unsorted = existing.map((c) => c.name);
  if (any) return { created: false, sections: [], typesAdded: [], typesSkipped: [], unsorted: [] };

  const have = new Set(existing.map((c) => typeKey(c.name)));
  const taken = new Set(existing.map((c) => c.code));
  const typesAdded: string[] = [];
  const typesSkipped: string[] = [];
  const plan = DEFAULT_SECTIONS.map((section) => ({
    section,
    types: STARTER_TYPES[section.key].flatMap((type) => {
      if (starterKeys(type).some((k) => have.has(k))) {
        typesSkipped.push(`${section.name} › ${type.name}`);
        return [];
      }
      const code = taken.has(type.code) ? suggestSectionCode(section.name, type.name, taken) : type.code;
      taken.add(code);
      typesAdded.push(`${section.name} › ${type.name}`);
      return [{ ...type, code }];
    }),
  }));
  if (dryRun) return { created: true, sections: plan.map((p) => ({ name: p.section.name, id: '' })), typesAdded, typesSkipped, unsorted };

  try {
    return await db.transaction(async (tx) => {
      const created = await tx
        .insert(sections)
        .values(DEFAULT_SECTIONS.map((s, i) => ({ storeId, name: s.name, nameHi: s.nameHi, icon: s.icon, sort: i + 1 })))
        .returning({ id: sections.id, name: sections.name });
      for (const { section, types } of plan) {
        const sectionId = created.find((row) => row.name === section.name)!.id;
        if (types.length > 0) {
          await tx.insert(categories).values(types.map((type) => ({ storeId, sectionId, name: type.name, nameHi: type.nameHi, code: type.code, sizes: [...type.sizes] })));
        }
      }
      return { created: true, sections: created, typesAdded, typesSkipped, unsorted };
    });
  } catch (error) {
    // Set up by someone else at the same moment: theirs stands.
    if (isUniqueViolation(error)) return { created: false, sections: [], typesAdded: [], typesSkipped: [], unsorted: [] };
    throw error;
  }
}

/** Sections in shop order with their types (A–Z), plus the types not sorted yet. Never writes. */
export async function listSections(db: Db, storeId: string, { activeOnly = false } = {}): Promise<{ sections: SectionWithTypes[]; unsorted: SectionType[] }> {
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
        nameHi: categories.nameHi,
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
    nameHi: row.nameHi,
    code: row.code,
    sizes: row.sizes,
    active: row.active,
    productCount: row.productCount,
  });
  return {
    sections: sectionRows.map((s) => ({
      id: s.id,
      name: s.name,
      nameHi: s.nameHi,
      icon: asSectionIcon(s.icon),
      sort: s.sort,
      active: s.active,
      types: typeRows.filter((t) => t.sectionId === s.id).map(toType),
    })),
    unsorted: typeRows.filter((t) => !t.sectionId || !sectionRows.some((s) => s.id === t.sectionId)).map(toType),
  };
}

/** Categories not sorted under any section yet (the owner's "Needs sorting" list). */
export async function unsortedCount(db: Db, storeId: string): Promise<number> {
  const [row] = await db
    .select({ n: int(sql`count(*)`) })
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.active, true), isNull(categories.sectionId)));
  return row?.n ?? 0;
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

/** The owner adds a section (e.g. Kids, Accessories) with a picture and an optional Hindi name; it goes last. */
export async function createSection(db: Db, storeId: string, input: { name: string; nameHi?: string | null; icon?: string | null }): Promise<Section> {
  const name = cleanSectionName(input.name);
  await assertFreeSectionName(db, storeId, name);
  const [{ last }] = await db.select({ last: int(sql`coalesce(max(${sections.sort}), 0)`) }).from(sections).where(eq(sections.storeId, storeId));
  try {
    const [created] = await db
      .insert(sections)
      .values({ storeId, name, nameHi: cleanHindi(input.nameHi), icon: asSectionIcon(input.icon), sort: last + 1 })
      .returning();
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('That name is already in the list.', { key: 'sec.err.exists' });
    throw error;
  }
}

/** Rename (English / Hindi), new picture, or hide / bring back. Hidden sections leave New item; their types and items stay. */
export async function updateSection(
  db: Db,
  storeId: string,
  id: string,
  input: { name: string; nameHi?: string | null; icon?: string | null; active: boolean },
): Promise<Section> {
  const name = cleanSectionName(input.name);
  await assertFreeSectionName(db, storeId, name, id);
  const [updated] = await db
    .update(sections)
    .set({
      name,
      active: input.active,
      ...(input.icon ? { icon: asSectionIcon(input.icon) } : {}),
      ...(input.nameHi === undefined ? {} : { nameHi: cleanHindi(input.nameHi) }),
    })
    .where(and(eq(sections.storeId, storeId), eq(sections.id, id)))
    .returning();
  if (!updated) throw new DomainError('Choose Men, Women, Boys or Girls.', { key: 'sec.err.sectionNotFound' });
  return updated;
}

/** Move a section one place up or down in the shop order (swaps `sort` with its neighbour). */
export async function moveSection(db: Db, storeId: string, id: string, direction: 'up' | 'down'): Promise<void> {
  const rows = await db.select({ id: sections.id, sort: sections.sort }).from(sections).where(eq(sections.storeId, storeId)).orderBy(asc(sections.sort), asc(sections.name));
  const index = rows.findIndex((r) => r.id === id);
  if (index < 0) throw new DomainError('Choose Men, Women, Boys or Girls.', { key: 'sec.err.sectionNotFound' });
  const other = direction === 'up' ? index - 1 : index + 1;
  if (other < 0 || other >= rows.length) return;
  // Re-number everything 1…n so two sections never share a place, then swap.
  const order = rows.map((r) => r.id);
  [order[index], order[other]] = [order[other], order[index]];
  await db.transaction(async (tx) => {
    for (const [i, sectionId] of order.entries()) await tx.update(sections).set({ sort: i + 1 }).where(and(eq(sections.storeId, storeId), eq(sections.id, sectionId)));
  });
}

/**
 * Categories → "Move under…": a type (sorted or from Needs sorting) goes under a
 * section. Its code, sizes and items stay; only the section changes. A hidden
 * section is refused (bring it back first), as is a name already used there.
 */
export async function moveType(db: Db, storeId: string, categoryId: string, sectionId: string): Promise<{ type: Category; section: Section }> {
  const [type] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.id, categoryId)))
    .limit(1);
  if (!type) throw new DomainError('Category not found.', { key: 'cat.err.categoryNotFound' });
  const [section] = await db
    .select()
    .from(sections)
    .where(and(eq(sections.storeId, storeId), eq(sections.id, sectionId)))
    .limit(1);
  if (!section) throw new DomainError('Choose Men, Women, Boys or Girls.', { key: 'sec.err.sectionNotFound' });
  if (!section.active) throw new DomainError('This section is hidden. Bring it back in Categories first.', { key: 'sec.err.hidden' });
  if (type.sectionId === section.id) return { type, section };
  await assertFreeTypeName(db, storeId, section.id, type.name, type.id);
  try {
    const [updated] = await db.update(categories).set({ sectionId: section.id }).where(eq(categories.id, type.id)).returning();
    return { type: updated, section };
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('A category with that name or code already exists.', { key: 'cat.err.categoryExists' });
    throw error;
  }
}

/** A type under a section, with its sizes (code made from both names). */
export async function createType(
  db: Db,
  storeId: string,
  input: { sectionId: string; name: string; nameHi?: string | null; sizes: string | readonly string[] },
): Promise<Category> {
  return createCategory(db, storeId, { name: input.name, nameHi: input.nameHi, sizes: input.sizes, sectionId: input.sectionId });
}

/** "+ Add size" on a type: kept for next time. Returns the type's sizes. */
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
