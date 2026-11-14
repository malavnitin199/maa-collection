import { mkdir, writeFile } from 'node:fs/promises';
import { DUMMY_CATALOG } from '../src/features/catalog/dummy-catalog.ts';
import { ean13Svg } from '../src/features/scanning/ean13.ts';

// One label per demo item: public/barcodes/<SKU>.svg, an EAN-13 barcode
// encoding the item's barcode number (the POS looks items up by it).
async function main() {
  await mkdir('public/barcodes', { recursive: true });
  for (const item of DUMMY_CATALOG) {
    const file = `public/barcodes/${item.sku}.svg`;
    await writeFile(file, ean13Svg(item.barcode));
    console.log(`wrote ${file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
