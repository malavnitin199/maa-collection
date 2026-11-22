import Link from 'next/link';
import { Suspense } from 'react';
import { IconBack } from '@/components/ui/icons';
import { backButton, card, sectionTitle } from '@/components/ui/styles';
import { CategoryList, StandInTile, type CategoryRowData } from '@/features/catalog/category-list';
import { SectionArt } from '@/features/catalog/section-art';
import { CategoryForm, SectionForm, SetUpSectionsForm, type SectionChoice } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import type { Locale, T } from '@/lib/i18n';
import { wholeRupees } from '@/lib/money';
import { can } from '@/lib/permissions';
import { FIXED_SECTIONS, isFixedType, localName, withFixedSections, type FixedSectionKey } from '@/lib/sections';
import { createCategoryAction, createSectionAction, moveTypeAction, setUpSectionsAction, updateCategoryAction } from '@/server/actions/admin';
import { requirePermission } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, type CategoryRow } from '@/server/services/catalog';
import { categoryFigures, listSections, sumFigures, type SectionWithTypes, type TypeFigures } from '@/server/services/sections';

/**
 * Categories (plan v19 task 02b; owner, 2026-11-22, ADR-066): collection tiles on top, each
 * with its products (Men and Women always there — a missing one is made by its tap); the
 * chosen collection's figures (categories, products, pieces, stock value); its categories,
 * each with products · items · pieces, sizes, ✎ and 🗑 (Jeans, Jacket, Shirt locked); the
 * categories not sorted yet in a "Needs sorting" tile. The chosen tile lives in the address (`?s=`).
 */
type Search = { s?: string };
const UNSORTED = 'unsorted';

async function load() {
  const [me, t, locale] = await Promise.all([requirePermission('catalog'), getT(), getLocale()]);
  const db = await requestDb();
  const [{ sections }, rows, figures] = await Promise.all([listSections(db, STORE_ID), listCategories(db, STORE_ID), categoryFigures(db, STORE_ID)]);
  const unsorted = rows.filter((c) => !c.sectionId || !sections.some((s) => s.id === c.sectionId));
  return { me, t, locale, sections, rows, unsorted, figures };
}

function pick(sections: SectionWithTypes[], s: string | undefined): string {
  if (s === UNSORTED) return UNSORTED;
  if (s && sections.some((section) => section.id === s)) return s;
  return sections[0]?.id ?? UNSORTED;
}

const tileClass = (on: boolean, hidden = false) =>
  `flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-semibold transition ${
    on ? 'border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-700/25' : 'border-zinc-200 bg-surface text-zinc-800 hover:border-brand-400 dark:border-zinc-800 dark:text-zinc-100'
  } ${hidden ? 'opacity-60' : ''}`;

type Tile = { fixed: FixedSectionKey | null; section?: SectionWithTypes };

function SectionTiles({ sections, rows, unsorted, selected, figures, t, locale }: { sections: SectionWithTypes[]; rows: CategoryRow[]; unsorted: CategoryRow[]; selected: string; figures: Record<string, TypeFigures>; t: T; locale: Locale }) {
  // Men and Women always show (ADR-064): one the shop lacks gets a tile that makes it.
  const tiles = withFixedSections<Tile>(
    sections.map((section) => ({ fixed: section.fixed, section })),
    (fixed) => ({ fixed }),
  );
  return (
    <nav aria-label={t('sec.tabs')} data-testid="section-tiles" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {tiles.map(({ fixed, section }) => {
        if (!section) {
          const def = FIXED_SECTIONS.find((f) => f.key === fixed)!;
          return <StandInTile key={`fixed:${fixed}`} fixedKey={def.key} name={localName(def, locale)} icon={def.icon} className={tileClass(false)} />;
        }
        const on = selected === section.id;
        const products = sumFigures(rows.filter((c) => c.sectionId === section.id).map((c) => figures[c.id])).products;
        return (
          <Link key={section.id} href={`/admin/categories?s=${section.id}`} aria-current={on ? 'page' : undefined} className={tileClass(on, !section.active)}>
            <SectionArt icon={section.icon} className="h-7 w-7" />
            <span className="flex flex-col items-start leading-tight">
              <span>
                {localName(section, locale)}
                {!section.active && <span className="ml-1 text-xs font-normal">({t('sec.hidden')})</span>}
              </span>
              <span className={`text-[11px] font-medium ${on ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>{t(products === 1 ? 'sec.n.products.one' : 'sec.n.products.other', { n: products })}</span>
            </span>
          </Link>
        );
      })}
      {(unsorted.length > 0 || sections.length === 0) && (
        <Link href={`/admin/categories?s=${UNSORTED}`} aria-current={selected === UNSORTED ? 'page' : undefined} className={tileClass(selected === UNSORTED)}>
          <span>{t('sec.unsorted')}</span>
          <span className={`rounded-full px-1.5 text-xs ${selected === UNSORTED ? 'bg-white/20' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'}`}>{unsorted.length}</span>
        </Link>
      )}
    </nav>
  );
}

/** The chosen collection's figures (owner, 2026-11-22: "number of products it has" and the rest that helps). */
function Figures({ name, categories, figures, showCost, t }: { name: string; categories: number; figures: TypeFigures; showCost: boolean; t: T }) {
  const boxes = [
    { label: t('sec.fig.categories'), value: String(categories), testId: 'fig-categories' },
    { label: t('sec.fig.products'), value: String(figures.products), testId: 'fig-products' },
    { label: t('sec.fig.pieces'), value: String(figures.pieces), testId: 'fig-pieces' },
    ...(showCost ? [{ label: t('sec.fig.value'), value: wholeRupees(figures.valuePaise), testId: 'fig-value' }] : []),
  ];
  return (
    <dl data-testid="collection-figures" aria-label={t('sec.fig.aria', { name })} className={`grid gap-2 ${showCost ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
      {boxes.map((box) => (
        <div key={box.testId} className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-surface px-3 py-2 shadow-sm ring-1 ring-brand-100 dark:ring-brand-900">
          <dt className="truncate text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{box.label}</dt>
          <dd data-testid={box.testId} className="truncate text-lg leading-tight font-bold tabular-nums">
            {box.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

async function Tree({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ me, t, locale, sections, rows, unsorted, figures }, params] = await Promise.all([load(), searchParams]);
  const selected = pick(sections, params.s);
  const choices: SectionChoice[] = sections.filter((s) => s.active).map((s) => ({ id: s.id, name: localName(s, locale) }));
  const section = sections.find((s) => s.id === selected);
  const shown = section ? rows.filter((c) => c.sectionId === section.id) : unsorted;
  const showCost = can(me, 'costs');
  const empty: TypeFigures = { products: 0, items: 0, pieces: 0, valuePaise: 0 };
  const listRows: CategoryRowData[] = shown.map((c) => ({
    id: c.id,
    label: localName(c, locale),
    hindi: locale === 'en' ? c.nameHi : null,
    code: c.code,
    sizes: c.sizes,
    active: c.active,
    fixed: isFixedType(c.name),
    figures: figures[c.id] ?? empty,
    initial: { name: c.name, nameHi: c.nameHi, code: c.code, active: c.active, sizes: c.sizes, sectionId: c.sectionId },
    editAction: updateCategoryAction.bind(null, c.id),
    moveAction: section ? undefined : moveTypeAction.bind(null, c.id),
  }));
  return (
    <>
      <SectionTiles sections={sections} rows={rows} unsorted={unsorted} selected={selected} figures={figures} t={t} locale={locale} />
      <Figures name={section ? localName(section, locale) : t('sec.unsorted')} categories={shown.length} figures={sumFigures(shown.map((c) => figures[c.id]))} showCost={showCost} t={t} />
      {!section && <h2 className={sectionTitle}>{t('sec.unsorted')}</h2>}
      {section && (
        <details className={card}>
          <summary className="cursor-pointer font-medium text-brand-700 dark:text-brand-400">{t('cat.cat.addOpen')}</summary>
          <div className="mt-3">
            {/* Keyed by section and hidden state: a form's typed text or "Saved" message must not follow the
                owner to the next tile, and the "Under" box must be set again after hide / bring back
                (a hidden section leaves the list, and the browser would quietly pick the first one). */}
            <CategoryForm key={`${section.id}:${section.active}`} action={createCategoryAction} submitLabel={t('cat.cat.add')} sections={choices} defaultSectionId={section.active ? section.id : null} />
          </div>
        </details>
      )}
      {!section && sections.length === 0 && (
        <section data-testid="sections-setup" className={card}>
          <SetUpSectionsForm action={setUpSectionsAction} />
        </section>
      )}
      {!section && sections.length === 0 && (
        <details className={card}>
          <summary className="cursor-pointer font-medium text-brand-700 dark:text-brand-400">{t('cat.cat.addOpen')}</summary>
          <div className="mt-3">
            <CategoryForm action={createCategoryAction} submitLabel={t('cat.cat.add')} />
          </div>
        </details>
      )}
      {/* Keyed by tile: a row's open form must not follow the owner to the next collection. */}
      <CategoryList key={selected} rows={listRows} showCost={showCost} canDelete={me.role === 'admin'} choices={choices} move={!section} />
    </>
  );
}

async function AddSection() {
  const [, t] = await Promise.all([requirePermission('catalog'), getT()]);
  return (
    <details className={card}>
      <summary className="cursor-pointer font-medium text-brand-700 dark:text-brand-400">{t('sec.add')}</summary>
      <div className="mt-3">
        <SectionForm action={createSectionAction} submitLabel={t('sec.addSave')} />
      </div>
    </details>
  );
}

export default async function CategoriesPage(props: { searchParams: Promise<Search> }) {
  const t = await getT();
  return (
    <main className="flex flex-col gap-4">
      {/* Home → Collections lands here (ADR-066); ← goes back Home. */}
      <div className="flex items-center gap-3">
        <Link href="/admin/dashboard" aria-label={t('ni.backHome')} className={backButton}>
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold">{t('nav.categories')}</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Tree searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <AddSection />
      </Suspense>
    </main>
  );
}
