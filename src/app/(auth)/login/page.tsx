import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentStaff } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { LoginForm } from '@/features/auth/login-form';
import { STORE_ID } from '@/lib/app-config';
import { listStaff } from '@/server/services/staff';

async function StaffLogin() {
  // Opening the app from the home screen while still logged in goes straight to your screen.
  const me = await getCurrentStaff();
  if (me) redirect(me.role === 'admin' ? '/admin/dashboard' : '/pos');
  const people = await listStaff(await requestDb(), STORE_ID, { activeOnly: true });
  return <LoginForm people={people.map(({ id, name, role }) => ({ id, name, role }))} />;
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Maa Collection</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Tap your name and enter your PIN.{' '}
          <a href="/help#start" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
            New here?
          </a>
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading staff…</p>}>
        <StaffLogin />
      </Suspense>
    </main>
  );
}
