import Link from 'next/link';
import { card, muted, sectionTitle } from '@/components/ui/styles';

const GROUPS = [
  {
    title: 'Stock',
    links: [
      { href: '/admin/stock/new', label: 'New items from a supplier', hint: 'A design in sizes × colours, barcodes + labels' },
      { href: '/admin/stock/receive', label: 'Receive stock (restock)', hint: 'Scan existing items to add pieces' },
      { href: '/admin/products/new', label: 'Add a single product', hint: 'One size/colour, or a manufacturer barcode' },
      { href: '/admin/categories', label: 'Categories', hint: 'Kurta, Saree… and their SKU codes' },
      { href: '/admin/suppliers', label: 'Suppliers', hint: 'Companies you buy from' },
      { href: '/admin/labels', label: 'Print labels', hint: 'Barcode labels for all products' },
    ],
  },
  {
    title: 'Shop',
    links: [
      { href: '/admin/staff', label: 'Staff', hint: 'People, roles and PINs' },
      { href: '/admin/activity', label: 'Activity', hint: 'Every sale and exchange' },
    ],
  },
  {
    title: 'Counter',
    links: [
      { href: '/pos', label: 'Counter sale', hint: 'Scan and sell' },
      { href: '/pos/exchange', label: 'Exchange', hint: 'Swap an item from an earlier sale' },
      { href: '/pos/my-sales', label: 'My sales', hint: 'Your own sales today and this month' },
    ],
  },
];

export default function MorePage() {
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">More</h1>
      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className={sectionTitle}>{group.title}</h2>
          <ul className="flex flex-col gap-2">
            {group.links.map((item) => (
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
      ))}
    </main>
  );
}
