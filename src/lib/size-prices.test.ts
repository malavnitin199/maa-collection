import { describe, expect, it } from 'vitest';
import { ratesForSize, sortSizes, splitDesignRates, type VariantRates } from './size-prices';

describe('ratesForSize', () => {
  const defaults = { mrpPaise: 70000, pricePaise: 50000, costPaise: 30000 };

  it('uses the defaults when the size has nothing of its own', () => {
    expect(ratesForSize(defaults)).toEqual(defaults);
    expect(ratesForSize(defaults, { mrpPaise: null, pricePaise: undefined })).toEqual(defaults);
  });

  it("uses the size's own values field by field", () => {
    expect(ratesForSize(defaults, { pricePaise: 60000 })).toEqual({ mrpPaise: 70000, pricePaise: 60000, costPaise: 30000 });
    expect(ratesForSize(defaults, { costPaise: 36000, mrpPaise: 75000 })).toEqual({ mrpPaise: 75000, pricePaise: 50000, costPaise: 36000 });
  });

  it("with no selling price, sells at that size's own MRP", () => {
    const atMrp = { mrpPaise: 70000, pricePaise: null, costPaise: null };
    expect(ratesForSize(atMrp).pricePaise).toBe(70000);
    expect(ratesForSize(atMrp, { mrpPaise: 80000 }).pricePaise).toBe(80000);
  });
});

describe('sortSizes', () => {
  it('orders letter sizes, then numbers, then the rest as given', () => {
    expect(sortSizes(['XL', 'Free', 'M', '32', '5-6Y', 'S', '28', '3XL'])).toEqual(['S', 'M', 'XL', '3XL', '28', '32', 'Free', '5-6Y']);
  });
});

describe('splitDesignRates', () => {
  const variant = (size: string, mrp: number, price: number, cost: number | null): VariantRates => ({
    size,
    mrpPaise: mrp,
    pricePaise: price,
    costPaise: cost,
  });
  const roundTrip = (variants: VariantRates[]) => {
    const { defaults, own } = splitDesignRates(variants);
    for (const v of variants) {
      expect(ratesForSize(defaults, own.find((o) => o.size.toLowerCase() === v.size.toLowerCase())), v.size).toEqual({
        mrpPaise: v.mrpPaise,
        pricePaise: v.pricePaise,
        costPaise: v.costPaise,
      });
    }
  };

  it('one price for all sizes and colours: only defaults', () => {
    const variants = ['Black', 'White'].flatMap(() => ['M', 'L', 'XL'].map((s) => variant(s, 70000, 50000, 30000)));
    expect(splitDesignRates(variants)).toEqual({
      sizes: ['M', 'L', 'XL'],
      defaults: { mrpPaise: 70000, pricePaise: 50000, costPaise: 30000 },
      own: [],
      mixedSizes: [],
    });
  });

  it('picks the most common value as the default and lists the sizes that differ', () => {
    const variants = ['XL', 'L', 'M'].flatMap((s) => [
      variant(s, s === 'XL' ? 75000 : 70000, { M: 50000, L: 55000, XL: 60000 }[s]!, { M: 30000, L: 33000, XL: 36000 }[s]!),
    ]);
    const split = splitDesignRates([...variants, ...variants]);
    expect(split.sizes).toEqual(['M', 'L', 'XL']);
    expect(split.defaults).toEqual({ mrpPaise: 70000, pricePaise: 50000, costPaise: 30000 });
    expect(split.own).toEqual([
      { size: 'L', pricePaise: 55000, costPaise: 33000 },
      { size: 'XL', mrpPaise: 75000, pricePaise: 60000, costPaise: 36000 },
    ]);
    roundTrip(variants);
  });

  it('every size at its own MRP → empty default selling price; missing purchase price → empty default', () => {
    const variants = [variant('M', 50000, 50000, null), variant('L', 60000, 60000, 33000), variant('XL', 60000, 60000, 33000)];
    const split = splitDesignRates(variants);
    expect(split.defaults).toEqual({ mrpPaise: 60000, pricePaise: null, costPaise: null });
    expect(split.own).toEqual([
      { size: 'M', mrpPaise: 50000 },
      { size: 'L', costPaise: 33000 },
      { size: 'XL', costPaise: 33000 },
    ]);
    roundTrip(variants);
  });

  it('names sizes whose colours differ today and uses the first colour', () => {
    const split = splitDesignRates([variant('M', 70000, 50000, null), variant('m', 70000, 45000, null), variant('L', 70000, 50000, null)]);
    expect(split.sizes).toEqual(['M', 'L']);
    expect(split.mixedSizes).toEqual(['M']);
    expect(split.own).toEqual([]);
  });
});
