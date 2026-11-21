'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { IconBuilding, IconEye, IconEyeOff, IconLayers, IconPeople, IconPriceTag, IconPrint, IconRename, IconTrash } from '@/components/ui/icons';
import { ActionGrid, ActionSheet, ActionTile, sheetDanger, sheetPrimary, sheetSecondary, useSelection } from '@/components/ui/selection';
import { input } from '@/components/ui/styles';
import { TagChooser } from '@/features/catalog/item-parts';
import { useT } from '@/features/i18n/i18n-provider';
import type { MessageKey } from '@/lib/i18n';
import type { ProductTags } from '@/lib/product-tags';
import { PRINT_MAX } from '@/lib/selection-limits';
import { bulkProductsAction, deleteCompaniesAction, type BulkProductInput } from '@/server/actions/admin';

type Option = { id: string; name: string };
type Sheet = 'hide' | 'rename' | 'company' | 'category' | 'tags' | 'prices';

const fieldLabel = 'flex flex-col gap-1.5 text-sm font-semibold';

/**
 * Products → Select (plan v17): what can be done to the chosen items. Each tile
 * opens a bottom sheet; Apply changes them all at once and a short message says so.
 */
export function ProductBulkActions({
  companies,
  categories,
  canCatalog,
  canPrices,
  canPrint,
  hiddenView,
}: {
  companies: Option[];
  categories: (Option & { code: string })[];
  /** Hide / bring back / rename / company / category / tags need the Catalog right. */
  canCatalog: boolean;
  canPrices: boolean;
  canPrint: boolean;
  /** Showing hidden items: the action is Bring back. */
  hiddenView: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { selected, clear, notify } = useSelection();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [name, setName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState<ProductTags>({ forGender: null, ageGroup: null });
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const n = selected.length;
  const none = n === 0;

  const run = (change: BulkProductInput) =>
    startBusy(async () => {
      setError(null);
      const result = await bulkProductsAction(selected, change);
      if (!result.ok) {
        // In a sheet: show it there; otherwise as a message.
        if (sheet) return setError(result.error);
        return notify('error', result.error);
      }
      setSheet(null);
      notify('ok', result.message);
      clear();
      router.refresh();
    });
  const open = (next: Sheet) => {
    setError(null);
    setSheet(next);
  };
  const close = () => setSheet(null);
  const title = (action: MessageKey) => t('bulk.sheet', { action: t(action), n });

  const tiles: { id: Sheet; label: MessageKey; icon: React.ReactNode; show: boolean }[] = [
    { id: 'rename', label: 'bulk.rename', icon: <IconRename />, show: !hiddenView && canCatalog },
    { id: 'company', label: 'bulk.company', icon: <IconBuilding />, show: !hiddenView && canCatalog },
    { id: 'category', label: 'bulk.category', icon: <IconLayers />, show: !hiddenView && canCatalog },
    { id: 'tags', label: 'bulk.tags', icon: <IconPeople />, show: !hiddenView && canCatalog },
    { id: 'prices', label: 'bulk.prices', icon: <IconPriceTag />, show: !hiddenView && canPrices },
  ];

  const apply = (
    <button type="submit" disabled={busy} className={sheetPrimary}>
      {busy ? t('common.saving') : t('bulk.apply')}
    </button>
  );
  const cancel = (
    <button type="button" onClick={close} className={sheetSecondary}>
      {t('cat.company.cancel')}
    </button>
  );
  const problem = error && (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
      {error}
    </p>
  );

  return (
    <>
      <ActionGrid>
        {canCatalog &&
          (hiddenView ? (
            <ActionTile icon={<IconEye />} label={t('bulk.bringBack')} disabled={none || busy} onClick={() => run({ kind: 'show' })} wide />
          ) : (
            <ActionTile icon={<IconEyeOff />} label={t('bulk.hide')} tone="danger" disabled={none || busy} onClick={() => open('hide')} />
          ))}
        {tiles
          .filter((tile) => tile.show)
          .map((tile) => (
            <ActionTile key={tile.id} icon={tile.icon} label={t(tile.label)} disabled={none || busy} onClick={() => open(tile.id)} />
          ))}
        {canPrint && !hiddenView && (
          <ActionTile
            icon={<IconPrint />}
            label={t('bulk.print')}
            disabled={none || busy}
            onClick={() => {
              if (n > PRINT_MAX) return notify('error', t('bulk.printMax', { n: PRINT_MAX }));
              router.push(`/admin/labels/print?${new URLSearchParams({ items: selected.join(',') })}`);
            }}
          />
        )}
      </ActionGrid>

      {sheet === 'hide' && (
        <ActionSheet title={title('bulk.hide')} onClose={close}>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('bulk.hideConfirm', { n })}</p>
          {problem}
          <button type="button" disabled={busy} onClick={() => run({ kind: 'hide' })} className={sheetDanger}>
            <IconEyeOff className="h-5 w-5" />
            {t('bulk.hideYes', { n })}
          </button>
          {cancel}
        </ActionSheet>
      )}
      {sheet === 'rename' && (
        <ActionSheet title={title('bulk.rename')} onClose={close}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run({ kind: 'rename', name });
            }}
          >
            <label className={fieldLabel}>
              {t('bulk.newName')}
              <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={`${input} text-lg`} />
            </label>
            {problem}
            {apply}
            {cancel}
          </form>
        </ActionSheet>
      )}
      {sheet === 'company' && (
        <ActionSheet title={title('bulk.company')} onClose={close}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run({ kind: 'company', supplierId });
            }}
          >
            <label className={fieldLabel}>
              {t('bulk.company')}
              <select autoFocus value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`${input} text-lg`}>
                <option value="">{t('cat.product.noCompany')}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {problem}
            {apply}
            {cancel}
          </form>
        </ActionSheet>
      )}
      {sheet === 'category' && (
        <ActionSheet title={title('bulk.category')} onClose={close}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run({ kind: 'category', categoryId });
            }}
          >
            <label className={fieldLabel}>
              {t('bulk.category')}
              <select required autoFocus value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${input} text-lg`}>
                <option value="">{t('stk.chooseCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </label>
            {problem}
            {apply}
            {cancel}
          </form>
        </ActionSheet>
      )}
      {sheet === 'tags' && (
        <ActionSheet title={title('bulk.tags')} onClose={close}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run({ kind: 'tags', forGender: tags.forGender ?? '', ageGroup: tags.ageGroup ?? '' });
            }}
          >
            <TagChooser value={tags} onChange={setTags} />
            {problem}
            {apply}
            {cancel}
          </form>
        </ActionSheet>
      )}
      {sheet === 'prices' && (
        <ActionSheet title={title('bulk.prices')} onClose={close}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run({ kind: 'prices', mrp, price });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className={fieldLabel}>
                {t('bulk.newMrp')}
                <input autoFocus inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} className={`${input} min-w-0 text-lg tabular-nums`} />
              </label>
              <label className={fieldLabel}>
                {t('bulk.newPrice')}
                <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} min-w-0 text-lg tabular-nums`} />
              </label>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('bulk.pricesHint')}</p>
            {problem}
            {apply}
            {cancel}
          </form>
        </ActionSheet>
      )}
    </>
  );
}

/** All tags → Select (plan v17): print just the chosen tags. */
export function PrintSelected() {
  const t = useT();
  const router = useRouter();
  const { selected, notify } = useSelection();
  return (
    <ActionGrid>
      <ActionTile
        icon={<IconPrint />}
        label={t('bulk.printN', { n: selected.length })}
        disabled={selected.length === 0}
        wide
        onClick={() => {
          if (selected.length > PRINT_MAX) return notify('error', t('bulk.printMax', { n: PRINT_MAX }));
          router.push(`/admin/labels/print?${new URLSearchParams({ items: selected.join(',') })}`);
        }}
      />
    </ActionGrid>
  );
}

/** Companies → Select (plan v17): hide the chosen companies (they move to "Previous companies") or bring them back. */
/**
 * Companies → Select (owner's feedback 2026-11-21): Delete only, after a confirmation.
 * Companies with items, bills or payments are kept (their history depends on them) and named in the message.
 */
export function CompanyBulkActions() {
  const t = useT();
  const router = useRouter();
  const { selected, clear, notify } = useSelection();
  const [busy, startBusy] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const n = selected.length;
  const remove = () =>
    startBusy(async () => {
      const result = await deleteCompaniesAction(selected);
      setConfirm(false);
      if (!result.ok) return notify('error', result.error);
      notify(result.deleted > 0 ? 'ok' : 'error', result.message);
      clear();
      router.refresh();
    });
  return (
    <>
      <ActionGrid>
        <ActionTile icon={<IconTrash />} label={t('bulk.delete')} tone="danger" disabled={n === 0 || busy} onClick={() => setConfirm(true)} wide />
      </ActionGrid>
      {confirm && (
        <ActionSheet title={t(n === 1 ? 'bulk.deleteAsk.one' : 'bulk.deleteAsk.other', { n })} onClose={() => setConfirm(false)}>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('bulk.deleteNote')}</p>
          <button type="button" data-testid="confirm-delete" disabled={busy} onClick={remove} className={sheetDanger}>
            <IconTrash className="h-5 w-5" />
            {busy ? t('common.saving') : t(n === 1 ? 'bulk.deleteYes.one' : 'bulk.deleteYes.other', { n })}
          </button>
          <button type="button" onClick={() => setConfirm(false)} className={sheetSecondary}>
            {t('common.cancel')}
          </button>
        </ActionSheet>
      )}
    </>
  );
}
