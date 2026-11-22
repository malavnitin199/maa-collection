'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { useScreenVisits } from './fresh-on-return';

/**
 * Filters and one-time messages kept in the page address (All tags' search and filters, a
 * period, "Deleted …"): gone when the person comes back from another screen (owner,
 * 2026-11-23, ADR-068), so the screen opens plain. Only a return to the very address the
 * screen showed when it was left counts — Delete sending you here with a new *Deleted* note
 * keeps the note. The rest of the address (which group or design is open) stays. Renders
 * nothing.
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
  /** What the address said while this screen was last on view. */
  const seen = useRef<string | null>(null);
  // First (effects run in order): on a return, compare with the address from before the trip.
  useScreenVisits({
    returned: () => {
      const url = new URL(window.location.href);
      if (seen.current === null || url.searchParams.toString() !== seen.current) return;
      const before = url.search;
      for (const name of drop) url.searchParams.delete(name);
      if (url.search !== before) router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    },
  });
  useEffect(() => {
    seen.current = params.toString();
  }, [params]);
  return null;
}
