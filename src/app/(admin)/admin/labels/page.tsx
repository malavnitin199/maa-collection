import { typeOptionName } from '@/lib/sections';
import Link from 'next/link';
import { Suspense } from 'react';
import { IconPrinter } from '@/components/ui/icons';
import { input, link, muted, primaryButton, secondaryButton, sectionTitle } from '@/components/ui/styles';
import { SelectableItem, SelectionBar, SelectionProvider, SelectToggle } from '@/components/ui/selection';
import { PrintSelected } from '@/features/catalog/bulk-actions';
import { DesignCard } from '@/features/catalog/design-card';
import { HangTag } from '@/features/catalog/hang-tag';
import { TagFilterForm } from '@/features/tag-library/filter-form';
import { groupNote, groupTitle } from '@/features/tag-library/group-title';
import { TagViews } from '@/features/tag-library/tag-views';
import { STORE_ID } from '@/lib/app-config';
import { groupDesigns } from '@/lib/design-groups';
import type { MessageKey } from '@/lib/i18n';
import { itemLink } from '@/lib/item-link';
import {
  capGroups,
  groupTags,
  hasTagFilters,
  parseTagParams,
  tagFilter,
  tagLibraryHref,
  tagPrintHref,
  TAG_GROUPS,
  TAG_LIMIT_MAX,
  TAG_PAGE,
  TAG_WHEN,
  type TagGroupBy,
  type TagParams,
  type TagWhen,
} from '@/lib/tag-library';
import { appOrigin } from '@/server/app-origin';
import { requireAnyPermission } from '@/server/auth';
import { getLocale, getT } from '@/server/i18n';
import { requestDb } from '@/server/request-db';
import { listCategories, listSuppliers } from '@/server/services/catalog';
import { tagSizesFor } from '@/server/services/products';
import { imageSrc, mainImages } from '@/server/services/images';
import { getStoreSettings, labelPriceCode } from '@/server/services/settings';
import { listStaff } from '@/server/services/staff';
import { listTagLibrary } from '@/server/services/tag-library';

export const metadata = { title: 'All tags · Maa Collection' };

const GROUP_LABEL: Record<TagGroupBy, MessageKey> = {
  date: 'stk.lib.group.date',
  company: 'stk.lib.group.company',
  category: 'stk.lib.group.category',
  delivery: 'stk.lib.group.delivery',
};
const WHEN_LABEL: Record<TagWhen, MessageKey> = {
  today: 'stk.lib.when.today',
  '7d': 'stk.lib.when.7d',
  '30d': 'stk.lib.when.30d',
  all: 'stk.lib.when.all',
};

const chip = (on: boolean) =>
  `inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition active:scale-95 ${
    on ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-zinc-300 hover:border-brand-400 dark:border-zinc-700'
  }`;

/** A row of one-tap choices (group by, when made) that keeps every other filter. */
function ChipRow<V extends string>({ label, values, current, href, names }: { label: string; values: readonly V[]; current: V; href: (v: V) => string; names: (v: V) => string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className={`${sectionTitle} mr-1`}>{label}</span>
      {values.map((v) => (
        <Link key={v} href={href(v)} scroll={false} aria-current={v === current ? 'true' : undefined} className={chip(v === current)}>
          {names(v)}
        </Link>
      ))}
    </nav>
  );
}

async function AllTags({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAnyPermission(['catalog', 'stock']);
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const p: TagParams = parseTagParams(await searchParams);
  const db = await requestDb();
  const [rows, settings, origin, supplierRows, categoryRows, people] = await Promise.all([
    listTagLibrary(db, STORE_ID, tagFilter(p)),
    getStoreSettings(db, STORE_ID),
    appOrigin(),
    listSuppliers(db, STORE_ID),
    listCategories(db, STORE_ID),
    listStaff(db, STORE_ID),
  ]);
  const now = new Date();
  const grouped = groupTags(rows, p.group);
  const { groups, shown, total } = capGroups(grouped, p.limit);
  const shownRows = groups.flatMap((g) => g.shown);
  const [sizes, photos] = await Promise.all([tagSizesFor(db, STORE_ID, shownRows), mainImages(db, STORE_ID, shownRows.map((r) => r.id))]);
  const photoOf = (id: string) => {
    const image = photos.get(id);
    return image ? imageSrc(image) : undefined;
  };
  const combined = p.show === 'designs';
  const designCount = groupDesigns(rows).length;
  /** One real hang tag: tap to open the item; pieces in stock under it. */
  const tagCell = (item: (typeof shownRows)[number], selectable = true) => {
    const tag = (
      <Link href={`/admin/products/${item.id}`} aria-label={t('stk.lib.open', { name: `${item.name} · ${item.color} · ${item.size}` })} className="tag-open">
        <HangTag product={item} company={item.supplierName} sizes={sizes.get(item.id)} qrValue={itemLink(origin, item.barcode)} priceCode={labelPriceCode(settings, item.costPaise)} />
      </Link>
    );
    return (
    <li key={item.id} className="tag-cell">
      {/* Plan v17: tick tags to print just those. */}
      {selectable ? (
        <SelectableItem ids={[item.id]} label={`${item.name} ${item.color} ${item.size}`}>
          {tag}
        </SelectableItem>
      ) : (
        tag
      )}
      <p className={`mt-1 text-center text-xs tabular-nums ${item.stock > 0 ? muted : 'text-red-600 dark:text-red-400'}`}>{t('stk.labels.pcs', { n: item.stock })}</p>
    </li>
    );
  };
  const pieces = rows.reduce((n, r) => n + Math.max(r.stock, 0), 0);
  const filtered = hasTagFilters(p);

  return (
    <>
      {/* Remount when the address changes, so Clear filters / chips reset the boxes. */}
      <TagFilterForm key={tagLibraryHref(p)} label={t('stk.lib.searchAria')}>
        {p.group !== 'date' && <input type="hidden" name="group" value={p.group} />}
        {p.when !== 'all' && <input type="hidden" name="when" value={p.when} />}
        {p.show === 'tags' && <input type="hidden" name="show" value="tags" />}
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={p.q}
            placeholder={t('stk.lib.searchPlaceholder')}
            aria-label={t('stk.lib.searchAria')}
            className={`min-w-0 flex-1 ${input}`}
          />
          <button type="submit" className={secondaryButton}>
            {t('stk.lib.show')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select name="supplier" defaultValue={p.supplier ?? ''} aria-label={t('stk.lib.companyAria')} className={`min-w-0 ${input}`}>
            <option value="">{t('stk.lib.allCompanies')}</option>
            <option value="none">{t('stk.lib.noCompany')}</option>
            {supplierRows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select name="category" defaultValue={p.category ?? ''} aria-label={t('stk.lib.categoryAria')} className={`min-w-0 ${input}`}>
            <option value="">{t('stk.lib.allCategories')}</option>
            {categoryRows.map((c) => (
              <option key={c.id} value={c.id}>
                {typeOptionName(c, t)}
              </option>
            ))}
          </select>
          <select name="made" defaultValue={p.made ?? ''} aria-label={t('stk.lib.madeBy')} className={`col-span-2 min-w-0 sm:col-span-1 ${input}`}>
            <option value="">{t('stk.lib.madeByAnyone')}</option>
            {people.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" name="stock" value="in" defaultChecked={p.stock} className="h-5 w-5 accent-brand-600" />
            {t('stk.lib.inStock')}
          </label>
          {filtered && (
            <Link href={tagLibraryHref({ ...parseTagParams({}), group: p.group })} scroll={false} className={`text-sm ${link}`}>
              {t('stk.lib.clear')}
            </Link>
          )}
        </div>
      </TagFilterForm>

      <div className="flex flex-col gap-2">
        <ChipRow
          label={t('stk.lib.groupBy')}
          values={TAG_GROUPS}
          current={p.group}
          href={(group) => tagLibraryHref(p, { group })}
          names={(g) => t(GROUP_LABEL[g])}
        />
        <ChipRow label={t('stk.lib.when')} values={TAG_WHEN} current={p.when} href={(when) => tagLibraryHref(p, { when })} names={(w) => t(WHEN_LABEL[w])} />
        <ChipRow
          label={t('cat.view.show')}
          values={['designs', 'tags'] as const}
          current={p.show}
          href={(show) => tagLibraryHref(p, { show })}
          names={(v) => t(v === 'designs' ? 'cat.view.combined' : 'stk.lib.view.tags')}
        />
      </div>

      {rows.length === 0 ? (
        filtered ? (
          <p className={`text-sm ${muted}`}>{t('stk.lib.none')}</p>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className={`text-sm ${muted}`}>{t('stk.lib.empty')}</p>
            <Link href="/admin/stock" className={primaryButton}>
              {t('stk.lib.addStock')}
            </Link>
          </div>
        )
      ) : (
        <SelectionProvider allIds={shownRows.map((r) => r.id)}>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={tagPrintHref(p)} className={`${secondaryButton} self-start`}>
              <IconPrinter className="h-4 w-4" />
              {t('stk.lib.printShown', { n: total })}
            </Link>
            <SelectToggle testId="select-tags" />
          </div>
          <TagViews
            labels={{ view: t('stk.lib.view'), grid: t('stk.lib.view.grid'), rows: t('stk.lib.view.rows'), swipeHint: t('stk.lib.swipeHint') }}
            summary={
              <span data-testid="tag-summary">
                {combined
                  ? t('stk.lib.summaryDesigns', { designs: designCount, tags: total, pcs: pieces, groups: grouped.length })
                  : t('stk.lib.summary', { tags: total, pcs: pieces, groups: grouped.length })}
                {shown < total && (
                  <>
                    <br />
                    {t('stk.lib.capped', { shown, total })}{' '}
                    {p.limit < TAG_LIMIT_MAX && (
                      <Link href={tagLibraryHref(p, { limit: Math.min(p.limit + TAG_PAGE, TAG_LIMIT_MAX) })} scroll={false} className={link}>
                        {t('stk.lib.showMore')}
                      </Link>
                    )}
                  </>
                )}
              </span>
            }
          >
            {groups.map((g) => {
              const id = `tags-${g.by}-${g.key}`;
              const note = groupNote(g, t, locale, now);
              const printHref = g.by === 'delivery' && g.key !== 'none' ? `/admin/labels/print?receipt=${g.key}` : tagPrintHref(p, g.key);
              return (
                <section key={id} aria-labelledby={id} data-testid="tag-group" className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-b border-zinc-200 pb-1.5 dark:border-zinc-800">
                    <div className="min-w-0">
                      <h2 id={id} className="text-lg leading-tight font-semibold">
                        {groupTitle(g, t, locale, now)}
                      </h2>
                      <p className={`text-xs ${muted}`}>
                        {note && `${note} · `}
                        {t('stk.lib.groupCount', { tags: g.items.length, pcs: g.pieces })}
                        {g.shown.length < g.items.length && ` (${t('stk.lib.groupShown', { n: g.shown.length })})`}
                      </p>
                    </div>
                    <Link href={printHref} className={`inline-flex items-center gap-1 text-sm ${link}`}>
                      <IconPrinter className="h-4 w-4" />
                      {t('stk.lib.printGroup')}
                    </Link>
                  </div>
                  {combined ? (
                    <ul className="tag-row">
                      {groupDesigns(g.shown).map((d) => (
                        <li key={d.key} className="design-cell">
                          <SelectableItem ids={d.items.map((r) => r.id)} label={d.name}>
                          <DesignCard
                            design={d}
                            t={t}
                            photos={d.items.map((r) => photoOf(r.id)).filter((src): src is string => Boolean(src))}
                            href={`/admin/products/${d.items[0].id}`}
                            qrValue={`${origin}/admin/products/${d.items[0].id}`}
                            printHref={tagPrintHref(p, g.key, d.key)}
                            expandLabel={t(d.items.length === 1 ? 'cat.design.showTags.one' : 'cat.design.showTags.other', { n: d.items.length })}
                          >
                            <ul className="tag-grid">{d.items.map((r) => tagCell(r, false))}</ul>
                          </DesignCard>
                          </SelectableItem>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="tag-row">{g.shown.map((r) => tagCell(r))}</ul>
                  )}
                </section>
              );
            })}
          </TagViews>
          <SelectionBar>
            <PrintSelected />
          </SelectionBar>
        </SelectionProvider>
      )}
    </>
  );
}

export default async function LabelsPage(props: PageProps<'/admin/labels'>) {
  const t = await getT();
  return (
    <main className="flex min-w-0 flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('stk.labels.title')}</h1>
        <p className={`mt-1 text-sm ${muted}`}>{t('stk.labels.subtitle')}</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">{t('stk.labels.loading')}</p>}>
        <AllTags searchParams={props.searchParams as Promise<Record<string, string | string[] | undefined>>} />
      </Suspense>
    </main>
  );
}
