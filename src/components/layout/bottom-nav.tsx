'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/features/i18n/i18n-provider';
import type { MessageKey } from '@/lib/i18n';

type Tab = { href: string; label: MessageKey; icon: string };

const ADMIN_TABS: Tab[] = [
  { href: '/admin/dashboard', label: 'tab.home', icon: '⌂' },
  { href: '/admin/products', label: 'tab.products', icon: '▦' },
  { href: '/admin/stock', label: 'tab.stock', icon: '⊕' },
  { href: '/pos', label: 'tab.sell', icon: '⎙' },
  { href: '/admin/more', label: 'tab.more', icon: '☰' },
];
const SALES_TABS: Tab[] = [
  { href: '/pos', label: 'tab.sell', icon: '⎙' },
  { href: '/pos/exchange', label: 'tab.exchange', icon: '⇄' },
  { href: '/pos/my-sales', label: 'tab.mySales', icon: '₹' },
];

function isActive(pathname: string, href: string) {
  if (href === '/pos') return pathname === '/pos';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Phone navigation: fixed tab bar at the bottom of the screen (hidden on larger screens). */
export function BottomNav({ role, catalogAccess = false }: { role: 'admin' | 'salesman'; catalogAccess?: boolean }) {
  const pathname = usePathname();
  const t = useT();
  // A salesman the owner made a catalog/stock person gets a Catalog tab (the filtered menu).
  const tabs: Tab[] = role === 'admin' ? ADMIN_TABS : catalogAccess ? [...SALES_TABS, { href: '/admin/more', label: 'tab.catalog', icon: '▦' }] : SALES_TABS;
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden print:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <ul className="flex">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
                  active ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {tab.icon}
                </span>
                {t(tab.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
