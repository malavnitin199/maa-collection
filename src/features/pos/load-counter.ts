import { requestDb } from '@/server/request-db';
import { STORE_ID } from '@/lib/app-config';
import { requireStaff } from '@/server/auth';
import { listStaff } from '@/server/services/staff';

/** Logged-in staff member plus everyone a sale or exchange can be credited to. */
export async function loadCounter() {
  const me = await requireStaff();
  const people = await listStaff(await requestDb(), STORE_ID, { activeOnly: true });
  return {
    me: { id: me.id, name: me.name },
    staff: people.map(({ id, name }) => ({ id, name })),
  };
}
