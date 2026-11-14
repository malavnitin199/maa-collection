'use client';

import { useEffect, useRef } from 'react';

/**
 * USB/Bluetooth scanners act as keyboards: they type the code very fast and
 * press Enter. This buffer recognises that burst. Keys more than `maxGapMs`
 * apart start a new code, so slow human typing is not mistaken for a scan.
 */
export function createScanBuffer(maxGapMs = 100, minLength = 3) {
  let buffer = '';
  let lastAt = Number.NEGATIVE_INFINITY;
  return {
    /** Feed one key; returns the scanned code when Enter completes a burst. */
    push(key: string, at: number): string | null {
      const continues = at - lastAt <= maxGapMs;
      lastAt = at;
      if (key === 'Enter') {
        const code = continues ? buffer : '';
        buffer = '';
        return code.length >= minLength ? code : null;
      }
      if (key.length === 1) buffer = continues ? buffer + key : key;
      return null; // Shift, Tab, etc.
    },
  };
}

function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Catches a hardware scan when no text box has focus (e.g. after tapping a
 * button), so the scan is not lost and its Enter does not press that button.
 * Scans into a text box are left alone: the box's own form handles them.
 */
export function useScannerKeystrokes(onScan: (code: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!enabled) return;
    const buffer = createScanBuffer();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTextEntry(event.target)) return;
      const code = buffer.push(event.key, event.timeStamp);
      if (code !== null) {
        event.preventDefault();
        onScanRef.current(code);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
