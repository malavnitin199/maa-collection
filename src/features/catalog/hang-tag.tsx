import { ean13Svg, isValidEan13 } from '@/features/scanning/ean13';
import { STORE_NAME } from '@/lib/app-config';
import { formatPaise } from '@/lib/money';
import { boxPaise, packOf } from '@/lib/packs';
import { sameSize } from '@/lib/size-prices';
import { QrCode } from './qr-code';

export type TagProduct = {
  sku: string;
  barcode: string;
  name: string;
  brand?: string;
  size: string;
  color: string;
  mrpPaise: number;
  /** Box packs (ADR-047): one tag per box says "BOX OF 12" and the box price. */
  packSize?: number | null;
  packMrpPaise?: number | null;
};

/**
 * Hang tag, exactly 40 × 60 mm with ~1.5 mm padding (ADR-014, ADR-015): shop
 * and punch hole, size big (no colour: owner, 2026-11-22), QR (opens the item), every size of
 * the category with a tick box (this piece's filled; tick another by pen), name,
 * ART. (= SKU) and code price, the EAN-13 barcode, and the MRP.
 */
export function HangTag({
  product,
  sizes = [],
  qrValue = null,
  priceCode = null,
}: {
  product: TagProduct;
  /** The size row: the category's sizes in shop order (see `tagSizeRange`); 2+ shows it. */
  sizes?: string[];
  /** Item link for the QR code; no QR when absent. */
  qrValue?: string | null;
  /** Purchase price in the owner's letter code, if enabled. */
  priceCode?: string | null;
}) {
  const [rupees, paise] = formatPaise(product.mrpPaise).split('.');
  const longSize = product.size.length > 4;
  const pack = packOf(product.packSize);
  return (
    <div
      data-testid="hang-tag"
      className="flex h-[60mm] w-[40mm] shrink-0 flex-col overflow-hidden rounded-[2mm] border border-zinc-300 bg-white p-[1.5mm] text-zinc-900 break-inside-avoid print:border-zinc-400"
    >
      <div className="flex items-start gap-[1mm]">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex items-center gap-[0.8mm] text-[5pt] leading-none font-bold tracking-[0.08em] uppercase">
            {/* Punch-hole guide for the thread. */}
            <span aria-hidden className="h-[2.2mm] w-[2.2mm] shrink-0 rounded-full border border-zinc-400" />
            <span className="truncate">{STORE_NAME}</span>
          </p>
          {product.brand && <p className="mt-[0.5mm] truncate text-[4.5pt] leading-none text-zinc-500 uppercase">{product.brand}</p>}
          <div className="mt-[0.8mm] border border-zinc-800 px-[1mm] pt-[0.3mm] pb-[0.5mm]">
            <p className="text-[4pt] leading-none font-semibold tracking-wide uppercase">Size</p>
            <p className="mt-[0.4mm] flex items-end justify-between gap-[1mm]">
              <span data-testid="tag-size" className={`${longSize ? 'text-[9pt]' : 'text-[15pt]'} leading-none font-bold`}>
                {product.size}
              </span>
              <span className="min-w-0 truncate text-right text-[6pt] leading-tight font-medium">
                {pack && (
                  <span data-testid="tag-pack" className="block font-bold">
                    BOX OF {pack}
                  </span>
                )}
              </span>
            </p>
          </div>
        </div>
        {qrValue ? (
          <QrCode value={qrValue} label={`QR code for ${product.sku}`} className="h-[12mm] w-[12mm] shrink-0" />
        ) : (
          <span className="h-[12mm] w-[12mm] shrink-0" />
        )}
      </div>

      {sizes.length > 1 && (
        <ul aria-label="Sizes — tick one with a pen" className="mt-[1mm] flex flex-wrap gap-x-[1.4mm] gap-y-[0.4mm] text-[6pt] leading-[2.6mm]">
          {sizes.map((size) => {
            const current = sameSize(size, product.size);
            return (
              <li key={size} aria-current={current ? 'true' : undefined} className="flex items-center gap-[0.5mm]">
                <span aria-hidden className={`h-[2mm] w-[2mm] shrink-0 border border-zinc-800 ${current ? 'bg-zinc-900' : 'bg-white'}`} />
                <span className={current ? 'font-bold' : 'font-medium text-zinc-700'}>{size}</span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-[0.8mm] line-clamp-2 text-[6.5pt] leading-tight font-semibold">{product.name}</p>
      <p className="mt-[0.3mm] flex justify-between gap-[1mm] font-mono text-[5pt] leading-tight">
        <span className="truncate">
          ART.: <span className="font-semibold">{product.sku}</span>
        </span>
        {priceCode && <span data-testid="price-code">{priceCode}</span>}
      </p>

      {isValidEan13(product.barcode) ? (
        <div
          role="img"
          aria-label={`Barcode ${product.barcode} for ${product.sku}`}
          className="mt-[0.3mm] w-[37mm] [&>svg]:h-auto [&>svg]:w-full"
          // Our own SVG built from 13 validated digits; no user text inside. ~0.33 mm per bar.
          dangerouslySetInnerHTML={{ __html: ean13Svg(product.barcode, 3, 30) }}
        />
      ) : (
        <p className="mt-[0.5mm] text-center font-mono text-[7pt]">{product.barcode}</p>
      )}

      <div className="mt-auto border border-zinc-800 pt-[0.8mm] pb-[0.4mm]">
        <span aria-hidden className="mx-[3mm] block h-[0.5mm] bg-red-600" />
        <p className="mt-[0.4mm] text-center leading-none">
          <span className="text-[5.5pt] font-semibold">MRP </span>
          <span className="text-[11pt] font-bold">{rupees}</span>
          {paise && <sup className="text-[5.5pt] font-bold">.{paise}</sup>}
        </p>
        {pack ? (
          <p className="mt-[0.3mm] text-center text-[5pt] leading-none font-semibold">
            per piece · Box {formatPaise(boxPaise(product.mrpPaise, pack, product.packMrpPaise)).replace('.00', '')}
          </p>
        ) : (
          <p className="mt-[0.3mm] text-center text-[4pt] leading-none text-zinc-500">(incl. of all taxes)</p>
        )}
      </div>
    </div>
  );
}
