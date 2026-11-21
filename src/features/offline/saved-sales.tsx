'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IconClock, IconRetry, IconUpload } from '@/components/ui/icons';
import { sheetDanger, sheetPrimary, sheetSecondary } from '@/components/ui/selection';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { formatWhen, plural } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { removeQueued } from '@/offline/outbox';
import { syncNow } from '@/offline/sync';
import type { QueuedSale } from '@/offline/types';
import { useNeedsLogin, useOnline, useOutbox, useSending } from './hooks';

/**
 * Plan v18 — "Saved on this phone": every sale made without internet that has
 * not reached the shop yet, with Send now. A sale the shop refused shows the
 * reason, Try again and Remove (asked twice). Other people's sales on this
 * phone are only counted: they are sent when that person logs in here.
 */
export function SavedSales({ me }: { me: { id: string } }) {
  const t = useT();
  const online = useOnline();
  const busy = useSending();
  const login = useNeedsLogin();
  const outbox = useOutbox();
  const mine = outbox.filter((s) => s.recordedBy === me.id);
  const waiting = mine.filter((s) => s.state === 'waiting').length;
  const others = new Map<string, number>();
  for (const s of outbox) if (s.recordedBy !== me.id) others.set(s.recordedByName, (others.get(s.recordedByName) ?? 0) + 1);

  return (
    <div data-testid="saved-sales" className="flex flex-col gap-3">
      {mine.length === 0 ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{t('off.list.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mine.map((sale) => (
            <SavedRow key={sale.operationId} sale={sale} meId={me.id} online={online} />
          ))}
        </ul>
      )}
      {mine.length > 0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('off.list.autoSend')}</p>}
      {[...others].map(([name, n]) => (
        <p key={name} className="text-sm text-zinc-600 dark:text-zinc-400">
          {plural(t, 'off.list.others', n, { name })}
        </p>
      ))}
      {login && (
        <Link href="/login" className={sheetPrimary}>
          {t('off.list.logIn')}
        </Link>
      )}
      {waiting > 0 && !login && (
        <button type="button" data-testid="send-now" disabled={!online || busy} onClick={() => void syncNow(me.id)} className={sheetPrimary}>
          <IconUpload className={`h-5 w-5 ${busy ? 'animate-pulse' : ''}`} />
          {busy ? t('off.list.sending') : online ? t('off.list.sendNow') : t('off.list.noInternet')}
        </button>
      )}
    </div>
  );
}

function SavedRow({ sale, meId, online }: { sale: QueuedSale; meId: string; online: boolean }) {
  const t = useT();
  const locale = useLocale();
  const [asking, setAsking] = useState(false);
  const detail = [sale.size, sale.color].filter(Boolean).join(' · ');
  const problem = sale.state === 'problem';
  return (
    <li
      data-testid="saved-sale"
      data-state={sale.state}
      className={`rounded-2xl border p-3 ${problem ? 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/40' : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {sale.name}
            {detail && <span className="font-normal text-zinc-500 dark:text-zinc-400"> · {detail}</span>}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {t('off.row.line', { qty: sale.quantity, price: formatPaise(sale.unitPricePaise), name: sale.soldByName })}
            {sale.manual && <span className="ml-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold dark:bg-zinc-800">{t('off.row.byHand')}</span>}
          </p>
        </div>
        <p className="shrink-0 text-base font-bold tabular-nums">{formatPaise(sale.totalPaise ?? sale.quantity * sale.unitPricePaise)}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
          <IconClock className="h-3.5 w-3.5" />
          {t('off.row.made', { time: formatWhen(locale, sale.madeAt) })}
        </span>
        {problem ? (
          <span className="font-semibold text-red-700 dark:text-red-300">
            {sale.problem ? t('off.row.problem', { reason: sale.problem }) : t('off.row.problemPlain')}
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{t('off.row.waiting')}</span>
        )}
      </div>
      {problem && !asking && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!online}
            onClick={() => void syncNow(meId, { retryProblems: true, only: sale.operationId })}
            className={`${sheetSecondary} min-h-10 gap-1.5 text-sm`}
          >
            <IconRetry className="h-4 w-4" />
            {t('off.row.tryAgain')}
          </button>
          <button type="button" onClick={() => setAsking(true)} className={`${sheetSecondary} min-h-10 text-sm text-red-700 dark:text-red-300`}>
            {t('off.row.remove')}
          </button>
        </div>
      )}
      {asking && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{t('off.row.removeConfirm')}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAsking(false)} className={`${sheetSecondary} min-h-10 text-sm`}>
              {t('common.cancel')}
            </button>
            <button type="button" onClick={() => void removeQueued(sale.operationId)} className={`${sheetDanger} min-h-10 text-sm`}>
              {t('off.row.removeYes')}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
