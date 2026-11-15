import Link from 'next/link';
import { Suspense } from 'react';
import { LanguageSwitch } from '@/features/i18n/language-switch';
import { SoundToggle } from '@/features/feedback/sound-toggle';
import type { MessageKey } from '@/lib/i18n';
import { logoutAction } from '@/server/actions/auth';
import { canAny } from '@/lib/permissions';
import { getCurrentStaff } from '@/server/auth';
import { getT } from '@/server/i18n';
import { BottomNav } from './bottom-nav';

type NavLink = { href: string; label: MessageKey };
const SALES_LINKS: NavLink[] = [
  { href: '/pos', label: 'nav.counterSale' },
  { href: '/pos/exchange', label: 'nav.exchange' },
  { href: '/pos/my-sales', label: 'nav.mySales' },
];
const ADMIN_LINKS: NavLink[] = [
  { href: '/admin/dashboard', label: 'nav.dashboard' },
  { href: '/admin/products', label: 'nav.products' },
  { href: '/admin/stock', label: 'nav.addStock' },
  { href: '/admin/suppliers', label: 'nav.suppliers' },
  { href: '/admin/categories', label: 'nav.categories' },
  { href: '/admin/staff', label: 'nav.staff' },
  { href: '/admin/reports', label: 'nav.reports' },
  { href: '/admin/team', label: 'nav.team' },
  { href: '/admin/activity', label: 'nav.activity' },
  { href: '/admin/labels', label: 'nav.labels' },
  { href: '/admin/settings', label: 'nav.settings' },
];

async function HeaderContent() {
  const [me, t] = await Promise.all([getCurrentStaff(), getT()]);
  const catalogAccess = me?.role !== 'admin' && canAny(me, ['catalog', 'stock', 'prices']);
  const links: NavLink[] =
    me?.role === 'admin' ? [...ADMIN_LINKS, ...SALES_LINKS] : catalogAccess ? [...SALES_LINKS, { href: '/admin/more', label: 'nav.catalog' }] : SALES_LINKS;
  return (
    <>
      {/* On a narrow phone the buttons move to a second row instead of squeezing the shop name. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <Link href={me?.role === 'admin' ? '/admin/dashboard' : '/pos'} className="text-lg font-semibold">
            Maa Collection
          </Link>
          {me && (
            <span
              data-testid="current-user"
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {me.name} · {t(me.role === 'admin' ? 'role.admin' : 'role.salesman')}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm whitespace-nowrap">
          <SoundToggle />
          <LanguageSwitch />
          <Link href="/guide" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
            {t('nav.guide')}
          </Link>
          {me ? (
            <form action={logoutAction}>
              <button type="submit" className="text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400">
                {t('nav.logout')}
              </button>
            </form>
          ) : (
            <Link href="/login" className="text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400">
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
      <nav className="hidden flex-wrap gap-x-4 gap-y-1 text-sm sm:flex">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            {t(item.label)}
          </Link>
        ))}
      </nav>
    </>
  );
}

async function BottomNavForUser() {
  const me = await getCurrentStaff();
  return me ? <BottomNav role={me.role} catalogAccess={canAny(me, ['catalog', 'stock', 'prices'])} /> : null;
}

export function RoleHeader() {
  return (
    <>
    <header className="sticky top-0 z-10 print:hidden border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3">
        <Suspense fallback={<span className="text-lg font-semibold">Maa Collection</span>}>
          <HeaderContent />
        </Suspense>
      </div>
    </header>
    {/* Outside <header>: its backdrop blur would make a fixed child stick to the header. */}
    <Suspense fallback={null}>
      <BottomNavForUser />
    </Suspense>
    </>
  );
}
