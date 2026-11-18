import { describe, expect, it } from 'vitest';
import { saleDeal } from './deal';

describe('profit or loss of a sale (plan v17)', () => {
  it('compares what was paid with the purchase price saved on the sale', () => {
    expect(saleDeal(2 * 120000, 80000, 2)).toEqual({ kind: 'profit', amountPaise: 80000 });
    expect(saleDeal(45000, 50000, 1)).toEqual({ kind: 'loss', amountPaise: 5000 });
    expect(saleDeal(50000, 50000, 1)).toEqual({ kind: 'even', amountPaise: 0 });
  });

  it('no purchase price (hand-entered sale, or none was set) = unknown', () => {
    expect(saleDeal(30000, null, 1)).toEqual({ kind: 'unknown' });
  });
});
