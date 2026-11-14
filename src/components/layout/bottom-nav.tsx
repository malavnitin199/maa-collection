'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { href: string; label: string; icon: string };

const ADMIN_TABS: Tab[] = [
  { href: '/admin/dashboard', label: 'Home', icon: '⌂' },
  { href: '/admin/products', label: 'Products', icon: '▦' },
  { href: '/admin/stock/new', label: '+ Stock', icon: '⊕' },
  { href: '/pos', label: 'Sell', icon: '⎙' },
  { href: '/admin/more', label: 'More', icon: '☰' },
];
const SALES_TABS: Tab[] = [
  { href: '/pos', label: 'Sell', icon: '⎙' },
  { href: '/pos/exchange', label: 'Exchange', icon: '⇄' },
  { href: '/pos/my-sales', label: 'My sales', icon: '₹' },
];

function isActive(pathname: string, href: string) {
  if (href === '/pos') return pathname === '/pos';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Phone navigation: fixed tab bar at the bottom of the screen (hidden on larger screens). */
export function BottomNav({ role }: { role: 'admin' | 'salesman' }) {
  const pathname = usePathname();
  const tabs = role === 'admin' ? ADMIN_TABS : SALES_TABS;
  return (
    <nav
      aria-label="Main"
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
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
