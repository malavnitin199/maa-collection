'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { IconLock, IconPencil, IconTrash } from '@/components/ui/icons';
import { ActionSheet, sheetDanger, sheetSecondary } from '@/components/ui/selection';
import { card, errorBox, muted } from '@/components/ui/styles';
import { useDone } from '@/features/feedback/effects';
import { useT } from '@/features/i18n/i18n-provider';
import { formatPaise } from '@/lib/money';
import type { SectionIcon } from '@/lib/sections';
import { deleteCategoryAction, openFixedCollectionAction, type FormState } from '@/server/actions/admin';
import type { TypeFigures } from '@/server/services/sections';
import { SectionArt } from './section-art';
import { CategoryForm, MoveTypeForm, type SectionChoice } from './setup-forms';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type CategoryRowData = {
  id: string;
  /** In the person's language. */
  label: string;
  /** The Hindi name beside it, on an English screen. */
  hindi: string | null;
  code: string;
  sizes: string[];
  active: boolean;
  /** Jeans, Jacket, Shirt (ADR-066): a lock instead of ✎ / 🗑. */
  fixed: boolean;
  figures: TypeFigures;
  initial: { name: string; nameHi: string | null; code: string; active: boolean; sizes: string[]; sectionId: string | null };
  editAction: Action;
  /** Needs sorting: "Move under…". */
  moveAction?: Action;
};

const iconButton = 'flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-zinc-200 transition active:scale-90 dark:ring-zinc-700';

/**
 * Categories (owner, 2026-11-22, ADR-066): each category with its products, items, pieces
 * (and their value, for the Purchase price right) and sizes; ✎ opens its form, 🗑 (owner)
 * asks first and deletes one with no items. Jeans, Jacket and Shirt carry a lock.
 */
export function CategoryList({ rows, showCost, canDelete, choices, move }: { rows: CategoryRowData[]; showCost: boolean; canDelete: boolean; choices: SectionChoice[]; move: boolean }) {
  const t = useT();
  const done = useDone();
  return (
    <>
      {done.node}
      <ul data-testid="category-list" className="flex flex-col gap-2">
        {rows.map((row) => (
          <CategoryRow key={row.id} row={row} showCost={showCost} canDelete={canDelete} choices={choices} move={move} onDeleted={(message) => done.show({ title: message })} />
        ))}
      </ul>
      {rows.length === 0 && <p className={`text-sm ${muted}`}>{t('sec.none')}</p>}
    </>
  );
}

function CategoryRow({ row, showCost, canDelete, choices, move, onDeleted }: { row: CategoryRowData; showCost: boolean; canDelete: boolean; choices: SectionChoice[]; move: boolean; onDeleted: (message: string) => void }) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const f = row.figures;
  const remove = () =>
    startBusy(async () => {
      const result = await deleteCategoryAction(row.id);
      if (!result.ok) return setError(result.error);
      setAsking(false);
      onDeleted(result.message);
      router.refresh();
    });
  return (
    <li data-testid="category-row" data-fixed={row.fixed || undefined}>
      <div className={`${card} flex flex-col gap-3`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-semibold">{row.label}</span>
              {row.hindi && <span className={`text-sm ${muted}`}>{row.hindi}</span>}
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">{row.code}</span>
              {!row.active && <span className={`text-xs ${muted}`}>{t('cat.inactiveParen')}</span>}
              {row.fixed && (
                <span title={t('sec.fixed')} className="text-zinc-400 dark:text-zinc-500">
                  <IconLock className="h-3.5 w-3.5" />
                </span>
              )}
            </p>
            <p data-testid="category-figures" className="mt-0.5 text-xs font-medium tabular-nums">
              {[
                t(f.products === 1 ? 'sec.n.products.one' : 'sec.n.products.other', { n: f.products }),
                t(f.items === 1 ? 'sec.n.items.one' : 'sec.n.items.other', { n: f.items }),
                t(f.pieces === 1 ? 'stk.item.pcs.one' : 'stk.item.pcs.other', { n: f.pieces }),
              ].join(' · ')}
              {showCost && f.valuePaise > 0 && <span className={muted}> · {t('sec.type.value', { amount: formatPaise(f.valuePaise) })}</span>}
            </p>
            <p data-testid="category-sizes" className={`text-xs ${muted}`}>
              {t('cat.cat.sizes', { sizes: row.sizes.length > 0 ? row.sizes.join(' · ') : t('cat.cat.sizesNotSet') })}
            </p>
          </div>
          {!row.fixed && (
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                aria-label={t('sec.type.edit', { name: row.label })}
                aria-expanded={editing}
                onClick={() => setEditing((open) => !open)}
                className={`${iconButton} ${editing ? 'bg-brand-600 text-white ring-brand-600' : 'text-brand-700 dark:text-brand-300'}`}
              >
                <IconPencil className="h-4 w-4" />
              </button>
              {canDelete && (
                <button
                  type="button"
                  aria-label={t('sec.type.delete', { name: row.label })}
                  onClick={() => {
                    setError(null);
                    setAsking(true);
                  }}
                  className={`${iconButton} text-red-600 dark:text-red-400`}
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
        {editing && <CategoryForm action={row.editAction} initial={row.initial} submitLabel={t('cat.cat.save')} sections={move ? undefined : choices} />}
        {row.moveAction && choices.length > 0 && <MoveTypeForm action={row.moveAction} sections={choices} typeName={row.label} />}
      </div>
      {asking && (
        <ActionSheet title={t('sec.type.deleteAsk', { name: row.label })} onClose={() => setAsking(false)}>
          {f.items > 0 ? (
            <p role="alert" className={errorBox}>
              {t('sec.err.hasItems', { name: row.label, n: f.items })}
            </p>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('sec.type.deleteNote')}</p>
              {error && (
                <p role="alert" className={errorBox}>
                  {error}
                </p>
              )}
              <button type="button" data-testid="confirm-delete-category" disabled={busy} onClick={remove} className={sheetDanger}>
                <IconTrash className="h-5 w-5" />
                {busy ? t('common.saving') : t('col.deleteYes')}
              </button>
            </>
          )}
          <button type="button" onClick={() => setAsking(false)} className={sheetSecondary}>
            {t('common.cancel')}
          </button>
        </ActionSheet>
      )}
    </li>
  );
}

/**
 * Men / Women the shop lacks (ADR-064), on the Categories tiles too: the tap makes it (or
 * brings it back) and opens it. The tile's look comes from the page.
 */
export function StandInTile({ fixedKey, name, icon, className }: { fixedKey: string; name: string; icon: SectionIcon; className: string }) {
  const t = useT();
  const router = useRouter();
  const done = useDone();
  const [busy, startBusy] = useTransition();
  return (
    <>
      {done.node}
      <button
        type="button"
        data-testid="stand-in-tile"
        disabled={busy}
        onClick={() =>
          startBusy(async () => {
            const result = await openFixedCollectionAction(fixedKey);
            if (!result.ok) return done.show({ kind: 'error', title: t('done.notSaved'), detail: result.error });
            router.push(`/admin/categories?s=${result.section.id}`);
          })
        }
        className={className}
      >
        <SectionArt icon={icon} className="h-7 w-7" />
        <span className="flex flex-col items-start leading-tight">
          <span>{name}</span>
          <span className="text-[11px] font-medium opacity-75">{t('sec.n.products.other', { n: 0 })}</span>
        </span>
      </button>
    </>
  );
}
