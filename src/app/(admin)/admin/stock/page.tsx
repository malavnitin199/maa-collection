import { Suspense } from 'react';
import { muted, sectionTitle } from '@/components/ui/styles';
import type { MessageKey } from '@/lib/i18n';
import { can, type Permission } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { TagTile } from '@/components/ui/tag-tile';
import { IconBulkAdd, IconGrid, IconScan, IconStockAdd, IconTag } from '@/components/ui/icons';

type Option = { href: string; Icon: (p: { className?: string }) => React.ReactNode; title: MessageKey; hint: MessageKey; needs: Permission };

/** The usual way in (plan v19): step by step — who is it for, what is it, details, sizes and pieces. */
const NEW_ITEM: Option = { href: '/admin/stock/new', Icon: IconStockAdd, title: 'stk.hub.item.title', hint: 'ni.hub.hint', needs: 'catalog' };

const OTHER_WAYS: Option[] = [
  // Owner, 2026-11-24 (ADR-072): many products of one category typed into one table.
  { href: '/admin/stock/bulk', Icon: IconBulkAdd, title: 'bulk.title', hint: 'bulk.hub.hint', needs: 'catalog' },
  // Plan v19: the earlier form (sizes × colours, prices by size, photos) stays here for now.
  { href: '/admin/stock/form', Icon: IconGrid, title: 'ni.hub.form.title', hint: 'ni.hub.form.hint', needs: 'catalog' },
  { href: '/admin/stock/receive', Icon: IconScan, title: 'stk.hub.receive.title', hint: 'stk.hub.receive.hint', needs: 'stock' },
  { href: '/admin/stock/old', Icon: IconTag, title: 'stk.hub.old.title', hint: 'stk.hub.old.hint', needs: 'catalog' },
];

async function Options() {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'stock']), getT()]);
  const others = OTHER_WAYS.filter((option) => can(me, option.needs));
  return (
    <div className="rise-in flex flex-col gap-5">
      {can(me, NEW_ITEM.needs) && (
        <TagTile href={NEW_ITEM.href} primary icon={<NEW_ITEM.Icon className="h-7 w-7" />} title={t(NEW_ITEM.title)} hint={t(NEW_ITEM.hint)} />
      )}
      {others.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={sectionTitle}>{t('stk.hub.otherWays')}</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {others.map((option) => (
              <li key={option.href}>
                <TagTile href={option.href} icon={<option.Icon />} title={t(option.title)} hint={t(option.hint)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default async function StockHubPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('stk.hub.title')}</h1>
        <p className={`text-sm ${muted}`}>{t('stk.hub.subtitle')}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Options />
      </Suspense>
    </main>
  );
}
