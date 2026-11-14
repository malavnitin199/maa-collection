import { describe, expect, it } from 'vitest';
import { codeWordProblem, decodePriceCode, encodePriceCode } from './price-code';

describe('code price', () => {
  it('encodes whole rupees with the code word (B=1 … E=0)', () => {
    expect(encodePriceCode(45000, 'BLACKHORSE')).toBe('CKE');
    expect(encodePriceCode(120099, 'blackhorse')).toBe('BLEE'); // ₹1200.99 → 1200
    expect(encodePriceCode(0, 'BLACKHORSE')).toBe('E');
  });

  it('decodes back to rupees', () => {
    expect(decodePriceCode('cke', 'BLACKHORSE')).toBe(450);
    expect(decodePriceCode('CKZ', 'BLACKHORSE')).toBeNull();
  });

  it('rejects code words that are not 10 different letters', () => {
    expect(codeWordProblem('BLACKHORSE')).toBeNull();
    expect(codeWordProblem('MAHALAXMIS')).toMatch(/different/);
    expect(codeWordProblem('SHORT')).toMatch(/exactly 10/);
    expect(codeWordProblem('BLACK HORSE')).toBeNull(); // spaces ignored
  });
});
