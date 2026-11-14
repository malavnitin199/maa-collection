import { describe, expect, it } from 'vitest';
import { DUMMY_CATALOG, findByBarcodeOrSku } from './dummy-catalog';

describe('dummy catalog lookup', () => {
  it('finds an item by barcode', () => {
    expect(findByBarcodeOrSku('8902222000013')?.sku).toBe('MAA-KU-001');
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

  it('never exposes cost or supplier fields to the cashier catalog', () => {
    for (const item of DUMMY_CATALOG) {
      const keys = Object.keys(item).join(',');
      expect(keys).not.toMatch(/cost|profit|supplier/i);
    }
  });
});
