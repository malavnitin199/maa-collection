import { ean13Svg, isValidEan13 } from '@/features/scanning/ean13';
import { STORE_NAME } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';

type LabelProduct = { sku: string; barcode: string; name: string; size: string; color: string; mrpPaise: number };

/**
 * Printable tag: shop, name, size, colour, MRP and the EAN-13 barcode.
 * `compact` is the sheet version (smaller padding, for printing many per page).
 */
export function BarcodeLabel({
  product,
  compact = false,
  priceCode = null,
}: {
  product: LabelProduct;
  compact?: boolean;
  /** Purchase price in the owner's letter code (shown bottom-right), if enabled. */
  priceCode?: string | null;
}) {
  return (
    <div
      className={`flex flex-col items-center text-center text-zinc-900 break-inside-avoid border border-zinc-200 bg-white dark:border-zinc-800 ${
        compact ? 'gap-0.5 rounded-lg p-2 print:rounded-none print:border-dashed' : 'gap-1 rounded-xl p-3'
      }`}
    >
      {compact && <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{STORE_NAME}</p>}
      <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium leading-tight`}>{product.name}</p>
      <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-zinc-600`}>
        {product.size} · {product.color} · <span className="font-semibold text-zinc-900">MRP {formatPaise(product.mrpPaise)}</span>
      </p>
      {isValidEan13(product.barcode) ? (
        <div
          role="img"
          aria-label={`Barcode ${product.barcode} for ${product.sku}`}
          className={`w-full ${compact ? 'max-w-[190px]' : 'max-w-[226px]'} [&>svg]:h-auto [&>svg]:w-full`}
          // Our own SVG built from 13 validated digits; no user text inside.
          dangerouslySetInnerHTML={{ __html: ean13Svg(product.barcode) }}
        />
      ) : (
        <p className="font-mono text-sm">{product.barcode}</p>
      )}
      <p className={`flex w-full justify-between gap-2 font-mono ${compact ? 'text-[10px]' : 'text-xs'} text-zinc-600`}>
        <span className={priceCode ? '' : 'mx-auto'}>{product.sku}</span>
        {priceCode && <span data-testid="price-code">{priceCode}</span>}
      </p>
    </div>
  );
}

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
