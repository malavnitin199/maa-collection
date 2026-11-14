'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { STORE_ID } from '@/lib/app-config';
import { endSession, startSession } from '@/server/auth';
import { verifyLogin } from '@/server/services/staff';

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const staffId = String(formData.get('staffId') ?? '');
  const pin = String(formData.get('pin') ?? '').trim();
  if (!staffId) return { error: 'Choose your name.' };
  if (!pin) return { error: 'Enter your PIN.' };
  const person = await verifyLogin(await getDb(), STORE_ID, staffId, pin);
  if (!person) return { error: 'Wrong PIN. Try again.' };
  await startSession({ id: person.id, name: person.name, role: person.role });
  redirect(person.role === 'admin' ? '/admin/dashboard' : '/pos');
}

export async function logoutAction() {
  await endSession();
  redirect('/login');
}
