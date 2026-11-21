'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ActionSheet, sheetDanger, sheetSecondary } from '@/components/ui/selection';
import { card, errorBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { useDone } from '@/features/feedback/effects';
import { useT } from '@/features/i18n/i18n-provider';
import { formatPaise } from '@/lib/money';
import { deleteBillAction, setBillCollectionsAction } from '@/server/actions/bills';
import type { Collection } from '@/server/services/bills';
import { CompanyCollections } from './bill-form';

/** "Take off" one collection from a bill (it goes back to the waiting list). */
export function RemoveCollection({ billId, receiptId, name }: { billId: string; receiptId: string; name: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={t('bills.removeOne', { name })}
      onClick={() =>
        start(async () => {
          const result = await setBillCollectionsAction(billId, { remove: [receiptId] });
          if (result.ok) router.refresh();
        })
      }
      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 active:scale-95 disabled:opacity-50 dark:text-red-300 dark:ring-red-900"
    >
      {t('bills.remove')}
    </button>
  );
}

/** "+ Add collections": each of the bill's companies' collections waiting for a bill, ticked and added at once; the amount follows. */
export function AddCollections({ billId, collections, companies }: { billId: string; collections: Collection[]; companies: { id: string; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const done = useDone();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const chosen = collections.filter((c) => picked.includes(c.receiptId));
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${secondaryButton} self-start text-sm`}>
        {t('bills.addCollections')}
      </button>
    );
  return (
    <div data-testid="add-collections" className={`${card} flex flex-col gap-3`}>
      {done.node}
      {companies.map((c) => (
        <CompanyCollections key={c.id} id={c.id} name={c.name} list={collections.filter((x) => x.supplierId === c.id)} picked={picked} onChange={setPicked} />
      ))}
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || picked.length === 0}
          onClick={() =>
            start(async () => {
              const result = await setBillCollectionsAction(billId, { add: picked });
              if (!result.ok) return setError(result.error);
              done.show({ title: t('bills.saved'), detail: t('bills.picked', { n: chosen.length, pcs: chosen.reduce((n, c) => n + c.pieces, 0), value: formatPaise(chosen.reduce((n, c) => n + c.valuePaise, 0)) }) });
              setPicked([]);
              setOpen(false);
              router.refresh();
            })
          }
          className={`${primaryButton} flex-1`}
        >
          {busy ? t('common.saving') : t('bills.addPicked', { n: picked.length })}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

/** Delete bill, after a confirmation (refused when payments name it). */
export function DeleteBill({ billId }: { billId: string }) {
  const t = useT();
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => setAsk(true)} className="self-start text-sm font-semibold text-red-700 dark:text-red-300">
        {t('bills.delete')}
      </button>
      {ask && (
        <ActionSheet title={t('bills.deleteAsk')} onClose={() => setAsk(false)}>
          {error && (
            <p role="alert" className={errorBox}>
              {error}
            </p>
          )}
          <button
            type="button"
            data-testid="confirm-delete-bill"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const result = await deleteBillAction(billId);
                if (!result.ok) return setError(result.error);
                router.push('/admin/bills');
              })
            }
            className={sheetDanger}
          >
            {busy ? t('common.saving') : t('bills.deleteYes')}
          </button>
          <button type="button" onClick={() => setAsk(false)} className={sheetSecondary}>
            {t('common.cancel')}
          </button>
        </ActionSheet>
      )}
    </>
  );
}
