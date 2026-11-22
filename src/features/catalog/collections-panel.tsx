'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { IconLock, IconTrash } from '@/components/ui/icons';
import { ActionSheet, sheetDanger, sheetSecondary } from '@/components/ui/selection';
import { card, errorBox, input, link, muted, okBox } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { deleteCollectionAction, renameCollectionAction } from '@/server/actions/admin';
import type { CollectionRow } from '@/server/services/sections';

/**
 * Home → Collections (owner, 2026-11-22, ADR-051): each collection (Men, Women, …)
 * with its items and pieces, its name to edit in place, and Delete — only once it
 * has no items (every item must have a collection). Men and Women are fixed (ADR-064):
 * always listed, with a lock instead of the name box and Delete.
 */
export function CollectionsPanel({ rows }: { rows: CollectionRow[] }) {
  const t = useT();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section data-testid="home-collections" className={`${card} rise-in flex flex-col gap-2 py-3`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t('col.title')}</h2>
        <Link href="/admin/categories" className={`text-sm ${link}`}>
          {t('col.categories')}
        </Link>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <Row key={row.id} row={row} onMessage={setMessage} />
        ))}
      </ul>
      {message && (
        <p role="status" className={message.ok ? okBox : errorBox}>
          {message.text}
        </p>
      )}
      <p className={`text-xs ${muted}`}>{t('col.keepNote')}</p>
    </section>
  );
}

function Row({ row, onMessage }: { row: CollectionRow; onMessage: (m: { ok: boolean; text: string } | null) => void }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState(row.name);
  const [confirm, setConfirm] = useState(false);
  const [busy, startBusy] = useTransition();
  const changed = !row.fixed && name.trim() !== row.name && name.trim().length > 0;
  const save = () =>
    startBusy(async () => {
      const result = await renameCollectionAction(row.id, name);
      if (!result.ok) return onMessage({ ok: false, text: result.error });
      setName(result.name);
      onMessage({ ok: true, text: t('col.saved') });
      router.refresh();
    });
  const remove = () =>
    startBusy(async () => {
      const result = await deleteCollectionAction(row.id);
      setConfirm(false);
      onMessage(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  return (
    <li data-testid="collection-row" data-fixed={row.fixed ?? undefined} className="flex items-center gap-2 rounded-xl bg-zinc-50 py-1.5 pr-1.5 pl-2 dark:bg-zinc-900">
      {row.fixed ? (
        <span className="flex h-9 min-w-0 flex-1 items-center gap-1.5 px-2 text-sm font-semibold">
          <span className="truncate">{row.name}</span>
          <span title={t('sec.fixed')} className="shrink-0 text-zinc-400">
            <IconLock className="h-3.5 w-3.5" />
          </span>
        </span>
      ) : (
      <form
        className="flex min-w-0 flex-1 items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) save();
        }}
      >
        <input
          aria-label={t('col.nameOf', { name: row.name })}
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          className={`${input} h-9 min-w-0 flex-1 py-1 text-sm font-semibold`}
        />
        {changed && (
          <button type="submit" disabled={busy} className="h-9 shrink-0 rounded-xl bg-brand-600 px-3 text-sm font-bold text-white active:scale-95 disabled:opacity-50">
            {t('col.save')}
          </button>
        )}
      </form>
      )}
      <span data-testid="collection-count" className={`w-[6.5rem] shrink-0 text-right text-xs tabular-nums ${muted}`}>
        {t('col.line', { items: row.items, pcs: row.pieces })}
        {!row.active && ` · ${t('col.hidden')}`}
      </span>
      {(row.fixed || row.items > 0) && <span aria-hidden className="w-9 shrink-0" />}
      {!row.fixed && row.items === 0 && (
        <button
          type="button"
          aria-label={t('col.delete', { name: row.name })}
          onClick={() => setConfirm(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        >
          <IconTrash className="h-4 w-4" />
        </button>
      )}
      {confirm && (
        <ActionSheet title={t('col.deleteAsk', { name: row.name })} onClose={() => setConfirm(false)}>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('col.deleteNote')}</p>
          <button type="button" data-testid="confirm-delete-collection" disabled={busy} onClick={remove} className={sheetDanger}>
            <IconTrash className="h-5 w-5" />
            {busy ? t('common.saving') : t('col.deleteYes')}
          </button>
          <button type="button" onClick={() => setConfirm(false)} className={sheetSecondary}>
            {t('common.cancel')}
          </button>
        </ActionSheet>
      )}
    </li>
  );
}
