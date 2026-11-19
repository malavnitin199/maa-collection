import Link from 'next/link';
import { Suspense } from 'react';
import { card, link, muted, secondaryButton, sectionTitle } from '@/components/ui/styles';
import { SectionArt } from '@/features/catalog/section-art';
import { CategoryForm, MoveTypeForm, SectionForm, type SectionChoice } from '@/features/catalog/setup-forms';
import { STORE_ID } from '@/lib/app-config';
import type { Locale, T } from '@/lib/i18n';
import { localName } from '@/lib/sections';
import { createCategoryAction, createSectionAction, moveSectionAction, moveTypeAction, updateCategoryAction, updateSectionAction } from '@/server/actions/admin';
import { requirePermission } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, type CategoryRow } from '@/server/services/catalog';
import { listSections, type SectionWithTypes } from '@/server/services/sections';

/**
 * Plan v19 (task 02b): the owner's tree. Sections (Men / Women / Boys / Girls and
 * their own) as tiles on top; the chosen section's categories underneath; the
 * categories not sorted yet in a "Needs sorting" tile the owner empties once.
 * Everything here is server-rendered; the chosen tile lives in the address (`?s=`).
 */
type Search = { s?: string };
const UNSORTED = 'unsorted';

async function load() {
  const [, t, locale] = await Promise.all([requirePermission('catalog'), getT(), getLocale()]);
  const db = await requestDb();
  const [{ sections }, rows] = await Promise.all([listSections(db, STORE_ID), listCategories(db, STORE_ID)]);
  const unsorted = rows.filter((c) => !c.sectionId || !sections.some((s) => s.id === c.sectionId));
  return { t, locale, sections, rows, unsorted };
}

function pick(sections: SectionWithTypes[], s: string | undefined): string {
  if (s === UNSORTED) return UNSORTED;
  if (s && sections.some((section) => section.id === s)) return s;
  return sections[0]?.id ?? UNSORTED;
}

function count(t: T, n: number) {
  return t(n === 1 ? 'sec.count.one' : 'sec.count.other', { n });
}

function SectionTiles({ sections, rows, unsorted, selected, t, locale }: { sections: SectionWithTypes[]; rows: CategoryRow[]; unsorted: CategoryRow[]; selected: string; t: T; locale: Locale }) {
  const tile = (on: boolean, hidden = false) =>
    `flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
      on ? 'border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-700/25' : 'border-zinc-200 bg-surface text-zinc-800 hover:border-brand-400 dark:border-zinc-800 dark:text-zinc-100'
    } ${hidden ? 'opacity-60' : ''}`;
  return (
    <nav aria-label={t('sec.tabs')} data-testid="section-tiles" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {sections.map((section) => {
        const on = selected === section.id;
        const n = rows.filter((c) => c.sectionId === section.id).length;
        return (
          <Link key={section.id} href={`/admin/categories?s=${section.id}`} aria-current={on ? 'page' : undefined} className={tile(on, !section.active)}>
            <SectionArt icon={section.icon} className="h-7 w-7" />
            <span>
              {localName(section, locale)}
              {!section.active && <span className="ml-1 text-xs font-normal">({t('sec.hidden')})</span>}
            </span>
            <span className={`rounded-full px-1.5 text-xs ${on ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>{n}</span>
          </Link>
        );
      })}
      {(unsorted.length > 0 || sections.length === 0) && (
        <Link href={`/admin/categories?s=${UNSORTED}`} aria-current={selected === UNSORTED ? 'page' : undefined} className={tile(selected === UNSORTED)}>
          <span>{t('sec.unsorted')}</span>
          <span className={`rounded-full px-1.5 text-xs ${selected === UNSORTED ? 'bg-white/20' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'}`}>{unsorted.length}</span>
        </Link>
      )}
    </nav>
  );
}

function SectionHead({ section, n, t, locale, first, last }: { section: SectionWithTypes; n: number; t: T; locale: Locale; first: boolean; last: boolean }) {
  const name = localName(section, locale);
  return (
    <section data-testid="section-head" className={`${card} flex flex-col gap-3`}>
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <SectionArt icon={section.icon} className="h-10 w-10" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold">
            {name}
            {locale === 'en' && section.nameHi && <span className={`ml-2 text-base font-normal ${muted}`}>{section.nameHi}</span>}
          </h2>
          <p className={`text-sm ${muted}`}>
            {count(t, n)}
            {!section.active && ` · ${t('sec.hidden')}`}
          </p>
        </div>
        <form action={moveSectionAction.bind(null, section.id, 'up')}>
          <button type="submit" disabled={first} aria-label={t('sec.up', { name })} className={`${secondaryButton} h-11 w-11 px-0 text-lg`}>
            ▲
          </button>
        </form>
        <form action={moveSectionAction.bind(null, section.id, 'down')}>
          <button type="submit" disabled={last} aria-label={t('sec.down', { name })} className={`${secondaryButton} h-11 w-11 px-0 text-lg`}>
            ▼
          </button>
        </form>
      </div>
      <details>
        <summary className={`cursor-pointer text-sm font-medium ${link}`}>{t('sec.edit')}</summary>
        <div className="mt-3">
          <SectionForm key={section.id} action={updateSectionAction.bind(null, section.id)} initial={section} submitLabel={t('sec.save')} />
        </div>
      </details>
    </section>
  );
}

function CategoryItem({ c, t, locale, choices, move }: { c: CategoryRow; t: T; locale: Locale; choices: SectionChoice[]; move: boolean }) {
  return (
    <li>
      <div className={`${card} flex flex-col gap-3`}>
        <details>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="font-medium">{localName(c, locale)}</span>
              {locale === 'en' && c.nameHi && <span className={`ml-2 text-sm ${muted}`}>{c.nameHi}</span>}
              <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">{c.code}</span>
              {!c.active && <span className={`ml-1 text-xs ${muted}`}>{t('cat.inactiveParen')}</span>}
              <span className={`block text-xs ${muted}`}>{t('cat.productsPcs', { products: c.productCount, pcs: c.stockUnits })}</span>
              <span data-testid="category-sizes" className={`block text-xs ${muted}`}>
                {t('cat.cat.sizes', { sizes: c.sizes.length > 0 ? c.sizes.join(' · ') : t('cat.cat.sizesNotSet') })}
              </span>
            </span>
            <span className={`shrink-0 text-sm ${link}`}>{t('cat.cat.edit')}</span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <CategoryForm action={updateCategoryAction.bind(null, c.id)} initial={c} submitLabel={t('cat.cat.save')} sections={move ? undefined : choices} />
            {c.productCount > 0 && (
              <Link href={`/admin/products?category=${c.id}`} className={`text-sm ${link}`}>
                {t('cat.cat.viewProducts')}
              </Link>
            )}
          </div>
        </details>
        {move && choices.length > 0 && <MoveTypeForm action={moveTypeAction.bind(null, c.id)} sections={choices} typeName={localName(c, locale)} />}
      </div>
    </li>
  );
}

async function Tree({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ t, locale, sections, rows, unsorted }, params] = await Promise.all([load(), searchParams]);
  const selected = pick(sections, params.s);
  const choices: SectionChoice[] = sections.filter((s) => s.active).map((s) => ({ id: s.id, name: localName(s, locale) }));
  const section = sections.find((s) => s.id === selected);
  const index = sections.findIndex((s) => s.id === selected);
  const shown = section ? rows.filter((c) => c.sectionId === section.id) : unsorted;
  return (
    <>
      <SectionTiles sections={sections} rows={rows} unsorted={unsorted} selected={selected} t={t} locale={locale} />
      {section ? (
        <SectionHead section={section} n={shown.length} t={t} locale={locale} first={index === 0} last={index === sections.length - 1} />
      ) : (
        <h2 className={sectionTitle}>{t('sec.unsorted')}</h2>
      )}
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
        <details className={card}>
          <summary className="cursor-pointer font-medium text-brand-700 dark:text-brand-400">{t('cat.cat.addOpen')}</summary>
          <div className="mt-3">
            <CategoryForm action={createCategoryAction} submitLabel={t('cat.cat.add')} />
          </div>
        </details>
      )}
      <ul data-testid="category-list" className="flex flex-col gap-2">
        {shown.map((c) => (
          <CategoryItem key={c.id} c={c} t={t} locale={locale} choices={choices} move={!section} />
        ))}
      </ul>
      {shown.length === 0 && <p className={`text-sm ${muted}`}>{t('sec.none')}</p>}
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
      <h1 className="text-2xl font-semibold">{t('nav.categories')}</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('common.loading')}</p>}>
        <Tree searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <AddSection />
      </Suspense>
    </main>
  );
}
