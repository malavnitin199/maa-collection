import Link from 'next/link';
import { Suspense } from 'react';
import { muted } from '@/components/ui/styles';
import type { MessageKey } from '@/lib/i18n';
import { can, type Permission } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';

const OPTIONS: { href: string; title: MessageKey; hint: MessageKey; primary?: boolean; needs: Permission }[] = [
  {
    href: '/admin/stock/old',
    title: 'stk.hub.old.title',
    hint: 'stk.hub.old.hint',
    needs: 'catalog',
  },
  {
    href: '/admin/stock/quick',
    title: 'stk.hub.quick.title',
    hint: 'stk.hub.quick.hint',
    primary: true,
    needs: 'catalog',
  },
  {
    href: '/admin/stock/new',
    title: 'stk.hub.design.title',
    hint: 'stk.hub.design.hint',
    needs: 'catalog',
  },
  {
    href: '/admin/stock/receive',
    title: 'stk.hub.receive.title',
    hint: 'stk.hub.receive.hint',
    needs: 'stock',
  },
];

async function Options() {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'stock']), getT()]);
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
            <span className="text-lg font-semibold">{t(option.title)}</span>
            <span className={`text-sm ${muted}`}>{t(option.hint)}</span>
          </Link>
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
