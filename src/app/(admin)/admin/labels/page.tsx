import Image from 'next/image';
import { DUMMY_CATALOG } from '@/features/catalog/dummy-catalog';
import { formatPaise } from '@/lib/money';

export default function LabelsPage() {
  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Test labels</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          One barcode per item. Scan it with the phone camera on the POS screen or with a
          USB/Bluetooth scanner, or print this page.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DUMMY_CATALOG.map((item) => (
          <li
            key={item.sku}
            className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800"
          >
            <div>
              <p className="text-sm font-medium text-zinc-900">{item.design}</p>
              <p className="text-xs text-zinc-600">
                {item.size} · {item.color} · MRP {formatPaise(item.mrpPaise)}
              </p>
            </div>
            <Image
              src={`/barcodes/${item.sku}.svg`}
              alt={`Barcode ${item.barcode} for ${item.sku}`}
              width={226}
              height={154}
              unoptimized
              className="h-auto w-full max-w-[226px]"
            />
            <p className="font-mono text-xs text-zinc-600">{item.sku}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
