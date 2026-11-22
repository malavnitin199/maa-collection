import { describe, expect, it } from 'vitest';
import { formatPaise, paperRupees, rupeesText, wholeRupees } from './money';

describe('formatPaise', () => {
  it('formats paise as INR rupees', () => {
    expect(formatPaise(49900)).toMatch(/₹\s?499\.00/);
    expect(formatPaise(129900)).toMatch(/₹\s?1,299\.00/);
    expect(formatPaise(0)).toMatch(/₹\s?0\.00/);
  });

  it('rejects non-integer amounts', () => {
    expect(() => formatPaise(499.5)).toThrow();
    expect(() => formatPaise(Number.NaN)).toThrow();
  });
});

describe('paperRupees / rupeesText (bill tables, ADR-061/062)', () => {
  it('prints rupees like a paper bill: Indian grouping, two decimals, no ₹', () => {
    expect(paperRupees(612000)).toBe('6,120.00');
    expect(paperRupees(12345600)).toBe('1,23,456.00');
    expect(paperRupees(11650)).toBe('116.50');
    expect(paperRupees(0)).toBe('0.00');
  });
  it('gives a rate box its rupees, or nothing', () => {
    expect(rupeesText(68000)).toBe('680');
    expect(rupeesText(11650)).toBe('116.5');
    expect(rupeesText(null)).toBe('');
  });
});

describe('wholeRupees (figure boxes, ADR-066)', () => {
  it('rounds to whole rupees with Indian grouping', () => {
    expect(wholeRupees(12345678)).toBe('₹1,23,457');
    expect(wholeRupees(0)).toBe('₹0');
    expect(wholeRupees(4950)).toBe('₹50');
  });
});
