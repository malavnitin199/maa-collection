import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { muted, okBox, primaryButton } from '@/components/ui/styles';
import { SelectableItem, SelectionBar, SelectionProvider, SelectToggle } from '@/components/ui/selection';
import { ProductDeleteAction } from '@/features/catalog/bulk-actions';
import { ProductListCard } from '@/features/catalog/product-list-card';
import { STORE_ID } from '@/lib/app-config';
import { groupDesigns } from '@/lib/design-groups';
import { can } from '@/lib/permissions';
import { requireAnyPermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { imageSrc, mainImages } from '@/server/services/images';
import { listProducts } from '@/server/services/products';

/** `deleted`: the message after Delete on a product page (ADR-050). */
type Search = { deleted?: string };

/** A card that can be ticked, for those who may select; otherwise the card as it is. */
function Selectable({ on, ids, label, children }: { on: boolean; ids: readonly string[]; label: string; children: ReactNode }) {
  return on ? (
    <SelectableItem ids={ids} label={label}>
      {children}
    </SelectableItem>
  ) : (
    children
  );
}

/**
 * Products (ADR-058, owner's feedback): every product in one list — one compact card per
 * design (same name, company and MRP), hidden items included and marked. No search,
 * filters or view switch for now. The owner can select cards to delete them (ADR-057).
 */
async function ProductList({ searchParams }: { searchParams: Promise<Search> }) {
  const [me, t] = await Promise.all([requireAnyPermission(['catalog', 'prices', 'stock']), getT()]);
  const { deleted } = await searchParams;
  const db = await requestDb();
  const items = await listProducts(db, STORE_ID);
  const photos = await mainImages(db, STORE_ID, items.map((p) => p.id));
  /** The first of these items that has a photo. */
  const photoOf = (ids: readonly string[]) => {
    for (const id of ids) {
      const image = photos.get(id);
      if (image) return imageSrc(image);
    }
    return undefined;
  };
  const showCost = can(me, 'costs');
  // Select's only action is Delete (ADR-057), which is the owner's (ADR-050).
  const canSelect = me.role === 'admin';
  const designs = groupDesigns(items);
  const pieces = designs.reduce((n, d) => n + d.pieces, 0);

  return (
    <>
      {deleted && (
        <p role="status" data-testid="deleted-note" className={okBox}>
          {deleted.slice(0, 300)}
        </p>
      )}
      <SelectionProvider allIds={canSelect ? items.map((p) => p.id) : []}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p data-testid="products-summary" className={`text-sm ${muted}`}>
            {t('cat.design.summary', { designs: designs.length, items: items.length, pcs: pieces })}
          </p>
          <SelectToggle testId="select-products" />
        </div>
        <ul data-testid="design-list" className="rise-in grid gap-2.5 sm:grid-cols-2">
          {designs.map((d) => {
            const ids = d.items.map((p) => p.id);
            return (
              <li key={d.key}>
                <Selectable on={canSelect} ids={ids} label={d.name}>
                  <ProductListCard design={d} photo={photoOf(ids)} href={`/admin/products/${ids[0]}`} showCost={showCost} t={t} />
                </Selectable>
              </li>
            );
          })}
        </ul>
        {items.length === 0 && <p className={`text-sm ${muted}`}>{t('cat.products.none')}</p>}
        <SelectionBar>
          <ProductDeleteAction />
        </SelectionBar>
      </SelectionProvider>
    </>
  );
}

export default async function ProductsPage(props: PageProps<'/admin/products'>) {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('nav.products')}</h1>
        <Link href="/admin/stock" className={primaryButton}>
          {t('nav.addStock')}
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('cat.products.loading')}</p>}>
        <ProductList searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </main>
  );
}
