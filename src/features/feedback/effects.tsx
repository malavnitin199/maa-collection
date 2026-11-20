'use client';

import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { feedback } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';
import './feedback.css';

/** Green tick that pops with a ripple (remount it with a new `key` to play again). */
export function ScanTick() {
  const t = useT();
  return (
    <span data-testid="scan-ok" aria-hidden className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
      <span className="fb-ripple absolute inset-0 rounded-full bg-brand-500/40" />
      <span className="fb-tick relative flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 shadow-lg" title={t('scan.ok')}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path className="fb-draw" style={{ '--fb-len': 22 } as React.CSSProperties} d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    </span>
  );
}

export type DoneLine = { label: string; value: string };
export type DoneInput = {
  /** Green tick (default) or a red cross for something that was not saved. */
  kind?: 'ok' | 'error';
  title: string;
  amount?: string;
  detail?: string;
  /** The full details, label · value, so the person can read what was done. */
  lines?: DoneLine[];
  /** How long it stays (ms) before closing by itself; longer when there are lines. */
  stay?: number;
};

/**
 * "Done ✓" card, like a payment app (owner's feedback 2026-11-20: every finished
 * task — a sale, a company, a category, items, a payment — shows one with its
 * details; a failure shows the red version so the two can never be confused).
 * The tick draws itself, the card rises, then it closes by itself, on a tap, or
 * on the next key press (a hardware scanner starting the next sale).
 */
export function DoneOverlay({ kind = 'ok', title, amount, detail, lines, stay, onClose }: DoneInput & { onClose: () => void }) {
  const t = useT();
  const wait = stay ?? (lines?.length || kind === 'error' ? 3200 : 1600);
  useEffect(() => {
    const timer = window.setTimeout(onClose, wait);
    const onKey = () => onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, wait]);
  const error = kind === 'error';
  // On the page body: never hidden by a closed <details> or moved by an animated ancestor; nothing on the server.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div
      data-testid="done-overlay"
      data-kind={kind}
      aria-live="polite"
      onPointerDown={onClose}
      className="fb-backdrop fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-6 backdrop-blur-[2px]"
    >
      <div className={`fb-card flex w-full max-w-xs flex-col items-center gap-2 rounded-3xl px-6 py-7 text-center shadow-2xl ${error ? 'fb-shake bg-red-50 dark:bg-red-950' : 'bg-white dark:bg-zinc-900'}`}>
        <span className="relative flex h-20 w-20 items-center justify-center">
          {!error && <span className="fb-ripple absolute inset-0 rounded-full bg-brand-500/30" />}
          <svg viewBox="0 0 80 80" className="relative h-20 w-20" aria-hidden>
            <circle cx="40" cy="40" r="36" fill={error ? '#dc2626' : 'var(--b-600)'} />
            {error ? (
              <path className="fb-draw" style={{ '--fb-len': 50 } as React.CSSProperties} d="M27 27l26 26M53 27L27 53" fill="none" stroke="white" strokeWidth={6} strokeLinecap="round" />
            ) : (
              <path className="fb-draw" style={{ '--fb-len': 60 } as React.CSSProperties} d="M24 41l11 11 22-24" fill="none" stroke="white" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </span>
        <p className={`text-xl font-semibold ${error ? 'text-red-800 dark:text-red-200' : ''}`}>{title}</p>
        {amount && <p className="text-3xl font-bold">{amount}</p>}
        {detail && <p className={`text-sm ${error ? 'text-red-800 dark:text-red-200' : 'text-zinc-500 dark:text-zinc-400'}`}>{detail}</p>}
        {lines && lines.length > 0 && (
          <dl data-testid="done-lines" className="mt-1 grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-left text-sm">
            {lines.map((line, i) => (
              <Fragment key={`${line.label}-${i}`}>
                <dt className="text-zinc-500 dark:text-zinc-400">{line.label}</dt>
                <dd className="min-w-0 truncate text-right font-medium">{line.value}</dd>
              </Fragment>
            ))}
          </dl>
        )}
        <p className="mt-1 text-xs text-zinc-400">{t('done.tap')}</p>
      </div>
    </div>,
    document.body,
  );
}
const subscribeNothing = () => () => {};

/**
 * The done card for any screen: `show({...})` plays the sound / buzz and shows
 * it; render `node` once in the screen's tree.
 */
export function useDone() {
  const [done, setDone] = useState<(DoneInput & { id: number }) | null>(null);
  const counter = useRef(0);
  const close = useCallback(() => setDone(null), []);
  const show = useCallback((input: DoneInput) => {
    feedback(input.kind === 'error' ? 'error' : 'done');
    setDone({ ...input, id: ++counter.current });
  }, []);
  const node = done ? <DoneOverlay key={done.id} {...done} onClose={close} /> : null;
  return { show, node, close };
}

type FormState = { error?: string; message?: string };
type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Wraps a form's server action: a saved result shows the done card with the
 * lines `describe` builds from what was typed; an error shows the red card.
 * The form's own inline message stays (screen readers, after the card closes).
 */
export function useFormDone(
  action: FormAction,
  { notSaved, describe }: { notSaved: string; describe: (formData: FormData, result: FormState) => Omit<DoneInput, 'kind'> },
) {
  const { show, node } = useDone();
  const wrapped: FormAction = async (previous, formData) => {
    const result = await action(previous, formData);
    if (result.error) show({ kind: 'error', title: notSaved, detail: result.error });
    else if (result.message) show({ kind: 'ok', ...describe(formData, result) });
    return result;
  };
  return { action: wrapped, node };
}
