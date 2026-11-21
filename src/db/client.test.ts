// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';
import { STORE_ID, STORE_NAME, STORE_TIMEZONE } from '../lib/app-config.ts';
import { createPgliteDb, type Db } from './client.ts';
import { stores, suppliers } from './schema/index.ts';

const dirs: string[] = [];
const close = (db: Db) => (db as unknown as { $client: PGlite }).$client.close();
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('local database start-up (ADR-056)', () => {
  it('a fresh local database gets the demo shop and the sample companies', async () => {
    const db = await createPgliteDb(undefined, { seed: 'demo+samples' });
    expect((await db.select().from(suppliers)).length).toBeGreaterThan(0);
    await close(db);
  });

  it('a copy of the live shop gets nothing added when the app starts', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'maa-live-copy-'));
    dirs.push(dir);
    // What `pnpm db:copy-live` leaves: the live shop's rows, no demo / sample data.
    const copy = await createPgliteDb(dir, { seed: 'none' });
    await copy.insert(stores).values({ id: STORE_ID, name: STORE_NAME, timezone: STORE_TIMEZONE });
    await close(copy);

    // The app starts on it the way `pnpm dev` does.
    const started = await createPgliteDb(dir, { seed: 'demo+samples' });
    expect(await started.select().from(suppliers)).toHaveLength(0);
    expect(await started.select().from(stores)).toHaveLength(1);
    await close(started);
  });
});
