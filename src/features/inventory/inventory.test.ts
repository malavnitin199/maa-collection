import { describe, expect, it } from 'vitest';
import { rupeesToPaise, saleTotalPaise, validateSaleDraft } from './inventory';

describe('rupeesToPaise', () => {
  it('parses rupee strings into integer paise', () => {
    expect(rupeesToPaise('450')).toBe(45000);
    expect(rupeesToPaise('1,299')).toBe(129900);
    expect(rupeesToPaise('450.5')).toBe(45050);
    expect(rupeesToPaise('0.07')).toBe(7);
  });

  it('rejects invalid amounts', () => {
    expect(rupeesToPaise('')).toBeNull();
    expect(rupeesToPaise('abc')).toBeNull();
    expect(rupeesToPaise('12.345')).toBeNull();
    expect(rupeesToPaise('-5')).toBeNull();
  });
});

describe('validateSaleDraft', () => {
  const limits = { stock: 3, mrpPaise: 49900 };

  it('accepts a bargained price at or below MRP within stock', () => {
    expect(validateSaleDraft({ quantity: 2, unitPricePaise: 45000 }, limits)).toBeNull();
    expect(validateSaleDraft({ quantity: 3, unitPricePaise: 49900 }, limits)).toBeNull();
  });

  it('rejects non-positive or fractional quantity', () => {
    expect(validateSaleDraft({ quantity: 0, unitPricePaise: 45000 }, limits)).toMatch(/whole number/);
    expect(validateSaleDraft({ quantity: 1.5, unitPricePaise: 45000 }, limits)).toMatch(/whole number/);
  });

  it('rejects deducting more than available stock', () => {
    expect(validateSaleDraft({ quantity: 4, unitPricePaise: 45000 }, limits)).toBe('Only 3 left in stock.');
    expect(validateSaleDraft({ quantity: 1, unitPricePaise: 45000 }, { stock: 0, mrpPaise: 49900 })).toBe('Out of stock.');
  });

  it('rejects invalid or above-MRP prices', () => {
    expect(validateSaleDraft({ quantity: 1, unitPricePaise: 0 }, limits)).toMatch(/valid sale price/);
    expect(validateSaleDraft({ quantity: 1, unitPricePaise: 50000 }, limits)).toBe('Sale price cannot be above MRP.');
  });
});

describe('saleTotalPaise', () => {
  it('multiplies in exact paise', () => {
    expect(saleTotalPaise(3, 45000)).toBe(135000);
  });
});
