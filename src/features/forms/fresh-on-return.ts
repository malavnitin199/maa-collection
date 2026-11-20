'use client';

import { useEffect, useRef } from 'react';

/**
 * A long form starts fresh when the person comes back to it (owner's feedback
 * 2026-11-20: half-typed details from last time were confusing). Next keeps a
 * visited page alive and shows it again later: its effects run again on that
 * return, so the second run (and a page restored from the browser's back
 * cache) calls `reset`. The first mount is left alone.
 */
export function useFreshOnReturn(reset: () => void) {
  const latest = useRef(reset);
  const shown = useRef(false);
  useEffect(() => {
    latest.current = reset;
  });
  useEffect(() => {
    if (shown.current) latest.current();
    shown.current = true;
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) latest.current();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);
}
