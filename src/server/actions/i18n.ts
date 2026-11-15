'use server';

import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDb } from '@/db/client';
import { staff } from '@/db/schema';
import { STORE_ID } from '@/lib/app-config';
import { isLocale } from '@/lib/i18n';
import { getCurrentStaff } from '@/server/auth';
import { LOCALE_COOKIE } from '@/server/i18n';

/**
 * Switch the screen language. Logged in: saved on the person (follows them to
 * any phone). Always: remembered on this phone too (login page, and people
 * who haven't chosen yet).
 */
export async function setLanguageAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const me = await getCurrentStaff();
  if (me) {
    await (await getDb())
      .update(staff)
      .set({ language: locale })
      .where(and(eq(staff.storeId, STORE_ID), eq(staff.id, me.id)));
  }
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
}
