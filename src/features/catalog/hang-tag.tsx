import { ean13Svg, isValidEan13 } from '@/features/scanning/ean13';
import { STORE_NAME } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { sameSize } from '@/lib/size-prices';
import { QrCode } from './qr-code';

export type TagProduct = { sku: string; barcode: string; name: string; brand?: string; size: string; color: string; mrpPaise: number };

/**
 * Hang tag, exactly 50 × 80 mm (ADR-014): shop, QR (opens the item), size boxed
 * big with the colour, the design's sizes with this one highlighted, name,
 * ART. (= SKU) and code price, the EAN-13 barcode, and the MRP.
 */
export function HangTag({
  product,
  sizes = [],
  qrValue = null,
  priceCode = null,
}: {
  product: TagProduct;
  /** All sizes of this design in shop order; 2+ shows the size row. */
  sizes?: string[];
  /** Item link for the QR code; no QR when absent. */
  qrValue?: string | null;
  /** Purchase price in the owner's letter code, if enabled. */
  priceCode?: string | null;
}) {
  const [rupees, paise] = formatPaise(product.mrpPaise).split('.');
  const longSize = product.size.length > 4;
  return (
    <div
      data-testid="hang-tag"
      className="relative flex h-[80mm] w-[50mm] shrink-0 flex-col overflow-hidden rounded-[3mm] border border-zinc-300 bg-white px-[3mm] pt-[2mm] pb-[2.5mm] text-zinc-900 break-inside-avoid print:rounded-[3mm] print:border-zinc-400"
    >
      {/* Punch-hole guide for the thread. */}
      <span aria-hidden className="absolute top-[2.5mm] left-1/2 h-[3mm] w-[3mm] -translate-x-1/2 rounded-full border border-zinc-400" />
      <div className="flex items-start justify-between gap-[1mm]">
        <div className="max-w-[19mm] min-w-0 pt-[1mm]">
          <p className="text-[7pt] leading-[1.15] font-bold tracking-[0.12em] uppercase">{STORE_NAME}</p>
          {product.brand && <p className="mt-[0.6mm] truncate text-[5.5pt] tracking-wide text-zinc-500 uppercase">{product.brand}</p>}
        </div>
        {qrValue ? (
          <QrCode value={qrValue} label={`QR code for ${product.sku}`} className="h-[14mm] w-[14mm] shrink-0" />
        ) : (
          <span className="h-[14mm] w-[14mm] shrink-0" />
        )}
      </div>

      <div className="mt-[1.5mm] border border-zinc-800">
        <p className="flex justify-between border-b border-zinc-800 px-[1.5mm] text-[5pt] leading-[2.2mm] font-semibold tracking-wider uppercase">
          <span>Size</span>
          <span>Colour</span>
        </p>
        <p className="flex items-center justify-between gap-[1.5mm] px-[1.5mm] py-[0.6mm]">
          <span data-testid="tag-size" className={`${longSize ? 'text-[11pt]' : 'text-[19pt]'} leading-none font-bold`}>
            {product.size}
          </span>
          <span className="min-w-0 truncate text-right text-[7.5pt] font-medium">{product.color}</span>
        </p>
      </div>

      {sizes.length > 1 && (
        <ul aria-label="Sizes of this design" className="mt-[1.3mm] flex flex-wrap justify-center gap-x-[1.2mm] gap-y-[0.4mm] text-[7pt] leading-[3mm] font-semibold">
          {sizes.map((size) => {
            const current = sameSize(size, product.size);
            return (
              <li key={size} aria-current={current ? 'true' : undefined} className={current ? 'bg-zinc-900 px-[0.8mm] text-white' : 'px-[0.3mm] text-zinc-600'}>
                {size}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-[1.3mm] line-clamp-2 text-center text-[8pt] leading-tight font-semibold">{product.name}</p>
      <p className="mt-[0.8mm] flex justify-between gap-[1mm] font-mono text-[6pt] leading-tight">
        <span className="truncate">
          ART.: <span className="font-semibold">{product.sku}</span>
        </span>
        {priceCode && <span data-testid="price-code">{priceCode}</span>}
      </p>

      {isValidEan13(product.barcode) ? (
        <div
          role="img"
          aria-label={`Barcode ${product.barcode} for ${product.sku}`}
          className="mx-auto mt-[0.5mm] w-[42mm] [&>svg]:h-auto [&>svg]:w-full"
          // Our own SVG built from 13 validated digits; no user text inside.
          dangerouslySetInnerHTML={{ __html: ean13Svg(product.barcode, 3, 30) }}
        />
      ) : (
        <p className="mt-[1mm] text-center font-mono text-[8pt]">{product.barcode}</p>
      )}

      <div className="mt-auto border border-zinc-800 pt-[1.2mm] pb-[0.6mm]">
        <span aria-hidden className="mx-[4mm] block h-[0.7mm] bg-red-600" />
        <p className="mt-[0.6mm] text-center leading-none">
          <span className="text-[7pt] font-semibold">MRP </span>
          <span className="text-[15pt] font-bold">{rupees}</span>
          {paise && <sup className="text-[7pt] font-bold">.{paise}</sup>}
        </p>
        <p className="mt-[0.4mm] text-center text-[5pt] text-zinc-500">(incl. of all taxes)</p>
      </div>
    </div>
  );
}
