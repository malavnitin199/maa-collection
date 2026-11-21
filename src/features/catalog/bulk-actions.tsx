'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { IconPrint, IconTrash } from '@/components/ui/icons';
import { ActionGrid, ActionSheet, ActionTile, sheetDanger, sheetSecondary, useSelection } from '@/components/ui/selection';
import { DeleteProductsSheet } from '@/features/catalog/delete-products';
import { useT } from '@/features/i18n/i18n-provider';
import { PRINT_MAX } from '@/lib/selection-limits';
import { deleteCompaniesAction } from '@/server/actions/admin';

/**
 * Products → Select (owner only, ADR-057): the one action is Delete — the chosen items go
 * for good after a confirmation (ADR-050). Name, prices, company, category, For / Age and
 * hiding are changed one item at a time (✎ Edit on its page).
 */
export function ProductDeleteAction() {
  const t = useT();
  const router = useRouter();
  const { selected, clear, notify } = useSelection();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <ActionGrid>
        <ActionTile icon={<IconTrash />} label={t('prod.delete')} tone="danger" disabled={selected.length === 0} onClick={() => setConfirm(true)} />
      </ActionGrid>
      {confirm && (
        <DeleteProductsSheet
          ids={selected}
          onClose={() => setConfirm(false)}
          onDone={(result) => {
            setConfirm(false);
            notify(result.ok ? 'ok' : 'error', result.message);
            clear();
            router.refresh();
          }}
        />
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

/** The confirmation before companies are deleted (ADR-051): what stays, what goes, then a red "Yes, delete". */
function DeleteCompaniesSheet({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: (result: { ok: boolean; message: string }) => void }) {
  const t = useT();
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const n = ids.length;
  const remove = () =>
    startBusy(async () => {
      setError(null);
      const result = await deleteCompaniesAction(ids);
      if (!result.ok) return setError(result.error);
      onDone({ ok: result.deleted > 0, message: result.message });
    });
  return (
    <ActionSheet title={t(n === 1 ? 'bulk.deleteAsk.one' : 'bulk.deleteAsk.other', { n })} onClose={onClose}>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('bulk.deleteNote')}</p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      <button type="button" data-testid="confirm-delete" disabled={busy} onClick={remove} className={sheetDanger}>
        <IconTrash className="h-5 w-5" />
        {busy ? t('common.saving') : t(n === 1 ? 'bulk.deleteYes.one' : 'bulk.deleteYes.other', { n })}
      </button>
      <button type="button" onClick={onClose} className={sheetSecondary}>
        {t('common.cancel')}
      </button>
    </ActionSheet>
  );
}

/**
 * Companies → Select → Delete (Catalog right, ADR-051), after a confirmation: any company;
 * its items and stock entries stay with no company.
 */
export function CompanyBulkActions() {
  const t = useT();
  const router = useRouter();
  const { selected, clear, notify } = useSelection();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <ActionGrid>
        <ActionTile icon={<IconTrash />} label={t('bulk.delete')} tone="danger" disabled={selected.length === 0} onClick={() => setConfirm(true)} wide />
      </ActionGrid>
      {confirm && (
        <DeleteCompaniesSheet
          ids={selected}
          onClose={() => setConfirm(false)}
          onDone={(result) => {
            setConfirm(false);
            notify(result.ok ? 'ok' : 'error', result.message);
            clear();
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/** A company's page (Catalog right): Delete this company → the confirmation → back to Companies with the result. */
export function DeleteCompanyButton({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="delete-company"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 active:scale-[0.98] dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
      >
        <IconTrash className="h-4 w-4" />
        {t('bulk.deleteThis')}
      </button>
      {open && (
        <DeleteCompaniesSheet
          ids={[id]}
          onClose={() => setOpen(false)}
          onDone={(result) => {
            setOpen(false);
            router.replace(`/admin/companies?${new URLSearchParams({ deleted: result.message })}`);
          }}
        />
      )}
    </>
  );
}
