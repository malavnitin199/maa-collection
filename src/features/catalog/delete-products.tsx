'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { IconTrash } from '@/components/ui/icons';
import { ActionSheet, sheetDanger, sheetSecondary } from '@/components/ui/selection';
import { useT } from '@/features/i18n/i18n-provider';
import { deleteProductsAction } from '@/server/actions/admin';

/**
 * The confirmation before items are deleted for good (owner, 2026-11-22, ADR-050):
 * what goes and what stays, then a red "Yes, delete". `designIds` (2+) adds
 * "Delete all N sizes of this design" on the product page.
 */
export function DeleteProductsSheet({
  ids,
  designIds = [],
  onClose,
  onDone,
}: {
  ids: string[];
  designIds?: string[];
  onClose: () => void;
  onDone: (result: { ok: boolean; deleted: number; message: string }) => void;
}) {
  const t = useT();
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const n = ids.length;
  const remove = (list: string[]) =>
    startBusy(async () => {
      setError(null);
      const result = await deleteProductsAction(list);
      if (!result.ok) return setError(result.error);
      onDone({ ok: result.deleted > 0, deleted: result.deleted, message: result.message });
    });
  return (
    <ActionSheet title={t(n === 1 ? 'prod.deleteAsk.one' : 'prod.deleteAsk.other', { n })} onClose={onClose}>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('prod.deleteNote')}</p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      <button type="button" data-testid="confirm-delete-items" disabled={busy} onClick={() => remove(ids)} className={sheetDanger}>
        <IconTrash className="h-5 w-5" />
        {busy ? t('common.saving') : t(n === 1 ? 'prod.deleteYes.one' : 'prod.deleteYes.other', { n })}
      </button>
      {designIds.length > 1 && (
        <button type="button" data-testid="confirm-delete-design" disabled={busy} onClick={() => remove(designIds)} className={sheetDanger}>
          <IconTrash className="h-5 w-5" />
          {t('prod.deleteDesign', { n: designIds.length })}
        </button>
      )}
      <button type="button" onClick={onClose} className={sheetSecondary}>
        {t('common.cancel')}
      </button>
    </ActionSheet>
  );
}

/** Product page (owner only): Delete this item → the confirmation → back to Products with the result. */
export function DeleteItemButton({ id, designIds }: { id: string; designIds: string[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="delete-item"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 active:scale-[0.98] dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
      >
        <IconTrash className="h-4 w-4" />
        {t('prod.deleteThis')}
      </button>
      {open && (
        <DeleteProductsSheet
          ids={[id]}
          designIds={designIds}
          onClose={() => setOpen(false)}
          onDone={(result) => {
            setOpen(false);
            router.replace(`/admin/products?${new URLSearchParams({ deleted: result.message })}`);
          }}
        />
      )}
    </>
  );
}
