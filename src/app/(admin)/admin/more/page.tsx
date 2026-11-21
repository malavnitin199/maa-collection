import Link from 'next/link';
import { Suspense } from 'react';
import { muted, sectionTitle } from '@/components/ui/styles';
import { IconChevron, IconBook, IconBoxes, IconChart, IconCheckList, IconClock, IconGear, IconGrid, IconHelp, IconPrinter, IconRupee, IconScan, IconStockAdd, IconSwap, IconTag, IconTruck, IconUsers } from '@/components/ui/icons';
import type { MessageKey } from '@/lib/i18n';
import { canAny, type Permission } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';

type Item = { href: string; Icon: (p: { className?: string }) => React.ReactNode; label: MessageKey; hint: MessageKey; needs: readonly Permission[] | 'admin' | 'everyone' };

const GROUPS: { title: MessageKey; links: Item[] }[] = [
  {
    title: 'cat.menu.catalogStock',
    links: [
      { href: '/admin/stock/old', Icon: IconTag, label: 'cat.menu.oldStock', hint: 'cat.menu.oldStockHint', needs: ['catalog'] },
      { href: '/admin/catalog/check', Icon: IconCheckList, label: 'cat.check.title', hint: 'cat.menu.checkHint', needs: ['catalog'] },
      { href: '/admin/stock/new', Icon: IconStockAdd, label: 'cat.menu.newItem', hint: 'cat.menu.newItemHint', needs: ['catalog'] },
      { href: '/admin/stock/receive', Icon: IconScan, label: 'cat.menu.receive', hint: 'cat.menu.receiveHint', needs: ['stock'] },
      { href: '/admin/products', Icon: IconBoxes, label: 'nav.products', hint: 'cat.menu.productsHint', needs: ['catalog', 'prices', 'stock'] },
      { href: '/admin/products/new', Icon: IconTag, label: 'cat.menu.single', hint: 'cat.menu.singleHint', needs: ['catalog'] },
      { href: '/admin/categories', Icon: IconGrid, label: 'nav.categories', hint: 'cat.menu.categoriesHint', needs: ['catalog'] },
      { href: '/admin/companies', Icon: IconTruck, label: 'cat.menu.suppliers', hint: 'cat.menu.suppliersHint', needs: ['catalog'] },
      { href: '/admin/labels', Icon: IconPrinter, label: 'cat.menu.labels', hint: 'cat.menu.labelsHint', needs: ['catalog', 'stock'] },
    ],
  },
  {
    title: 'cat.menu.shop',
    links: [
      { href: '/admin/approvals', Icon: IconCheckList, label: 'nav.approvals', hint: 'appr.menu.hint', needs: 'admin' },
      { href: '/admin/staff', Icon: IconUsers, label: 'cat.menu.staff', hint: 'cat.menu.staffHint', needs: 'admin' },
      { href: '/admin/team', Icon: IconChart, label: 'cat.menu.team', hint: 'cat.menu.teamHint', needs: 'admin' },
      { href: '/admin/reports', Icon: IconRupee, label: 'nav.reports', hint: 'cat.menu.reportsHint', needs: 'admin' },
      { href: '/admin/activity', Icon: IconClock, label: 'nav.activity', hint: 'cat.menu.activityHint', needs: 'admin' },
      { href: '/admin/settings', Icon: IconGear, label: 'nav.settings', hint: 'cat.menu.settingsHint', needs: 'admin' },
      { href: '/admin/settings#clear-stock', Icon: IconBoxes, label: 'own.clear.title', hint: 'cat.menu.clearHint', needs: 'admin' },
    ],
  },
  {
    title: 'cat.menu.counter',
    links: [
      { href: '/pos', Icon: IconScan, label: 'nav.counterSale', hint: 'cat.menu.sellHint', needs: 'everyone' },
      { href: '/pos/exchange', Icon: IconSwap, label: 'nav.exchange', hint: 'cat.menu.exchangeHint', needs: 'everyone' },
      { href: '/pos/my-sales', Icon: IconRupee, label: 'nav.mySales', hint: 'cat.menu.mySalesHint', needs: 'everyone' },
      { href: '/guide', Icon: IconBook, label: 'nav.guide', hint: 'cat.menu.guideHint', needs: 'everyone' },
      { href: '/help', Icon: IconHelp, label: 'cat.menu.help', hint: 'cat.menu.helpHint', needs: 'everyone' },
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
            <ul className="rise-in divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-200/80 bg-surface shadow-sm shadow-brand-900/[0.05] dark:divide-zinc-800 dark:border-zinc-800">
              {links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center gap-3 px-4 py-3 transition active:bg-brand-50 dark:active:bg-zinc-800">
                    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
                      <item.Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t(item.label)}</span>
                      <span className={`block text-xs ${muted}`}>{t(item.hint)}</span>
                    </span>
                    <IconChevron className={`h-5 w-5 shrink-0 ${muted}`} />
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
