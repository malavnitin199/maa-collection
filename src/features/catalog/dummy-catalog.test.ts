import { describe, expect, it } from 'vitest';
import { isValidEan13 } from '@/features/scanning/ean13';
import { DUMMY_CATALOG, findByBarcodeOrSku } from './dummy-catalog';

describe('dummy catalog lookup', () => {
  it('finds an item by barcode', () => {
    expect(findByBarcodeOrSku('8902222000016')?.sku).toBe('MAA-KU-001');
  });

  it('finds an item by SKU, case-insensitive and trimmed', () => {
    expect(findByBarcodeOrSku('  maa-ts-001 ')?.design).toBe('Classic Crew Tee');
  });

  it('returns undefined for unknown or empty codes', () => {
    expect(findByBarcodeOrSku('0000000000000')).toBeUndefined();
    expect(findByBarcodeOrSku('   ')).toBeUndefined();
  });

  it('keeps barcodes and SKUs unique', () => {
    const barcodes = new Set(DUMMY_CATALOG.map((i) => i.barcode));
    const skus = new Set(DUMMY_CATALOG.map((i) => i.sku));
    expect(barcodes.size).toBe(DUMMY_CATALOG.length);
    expect(skus.size).toBe(DUMMY_CATALOG.length);
  });

  it('uses real-world-valid EAN-13 barcodes, so printed labels can actually scan', () => {
    for (const item of DUMMY_CATALOG) {
      expect(isValidEan13(item.barcode), `${item.sku} barcode ${item.barcode}`).toBe(true);
    }
  });

  it('never exposes cost or supplier fields to the cashier catalog', () => {
    for (const item of DUMMY_CATALOG) {
      const keys = Object.keys(item).join(',');
      expect(keys).not.toMatch(/cost|profit|supplier/i);
    }
  });
});
