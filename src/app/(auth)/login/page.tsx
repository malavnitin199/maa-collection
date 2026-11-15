import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentStaff } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { LoginForm } from '@/features/auth/login-form';
import { LanguageSwitch } from '@/features/i18n/language-switch';
import { AppearanceMenu } from '@/features/appearance/appearance-menu';
import { getT } from '@/server/i18n';
import { STORE_ID } from '@/lib/app-config';
import { listStaff } from '@/server/services/staff';

async function StaffLogin() {
  // Opening the app from the home screen while still logged in goes straight to your screen.
  const me = await getCurrentStaff();
  if (me) redirect(me.role === 'admin' ? '/admin/dashboard' : '/pos');
  const people = await listStaff(await requestDb(), STORE_ID, { activeOnly: true });
  return <LoginForm people={people.map(({ id, name, role }) => ({ id, name, role }))} />;
}

export default async function LoginPage() {
  const t = await getT(); // this phone's language
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      {/* The shop's band: its dye, its name in the display face, a zari edge. */}
      <header className="relative bg-brand-800 px-6 pt-4 pb-12 text-white dark:bg-brand-950 sm:mt-6 sm:rounded-t-3xl">
        <div className="flex items-center justify-end gap-2">
          <AppearanceMenu />
          <LanguageSwitch onBand />
        </div>
        <h1 className="mt-3 font-display text-[2.4rem] leading-none text-white">Maa Collection</h1>
        <p className="mt-2 text-sm text-white/80">
          {t('login.subtitle')}{' '}
          <a href="/guide#start" className="font-semibold text-white underline decoration-zari decoration-2 underline-offset-4">
            {t('login.newHere')}
          </a>
        </p>
        <div aria-hidden className="zari absolute inset-x-0 bottom-3 opacity-90" />
      </header>
      <section className="relative -mt-6 mx-3 mb-6 rounded-[2rem] bg-surface p-5 shadow-xl shadow-brand-950/10 ring-1 ring-black/5 dark:ring-white/10">
        <Suspense fallback={<p className="text-sm text-zinc-500">{t('login.loading')}</p>}>
          <StaffLogin />
        </Suspense>
      </section>
    </main>
  );
}
