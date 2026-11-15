import { Suspense } from 'react';
import { loadCounter } from '@/features/pos/load-counter';
import { PosScreen } from '@/features/pos/pos-screen';
import { lookupProductAction } from '@/server/actions/pos';

async function Counter({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const [{ me, staff }, { code }] = await Promise.all([loadCounter(), searchParams]);
  // Opened from a tag's QR code (/i/<code>): show that item straight away.
  const scanned = typeof code === 'string' ? code.trim().slice(0, 64) : '';
  const found = scanned ? await lookupProductAction(scanned) : null;
  const initial = scanned ? { code: scanned, product: found?.ok ? found.data : null } : undefined;
  return <PosScreen me={me} staff={staff} initial={initial} />;
}

export default function PosPage(props: PageProps<'/pos'>) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Counter searchParams={props.searchParams as Promise<{ code?: string | string[] }>} />
    </Suspense>
  );
}
