import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema/index.ts';
import { addSampleCatalog, seedDemoData } from './seed.ts';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { maaDb?: Promise<Db> };

/**
 * The app's database.
 * - DATABASE_URL=postgres://… → that Postgres (Neon in production).
 * - otherwise → PGlite, an embedded Postgres stored in ./.pglite, migrated and
 *   seeded with demo data automatically. `DATABASE_URL=pglite:memory` keeps it
 *   in memory (used by end-to-end tests). No local install needed.
 */
export function getDb(): Promise<Db> {
  globalForDb.maaDb ??= createDb(process.env.DATABASE_URL);
  return globalForDb.maaDb;
}

async function createDb(url: string | undefined): Promise<Db> {
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { default: postgres } = await import('postgres');
    // prepare: false — required behind Neon's pooled (pgbouncer) endpoint.
    const client = postgres(url, { prepare: false, max: 1 });
    return drizzle(client, { schema }) as unknown as Db;
  }
  const dataDir = url?.startsWith('pglite:') ? url.slice('pglite:'.length) : './.pglite';
  return createPgliteDb(dataDir === 'memory' ? undefined : dataDir, { seed: 'demo+samples' });
}

/** Embedded Postgres with migrations applied; used for local dev and tests. */
export async function createPgliteDb(
  dataDir?: string,
  options: { seed?: 'demo' | 'demo+samples' | 'none' } = {},
): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  const typed = db as unknown as Db;
  if (options.seed === 'demo' || options.seed === 'demo+samples') {
    const { seeded } = await seedDemoData(typed, { pins: 'dev' });
    // Sample companies/categories for trying the app locally (unit tests use plain 'demo').
    // Only into a shop the demo seed just made — never into a copy of the live shop
    // (`pnpm db:copy-live`), which must stay exactly like live.
    if (seeded && options.seed === 'demo+samples') await addSampleCatalog(typed);
  }
  return typed;
}
