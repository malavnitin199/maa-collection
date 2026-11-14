import { mkdir } from 'node:fs/promises';
import QRCode from 'qrcode';
import { DUMMY_CATALOG } from '../src/features/catalog/dummy-catalog.ts';

// Encodes the SKU; the POS lookup accepts either SKU or barcode.
async function main() {
  await mkdir('public/qr', { recursive: true });
  for (const item of DUMMY_CATALOG) {
    const file = `public/qr/${item.sku}.png`;
    await QRCode.toFile(file, item.sku, { width: 320, margin: 2 });
    console.log(`wrote ${file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
