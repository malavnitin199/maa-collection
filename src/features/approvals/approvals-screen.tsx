'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AllDoneArt } from '@/components/ui/art';
import { card, errorBox, input, muted, okBox, primaryButton, secondaryButton } from '@/components/ui/styles';
import { useLocale, useT } from '@/features/i18n/i18n-provider';
import { formatDate, type MessageKey } from '@/lib/i18n';
import { formatPaise } from '@/lib/money';
import { approveAllAction, approveExchangeAction, approveSaleAction, rejectExchangeAction, rejectSaleAction } from '@/server/actions/approvals';
import { REJECT_REASONS, type ApprovalDay, type PendingEntry, type RejectReason } from '@/server/services/approvals';

const dangerButton =
  'inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 font-semibold text-white shadow-md shadow-red-700/25 transition hover:bg-red-700 active:scale-[0.97] disabled:opacity-50';
const chip = 'mr-1 rounded px-1.5 py-0.5 text-xs font-medium';

const REASON_KEY: Record<RejectReason, MessageKey> = {
  wrong_price: 'appr.reason.wrong_price',
  wrong_item: 'appr.reason.wrong_item',
  duplicate: 'appr.reason.duplicate',
  not_sold: 'appr.reason.not_sold',
  other: 'appr.reason.other',
};

type Message = { kind: 'ok' | 'error'; text: string };

/**
 * The owner's queue (plan v12): everything the counter recorded that he has not
 * looked at yet, grouped by shop day. One tap approves; Reject asks for a reason.
 * Every decision is final and made once — the server ignores a second tap.
 */
export function ApprovalsScreen({ days, total }: { days: ApprovalDay[]; total: number }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);
  const [rejecting, setRejecting] = useState<{ kind: 'sale' | 'exchange'; id: string } | null>(null);
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [note, setNote] = useState('');

  function finish(result: { ok: true; data: { changed: boolean; status: string; stockReturned?: number } } | { ok: false; error: string }) {
    if (!result.ok) return setMessage({ kind: 'error', text: result.error });
    if (!result.data.changed) return setMessage({ kind: 'ok', text: t('appr.done.already') });
    if (result.data.status === 'approved') setMessage({ kind: 'ok', text: t('appr.done.approved') });
    else setMessage({ kind: 'ok', text: result.data.stockReturned ? t('appr.done.rejectedStock', { n: result.data.stockReturned }) : t('appr.done.rejected') });
    setRejecting(null);
    setReason(null);
    setNote('');
  }

  const approve = (entry: PendingEntry) =>
    startTransition(async () => {
      finish(await (entry.kind === 'sale' ? approveSaleAction(entry.id) : approveExchangeAction(entry.id)));
      router.refresh();
    });

  const reject = (entry: PendingEntry) => {
    if (!reason) return setMessage({ kind: 'error', text: t('appr.err.reason') });
    startTransition(async () => {
      const input = { id: entry.id, reason, note: note.trim() || undefined };
      finish(await (entry.kind === 'sale' ? rejectSaleAction(input) : rejectExchangeAction(input)));
      router.refresh();
    });
  };

  const approveMany = (day?: string) =>
    startTransition(async () => {
      const result = await approveAllAction({ batchId: crypto.randomUUID(), day });
      if (!result.ok) setMessage({ kind: 'error', text: result.error });
      else setMessage({ kind: 'ok', text: result.data.total ? t('appr.done.all', { n: result.data.total }) : t('appr.done.none') });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      {message && (
        <p role="status" className={message.kind === 'ok' ? okBox : errorBox}>
          {message.text}
        </p>
      )}
      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <AllDoneArt className="art-tap h-24 w-24 text-brand-600 dark:text-brand-300" />
          <p data-testid="approvals-empty" className={`text-sm ${muted}`}>
            {t('appr.none')}
          </p>
        </div>
      ) : (
        total > 1 && (
          <button type="button" data-testid="approve-all" disabled={busy} onClick={() => approveMany()} className={`${secondaryButton} w-fit`}>
            {t('appr.approveAll', { n: total })}
          </button>
        )
      )}

      {days.map((day) => (
        <section key={day.day} data-testid="approval-day" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg">
              {formatDate(locale, `${day.day}T00:00:00Z`, 'date')}{' '}
              <span className={`text-sm font-normal ${muted}`}>{t('appr.day.total', { n: day.entries.length, amount: formatPaise(day.totalPaise) })}</span>
            </h2>
            {day.entries.length > 1 && (
              <button type="button" disabled={busy} onClick={() => approveMany(day.day)} className={`${secondaryButton} text-sm`}>
                {t('appr.approveDay')}
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {day.entries.map((entry) => {
              const unit = entry.quantity > 0 ? Math.round(entry.amountPaise / entry.quantity) : entry.amountPaise;
              const cut = entry.kind === 'sale' && entry.mrpPaise && unit < entry.mrpPaise ? Math.round((1 - unit / entry.mrpPaise) * 100) : 0;
              const open = rejecting?.kind === entry.kind && rejecting.id === entry.id;
              return (
                <li key={`${entry.kind}-${entry.id}`} data-testid="approval-entry" className={`${card} flex flex-col gap-2`}>
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0">
                      {entry.kind === 'exchange' && <span className={`${chip} bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200`}>{t('appr.exchange')}</span>}
                      {entry.manual && <span className={`${chip} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>{t('appr.byHand')}</span>}
                      <span className="font-semibold">
                        {entry.quantity} × {entry.title}
                      </span>
                      {entry.detail && <span className={`ml-1 text-sm ${muted}`}>{entry.detail}</span>}
                      {entry.swap && (
                        <span className={`block text-sm ${muted}`}>
                          {t('appr.returned', { returned: entry.swap.returned, issued: entry.swap.issued })} · {t(entry.swap.hasBill ? 'appr.hasBill' : 'appr.noBill')}
                        </span>
                      )}
                      <span className={`block text-sm ${muted}`}>
                        {entry.kind === 'sale' && t('appr.each', { price: formatPaise(unit) })}
                        {entry.kind === 'sale' && ' · '}
                        {entry.kind === 'sale' && (entry.mrpPaise ? (entry.listPricePaise ? t('appr.mrp', { mrp: formatPaise(entry.mrpPaise), price: formatPaise(entry.listPricePaise) }) : t('appr.mrpOnly', { mrp: formatPaise(entry.mrpPaise) })) : t('appr.noMrp'))}
                        {cut > 0 && <span className="ml-1 font-medium text-amber-700 dark:text-amber-300">{t('appr.cutPrice', { pct: cut })}</span>}
                      </span>
                      {entry.note && <span className="block text-sm italic">{entry.note}</span>}
                      <span className={`block text-xs ${muted}`}>
                        {formatDate(locale, entry.at, 'dateTime')} · {t('appr.soldBy', { name: entry.soldBy })}
                        {entry.recordedBy !== entry.soldBy && ` · ${t('appr.recordedBy', { name: entry.recordedBy })}`}
                      </span>
                    </div>
                    <span className="font-display text-xl tabular-nums">{formatPaise(entry.amountPaise)}</span>
                  </div>

                  {open ? (
                    <div className="flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                      <p className="text-sm font-medium text-red-900 dark:text-red-200">{t('appr.reject.title')}</p>
                      <div role="radiogroup" aria-label={t('appr.reject.reason')} className="flex flex-wrap gap-2">
                        {REJECT_REASONS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            role="radio"
                            aria-checked={reason === r}
                            onClick={() => setReason(r)}
                            className={`rounded-full border px-3 py-1 text-sm ${reason === r ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}
                          >
                            {t(REASON_KEY[r])}
                          </button>
                        ))}
                      </div>
                      <label className="flex flex-col gap-1 text-sm font-medium">
                        {t('appr.reject.note')}
                        <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={input} />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={busy} onClick={() => reject(entry)} className={dangerButton}>
                          {t('appr.reject.confirm')}
                        </button>
                        <button type="button" onClick={() => setRejecting(null)} className={secondaryButton}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button type="button" disabled={busy} onClick={() => { setRejecting({ kind: entry.kind, id: entry.id }); setReason(null); setNote(''); }} className={secondaryButton}>
                        {t('appr.reject')}
                      </button>
                      <button type="button" disabled={busy} onClick={() => approve(entry)} className={primaryButton}>
                        {t('appr.approve')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
