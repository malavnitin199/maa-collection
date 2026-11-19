'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconBook, IconHome, IconMenu, IconRupee, IconScan, IconStockAdd, IconSwap, IconTag } from '@/components/ui/icons';
import { useT } from '@/features/i18n/i18n-provider';
import type { MessageKey } from '@/lib/i18n';

type Tab = { href: string; label: MessageKey; Icon: (p: { className?: string }) => React.ReactNode };

const SELL: Tab = { href: '/pos', label: 'tab.sell', Icon: IconScan };
const ADMIN_TABS: Tab[] = [
  { href: '/admin/dashboard', label: 'tab.home', Icon: IconHome },
  { href: '/admin/products', label: 'tab.products', Icon: IconTag },
  { href: '/admin/stock', label: 'tab.stock', Icon: IconStockAdd },
  { href: '/admin/more', label: 'tab.more', Icon: IconMenu },
];
const SALES_TABS: Tab[] = [
  { href: '/pos/exchange', label: 'tab.exchange', Icon: IconSwap },
  { href: '/pos/my-sales', label: 'tab.mySales', Icon: IconRupee },
];
const CATALOG_TABS: Tab[] = [
  { href: '/pos/exchange', label: 'tab.exchange', Icon: IconSwap },
  { href: '/pos/my-sales', label: 'tab.mySales', Icon: IconRupee },
  { href: '/admin/more', label: 'tab.catalog', Icon: IconTag },
  { href: '/guide', label: 'nav.guide', Icon: IconBook },
];

function isActive(pathname: string, href: string) {
  if (href === '/pos') return pathname === '/pos';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Phone navigation: a floating dock with the big round Sell (scan) button in
 * the middle — the action used most, like the scan button of payment apps.
 * Hidden on larger screens (the header has the links there).
 */
export function BottomNav({ role, catalogAccess = false }: { role: 'admin' | 'salesman'; catalogAccess?: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const others = role === 'admin' ? ADMIN_TABS : catalogAccess ? CATALOG_TABS : SALES_TABS;
  const half = Math.ceil(others.length / 2);
  const tab = (item: Tab) => {
    const active = isActive(pathname, item.href);
    return (
      <li key={item.href} className="flex-1">
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] leading-tight font-medium transition active:scale-95 ${
            active ? 'text-brand-700 dark:text-brand-300' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${active ? 'bg-brand-100 dark:bg-brand-900/60' : ''}`}>
            <item.Icon className="h-5 w-5" />
          </span>
          {t(item.label)}
        </Link>
      </li>
    );
  };
  const sellActive = isActive(pathname, SELL.href);
  return (
    <nav data-dock aria-label={t('nav.main')} className="fixed inset-x-3 bottom-3 z-20 pb-[env(safe-area-inset-bottom)] sm:hidden print:hidden">
      <ul className="flex items-end rounded-[1.75rem] bg-surface/95 px-1.5 pt-1 pb-1 shadow-xl ring-1 shadow-brand-950/15 ring-black/5 backdrop-blur dark:ring-white/10">
        {others.slice(0, half).map(tab)}
        <li className="flex flex-1 justify-center">
          <Link
            href={SELL.href}
            aria-current={sellActive ? 'page' : undefined}
            className="-mt-7 flex flex-col items-center gap-0.5 text-[11px] font-semibold text-brand-700 transition active:scale-95 dark:text-brand-300"
          >
            <span className="flex h-15 w-15 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 shadow-brand-700/40 ring-[var(--background)]">
              <SELL.Icon className="h-7 w-7" />
            </span>
            {t(SELL.label)}
          </Link>
        </li>
        {others.slice(half).map(tab)}
      </ul>
    </nav>
  );
}
