import { describe, expect, it } from 'vitest';
import { ean13Modules, ean13Svg, inStoreEan13, isValidEan13 } from './ean13';

describe('ean13Modules', () => {
  it('builds 95 modules with start, centre and end guards', () => {
    const bits = ean13Modules('8901111000014');
    expect(bits).toHaveLength(95);
    expect(bits.slice(0, 3)).toBe('101');
    expect(bits.slice(45, 50)).toBe('01010');
    expect(bits.slice(92)).toBe('101');
  });

  it('matches the published encoding of 4006381333931', () => {
    // First digit 4 => left parity LGLLGG; digits 006381 / 333931.
    expect(ean13Modules('4006381333931')).toBe(
      '101' +
        '0001101' + '0100111' + '0101111' + '0111101' + '0001001' + '0110011' +
        '01010' +
        '1000010' + '1000010' + '1000010' + '1110100' + '1000010' + '1100110' +
        '101',
    );
  });

  it('refuses an invalid code instead of drawing an unscannable barcode', () => {
    expect(() => ean13Modules('8901111000011')).toThrow(/Invalid EAN-13/);
  });

  it('renders an SVG with the readable digits', () => {
    const svg = ean13Svg('8901111000014');
    expect(svg).toMatch(/^<svg /);
    // Standard layout: first digit outside the bars, then two groups of six.
    expect(svg).toContain('>8<');
    expect(svg).toContain('>901111<');
    expect(svg).toContain('>000014<');
  });
});

describe('isValidEan13', () => {
  it('accepts codes with a correct check digit', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('8901111000014')).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidEan13('8901111000011')).toBe(false);
  });

  it('rejects wrong length or non-digits', () => {
    expect(isValidEan13('890111100001')).toBe(false);
    expect(isValidEan13('MAA-TS-001')).toBe(false);
    expect(isValidEan13('')).toBe(false);
  });
});

describe('inStoreEan13', () => {
  it('builds valid in-store barcodes with the 200 prefix', () => {
    const code = inStoreEan13(1);
    expect(code).toBe('2000000000015');
    expect(isValidEan13(code)).toBe(true);
    expect(isValidEan13(inStoreEan13(123_456_789))).toBe(true);
  });

  it('rejects out-of-range sequence numbers', () => {
    expect(() => inStoreEan13(0)).toThrow();
    expect(() => inStoreEan13(1_000_000_000)).toThrow();
  });
});
