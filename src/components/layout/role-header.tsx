import Link from 'next/link';
import { Suspense } from 'react';
import { LanguageSwitch } from '@/features/i18n/language-switch';
import { SoundToggle } from '@/features/feedback/sound-toggle';
import { AppearanceMenu } from '@/features/appearance/appearance-menu';
import { headerIconButton } from '@/components/ui/styles';
import { IconBook, IconLogout } from '@/components/ui/icons';
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
      {/* On a narrow phone the buttons move to a second row instead of squeezing the shop name. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href={me?.role === 'admin' ? '/admin/dashboard' : '/pos'} className="font-display text-[1.45rem] leading-none whitespace-nowrap text-white">
            Maa Collection
          </Link>
          {me && (
            <span
              data-testid="current-user"
              className="truncate rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15"
            >
              {me.name} · {t(me.role === 'admin' ? 'role.admin' : 'role.salesman')}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-sm whitespace-nowrap">
          <AppearanceMenu />
          <SoundToggle />
          <LanguageSwitch onBand />
          <Link href="/guide" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-white/90 transition hover:bg-white/10 hover:text-white">
            <IconBook className="h-4 w-4" />
            {t('nav.guide')}
          </Link>
          {me ? (
            <form action={logoutAction}>
              <button type="submit" aria-label={t('nav.logout')} title={t('nav.logout')} className={headerIconButton}>
                <IconLogout className="h-5 w-5" />
              </button>
            </form>
          ) : (
            <Link href="/login" className="rounded-full px-2.5 py-1 font-semibold text-white/90 hover:bg-white/10">
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
      <nav className="hidden flex-wrap gap-x-1 gap-y-1 text-sm sm:flex">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full px-2.5 py-1 font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
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
    {/* A band in the theme's dye, finished with the zari border (the app's signature). */}
    <header className="sticky top-0 z-10 bg-brand-800 text-white shadow-lg shadow-brand-950/20 print:hidden dark:bg-brand-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 pt-3 pb-2.5">
        <Suspense fallback={<span className="font-display text-[1.45rem] leading-none text-white">Maa Collection</span>}>
          <HeaderContent />
        </Suspense>
      </div>
      <div aria-hidden className="zari opacity-90" />
    </header>
    {/* Outside <header>: its backdrop blur would make a fixed child stick to the header. */}
    <Suspense fallback={null}>
      <BottomNavForUser />
    </Suspense>
    </>
  );
}
