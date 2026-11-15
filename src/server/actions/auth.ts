'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { endSession, startSession } from '@/server/auth';
import { getT } from '@/server/i18n';
import { verifyLogin } from '@/server/services/staff';

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const staffId = String(formData.get('staffId') ?? '');
  const pin = String(formData.get('pin') ?? '').trim();
  const t = await getT(); // logged out: this phone's language
  if (!staffId) return { error: t('login.chooseName') };
  if (!pin) return { error: t('login.enterPin') };
  const person = await verifyLogin(await getDb(), STORE_ID, staffId, pin);
  if (!person) return { error: t('login.wrongPin') };
  await startSession({ id: person.id, name: person.name, role: person.role, permissions: person.permissions });
  redirect(person.role === 'admin' ? '/admin/dashboard' : '/pos');
}

export async function logoutAction() {
  await endSession();
  redirect('/login');
}
