import Link from 'next/link';
import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import { can, type Permission } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';

const OPTIONS: { href: string; title: string; hint: string; primary?: boolean; needs: Permission }[] = [
  {
    href: '/admin/stock/old',
    title: 'Tag old stock',
    hint: 'Items already in the shop: take a photo, fill details, count pieces, get the barcode. One at a time, fast.',
    needs: 'catalog',
  },
  {
    href: '/admin/stock/quick',
    title: 'Many different products',
    hint: 'Same company and category; each product with its own name, MRP, selling and purchase price.',
    primary: true,
    needs: 'catalog',
  },
  {
    href: '/admin/stock/new',
    title: 'One design in sizes × colours',
    hint: 'e.g. a kurta in M, L, XL and three colours — every combination gets its own barcode.',
    needs: 'catalog',
  },
  {
    href: '/admin/stock/receive',
    title: 'More of existing items',
    hint: 'Restock: scan or search items already in the catalogue and add pieces.',
    needs: 'stock',
  },
];

async function Options() {
  const me = await requireAnyPermission(['catalog', 'stock']);
  return (
    <ul className="flex flex-col gap-3">
      {OPTIONS.filter((option) => can(me, option.needs)).map((option) => (
        <li key={option.href}>
          <Link
            href={option.href}
            className={`flex flex-col gap-1 rounded-xl border p-4 ${
              option.primary ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <span className="text-lg font-semibold">{option.title}</span>
            <span className={`text-sm ${muted}`}>{option.hint}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function StockHubPage() {
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add stock</h1>
        <p className={`text-sm ${muted}`}>What arrived? Every option ends with printable barcode labels.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Options />
      </Suspense>
    </main>
  );
}
