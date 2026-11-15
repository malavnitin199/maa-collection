import Link from 'next/link';
import { Suspense } from 'react';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import { canAny, type Permission } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';

type Item = { href: string; label: string; hint: string; needs: readonly Permission[] | 'admin' | 'everyone' };

const GROUPS: { title: string; links: Item[] }[] = [
  {
    title: 'Catalog & stock',
    links: [
      { href: '/admin/stock/old', label: 'Tag old stock', hint: 'Photo → details → barcode, one item at a time', needs: ['catalog'] },
      { href: '/admin/catalog/check', label: 'Needs attention', hint: 'Items without photo, company, stock or purchase price', needs: ['catalog'] },
      { href: '/admin/stock/quick', label: 'Quick add products', hint: 'Many products from one company, each with its own prices', needs: ['catalog'] },
      { href: '/admin/stock/new', label: 'New design in sizes × colours', hint: 'One design, every size/colour gets a barcode', needs: ['catalog'] },
      { href: '/admin/stock/receive', label: 'Receive stock (restock)', hint: 'Scan existing items to add pieces', needs: ['stock'] },
      { href: '/admin/products', label: 'Products', hint: 'Search, photos, edit, rates', needs: ['catalog', 'prices', 'stock'] },
      { href: '/admin/products/new', label: 'Add a single product', hint: 'One size/colour, or a manufacturer barcode', needs: ['catalog'] },
      { href: '/admin/categories', label: 'Categories', hint: 'Kurta, Saree… and their SKU codes', needs: ['catalog'] },
      { href: '/admin/suppliers', label: 'Companies (suppliers)', hint: 'Companies you buy from', needs: ['catalog'] },
      { href: '/admin/labels', label: 'Print labels', hint: 'Barcode labels for all products', needs: ['catalog', 'stock'] },
    ],
  },
  {
    title: 'Shop (owner)',
    links: [
      { href: '/admin/staff', label: 'Staff & permissions', hint: 'People, PINs and what each may do', needs: 'admin' },
      { href: '/admin/reports', label: 'Reports', hint: 'Best sellers, not selling, by category / company / person; Excel export', needs: 'admin' },
      { href: '/admin/activity', label: 'Activity', hint: 'Every sale and exchange', needs: 'admin' },
      { href: '/admin/settings', label: 'Settings', hint: 'Code price on tags (secret purchase price)', needs: 'admin' },
    ],
  },
  {
    title: 'Counter',
    links: [
      { href: '/pos', label: 'Counter sale', hint: 'Scan and sell', needs: 'everyone' },
      { href: '/pos/exchange', label: 'Exchange', hint: 'Swap an item from an earlier sale', needs: 'everyone' },
      { href: '/pos/my-sales', label: 'My sales', hint: 'Your own sales today and this month', needs: 'everyone' },
      { href: '/help', label: 'Help & guide', hint: 'How to use the app, step by step', needs: 'everyone' },
    ],
  },
];

async function Menu() {
  // Salesmen with no catalog/stock/price rights have nothing here: back to the counter.
  const me = await requireAnyPermission(['catalog', 'stock', 'prices']);
  const allowed = (item: Item) =>
    item.needs === 'everyone' || (item.needs === 'admin' ? me.role === 'admin' : canAny(me, item.needs));
  return (
    <>
      {GROUPS.map((group) => {
        const links = group.links.filter(allowed);
        if (links.length === 0) return null;
        return (
          <section key={group.title} className="flex flex-col gap-2">
            <h2 className={sectionTitle}>{group.title}</h2>
            <ul className="flex flex-col gap-2">
              {links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={`${card} flex items-center justify-between gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
                    <span>
                      <span className="block font-medium">{item.label}</span>
                      <span className={`block text-xs ${muted}`}>{item.hint}</span>
                    </span>
                    <span aria-hidden className={muted}>
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export default function MorePage() {
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Menu</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Menu />
      </Suspense>
    </main>
  );
}
