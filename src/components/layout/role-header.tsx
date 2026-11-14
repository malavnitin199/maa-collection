import Link from 'next/link';
import { Suspense } from 'react';
import { logoutAction } from '@/server/actions/auth';
import { canAny } from '@/lib/permissions';
import { getCurrentStaff } from '@/server/auth';
import { BottomNav } from './bottom-nav';

const SALES_LINKS = [
  { href: '/pos', label: 'Counter sale' },
  { href: '/pos/exchange', label: 'Exchange' },
  { href: '/pos/my-sales', label: 'My sales' },
];
const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/stock', label: '+ Add stock' },
  { href: '/admin/suppliers', label: 'Suppliers' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/staff', label: 'Staff' },
  { href: '/admin/activity', label: 'Activity' },
  { href: '/admin/labels', label: 'Labels' },
  { href: '/admin/settings', label: 'Settings' },
];

async function HeaderContent() {
  const me = await getCurrentStaff();
  const catalogAccess = me?.role !== 'admin' && canAny(me, ['catalog', 'stock', 'prices']);
  const links = me?.role === 'admin' ? [...ADMIN_LINKS, ...SALES_LINKS] : catalogAccess ? [...SALES_LINKS, { href: '/admin/more', label: 'Catalog' }] : SALES_LINKS;
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <Link href={me?.role === 'admin' ? '/admin/dashboard' : '/pos'} className="text-lg font-semibold">
            Maa Collection
          </Link>
          {me && (
            <span
              data-testid="current-user"
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {me.name} · {me.role === 'admin' ? 'Admin' : 'Salesman'}
            </span>
          )}
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400">
            Log out
          </button>
        </form>
      </div>
      <nav className="hidden flex-wrap gap-x-4 gap-y-1 text-sm sm:flex">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            {item.label}
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
