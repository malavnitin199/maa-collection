import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted } from '@/components/ui/styles';
import { STORE_ID } from '@/lib/app-config';
import type { T } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { catalogAttention, type AttentionItem } from '@/server/services/catalog';

function List({ id, title, hint, count, items, fix, t }: { id: string; title: string; hint: string; count: number; items: AttentionItem[]; fix: string; t: T }) {
  return (
    <details id={id} className={card} open={count > 0 && count <= 10}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="font-semibold">{title}</span>
          <span className={`block text-xs ${muted}`}>{hint}</span>
        </span>
        <span
          data-testid={`count-${id}`}
          className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${count ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200'}`}
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
          {count > items.length && <li className={`pt-1 text-xs ${muted}`}>{t('cat.check.more', { n: count - items.length })}</li>}
        </ul>
      )}
    </details>
  );
}

async function Check() {
  const [me, t] = await Promise.all([requirePermission('catalog'), getT()]);
  const data = await catalogAttention(await requestDb(), STORE_ID);
  return (
    <div className="flex flex-col gap-3">
      <List id="photo" title={t('cat.check.noPhoto')} hint={t('cat.check.noPhotoHint')} count={data.noPhoto.count} items={data.noPhoto.items} fix={t('cat.check.addPhoto')} t={t} />
      <List id="company" title={t('cat.check.noCompany')} hint={t('cat.check.noCompanyHint')} count={data.noSupplier.count} items={data.noSupplier.items} fix={t('cat.check.setCompany')} t={t} />
      <List id="stock" title={t('cat.check.outOfStock')} hint={t('cat.check.outOfStockHint')} count={data.outOfStock.count} items={data.outOfStock.items} fix={t('cat.check.open')} t={t} />
      {can(me, 'costs') && (
        <List id="cost" title={t('cat.check.noCost')} hint={t('cat.check.noCostHint')} count={data.noCost.count} items={data.noCost.items} fix={t('cat.check.addPrice')} t={t} />
      )}
    </div>
  );
}

export default async function CatalogCheckPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('cat.check.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('cat.check.subtitle')}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('cat.check.loading')}</p>}>
        <Check />
      </Suspense>
    </main>
  );
}
