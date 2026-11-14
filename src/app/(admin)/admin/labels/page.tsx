import Image from 'next/image';
import { DUMMY_CATALOG } from '@/features/catalog/dummy-catalog';
import { formatPaise } from '@/lib/money';

export default function LabelsPage() {
  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">QR labels</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Open this page on a laptop and scan a code with the phone camera on the POS screen, or
          print it. Each QR encodes the item SKU.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {DUMMY_CATALOG.map((item) => (
          <li
            key={item.sku}
            className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800"
          >
            <Image
              src={`/qr/${item.sku}.png`}
              alt={`QR code for ${item.sku}`}
              width={160}
              height={160}
            />
            <p className="font-mono text-xs text-zinc-900">{item.sku}</p>
            <p className="text-sm font-medium text-zinc-900">{item.design}</p>
            <p className="text-xs text-zinc-600">
              {item.size} · {item.color} · MRP {formatPaise(item.mrpPaise)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
