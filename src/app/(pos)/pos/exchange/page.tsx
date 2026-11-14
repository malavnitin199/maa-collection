import { Suspense } from 'react';
import { ExchangeScreen } from '@/features/pos/exchange-screen';
import { loadCounter } from '@/features/pos/load-counter';

async function Exchange() {
  const { me, staff } = await loadCounter();
  return <ExchangeScreen me={me} staff={staff} />;
}

export default function ExchangePage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Exchange />
    </Suspense>
  );
}
