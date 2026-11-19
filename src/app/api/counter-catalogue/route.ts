import { STORE_ID } from '@/lib/app-config';
import { getCurrentStaff } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { counterCatalogue } from '@/server/services/products';
import { listStaff } from '@/server/services/staff';

/**
 * Plan v18: the counter's copy for the phone, so scanning keeps working without
 * internet — every item in use (never purchase prices) and who a sale can be
 * credited to. Logged-in staff only; never stored by the browser's cache.
 */
export async function GET() {
  const me = await getCurrentStaff();
  if (!me) return Response.json({ ok: false, code: 'login' }, { status: 401 });
  const db = await requestDb();
  const [items, people] = await Promise.all([counterCatalogue(db, STORE_ID), listStaff(db, STORE_ID, { activeOnly: true })]);
  return Response.json(
    {
      v: 1,
      savedAt: new Date().toISOString(),
      me: { id: me.id, name: me.name },
      staff: people.map(({ id, name }) => ({ id, name })),
      items,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
