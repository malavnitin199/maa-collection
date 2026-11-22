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

/** Whether this screen was left for another one, and the check still waiting to run. */
function makeVisit() {
  let away = false;
  let timer: number | undefined;
  return {
    /** Back on screen: true once after the screen was really left. */
    back() {
      window.clearTimeout(timer);
      const was = away;
      away = false;
      return was;
    },
    /** Hidden or closed: a moment later, was another screen opened? */
    hidden(path: string, onLeft: () => void) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (window.location.pathname === path) return;
        away = true;
        onLeft();
      }, 0);
    },
  };
}

type Visits = { left?: () => void; returned?: () => void };

/**
 * Coming back to a screen (ADR-068). Next keeps a visited screen alive, hidden, and shows it
 * again later: its effects stop when it hides and run again when it shows. This tells the two
 * moments apart from React's own quick stop-and-start in development:
 * - `left` runs when another screen was opened (a different address path — a filter or a
 *   message in the address is still the same screen), while this one is hidden, so it is
 *   clean before anyone sees it again;
 * - `returned` runs when the screen shows again after that (and after the browser's back
 *   cache brings a page back).
 */
export function useScreenVisits(handlers: Visits) {
  const latest = useRef(handlers);
  const [visit] = useState(makeVisit);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    const path = window.location.pathname;
    if (visit.back()) latest.current.returned?.();
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      latest.current.left?.();
      latest.current.returned?.();
    };
    window.addEventListener('pageshow', onShow);
    return () => {
      window.removeEventListener('pageshow', onShow);
      visit.hidden(path, () => latest.current.left?.());
    };
  }, [visit]);
}

/**
 * Selections, searches, filters and pages of a list start clean when the person comes back
 * (owner, 2026-11-23, ADR-068): cleared as soon as another screen opens, so nothing old
 * flashes on return.
 */
export function useClearOnLeave(clear: () => void) {
  useScreenVisits({ left: clear });
}

/**
 * A long form starts fresh when the person comes back to it (owner's feedback
 * 2026-11-20: half-typed details from last time were confusing).
 *
 * Refinement (owner, later that day): when a lot was already filled in
 * (`ask()` is true — e.g. three or more steps), the form asks instead:
 * continue with what was there, or start fresh. Render `ResumeSheet` with
 * `asking`, `keep` and `fresh`.
 */
export function useFreshOnReturn(reset: () => void, { ask }: { ask?: () => boolean } = {}) {
  const latest = useRef({ reset, ask });
  const [store] = useState(makeFlag);
  const asking = useSyncExternalStore(store.subscribe, store.get, () => false);
  useEffect(() => {
    latest.current = { reset, ask };
  });
  useScreenVisits({
    returned: () => {
      if (latest.current.ask?.()) store.set(true);
      else latest.current.reset();
    },
  });
  const keep = useCallback(() => store.set(false), [store]);
  const fresh = useCallback(() => {
    store.set(false);
    latest.current.reset();
  }, [store]);
  return { asking, keep, fresh };
}
