// One-time (ADR-054): bills made before they kept their own copy get one now —
// each stock entry on a bill is copied as it is today. Bill amounts are not changed.
//
//   DATABASE_URL=postgres://… node --import ./scripts/register.mjs scripts/backfill-bill-copies.ts
//
// Take a backup first (see docs/PROGRESS.md for the backup command).
import { getDb } from '../src/db/client.ts';
import { STORE_ID } from '../src/lib/app-config.ts';
import { backfillBillCopies } from '../src/server/services/bills.ts';

const url = process.env.DATABASE_URL ?? '';
if (!/^postgres(ql)?:\/\//.test(url) && !/^pglite:/.test(url)) {
  console.error('Set DATABASE_URL to the Postgres database (or pglite:<folder> for a local one).');
  process.exit(1);
}
const db = await getDb();
console.log(`Copied ${await backfillBillCopies(db, STORE_ID)} stock entries onto their bills.`);
process.exit(0);
