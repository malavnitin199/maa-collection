import Link from 'next/link';
import { Suspense } from 'react';
import { LanguageSwitch } from '@/features/i18n/language-switch';
import { SoundToggle } from '@/features/feedback/sound-toggle';
import { IconBook, IconChevron } from '@/components/ui/icons';
import { LogoutRow } from '@/features/offline/logout-row';
import { OfflineStrip } from '@/features/offline/offline-strip';
import { HeaderMenu, menuRow } from './header-menu';
import type { MessageKey } from '@/lib/i18n';
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
  { href: '/admin/approvals', label: 'nav.approvals' },
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
      {/* Plan v17: the shop's name in full with who is logged in, then just अ / A and the ⋯ menu.
          Plan v18: taller and bigger (owner: "looking so small"). */}
      <div className="flex items-center justify-between gap-3">
        <Link href={me?.role === 'admin' ? '/admin/dashboard' : '/pos'} className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-display text-lg font-bold tracking-wide text-white shadow-inner ring-1 ring-white/30 min-[390px]:h-[3.25rem] min-[390px]:w-[3.25rem]"
          >
            MC
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="header-brand truncate font-display text-[1.4rem] leading-tight whitespace-nowrap text-white min-[390px]:text-[1.55rem]">Maa Collection</span>
            {me && (
              <span data-testid="current-user" className="mt-1 truncate text-sm leading-none font-medium text-white/85">
                {me.name} · {t(me.role === 'admin' ? 'role.admin' : 'role.salesman')}
              </span>
            )}
          </span>
        </Link>
        <div data-testid="header-buttons" className="flex shrink-0 items-center gap-2">
          <LanguageSwitch onBand />
          <HeaderMenu>
            <SoundToggle row={menuRow} />
            <Link href="/guide" className={menuRow}>
              <IconBook className="h-5 w-5 text-brand-600 dark:text-brand-300" />
              {t('nav.guide')}
            </Link>
            {me ? (
              <LogoutRow staffId={me.id} className={menuRow} />
            ) : (
              <Link href="/login" className={menuRow}>
                <IconChevron className="h-5 w-5" />
                {t('nav.login')}
              </Link>
            )}
          </HeaderMenu>
        </div>
      </div>
      {/* Plan v18: no internet / sales saved on this phone — shown only then. */}
      {me && <OfflineStrip me={{ id: me.id, name: me.name }} />}
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
    {/* Plan v17: a soft gradient in the theme's dye with a faint glow, finished with the zari border. */}
    <header className="header-band sticky top-0 z-10 text-white shadow-lg shadow-brand-950/25 print:hidden">
      <div className="mx-auto flex min-h-[5rem] max-w-5xl flex-col justify-center gap-3 px-4 pt-4 pb-4">
        <Suspense fallback={<span className="font-display text-[1.55rem] leading-none text-white">Maa Collection</span>}>
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
