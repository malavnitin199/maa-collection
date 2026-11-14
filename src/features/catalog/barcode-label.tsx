import { ean13Svg, isValidEan13 } from '@/features/scanning/ean13';
import { formatPaise } from '@/lib/money';

type LabelProduct = { sku: string; barcode: string; name: string; size: string; color: string; mrpPaise: number };

/** Printable tag: name, size, colour, MRP and the EAN-13 barcode. */
export function BarcodeLabel({ product }: { product: LabelProduct }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 bg-white p-3 text-center text-zinc-900 break-inside-avoid dark:border-zinc-800">
      <p className="text-sm font-medium">{product.name}</p>
      <p className="text-xs text-zinc-600">
        {product.size} · {product.color} · MRP {formatPaise(product.mrpPaise)}
      </p>
      {isValidEan13(product.barcode) ? (
        <div
          role="img"
          aria-label={`Barcode ${product.barcode} for ${product.sku}`}
          className="w-full max-w-[226px] [&>svg]:h-auto [&>svg]:w-full"
          // Our own SVG built from 13 validated digits; no user text inside.
          dangerouslySetInnerHTML={{ __html: ean13Svg(product.barcode) }}
        />
      ) : (
        <p className="font-mono text-sm">{product.barcode}</p>
      )}
      <p className="font-mono text-xs text-zinc-600">{product.sku}</p>
    </div>
  );
}
