import Link from 'next/link';
import { Suspense } from 'react';
import { card, muted, sectionTitle } from '@/components/ui/styles';
import type { MessageKey } from '@/lib/i18n';
import { canAny, type Permission } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';

type Item = { href: string; label: MessageKey; hint: MessageKey; needs: readonly Permission[] | 'admin' | 'everyone' };

const GROUPS: { title: MessageKey; links: Item[] }[] = [
  {
    title: 'cat.menu.catalogStock',
    links: [
      { href: '/admin/stock/old', label: 'cat.menu.oldStock', hint: 'cat.menu.oldStockHint', needs: ['catalog'] },
      { href: '/admin/catalog/check', label: 'cat.check.title', hint: 'cat.menu.checkHint', needs: ['catalog'] },
      { href: '/admin/stock/quick', label: 'cat.menu.quick', hint: 'cat.menu.quickHint', needs: ['catalog'] },
      { href: '/admin/stock/new', label: 'cat.menu.newDesign', hint: 'cat.menu.newDesignHint', needs: ['catalog'] },
      { href: '/admin/stock/receive', label: 'cat.menu.receive', hint: 'cat.menu.receiveHint', needs: ['stock'] },
      { href: '/admin/products', label: 'nav.products', hint: 'cat.menu.productsHint', needs: ['catalog', 'prices', 'stock'] },
      { href: '/admin/products/new', label: 'cat.menu.single', hint: 'cat.menu.singleHint', needs: ['catalog'] },
      { href: '/admin/categories', label: 'nav.categories', hint: 'cat.menu.categoriesHint', needs: ['catalog'] },
      { href: '/admin/suppliers', label: 'cat.menu.suppliers', hint: 'cat.menu.suppliersHint', needs: ['catalog'] },
      { href: '/admin/labels', label: 'cat.menu.labels', hint: 'cat.menu.labelsHint', needs: ['catalog', 'stock'] },
    ],
  },
  {
    title: 'cat.menu.shop',
    links: [
      { href: '/admin/staff', label: 'cat.menu.staff', hint: 'cat.menu.staffHint', needs: 'admin' },
      { href: '/admin/team', label: 'cat.menu.team', hint: 'cat.menu.teamHint', needs: 'admin' },
      { href: '/admin/reports', label: 'nav.reports', hint: 'cat.menu.reportsHint', needs: 'admin' },
      { href: '/admin/activity', label: 'nav.activity', hint: 'cat.menu.activityHint', needs: 'admin' },
      { href: '/admin/settings', label: 'nav.settings', hint: 'cat.menu.settingsHint', needs: 'admin' },
    ],
  },
  {
    title: 'cat.menu.counter',
    links: [
      { href: '/pos', label: 'nav.counterSale', hint: 'cat.menu.sellHint', needs: 'everyone' },
      { href: '/pos/exchange', label: 'nav.exchange', hint: 'cat.menu.exchangeHint', needs: 'everyone' },
      { href: '/pos/my-sales', label: 'nav.mySales', hint: 'cat.menu.mySalesHint', needs: 'everyone' },
      { href: '/guide', label: 'nav.guide', hint: 'cat.menu.guideHint', needs: 'everyone' },
      { href: '/help', label: 'cat.menu.help', hint: 'cat.menu.helpHint', needs: 'everyone' },
    ],
  },
];

async function Menu() {
  // Salesmen with no catalog/stock/price rights have nothing here: back to the counter.
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'stock', 'prices']), getT()]);
  const allowed = (item: Item) =>
    item.needs === 'everyone' || (item.needs === 'admin' ? me.role === 'admin' : canAny(me, item.needs));
  return (
    <>
      {GROUPS.map((group) => {
        const links = group.links.filter(allowed);
        if (links.length === 0) return null;
        return (
          <section key={group.title} className="flex flex-col gap-2">
            <h2 className={sectionTitle}>{t(group.title)}</h2>
            <ul className="flex flex-col gap-2">
              {links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={`${card} flex items-center justify-between gap-3 py-3 active:bg-zinc-50 dark:active:bg-zinc-900`}>
                    <span>
                      <span className="block font-medium">{t(item.label)}</span>
                      <span className={`block text-xs ${muted}`}>{t(item.hint)}</span>
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

export default async function MorePage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">{t('cat.menu.title')}</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Menu />
      </Suspense>
    </main>
  );
}
