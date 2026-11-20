'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** A tiny on/off store the effect can flip without calling setState from inside it. */
function makeFlag() {
  let on = false;
  const listeners = new Set<() => void>();
  return {
    get: () => on,
    set(next: boolean) {
      if (on === next) return;
      on = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * A long form starts fresh when the person comes back to it (owner's feedback
 * 2026-11-20: half-typed details from last time were confusing). Next keeps a
 * visited page alive and shows it again later: its effects run again on that
 * return, so the second run (and a page restored from the browser's back
 * cache) calls `reset`. The first mount is left alone.
 *
 * Refinement (owner, later that day): when a lot was already filled in
 * (`ask()` is true — e.g. three or more steps), the form asks instead:
 * continue with what was there, or start fresh. Render `ResumeSheet` with
 * `asking`, `keep` and `fresh`.
 */
export function useFreshOnReturn(reset: () => void, { ask }: { ask?: () => boolean } = {}) {
  const latest = useRef({ reset, ask });
  const shown = useRef(false);
  const [store] = useState(makeFlag);
  const asking = useSyncExternalStore(store.subscribe, store.get, () => false);
  useEffect(() => {
    latest.current = { reset, ask };
  });
  useEffect(() => {
    const returned = () => {
      if (latest.current.ask?.()) store.set(true);
      else latest.current.reset();
    };
    if (shown.current) returned();
    shown.current = true;
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) returned();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [store]);
  const keep = useCallback(() => store.set(false), [store]);
  const fresh = useCallback(() => {
    store.set(false);
    latest.current.reset();
  }, [store]);
  return { asking, keep, fresh };
}
