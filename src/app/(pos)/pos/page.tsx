import { Suspense } from 'react';
import { loadCounter } from '@/features/pos/load-counter';
import { PosScreen } from '@/features/pos/pos-screen';

async function Counter() {
  const { me, staff } = await loadCounter();
  return <PosScreen me={me} staff={staff} />;
}

export default function PosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Counter />
    </Suspense>
  );
}
