// Relative .ts imports so `node scripts/db-seed.ts` can run this file directly.
import { DUMMY_CATALOG } from '../features/catalog/dummy-catalog.ts';
import { STORE_ID, STORE_NAME, STORE_TIMEZONE } from '../lib/app-config.ts';
import { hashPin, randomPin } from '../server/security/pin.ts';
import type { Db } from './client.ts';
import { categories, products, sections, staff, stockMovements, stores, suppliers } from './schema/index.ts';
import { DEFAULT_CATEGORY_SIZES } from '../lib/size-lists.ts';
import { DEFAULT_SECTIONS, type DefaultSectionKey } from '../lib/sections.ts';
import { eq } from 'drizzle-orm';

/** Owner's staff list (plan v2, D-ST-1). The admin can add more in the app. */
export const SEED_STAFF = [
  { name: 'Owner', role: 'admin' },
  { name: 'Vishal', role: 'salesman' },
  { name: 'Nitin', role: 'salesman' },
  { name: 'Pradeep', role: 'salesman' },
  { name: 'Balram', role: 'salesman' },
] as const;

/** PIN for every seeded account in local dev and tests ONLY (never production). */
export const DEV_PIN = '1234';

/**
 * Plan v19: which section each demo / sample category sits under. Dev and test
 * data only — the live shop's categories are sorted by the owner (D-V19-2).
 */
const SEED_SECTION: Record<string, DefaultSectionKey> = {
  'T-Shirt': 'men',
  Kurta: 'men',
  Jeans: 'men',
  Shirt: 'men',
  'Gents Jeans': 'men',
  Saree: 'women',
  Dress: 'women',
  Kurti: 'women',
  Lehenga: 'women',
  Dupatta: 'women',
  Leggings: 'women',
  'Night Suit': 'women',
  'Ladies Jeans': 'women',
};

/** The shop's sections by default key (empty when the shop has none yet). */
async function sectionIds(db: Db): Promise<Partial<Record<DefaultSectionKey, string>>> {
  const rows = await db.select({ id: sections.id, name: sections.name }).from(sections).where(eq(sections.storeId, STORE_ID));
  const out: Partial<Record<DefaultSectionKey, string>> = {};
  for (const d of DEFAULT_SECTIONS) {
    const row = rows.find((r) => r.name === d.name);
    if (row) out[d.key] = row.id;
  }
  return out;
}

const OPENING_STOCK: Record<string, number> = {
  'MAA-TS-001': 3,
  'MAA-TS-002': 5,
  'MAA-KU-001': 4,
  'MAA-KU-002': 2,
  'MAA-JE-001': 6,
  'MAA-SH-001': 1,
  'MAA-SA-001': 0,
  'MAA-DR-001': 8,
};

/**
 * Inserts the shop, staff and the 8 demo products if the database is empty.
 * pins: 'dev' gives everyone DEV_PIN; 'random' generates one PIN per person and
 * returns them so they can be handed to the owner (production seeding).
 */
export async function seedDemoData(
  db: Db,
  { pins }: { pins: 'dev' | 'random' },
): Promise<{ seeded: boolean; pins: Record<string, string> }> {
  const existing = await db.select({ id: stores.id }).from(stores).limit(1);
  if (existing.length > 0) return { seeded: false, pins: {} };

  const issuedPins: Record<string, string> = {};
  await db.transaction(async (tx) => {
    await tx.insert(stores).values({ id: STORE_ID, name: STORE_NAME, timezone: STORE_TIMEZONE });
    const people = await tx
      .insert(staff)
      .values(
        SEED_STAFF.map((person) => {
          const pin = pins === 'dev' ? DEV_PIN : randomPin();
          issuedPins[person.name] = pin;
          return { storeId: STORE_ID, name: person.name, role: person.role, pinHash: hashPin(pin) };
        }),
      )
      .returning();
    const owner = people.find((p) => p.role === 'admin');
    // Plan v19: the four sections, then the demo categories under them.
    const sectionRows = await tx
      .insert(sections)
      .values(DEFAULT_SECTIONS.map((s, i) => ({ storeId: STORE_ID, name: s.name, nameHi: s.nameHi, icon: s.icon, sort: i + 1 })))
      .returning();
    const sectionId = (name: string) => {
      const key = SEED_SECTION[name];
      return key ? (sectionRows.find((s) => s.name === DEFAULT_SECTIONS.find((d) => d.key === key)!.name)?.id ?? null) : null;
    };
    const categoryNames = [...new Set(DUMMY_CATALOG.map((item) => item.category))];
    const categoryRows = await tx
      .insert(categories)
      .values(
        categoryNames.map((name) => {
          // Matches the demo SKUs: T-Shirt → TS, Kurta → KU, …
          const code = (name.toUpperCase().replace(/[^A-Z]/g, '') + 'XX').slice(0, 2);
          return { storeId: STORE_ID, name, code, sizes: DEFAULT_CATEGORY_SIZES[code] ?? [], sectionId: sectionId(name) };
        }),
      )
      .returning();
    const categoryId = (name: string) => categoryRows.find((c) => c.name === name)?.id;
    const inserted = await tx
      .insert(products)
      .values(
        DUMMY_CATALOG.map((item) => ({
          storeId: STORE_ID,
          sku: item.sku,
          barcode: item.barcode,
          name: item.design,
          brand: item.brand,
          category: item.category,
          categoryId: categoryId(item.category),
          size: item.size,
          color: item.color,
          mrpPaise: item.mrpPaise,
          pricePaise: item.mrpPaise,
          costPaise: Math.round((item.mrpPaise * 0.6) / 100) * 100,
          stock: OPENING_STOCK[item.sku] ?? 0,
          createdBy: owner?.id,
        })),
      )
      .returning();
    const opening = inserted.filter((p) => p.stock > 0);
    if (opening.length > 0) {
      await tx.insert(stockMovements).values(
        opening.map((p) => ({
          storeId: STORE_ID,
          productId: p.id,
          quantityChange: p.stock,
          reason: 'opening' as const,
          staffId: owner?.id,
          note: 'Demo opening stock',
        })),
      );
    }
  });
  return { seeded: true, pins: issuedPins };
}

/** Sample companies and extra categories so the owner can try the stock screens (plan: owner request 2026-11-15). */
export const SAMPLE_SUPPLIERS = [
  { name: 'Shree Ganesh Textiles', contactName: 'Mahesh Agarwal', phone: '98250 11111', notes: 'Surat · sarees and dress material' },
  { name: 'Laxmi Fashion House', contactName: 'Sunita Jain', phone: '98290 22222', notes: 'Jaipur · kurtis and suits' },
  { name: 'Royal Garments', contactName: 'Harpreet Singh', phone: '98140 33333', notes: 'Ludhiana · shirts, tees, winter wear' },
  { name: 'Kalyan Silk Mills', contactName: 'Ravi Kalyan', phone: '94150 44444', notes: 'Varanasi · Banarasi silk' },
  { name: 'Jaipur Prints Co.', contactName: 'Anil Sharma', phone: '94140 55555', notes: 'Jaipur · block-print cotton' },
] as const;

export const SAMPLE_CATEGORIES = [
  { name: 'Kurti', code: 'KR' },
  { name: 'Lehenga', code: 'LE' },
  { name: 'Dupatta', code: 'DU' },
  { name: 'Leggings', code: 'LG' },
  { name: 'Night Suit', code: 'NS' },
  // Jeans by gender (owner decision, ADR-015).
  { name: 'Ladies Jeans', code: 'LJ' },
  { name: 'Gents Jeans', code: 'GJ' },
] as const;

/** Adds the sample suppliers/categories that don't exist yet; safe to run repeatedly. */
export async function addSampleCatalog(db: Db): Promise<{ suppliers: number; categories: number }> {
  const addedSuppliers = await db
    .insert(suppliers)
    .values(SAMPLE_SUPPLIERS.map((s) => ({ storeId: STORE_ID, ...s })))
    .onConflictDoNothing()
    .returning({ id: suppliers.id });
  const ids = await sectionIds(db);
  const addedCategories = await db
    .insert(categories)
    .values(SAMPLE_CATEGORIES.map((c) => ({ storeId: STORE_ID, ...c, sizes: DEFAULT_CATEGORY_SIZES[c.code] ?? [], sectionId: (SEED_SECTION[c.name] && ids[SEED_SECTION[c.name]]) ?? null })))
    .onConflictDoNothing()
    .returning({ id: categories.id });
  return { suppliers: addedSuppliers.length, categories: addedCategories.length };
}
