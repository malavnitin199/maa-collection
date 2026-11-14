import { connection } from 'next/server';
import { getDb, type Db } from '@/db/client';

/**
 * Database access for pages and layouts. `connection()` marks the render as
 * request-time first, so Next.js never tries to prerender live shop data
 * (and the DB driver's clock reads don't trip the prerender check).
 */
export async function requestDb(): Promise<Db> {
  await connection();
  return getDb();
}
