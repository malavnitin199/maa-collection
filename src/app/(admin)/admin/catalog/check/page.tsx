import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted } from '@/components/ui/styles';
import { STORE_ID } from '@/lib/app-config';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { requestDb } from '@/server/request-db';
import { catalogAttention, type AttentionItem } from '@/server/services/catalog';

function List({ id, title, hint, count, items, fix }: { id: string; title: string; hint: string; count: number; items: AttentionItem[]; fix: string }) {
  return (
    <details id={id} className={card} open={count > 0 && count <= 10}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="font-semibold">{title}</span>
          <span className={`block text-xs ${muted}`}>{hint}</span>
        </span>
        <span
          data-testid={`count-${id}`}
          className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${count ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}
        >
          {count || '✓'}
        </span>
      </summary>
      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 border-b border-zinc-100 py-1.5 dark:border-zinc-900">
              <span className="min-w-0 truncate">
                {item.name} · {item.color} · {item.size} <span className={muted}>({item.sku})</span>
              </span>
              <Link href={`/admin/products/${item.id}`} className={`shrink-0 ${link}`}>
                {fix} →
              </Link>
            </li>
          ))}
          {count > items.length && <li className={`pt-1 text-xs ${muted}`}>…and {count - items.length} more</li>}
        </ul>
      )}
    </details>
  );
}

async function Check() {
  const me = await requirePermission('catalog');
  const data = await catalogAttention(await requestDb(), STORE_ID);
  return (
    <div className="flex flex-col gap-3">
      <List id="photo" title="No photo" hint="Add a photo so staff can recognise the item at the counter." count={data.noPhoto.count} items={data.noPhoto.items} fix="Add photo" />
      <List id="company" title="No company" hint="Old stock often has none; set it if you know where it came from." count={data.noSupplier.count} items={data.noSupplier.items} fix="Set company" />
      <List id="stock" title="Out of stock" hint="Still on the shelf? Receive the pieces. Not sold any more? Mark it inactive." count={data.outOfStock.count} items={data.outOfStock.items} fix="Open" />
      {can(me, 'costs') && (
        <List id="cost" title="No purchase price" hint="Needed for profit and the code price on tags." count={data.noCost.count} items={data.noCost.items} fix="Add price" />
      )}
    </div>
  );
}

export default function CatalogCheckPage() {
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Needs attention</h1>
        <p className={`text-sm ${muted}`}>Your catalog to-do list. Tap an item to fix it; the list updates by itself.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Checking…</p>}>
        <Check />
      </Suspense>
    </main>
  );
}
