// Makes the laptop's database (./.pglite) an exact copy of the live shop (Neon) — ADR-056.
//
//   pnpm db:copy-live        (stop `pnpm dev` first)
//
// One way only: live is READ in a single read-only snapshot and never written to.
// The laptop's old database is moved to ../backups/ first, so it can be put back —
// unless it is itself an earlier copy of live, which is simply replaced.
// The Neon address comes from .env.neon (or LIVE_DATABASE_URL) and is never printed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { createPgliteDb } from '../src/db/client.ts';

const root = process.cwd();
const target = path.join(root, '.pglite');
const fresh = path.join(root, '.pglite-new');
const backups = path.join(root, '..', 'backups');
/** Left inside a copy, so the next copy replaces it without a backup (live is its source). */
const MARK = 'maa-live-copy.json';

if (!existsSync(path.join(root, 'drizzle'))) stop('Run this from the maa-collection folder.');
const envFile = path.join(root, '.env.neon');
if (!process.env.LIVE_DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
const liveUrl = process.env.LIVE_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '';
if (!/^postgres(ql)?:\/\//.test(liveUrl)) stop('No live database address: .env.neon is missing (vercel env pull .env.neon).');
if (inUse(target)) stop('The laptop app is using its database. Stop `pnpm dev` (Ctrl+C), then run this again.');

// Same text formats on both sides, so every value is copied and compared exactly.
const FORMATS = ["timezone = 'UTC'", "datestyle = 'ISO, YMD'", "intervalstyle = 'postgres'", 'extra_float_digits = 3', "bytea_output = 'hex'"];

type Table = { name: string; columns: string[]; rows: number; hash: string; data: Buffer };

// 1. Read live: one read-only, repeatable-read snapshot, so all tables are from the same moment.
console.log('Reading the live shop (read only)…');
const live = postgres(liveUrl, { max: 1, prepare: false, onnotice: () => {} });
const snapshot = await live.begin('isolation level repeatable read read only', async (tx) => {
  for (const setting of FORMATS) await tx.unsafe(`set local ${setting}`);
  const [{ at }] = await tx<{ at: Date }[]>`select now() as at`;
  const [{ n: migrations }] = await tx<{ n: number }[]>`select count(*)::int as n from drizzle.__drizzle_migrations`;
  const tables: Table[] = [];
  for (const [name, columns] of await columnsOf((sql) => tx.unsafe<{ table_name: string; column_name: string }[]>(sql))) {
    const cols = columns.map(q).join(', ');
    const [{ rows, hash }] = await tx.unsafe<{ rows: number; hash: string }[]>(checksumSql(name, cols));
    const chunks: Buffer[] = [];
    if (rows > 0) for await (const chunk of await tx.unsafe(`copy ${q(name)} (${cols}) to stdout`).readable()) chunks.push(chunk);
    tables.push({ name, columns, rows, hash, data: Buffer.concat(chunks) });
  }
  const sequences: { name: string; value: string; called: boolean }[] = [];
  for (const { name } of await tx<{ name: string }[]>`select sequence_name as name from information_schema.sequences where sequence_schema = 'public'`) {
    const [s] = await tx.unsafe<{ value: string; called: boolean }[]>(`select last_value::text as value, is_called as called from ${q(name)}`);
    sequences.push({ name, ...s });
  }
  return { at, migrations, tables, sequences };
});
await live.end();
const total = snapshot.tables.reduce((sum, t) => sum + t.rows, 0);
console.log(`  ${snapshot.tables.length} tables, ${total} rows (live as of ${snapshot.at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}).`);

// 2. A fresh laptop database with the same structure (this code's migrations, no demo data).
console.log('Building the laptop copy…');
rmSync(fresh, { recursive: true, force: true });
const pg = ((await createPgliteDb(fresh, { seed: 'none' })) as unknown as { $client: PGlite }).$client;
const [{ n: localMigrations }] = (await pg.query<{ n: number }>('select count(*)::int as n from drizzle.__drizzle_migrations')).rows;
if (localMigrations < snapshot.migrations) {
  await discard();
  stop(`Live has ${snapshot.migrations - localMigrations} database change(s) this code doesn't have yet. Get the latest code (git pull), then run this again.`);
}
const localColumns = await columnsOf(async (sql) => (await pg.query<{ table_name: string; column_name: string }>(sql)).rows);
for (const t of snapshot.tables) {
  const missing = t.columns.filter((c) => !localColumns.get(t.name)?.includes(c));
  if (missing.length > 0) {
    await discard();
    stop(`The laptop's "${t.name}" table has no ${missing.join(', ')}. Get the latest code (git pull), then run this again.`);
  }
}

// 3. Load every table as it is on live (foreign-key checks paused: the snapshot is already consistent).
await pg.exec(FORMATS.map((s) => `set ${s};`).join(' '));
await pg.exec('set session_replication_role = replica;');
await pg.transaction(async (tx) => {
  for (const t of snapshot.tables) {
    if (t.rows === 0) continue;
    await tx.query(`copy ${q(t.name)} (${t.columns.map(q).join(', ')}) from '/dev/blob'`, [], { blob: new Blob([new Uint8Array(t.data)]) });
  }
  for (const s of snapshot.sequences) await tx.query('select setval($1, $2::bigint, $3)', [q(s.name), s.value, s.called]);
});
await pg.exec('set session_replication_role = origin;');

// 4. Check: every table has the same rows, value for value, as live.
console.log('Checking every table against live…');
const different: string[] = [];
for (const t of snapshot.tables) {
  const { rows, hash } = (await pg.query<{ rows: number; hash: string }>(checksumSql(t.name, t.columns.map(q).join(', ')))).rows[0];
  if (rows !== t.rows || hash !== t.hash) different.push(`${t.name} (live ${t.rows} rows, laptop ${rows})`);
}
if (different.length > 0) {
  await discard();
  stop(`The copy did not match live, so nothing on the laptop was changed: ${different.join('; ')}.`);
}
await pg.close();
writeFileSync(path.join(fresh, MARK), JSON.stringify({ liveAsOf: snapshot.at, tables: snapshot.tables.length, rows: total }, null, 1));

// 5. Swap: the old laptop database goes to ../backups/ (an earlier copy is just replaced), the copy takes its place.
if (inUse(target)) {
  rmSync(fresh, { recursive: true, force: true });
  stop('The laptop app started using its database meanwhile. Stop `pnpm dev`, then run this again.');
}
let keptAt = '';
const replacedCopy = existsSync(path.join(target, MARK));
if (replacedCopy) rmSync(target, { recursive: true, force: true });
else if (existsSync(target)) {
  mkdirSync(backups, { recursive: true });
  keptAt = path.join(backups, `laptop-database-before-live-copy-${stamp(new Date())}`);
  renameSync(target, keptAt);
}
renameSync(fresh, target);

console.log('');
console.log(`Done ✓ The laptop now has the same data as live: ${snapshot.tables.length} tables, ${total} rows, every table checked.`);
if (localMigrations > snapshot.migrations)
  console.log(`  Note: this code has ${localMigrations - snapshot.migrations} newer database change(s) that live doesn't have yet; those new parts start empty here.`);
if (replacedCopy) console.log('  The earlier laptop copy was replaced (anything tried on it locally is gone).');
if (keptAt) console.log(`  Old laptop database kept in ${path.relative(root, keptAt)} (to put it back: stop pnpm dev, rename it to .pglite).`);
console.log('  Log in on the laptop with your live PIN (the demo PIN 1234 is gone with the demo data).');
console.log('  Start the app: pnpm dev');
process.exit(0);

// ——— helpers ———

/** Columns per table of the public schema (generated columns left out — they fill themselves). */
async function columnsOf(run: (sql: string) => Promise<readonly { table_name: string; column_name: string }[]>) {
  const rows = await run(
    `select c.table_name, c.column_name from information_schema.columns c
       join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and t.table_type = 'BASE TABLE' and c.is_generated = 'NEVER'
      order by c.table_name, c.ordinal_position`,
  );
  const tables = new Map<string, string[]>();
  for (const r of rows) tables.set(r.table_name, [...(tables.get(r.table_name) ?? []), r.column_name]);
  return tables;
}

/** Row count + a fingerprint of every row's values (order-free), the same on Neon and PGlite. */
function checksumSql(table: string, cols: string) {
  return `select count(*)::int as rows, coalesce(md5(string_agg(h, '' order by h)), '') as hash
            from (select md5(row(${cols})::text) as h from ${q(table)}) s`;
}

function q(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

/** True when a running program (e.g. `pnpm dev`) has files of the folder open. */
function inUse(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    return execFileSync('lsof', ['-t', '+D', dir], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== '';
  } catch {
    return false; // lsof exits 1 when nothing has the folder open
  }
}

async function discard() {
  await pg.close();
  rmSync(fresh, { recursive: true, force: true });
}

function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function stop(message: string): never {
  console.error(`Not copied: ${message}`);
  process.exit(1);
}
