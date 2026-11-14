import { mkdir, writeFile } from 'node:fs/promises';
import QRCode from 'qrcode';
import { DUMMY_CATALOG } from '../src/features/catalog/dummy-catalog.ts';
import { ean13Svg } from '../src/features/scanning/ean13.ts';

// Test labels for every demo item:
// - public/qr/<SKU>.png       QR code encoding the SKU
// - public/barcodes/<SKU>.svg EAN-13 barcode encoding the item's barcode number
// The POS lookup accepts either value.
async function main() {
  await mkdir('public/qr', { recursive: true });
  await mkdir('public/barcodes', { recursive: true });
  for (const item of DUMMY_CATALOG) {
    const qrFile = `public/qr/${item.sku}.png`;
    await QRCode.toFile(qrFile, item.sku, { width: 320, margin: 2 });
    const barcodeFile = `public/barcodes/${item.sku}.svg`;
    await writeFile(barcodeFile, ean13Svg(item.barcode));
    console.log(`wrote ${qrFile} and ${barcodeFile}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
