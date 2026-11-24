import { describe, expect, it } from 'vitest';
import { markupOf, saleFromCost } from './markup';

describe('sale price from the purchase price (ADR-053)', () => {
  it('reads the remembered % (50 when there is none, never above 500)', () => {
    expect(markupOf(null)).toBe(50);
    expect(markupOf('')).toBe(50);
    expect(markupOf('abc')).toBe(50);
    expect(markupOf('30')).toBe(30);
    expect(markupOf('999')).toBe(500);
  });
  it('adds the % and rounds to whole rupees; nothing without a purchase price', () => {
    expect(saleFromCost(70000, 50)).toBe(105000);
    expect(saleFromCost(33300, 50)).toBe(50000); // ₹499.50 → ₹500
    expect(saleFromCost(45000, 20)).toBe(54000);
    expect(saleFromCost(0, 50)).toBeNull();
    expect(saleFromCost(null, 50)).toBeNull();
  });
});
