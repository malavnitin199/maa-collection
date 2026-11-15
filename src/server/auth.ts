import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { requestDb } from '@/server/request-db';
import { staff } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { can, canAny, type Permission } from '@/lib/permissions';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionSecret,
  signSession,
  verifySession,
  type Role,
} from './security/session';

export type CurrentStaff = { id: string; name: string; role: Role; permissions: string[]; language?: string | null };

/** The logged-in staff member, re-checked against the database (still active). Cached per request. */
export const getCurrentStaff = cache(async function getCurrentStaff(): Promise<CurrentStaff | null> {
  // requestDb() first: it marks the render as request-time before the expiry check reads the clock.
  const db = await requestDb();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySession(token, sessionSecret());
  if (!session) return null;
  const [person] = await db
    .select({ id: staff.id, name: staff.name, role: staff.role, permissions: staff.permissions, language: staff.language })
    .from(staff)
    .where(and(eq(staff.storeId, STORE_ID), eq(staff.id, session.sid), eq(staff.active, true)))
    .limit(1);
  return person ?? null;
});

/** For pages and actions: logged-in staff, or redirect to /login. */
export async function requireStaff(): Promise<CurrentStaff> {
  const current = await getCurrentStaff();
  if (!current) redirect('/login');
  return current;
}

/** For admin pages and actions: an admin, or send them to the counter. */
export async function requireAdmin(): Promise<CurrentStaff> {
  const current = await requireStaff();
  if (current.role !== 'admin') redirect('/pos');
  return current;
}

/** Admin, or a salesman the owner granted `permission`; otherwise back to the counter. */
export async function requirePermission(permission: Permission): Promise<CurrentStaff> {
  const current = await requireStaff();
  if (!can(current, permission)) redirect('/pos');
  return current;
}

/** Admin, or a salesman with at least one of `permissions`. */
export async function requireAnyPermission(permissions: readonly Permission[]): Promise<CurrentStaff> {
  const current = await requireStaff();
  if (!canAny(current, permissions)) redirect('/pos');
  return current;
}

export async function startSession(person: CurrentStaff) {
  const token = signSession(
    { sid: person.id, name: person.name, role: person.role, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS },
    sessionSecret(),
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
