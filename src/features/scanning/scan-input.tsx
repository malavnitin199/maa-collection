'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { input, muted, primaryButton, secondaryButton } from '@/components/ui/styles';
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

type Props = {
  label: string;
  onScan: (code: string) => void;
  busy?: boolean;
  /** Catch hardware-scanner bursts anywhere on the page (only one ScanInput should enable this). */
  captureScanner?: boolean;
};

/** Scan box + Find + camera; also accepts USB/Bluetooth scanners typing into the page. */
export function ScanInput({ label, onScan, busy = false, captureScanner = true }: Props) {
  const id = useId();
  const [value, setValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
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

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex gap-2">
          <input
            id={id}
            ref={ref}
            disabled={!hydrated}
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Scanner types here, or enter a code"
            className={`w-full ${input}`}
          />
          <button type="submit" disabled={!hydrated || busy} className={primaryButton}>
            Find
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!hydrated}
            onClick={() => setCameraOpen((open) => !open)}
            className={secondaryButton}
          >
            {cameraOpen ? 'Stop camera' : 'Scan with camera'}
          </button>
          <p className={`text-xs ${muted}`}>A USB/Bluetooth scanner types the code and presses Enter by itself.</p>
        </div>
      </form>
      {cameraOpen && <CameraScanner onDecode={submit} onClose={() => setCameraOpen(false)} />}
    </div>
  );
}
