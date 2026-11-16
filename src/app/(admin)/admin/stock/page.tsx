import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import type { MessageKey } from '@/lib/i18n';
import { can, type Permission } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { TagTile } from '@/components/ui/tag-tile';
import { IconGrid, IconScan, IconStockAdd, IconTag } from '@/components/ui/icons';

const OPTIONS: { href: string; Icon: (p: { className?: string }) => React.ReactNode; title: MessageKey; hint: MessageKey; primary?: boolean; needs: Permission }[] = [
  {
    href: '/admin/stock/old',
    Icon: IconTag,
    title: 'stk.hub.old.title',
    hint: 'stk.hub.old.hint',
    needs: 'catalog',
  },
  {
    href: '/admin/stock/quick',
    Icon: IconStockAdd,
    title: 'stk.hub.quick.title',
    hint: 'stk.hub.quick.hint',
    primary: true,
    needs: 'catalog',
  },
  {
    href: '/admin/stock/new',
    Icon: IconGrid,
    title: 'stk.hub.design.title',
    hint: 'stk.hub.design.hint',
    needs: 'catalog',
  },
  {
    href: '/admin/stock/receive',
    Icon: IconScan,
    title: 'stk.hub.receive.title',
    hint: 'stk.hub.receive.hint',
    needs: 'stock',
  },
];

async function Options() {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'stock']), getT()]);
  return (
    <ul className="rise-in grid grid-cols-1 gap-3 sm:grid-cols-2">
      {OPTIONS.filter((option) => can(me, option.needs)).map((option) => (
        <li key={option.href}>
          <TagTile href={option.href} primary={option.primary} icon={<option.Icon />} title={t(option.title)} hint={t(option.hint)} />
        </li>
      ))}
    </ul>
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
