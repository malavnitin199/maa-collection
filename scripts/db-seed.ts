// Seeds an EMPTY database (production) with the shop, staff and demo products.
// Each person gets a random PIN, printed once here — hand them to the owner;
// they are not stored anywhere in plain text. Does nothing if already seeded.
//   DATABASE_URL=postgres://… pnpm db:seed
import { getDb } from '../src/db/client.ts';
import { seedDemoData } from '../src/db/seed.ts';

const url = process.env.DATABASE_URL ?? '';
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error('Set DATABASE_URL to the Postgres database to seed.');
  process.exit(1);
}
const db = await getDb();
const result = await seedDemoData(db, { pins: 'random' });
if (!result.seeded) {
  console.log('Database already has data; nothing changed.');
} else {
  console.log('Seeded. Staff PINs (shown once):');
  for (const [name, pin] of Object.entries(result.pins)) console.log(`  ${name.padEnd(8)} ${pin}`);
}
process.exit(0);
