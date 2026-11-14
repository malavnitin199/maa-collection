import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { staff, type Staff } from '@/db/schema';
import { cleanPermissions } from '@/lib/permissions';
import { hashPin, isValidPin, verifyPin } from '@/server/security/pin';
import { DomainError, isUniqueViolation } from './errors';

export type StaffSummary = Pick<Staff, 'id' | 'name' | 'role' | 'active' | 'permissions'>;
const summaryColumns = { id: staff.id, name: staff.name, role: staff.role, active: staff.active, permissions: staff.permissions };

export async function listStaff(db: Db, storeId: string, { activeOnly = false } = {}): Promise<StaffSummary[]> {
  return db
    .select(summaryColumns)
    .from(staff)
    .where(and(eq(staff.storeId, storeId), activeOnly ? eq(staff.active, true) : undefined))
    .orderBy(asc(staff.role), asc(staff.name));
}

/** Returns the staff member if the PIN matches an active account, else null. */
export async function verifyLogin(db: Db, storeId: string, staffId: string, pin: string): Promise<StaffSummary | null> {
  const [person] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.storeId, storeId), eq(staff.id, staffId), eq(staff.active, true)))
    .limit(1);
  if (!person || !verifyPin(pin, person.pinHash)) return null;
  return { id: person.id, name: person.name, role: person.role, active: person.active, permissions: person.permissions };
}

export async function createStaff(
  db: Db,
  storeId: string,
  input: { name: string; role: 'admin' | 'salesman'; pin: string },
): Promise<StaffSummary> {
  const name = input.name.trim();
  if (!name || name.length > 40) throw new DomainError('Enter a name (up to 40 characters).');
  if (!isValidPin(input.pin)) throw new DomainError('PIN must be 4 to 6 digits.');
  try {
    const [created] = await db
      .insert(staff)
      .values({ storeId, name, role: input.role, pinHash: hashPin(input.pin) })
      .returning(summaryColumns);
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('Someone with that name already exists.');
    throw error;
  }
}

export async function setStaffPin(db: Db, storeId: string, staffId: string, pin: string) {
  if (!isValidPin(pin)) throw new DomainError('PIN must be 4 to 6 digits.');
  const updated = await db
    .update(staff)
    .set({ pinHash: hashPin(pin) })
    .where(and(eq(staff.storeId, storeId), eq(staff.id, staffId)))
    .returning({ id: staff.id });
  if (updated.length === 0) throw new DomainError('Staff member not found.');
}

export async function setStaffActive(
  db: Db,
  storeId: string,
  staffId: string,
  active: boolean,
  actingStaffId: string,
) {
  if (!active && staffId === actingStaffId) throw new DomainError("You can't deactivate your own account.");
  if (!active) {
    const admins = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.storeId, storeId), eq(staff.role, 'admin'), eq(staff.active, true)));
    if (admins.length === 1 && admins[0].id === staffId) {
      throw new DomainError('Keep at least one active admin.');
    }
  }
  await db
    .update(staff)
    .set({ active })
    .where(and(eq(staff.storeId, storeId), eq(staff.id, staffId)));
}

/** Owner sets which extra rights a salesman has (catalog, prices, stock, costs). */
export async function setStaffPermissions(db: Db, storeId: string, staffId: string, permissions: readonly string[]): Promise<string[]> {
  const cleaned = cleanPermissions(permissions);
  const [updated] = await db
    .update(staff)
    .set({ permissions: cleaned })
    .where(and(eq(staff.storeId, storeId), eq(staff.id, staffId)))
    .returning({ permissions: staff.permissions, role: staff.role });
  if (!updated) throw new DomainError('Staff member not found.');
  return updated.permissions;
}
