'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevron, IconTick, IconUpload, IconWifiOff } from '@/components/ui/icons';
import { ActionSheet, sheetSecondary } from '@/components/ui/selection';
import { useT } from '@/features/i18n/i18n-provider';
import { plural } from '@/lib/i18n';
import { refreshCatalogue } from '@/offline/catalogue';
import { startOfflineHelper } from '@/offline/helper';
import { lastSent, syncNow } from '@/offline/sync';
import { useNeedsLogin, useOnline, useOutbox, useSending } from './hooks';
import { SavedSales } from './saved-sales';

/** The phone's copy of the counter is refreshed when older than this (while online). */
const COPY_MAX_AGE_MS = 5 * 60_000;
/** Waiting sales are tried again this often while online. */
const RESEND_MS = 30_000;

/**
 * Plan v18 — lives in the header on every screen. Keeps the counter ready for
 * no internet (offline helper + the phone's copy of the items), sends sales
 * saved on the phone as soon as the shop can be reached, and says so: a strip
 * under the shop's name while offline or while sales wait (tap = the list),
 * and a short message when they reached the shop.
 */
export function OfflineStrip({ me }: { me: { id: string; name: string } }) {
  const t = useT();
  const pathname = usePathname();
  const online = useOnline();
  const busy = useSending();
  const login = useNeedsLogin();
  const outbox = useOutbox();
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);
  const [toast, setToast] = useState<{ n: number; at: number } | null>(null);
  const mine = outbox.filter((s) => s.recordedBy === me.id);
  const waiting = mine.filter((s) => s.state === 'waiting').length;
  const problems = mine.length - waiting;
  // A new screen closes the list (the header stays mounted across screens).
  if (open && pathname !== openedOn) setOpen(false);

  useEffect(() => {
    void startOfflineHelper();
  }, []);

  useEffect(() => {
    if (!online) return;
    void refreshCatalogue(me.id, { maxAgeMs: COPY_MAX_AGE_MS });
    const timer = setInterval(() => void refreshCatalogue(me.id, { maxAgeMs: COPY_MAX_AGE_MS }), COPY_MAX_AGE_MS * 2);
    return () => clearInterval(timer);
  }, [online, me.id]);

  useEffect(() => {
    if (!online || waiting === 0) return;
    void syncNow(me.id);
    const timer = setInterval(() => void syncNow(me.id), RESEND_MS);
    return () => clearInterval(timer);
  }, [online, waiting, me.id]);

  // Sales reached the shop: say so for a moment, and fetch fresh stock counts.
  useEffect(
    () =>
      lastSent.subscribe(() => {
        const sent = lastSent.get();
        if (!sent) return;
        setToast(sent);
        void refreshCatalogue(me.id);
      }),
    [me.id],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const show = !online || mine.length > 0;
  let tone = 'bg-white/15 text-white ring-white/25';
  let icon = <IconUpload className={`h-5 w-5 shrink-0 ${busy ? 'animate-pulse' : ''}`} />;
  let text = '';
  if (!online) {
    tone = 'bg-amber-300 text-amber-950 ring-amber-200';
    icon = <IconWifiOff className="h-5 w-5 shrink-0" />;
    text = mine.length > 0 ? plural(t, 'off.strip.offlineSaved', mine.length) : t('off.strip.offline');
  } else if (login && mine.length > 0) {
    tone = 'bg-amber-300 text-amber-950 ring-amber-200';
    text = plural(t, 'off.strip.login', mine.length);
  } else if (busy && waiting > 0) {
    text = t('off.strip.sending');
  } else if (waiting > 0) {
    text = plural(t, 'off.strip.waiting', waiting);
  } else if (problems > 0) {
    tone = 'bg-red-500 text-white ring-red-300';
    text = plural(t, 'off.strip.problem', problems);
  }

  return (
    <>
      {show && text && (
        <button
          type="button"
          data-testid="offline-strip"
          data-online={online ? 'yes' : 'no'}
          aria-label={`${text}. ${t('off.strip.open')}`}
          onClick={() => {
            setOpenedOn(pathname);
            setOpen(true);
          }}
          className={`rise-in flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3.5 py-2 text-left text-sm font-semibold ring-1 transition active:scale-[0.99] ${tone}`}
        >
          {icon}
          <span className="min-w-0 flex-1">{text}</span>
          {mine.length > 0 && (
            <span data-testid="offline-count" className="rounded-full bg-black/15 px-2 py-0.5 text-xs font-bold tabular-nums">
              {mine.length}
            </span>
          )}
          <IconChevron className="h-4 w-4 shrink-0 opacity-80" />
        </button>
      )}
      {open && (
        <ActionSheet title={t('off.list.title')} onClose={() => setOpen(false)}>
          <SavedSales me={me} />
          <button type="button" onClick={() => setOpen(false)} className={sheetSecondary}>
            {t('off.list.close')}
          </button>
        </ActionSheet>
      )}
      {toast &&
        createPortal(
          <div
            role="status"
            data-testid="offline-sent"
            className="sel-toast pointer-events-none fixed inset-x-4 bottom-28 z-[70] mx-auto flex max-w-sm items-center gap-2.5 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl sm:bottom-8"
          >
            <IconTick className="h-5 w-5 shrink-0" />
            {plural(t, 'off.sent', toast.n)}
          </div>,
          document.body,
        )}
    </>
  );
}
