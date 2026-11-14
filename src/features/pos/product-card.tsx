import { card, muted } from '@/components/ui/styles';
import { formatPaise } from '@/lib/money';
import type { CounterProduct } from '@/server/services/products';

/** Item details shown after a scan. Counter view: no cost price. */
export function ProductDetails({ product }: { product: CounterProduct }) {
  const rows: [string, React.ReactNode, string?][] = [
    ['SKU', <span key="sku" className="font-mono">{product.sku}</span>],
    ['Barcode', <span key="bc" className="font-mono">{product.barcode}</span>],
    ['Brand', product.brand],
    ['Category', product.category],
    ['Size / Colour', `${product.size} · ${product.color}`],
    ['MRP', formatPaise(product.mrpPaise)],
    ['Selling price', formatPaise(product.pricePaise)],
    ['In stock', product.stock, 'details-stock'],
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
  return (
    <section data-testid="item-details" className={card}>
      <div className="flex items-start gap-3">
        {product.imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- our own resized photos
          <img src={product.imageSrc} alt={`Photo of ${product.name}`} className="h-24 w-24 shrink-0 rounded-lg object-cover" />
        )}
        <h2 className="text-lg font-semibold">{product.name}</h2>
      </div>
      <ProductDetails product={product} />
      {children}
    </section>
  );
}
