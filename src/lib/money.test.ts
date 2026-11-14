import { describe, expect, it } from 'vitest';
import { formatPaise } from './money';

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
