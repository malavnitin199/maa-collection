'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { useScreenVisits } from './fresh-on-return';

/**
 * The browser's name for this place in the history list. Back / Forward land on the same
 * place (same key); a tap on a link or a Delete makes a new place (new key), and a replace
 * keeps it. Null where the browser has no Navigation API — then nothing is removed.
 */
function historyKey(): string | null {
  const nav = (window as unknown as { navigation?: { currentEntry?: { key?: string } | null } }).navigation;
  return nav?.currentEntry?.key ?? null;
}

/**
 * Filters and one-time messages kept in the page address (All tags' search and filters, a
 * period, "Deleted …"): gone when the person goes Back (or Forward) to a screen after another
 * one (owner, 2026-11-23, ADR-068), so the screen opens plain. Only Back / Forward to the very
 * place in history the screen showed counts: a link that carries a filter on purpose ("See this
 * company's tags") and Delete's new *Deleted* note always show as sent. The rest of the address
 * (which group or design is open) stays. Renders nothing.
 */
export function FreshAddress({ drop }: { drop: readonly string[] }) {
  return (
    <Suspense fallback={null}>
      <Watch drop={drop} />
    </Suspense>
  );
}

function Watch({ drop }: { drop: readonly string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  /** The address and the place in history while this screen was last on view. */
  const seen = useRef<{ search: string; key: string | null } | null>(null);
  // First (effects run in order): on a return, compare with what was seen before the trip.
  useScreenVisits({
    returned: () => {
      const was = seen.current;
      const key = historyKey();
      const url = new URL(window.location.href);
      if (!was || key === null || key !== was.key || url.searchParams.toString() !== was.search) return;
      const before = url.search;
      for (const name of drop) url.searchParams.delete(name);
      if (url.search !== before) router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    },
  });
  useEffect(() => {
    seen.current = { search: params.toString(), key: historyKey() };
  }, [params]);
  return null;
}
