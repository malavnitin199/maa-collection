// Adds the 5 sample suppliers and 5 extra categories to an existing database
// (skips any that already exist). DATABASE_URL=postgres://… pnpm db:sample
import { getDb } from '../src/db/client.ts';
import { addSampleCatalog } from '../src/db/seed.ts';

if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? '')) {
  console.error('Set DATABASE_URL to the Postgres database.');
  process.exit(1);
}
const added = await addSampleCatalog(await getDb());
console.log(`Added ${added.suppliers} supplier(s) and ${added.categories} categor(y/ies).`);
process.exit(0);
