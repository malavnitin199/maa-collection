import { describe, expect, it } from 'vitest';
import { stockValue } from './stock-value';

describe('stockValue (ADR-057): pieces × purchase price = total', () => {
  it('one price: pieces, that price, and pieces × price', () => {
    expect(stockValue([{ stock: 8, costPaise: 90_000 }])).toEqual({
      pieces: 8,
      perPiece: { minPaise: 90_000, maxPaise: 90_000 },
      totalPaise: 720_000,
      piecesWithoutPrice: 0,
    });
  });

  it('sizes with their own purchase price: a range per piece, the exact total', () => {
    const value = stockValue([
      { stock: 2, costPaise: 30_000 },
      { stock: 1, costPaise: 33_000 },
      { stock: 3, costPaise: 36_000 },
    ]);
    expect(value.pieces).toBe(6);
    expect(value.perPiece).toEqual({ minPaise: 30_000, maxPaise: 36_000 });
    expect(value.totalPaise).toBe(2 * 30_000 + 33_000 + 3 * 36_000);
  });

  it('a size with no pieces does not widen the range (it adds nothing to the total)', () => {
    const value = stockValue([
      { stock: 4, costPaise: 50_000 },
      { stock: 0, costPaise: 45_000 },
    ]);
    expect(value.perPiece).toEqual({ minPaise: 50_000, maxPaise: 50_000 });
    expect(value.totalPaise).toBe(200_000);
  });

  it('nothing in stock: still shows the price, total zero', () => {
    const value = stockValue([{ stock: 0, costPaise: 50_000 }]);
    expect(value).toEqual({ pieces: 0, perPiece: { minPaise: 50_000, maxPaise: 50_000 }, totalPaise: 0, piecesWithoutPrice: 0 });
  });

  it('stock below zero (sold offline) counts as no pieces, never a negative amount', () => {
    const value = stockValue([
      { stock: -2, costPaise: 50_000 },
      { stock: 3, costPaise: 50_000 },
    ]);
    expect(value.pieces).toBe(3);
    expect(value.totalPaise).toBe(150_000);
  });

  it('items without a purchase price: counted as pieces, left out of the total, reported', () => {
    expect(stockValue([{ stock: 5, costPaise: null }])).toEqual({ pieces: 5, perPiece: null, totalPaise: 0, piecesWithoutPrice: 5 });
    const mixed = stockValue([
      { stock: 2, costPaise: 40_000 },
      { stock: 3, costPaise: null },
    ]);
    expect(mixed).toEqual({ pieces: 5, perPiece: { minPaise: 40_000, maxPaise: 40_000 }, totalPaise: 80_000, piecesWithoutPrice: 3 });
  });

  it('no items: nothing at all', () => {
    expect(stockValue([])).toEqual({ pieces: 0, perPiece: null, totalPaise: 0, piecesWithoutPrice: 0 });
  });
});
