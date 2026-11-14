import { defineConfig } from 'drizzle-kit';

// `pnpm db:generate` writes SQL migrations to ./drizzle from the schema.
// `pnpm db:migrate` applies them to DATABASE_URL (Neon in production).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
