'use client';

import { card, muted } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';
import { formatPaise } from '@/lib/money';
import type { CounterProduct } from '@/server/services/products';

/** Item details shown after a scan. Counter view: no cost price. */
export function ProductDetails({ product }: { product: CounterProduct }) {
  const t = useT();
  const rows: [string, React.ReactNode, string?][] = [
    [t('item.sku'), <span key="sku" className="font-mono">{product.sku}</span>],
    [t('item.barcode'), <span key="bc" className="font-mono">{product.barcode}</span>],
    [t('item.brand'), product.brand],
    [t('item.category'), product.category],
    [t('item.sizeColour'), `${product.size} · ${product.color}`],
    [t('item.mrp'), formatPaise(product.mrpPaise)],
    [t('item.price'), formatPaise(product.pricePaise)],
    [t('item.inStock'), product.stock, 'details-stock'],
  ];
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
      {rows.map(([label, value, testId]) => (
        <div key={label}>
          <dt className={muted}>{label}</dt>
          <dd data-testid={testId} className={testId ? 'font-semibold' : undefined}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ProductCard({ product, children }: { product: CounterProduct; children?: React.ReactNode }) {
  const t = useT();
  return (
    <section data-testid="item-details" className={`${card} fb-card`}>
      <div className="flex items-start gap-3">
        {product.imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
          <img src={product.imageSrc} alt={t('item.photo', { name: product.name })} className="h-24 w-24 shrink-0 rounded-lg object-cover" />
        )}
        <h2 className="text-lg font-semibold">{product.name}</h2>
      </div>
      <ProductDetails product={product} />
      {children}
    </section>
  );
}
