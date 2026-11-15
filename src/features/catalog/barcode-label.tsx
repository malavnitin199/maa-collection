import { ean13Svg, isValidEan13 } from '@/features/scanning/ean13';
import { formatPaise } from '@/lib/money';

type LabelProduct = { sku: string; barcode: string; name: string; size: string; color: string; mrpPaise: number };

/**
 * Label-printer sticker, exactly 50 × 25 mm: name, size/colour, MRP, barcode
 * and SKU (+ code price if enabled). Prints one per page on a sticker roll.
 */
export function StickerLabel({ product, priceCode = null }: { product: LabelProduct; priceCode?: string | null }) {
  return (
    <div className="flex h-[25mm] w-[50mm] flex-col justify-between overflow-hidden border border-dashed border-zinc-300 bg-white px-[1.5mm] py-[1mm] text-zinc-900 print:border-0">
      <div className="flex items-baseline justify-between gap-1 text-[7pt] leading-tight">
        <span className="truncate font-semibold">{product.name}</span>
        <span className="shrink-0 font-semibold">MRP {formatPaise(product.mrpPaise).replace('.00', '')}</span>
      </div>
      {isValidEan13(product.barcode) ? (
        <div
          role="img"
          aria-label={`Barcode ${product.barcode} for ${product.sku}`}
          className="w-full [&>svg]:h-auto [&>svg]:w-full"
          // Short bars so the barcode can use the full sticker width (~0.4 mm per bar).
          dangerouslySetInnerHTML={{ __html: ean13Svg(product.barcode, 3, 24) }}
        />
      ) : (
        <p className="font-mono text-[8pt]">{product.barcode}</p>
      )}
      <div className="flex justify-between gap-1 font-mono text-[5.5pt] leading-tight text-zinc-600">
        <span className="truncate">
          {product.size} · {product.color} · {product.sku}
        </span>
        {priceCode && <span data-testid="price-code">{priceCode}</span>}
      </div>
    </div>
  );
}
