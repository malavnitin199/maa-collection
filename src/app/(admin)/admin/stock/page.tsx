import Link from 'next/link';
import { muted } from '@/components/ui/styles';

const OPTIONS = [
  {
    href: '/admin/stock/quick',
    title: 'Many different products',
    hint: 'Same company and category; each product with its own name, MRP, selling and purchase price.',
    primary: true,
  },
  {
    href: '/admin/stock/new',
    title: 'One design in sizes × colours',
    hint: 'e.g. a kurta in M, L, XL and three colours — every combination gets its own barcode.',
  },
  {
    href: '/admin/stock/receive',
    title: 'More of existing items',
    hint: 'Restock: scan or search items already in the catalogue and add pieces.',
  },
];

export default function StockHubPage() {
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add stock</h1>
        <p className={`text-sm ${muted}`}>What arrived? Every option ends with printable barcode labels.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {OPTIONS.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              className={`flex flex-col gap-1 rounded-xl border p-4 ${
                option.primary
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <span className="text-lg font-semibold">{option.title}</span>
              <span className={`text-sm ${muted}`}>{option.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
