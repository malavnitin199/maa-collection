import { describe, expect, it } from 'vitest';
import { boxPaise, boxSale, packOf, perPiecePaise, tagsFor } from './packs';

describe('box packs', () => {
  it('a box size is 2 … 1000 whole pieces', () => {
    expect([packOf(12), packOf(1), packOf(0), packOf(2.5), packOf(null), packOf(1001)]).toEqual([12, null, null, null, null, null]);
  });
  it('per piece from a box price; a box from a piece price', () => {
    expect(perPiecePaise(50000, 12)).toBe(4167);
    expect(boxPaise(4500, 10)).toBe(45000);
    expect(boxPaise(4500, 10, 40000)).toBe(40000);
  });
  it('one tag per box, a part box gets one too; loose items one per piece', () => {
    expect([tagsFor(36, 12), tagsFor(30, 12), tagsFor(5, null), tagsFor(0, 12)]).toEqual([3, 3, 5, 0]);
  });
  it('a whole-box sale keeps the exact box total; the piece price is rounded', () => {
    expect(boxSale(1, 12, 40000)).toEqual({ quantity: 12, unitPricePaise: 3333, totalPaise: 40000 });
    expect(boxSale(2, 10, 45000)).toEqual({ quantity: 20, unitPricePaise: 4500, totalPaise: 90000 });
  });
});
