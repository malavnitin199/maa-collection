import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted, sectionTitle } from '@/components/ui/styles';
import { SectionArt } from '@/features/catalog/section-art';
import { CategoryForm, SectionForm } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import type { MessageKey, T } from '@/lib/i18n';
import { SECTION_ICONS, sectionName } from '@/lib/sections';
import { createCategoryAction, updateCategoryAction, updateSectionAction } from '@/server/actions/admin';
import { requirePermission } from '@/server/auth';
import { getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, type CategoryRow } from '@/server/services/catalog';
import { listSections } from '@/server/services/sections';

async function load() {
  const [, t] = await Promise.all([requirePermission('catalog'), getT()]);
  const db = await requestDb();
  // listSections first: it sets up Man / Woman / Girl / Boy the first time.
  const { sections } = await listSections(db, STORE_ID);
  const rows = await listCategories(db, STORE_ID);
  return { t, sections, rows };
}

async function AddCategory() {
  const { t, sections } = await load();
  return (
    <details className={card}>
      <summary className="cursor-pointer font-medium text-brand-700 dark:text-brand-400">{t('cat.cat.addOpen')}</summary>
      <div className="mt-3">
        <CategoryForm
          action={createCategoryAction}
          submitLabel={t('cat.cat.add')}
          sections={sections.filter((s) => s.active).map((s) => ({ id: s.id, name: sectionName(s.name, t)! }))}
        />
      </div>
    </details>
  );
}

function CategoryRowItem({ c, t, sections }: { c: CategoryRow; t: T; sections: { id: string; name: string }[] }) {
  return (
    <li>
      <details className={card}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span>
            <span className="font-medium">{c.name}</span>
            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">{c.code}</span>
            {!c.active && <span className={`ml-1 text-xs ${muted}`}>{t('cat.inactiveParen')}</span>}
            <span className={`block text-xs ${muted}`}>{t('cat.productsPcs', { products: c.productCount, pcs: c.stockUnits })}</span>
            <span data-testid="category-sizes" className={`block text-xs ${muted}`}>
              {t('cat.cat.sizes', { sizes: c.sizes.length > 0 ? c.sizes.join(' · ') : t('cat.cat.sizesNotSet') })}
            </span>
          </span>
          <span className={`text-sm ${link}`}>{t('cat.cat.edit')}</span>
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <CategoryForm action={updateCategoryAction.bind(null, c.id)} initial={c} submitLabel={t('cat.cat.save')} sections={sections} />
          {c.productCount > 0 && (
            <Link href={`/admin/products?category=${c.id}`} className={`text-sm ${link}`}>
              {t('cat.cat.viewProducts')}
            </Link>
          )}
        </div>
      </details>
    </li>
  );
}

/** Plan v19: categories under Man / Woman / Girl / Boy (and the owner's own sections). */
async function CategoryList() {
  const { t, sections, rows } = await load();
  const choices = sections.map((s) => ({ id: s.id, name: sectionName(s.name, t)! }));
  const pictures = SECTION_ICONS.map((key) => ({ key, label: t(`ns.icon.${key}` as MessageKey) }));
  const unsorted = rows.filter((c) => !c.sectionId || !sections.some((s) => s.id === c.sectionId));
  return (
    <div data-testid="category-list" className="flex flex-col gap-6">
      {sections.map((section) => {
        const inSection = rows.filter((c) => c.sectionId === section.id);
        return (
          <section key={section.id} data-testid="section-group" className="flex flex-col gap-2">
            <details>
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <SectionArt icon={section.icon} className="h-8 w-8" />
                </span>
                <span className="flex-1">
                  <span className="text-lg font-bold">{sectionName(section.name, t)}</span>
                  {!section.active && <span className={`ml-1 text-xs ${muted}`}>{t('cat.inactiveParen')}</span>}
                  <span className={`block text-xs ${muted}`}>{t(inSection.length === 1 ? 'sec.count.one' : 'sec.count.other', { n: inSection.length })}</span>
                </span>
                <span className={`text-sm ${link}`}>{t('cat.cat.edit')}</span>
              </summary>
              <div className={`${card} mt-2`}>
                <SectionForm action={updateSectionAction.bind(null, section.id)} initial={{ name: section.name, icon: section.icon, active: section.active }} pictures={pictures} />
              </div>
            </details>
            <ul className="flex flex-col gap-2">
              {inSection.map((c) => (
                <CategoryRowItem key={c.id} c={c} t={t} sections={choices} />
              ))}
            </ul>
          </section>
        );
      })}
      {unsorted.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className={sectionTitle}>{t('sec.unsorted')}</h3>
          <ul className="flex flex-col gap-2">
            {unsorted.map((c) => (
              <CategoryRowItem key={c.id} c={c} t={t} sections={choices} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default async function CategoriesPage() {
  const t = await getT();
  return (
    <main className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('nav.categories')}</h1>
        <p className={`text-sm ${muted}`}>{t('cat.cat.subtitle')}</p>
      </div>
      <Suspense fallback={null}>
        <AddCategory />
      </Suspense>
      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('cat.allCategories')}</h2>
        <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
          <CategoryList />
        </Suspense>
      </section>
    </main>
  );
}
