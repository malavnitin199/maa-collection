import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { categories, products, sections, type Category, type Section } from '@/db/schema';
import type { Locale } from '@/lib/i18n';
import { asSectionIcon, DEFAULT_SECTIONS, FIXED_SECTIONS, fixedSectionKey, fixedSectionPlace, localName, STARTER_TYPES, starterKeys, typeKey, withFixedSections, type FixedSectionKey, type SectionIcon } from '@/lib/sections';
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
export type SectionWithTypes = {
  id: string;
  name: string;
  nameHi: string | null;
  icon: SectionIcon;
  sort: number;
  active: boolean;
  /** Men / Women (ADR-064): always there, never deleted, renamed or hidden. */
  fixed: FixedSectionKey | null;
  types: SectionType[];
};

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
      fixed: fixedSectionKey(s.name),
      types: typeRows.filter((t) => t.sectionId === s.id).map(toType),
    })),
    unsorted: typeRows.filter((t) => !t.sectionId || !sectionRows.some((s) => s.id === t.sectionId)).map(toType),
  };
}

/** One tile on New item's "Which collection?" (ADR-064). `standIn` = Men / Women the shop lacks, made when tapped. */
export type PickSection = {
  id: string;
  /** In the person's language. */
  name: string;
  icon: SectionIcon;
  fixed: FixedSectionKey | null;
  /** Items in it (every category, hidden ones too): a collection with items is not deleted. */
  items: number;
  standIn?: true;
  types: { id: string; name: string; code: string; sizes: string[] }[];
};

export function toPickSection(s: SectionWithTypes, locale: Locale): PickSection {
  return {
    id: s.id,
    name: localName(s, locale),
    icon: s.icon,
    fixed: s.fixed,
    items: s.types.reduce((n, x) => n + x.productCount, 0),
    types: s.types.filter((x) => x.active).map((x) => ({ id: x.id, name: localName(x, locale), code: x.code, sizes: x.sizes })),
  };
}

/** New item's collections: shown ones in shop order, Men and Women always among them (a stand-in when missing or hidden). Never writes. */
export async function newItemSections(db: Db, storeId: string, locale: Locale): Promise<PickSection[]> {
  const { sections: rows } = await listSections(db, storeId);
  return withFixedSections(
    rows.filter((s) => s.active).map((s) => toPickSection(s, locale)),
    (key): PickSection => {
      const fixed = FIXED_SECTIONS.find((f) => f.key === key)!;
      return { id: `fixed:${key}`, name: localName(fixed, locale), icon: fixed.icon, fixed: key, items: 0, standIn: true, types: [] };
    },
  );
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

/** Owner, 2026-11-22 (ADR-064): Men and Women stay as they are — no new name, never hidden or deleted. */
function fixedRefusal(name: string): DomainError {
  return new DomainError(`${name} always stays. It cannot be deleted, renamed or hidden.`, { key: 'sec.err.fixed', vars: { name } });
}

async function currentSection(db: Db, storeId: string, id: string): Promise<Section> {
  const [row] = await db.select().from(sections).where(and(eq(sections.storeId, storeId), eq(sections.id, id))).limit(1);
  if (!row) throw new DomainError('Choose a collection.', { key: 'sec.err.sectionNotFound' });
  return row;
}

/** A fixed collection may only change its letter case, its Hindi name and its picture. */
function assertFixedKept(current: Section, next: { name: string; active?: boolean }) {
  if (!fixedSectionKey(current.name)) return;
  if (next.name.toLowerCase() !== current.name.toLowerCase() || next.active === false) throw fixedRefusal(current.name);
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
  assertFixedKept(await currentSection(db, storeId, id), { name, active: input.active });
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

export type CollectionRow = { id: string; name: string; active: boolean; categories: number; items: number; pieces: number; fixed: FixedSectionKey | null };

/**
 * Home → Collections (owner, 2026-11-22, ADR-051): every collection (Men, Women, …)
 * in shop order with its categories, items and pieces in stock; Men and Women always
 * among them (ADR-064 — a missing one as an empty stand-in, id `fixed:<key>`).
 */
export async function collectionsOverview(db: Db, storeId: string): Promise<CollectionRow[]> {
  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      active: sections.active,
      categories: int(sql`count(distinct ${categories.id})`),
      items: int(sql`count(${products.id})`),
      pieces: int(sql`coalesce(sum(greatest(${products.stock}, 0)), 0)`),
    })
    .from(sections)
    .leftJoin(categories, eq(categories.sectionId, sections.id))
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(eq(sections.storeId, storeId))
    .groupBy(sections.id)
    .orderBy(asc(sections.sort), asc(sections.name));
  const list = rows.map((row) => ({ ...row, fixed: fixedSectionKey(row.name) }));
  // Men and Women are always listed (ADR-064); one the shop lacks shows as empty until it is made.
  return withFixedSections(list, (key) => ({ id: `fixed:${key}`, name: FIXED_SECTIONS.find((f) => f.key === key)!.name, active: true, categories: 0, items: 0, pieces: 0, fixed: key }));
}

/** Home → Collections: a new name (the Hindi name, picture and hidden state stay). */
export async function renameSection(db: Db, storeId: string, id: string, rawName: string): Promise<Section> {
  const name = cleanSectionName(rawName);
  assertFixedKept(await currentSection(db, storeId, id), { name });
  await assertFreeSectionName(db, storeId, name, id);
  try {
    const [updated] = await db.update(sections).set({ name }).where(and(eq(sections.storeId, storeId), eq(sections.id, id))).returning();
    if (!updated) throw new DomainError('Choose a collection.', { key: 'sec.err.sectionNotFound' });
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('That name is already in the list.', { key: 'sec.err.exists' });
    throw error;
  }
}

/**
 * Home → Collections → Delete (owner, 2026-11-22, ADR-051): a collection is the
 * one field every item must have, so it can go only once none of its items is
 * left (delete or move them first). Its empty categories go with it.
 */
export async function deleteSection(db: Db, storeId: string, id: string): Promise<{ name: string; categories: number }> {
  return db.transaction(async (raw) => {
    const tx = raw as unknown as Db;
    const [section] = await tx.select().from(sections).where(and(eq(sections.storeId, storeId), eq(sections.id, id))).limit(1);
    if (!section) throw new DomainError('Choose a collection.', { key: 'sec.err.sectionNotFound' });
    if (fixedSectionKey(section.name)) throw fixedRefusal(section.name);
    const [{ items }] = await tx
      .select({ items: int(sql`count(${products.id})`) })
      .from(categories)
      .innerJoin(products, eq(products.categoryId, categories.id))
      .where(eq(categories.sectionId, id));
    if (items > 0) throw new DomainError(`${section.name} still has ${items} items. Delete them first.`, { key: 'sec.err.hasItems', vars: { name: section.name, n: items } });
    const gone = await tx.delete(categories).where(and(eq(categories.storeId, storeId), eq(categories.sectionId, id))).returning({ id: categories.id });
    await tx.delete(sections).where(eq(sections.id, id));
    return { name: section.name, categories: gone.length };
  });
}

/**
 * Men / Women when the shop lacks one (owner, 2026-11-22, ADR-064): New item shows it
 * anyway, and the tap that picks it lands here — a hidden one is brought back; a missing
 * one is made (with its Hindi name and picture) right after the fixed one before it
 * (Women after Men, else first), the others keeping their order. Never from a page read.
 */
export async function ensureFixedSection(db: Db, storeId: string, key: FixedSectionKey): Promise<Section> {
  const fixed = FIXED_SECTIONS.find((s) => s.key === key);
  if (!fixed) throw new DomainError('Choose a collection.', { key: 'sec.err.sectionNotFound' });
  try {
    return await db.transaction(async (raw) => {
      const tx = raw as unknown as Db;
      const rows = await tx.select().from(sections).where(eq(sections.storeId, storeId)).orderBy(asc(sections.sort), asc(sections.name));
      const found = rows.find((s) => fixedSectionKey(s.name) === key);
      if (found?.active) return found;
      if (found) {
        const [shown] = await tx.update(sections).set({ active: true }).where(eq(sections.id, found.id)).returning();
        return shown;
      }
      const [created] = await tx.insert(sections).values({ storeId, name: fixed.name, nameHi: fixed.nameHi, icon: fixed.icon, sort: 0 }).returning();
      const order = rows.map((r) => r.id);
      order.splice(fixedSectionPlace(rows.map((r) => ({ fixed: fixedSectionKey(r.name) })), key), 0, created.id);
      for (const [i, sectionId] of order.entries()) await tx.update(sections).set({ sort: i + 1 }).where(eq(sections.id, sectionId));
      return { ...created, sort: order.indexOf(created.id) + 1 };
    });
  } catch (error) {
    // Made by another phone at the same moment: theirs is the one.
    if (!isUniqueViolation(error)) throw error;
    const [theirs] = await db
      .select()
      .from(sections)
      .where(and(eq(sections.storeId, storeId), sql`lower(${sections.name}) = lower(${fixed.name})`))
      .limit(1);
    if (!theirs) throw error;
    return theirs;
  }
}
