'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { input } from '@/components/ui/styles';
import { IconCamera } from '@/components/ui/icons';
import { ScanTick } from '@/features/feedback/effects';
import { unlockAudio } from '@/features/feedback/sounds';
import { useT } from '@/features/i18n/i18n-provider';
import { CameraScanner } from './camera-scanner';
import { useScannerKeystrokes } from './scanner-keystrokes';

const emptySubscribe = () => () => {};
/** False during SSR/hydration, true once React is interactive. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

const CORNERS = [
  'top-2 left-2 rounded-tl-md border-t-2 border-l-2',
  'top-2 right-2 rounded-tr-md border-t-2 border-r-2',
  'bottom-2 left-2 rounded-bl-md border-b-2 border-l-2',
  'bottom-2 right-2 rounded-br-md border-b-2 border-r-2',
];
const findButton =
  'inline-flex shrink-0 items-center justify-center rounded-full bg-white px-5 py-2 font-bold text-brand-800 shadow-md transition hover:bg-brand-50 active:scale-[0.97] disabled:opacity-60 disabled:active:scale-100';
const cameraButton =
  'inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/25 active:scale-[0.97] disabled:opacity-60';

type Props = {
  label: string;
  onScan: (code: string) => void;
  busy?: boolean;
  /** Catch hardware-scanner bursts anywhere on the page (only one ScanInput should enable this). */
  captureScanner?: boolean;
  /** Result of the last scan: a green tick (ok) or a shake (error). A new `id` plays it again. */
  result?: { kind: 'ok' | 'error'; id: number } | null;
};

/** Scan box + Find + camera; also accepts USB/Bluetooth scanners typing into the page. */
export function ScanInput({ label, onScan, busy = false, captureScanner = true, result = null }: Props) {
  const t = useT();
  const id = useId();
  const [value, setValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (hydrated) ref.current?.focus();
  }, [hydrated]);

  function submit(raw: string) {
    const code = raw.trim();
    setValue('');
    setCameraOpen(false);
    if (code) onScan(code);
  }

  useScannerKeystrokes(submit, hydrated && captureScanner);

  // A failed scan: the box shakes and flashes red (only a flash with reduced motion). Played on the
  // element itself so the text box keeps its focus.
  const errorId = result?.kind === 'error' ? result.id : null;
  useEffect(() => {
    const box = boxRef.current;
    if (errorId === null || !box?.animate) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const off = '0 0 0 0 rgb(220 38 38 / 0)';
    const red = '0 0 0 4px rgb(220 38 38 / 0.45)';
    const frames = still
      ? [off, red, off].map((boxShadow) => ({ boxShadow }))
      : [0, -7, 7, -4, 4, 0].map((x, i, all) => ({ transform: `translateX(${x}px)`, boxShadow: i === 0 || i === all.length - 1 ? off : red }));
    box.animate(frames, { duration: still ? 700 : 420, easing: 'ease-in-out' });
  }, [errorId]);

  return (
    <div className="flex flex-col gap-2">
      {/* The scan zone (plan v8): the theme's dye with viewfinder corners in zari, so
          every screen that scans shows the same "scan here" place. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        className="relative flex flex-col gap-2.5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-5 text-white shadow-lg shadow-brand-900/20 dark:from-brand-900 dark:to-brand-950"
      >
        {CORNERS.map((c) => (
          <span key={c} aria-hidden className={`pointer-events-none absolute h-3.5 w-3.5 border-zari ${c}`} />
        ))}
        <label htmlFor={id} className="text-sm font-semibold text-white/95">
          {label}
        </label>
        <div ref={boxRef} data-last-scan={result?.kind} className="flex gap-2 rounded-xl">
          {/* The tick sits at the end of the text box, clear of the Find button. */}
          <div className="relative w-full">
            <input
              id={id}
              ref={ref}
              disabled={!hydrated}
              autoComplete="off"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={t('scan.placeholder')}
              className={`w-full ${input} pr-12 text-zinc-900 dark:text-zinc-100`}
            />
            {result?.kind === 'ok' && <ScanTick key={result.id} />}
          </div>
          <button type="submit" disabled={!hydrated || busy} className={findButton}>
            {t('scan.find')}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!hydrated}
            onClick={() => {
              unlockAudio(); // camera scans aren't a tap: allow the sound now
              setCameraOpen((open) => !open);
            }}
            className={cameraButton}
          >
            <IconCamera className="h-5 w-5" />
            {cameraOpen ? t('scan.stopCamera') : t('scan.camera')}
          </button>
          <p className="text-xs text-white/75">{t('scan.hardwareHint')}</p>
        </div>
      </form>
      {cameraOpen && <CameraScanner onDecode={submit} onClose={() => setCameraOpen(false)} />}
    </div>
  );
}
