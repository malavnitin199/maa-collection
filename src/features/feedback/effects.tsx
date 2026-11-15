'use client';

import { useEffect } from 'react';
import { useT } from '@/features/i18n/i18n-provider';
import './feedback.css';

/** Green tick that pops with a ripple (remount it with a new `key` to play again). */
export function ScanTick() {
  const t = useT();
  return (
    <span data-testid="scan-ok" aria-hidden className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
      <span className="fb-ripple absolute inset-0 rounded-full bg-emerald-500/40" />
      <span className="fb-tick relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 shadow-lg" title={t('scan.ok')}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path className="fb-draw" style={{ '--fb-len': 22 } as React.CSSProperties} d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    </span>
  );
}

/**
 * "Sale done ✓" card, like a payment app: the tick draws itself, the card
 * rises, then it closes by itself (~1.6 s), on a tap, or on the next key press
 * (a hardware scanner starting the next sale).
 */
export function DoneOverlay({ title, amount, detail, onClose }: { title: string; amount?: string; detail?: string; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const timer = window.setTimeout(onClose, 1600);
    const onKey = () => onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div
      data-testid="done-overlay"
      aria-live="polite"
      onPointerDown={onClose}
      className="fb-backdrop fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-6 backdrop-blur-[2px]"
    >
      <div className="fb-card flex w-full max-w-xs flex-col items-center gap-2 rounded-3xl bg-white px-6 py-7 text-center shadow-2xl dark:bg-zinc-900">
        <span className="relative flex h-20 w-20 items-center justify-center">
          <span className="fb-ripple absolute inset-0 rounded-full bg-emerald-500/30" />
          <svg viewBox="0 0 80 80" className="relative h-20 w-20" aria-hidden>
            <circle cx="40" cy="40" r="36" fill="#059669" />
            <path className="fb-draw" style={{ '--fb-len': 60 } as React.CSSProperties} d="M24 41l11 11 22-24" fill="none" stroke="white" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-xl font-semibold">{title}</p>
        {amount && <p className="text-3xl font-bold">{amount}</p>}
        {detail && <p className="text-sm text-zinc-500 dark:text-zinc-400">{detail}</p>}
        <p className="mt-1 text-xs text-zinc-400">{t('done.tap')}</p>
      </div>
    </div>
  );
}
