import { Suspense } from 'react';
import { muted, sectionTitle } from '@/components/ui/styles';
import type { MessageKey } from '@/lib/i18n';
import { can, type Permission } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { TagTile } from '@/components/ui/tag-tile';
import { IconScan, IconStockAdd, IconTag } from '@/components/ui/icons';

type Option = { href: string; Icon: (p: { className?: string }) => React.ReactNode; title: MessageKey; hint: MessageKey; needs: Permission };

/** The usual way in (plan v17): one item, in one colour or many sizes × colours. */
const NEW_ITEM: Option = { href: '/admin/stock/new', Icon: IconStockAdd, title: 'stk.hub.item.title', hint: 'stk.hub.item.hint', needs: 'catalog' };

const OTHER_WAYS: Option[] = [
  // Plan v19 (03a): the step-by-step New item, here until it replaces the form above (V19-04).
  { href: '/admin/stock/add', Icon: IconStockAdd, title: 'ni.hub.title', hint: 'ni.hub.hint', needs: 'catalog' },
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
