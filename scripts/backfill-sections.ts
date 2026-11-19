// One-time set-up of the sections (plan v19, ADR-033) in a Postgres database:
// Men / Women / Boys / Girls with Hindi names; existing categories are left in
// "Needs sorting" for the owner; starter types are added only where the shop
// has no category with that name. Does nothing if the shop already has sections.
//
//   DATABASE_URL=postgres://… node --import ./scripts/register.mjs scripts/backfill-sections.ts --dry-run   (report only)
//   DATABASE_URL=postgres://… node --import ./scripts/register.mjs scripts/backfill-sections.ts             (write)
//   DATABASE_URL=pglite:./.pglite node --import ./scripts/register.mjs scripts/backfill-sections.ts         (a local dev database)
//
// Take a backup first (see docs/PROGRESS.md for the backup command).
import { getDb } from '../src/db/client.ts';
import { STORE_ID } from '../src/lib/app-config.ts';
import { backfillSections } from '../src/server/services/sections.ts';

const url = process.env.DATABASE_URL ?? '';
if (!/^postgres(ql)?:\/\//.test(url) && !/^pglite:/.test(url)) {
  console.error('Set DATABASE_URL to the Postgres database to set up (or pglite:<folder> for a local one).');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');
const db = await getDb();
const result = await backfillSections(db, STORE_ID, { dryRun });
if (!result.created) {
  console.log('This shop already has sections; nothing changed.');
} else {
  console.log(dryRun ? 'Would set up (dry run, nothing written):' : 'Set up:');
  console.log('  sections      ', result.sections.map((s) => s.name).join(', '));
  console.log('  types added   ', result.typesAdded.length ? result.typesAdded.join(', ') : '—');
  console.log('  types skipped ', result.typesSkipped.length ? result.typesSkipped.join(', ') : '—', '(the shop already has them)');
  console.log('  needs sorting ', result.unsorted.length ? result.unsorted.join(', ') : '—', '(the owner sorts these in Categories)');
}
process.exit(0);
