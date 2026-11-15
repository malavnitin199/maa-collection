import { describe, expect, it } from 'vitest';
import { cleanSizeList, DEFAULT_CATEGORY_SIZES, tagSizeRange } from './size-lists';

describe('category size lists', () => {
  it('cleans a typed list: order kept, blanks and repeats (any case) dropped', () => {
    expect(cleanSizeList(' S, m ,L,, XL , s, xxl ')).toEqual(['S', 'm', 'L', 'XL', 'xxl']);
    expect(cleanSizeList(['28', ' 30 ', '28'])).toEqual(['28', '30']);
    expect(cleanSizeList('')).toEqual([]);
  });

  it('starts with the owner’s lists: shirts S–XXL, kurtas M–XXL, jeans by gender, sarees Free', () => {
    expect(DEFAULT_CATEGORY_SIZES.SH).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
    expect(DEFAULT_CATEGORY_SIZES.KU).toEqual(['M', 'L', 'XL', 'XXL']);
    expect(DEFAULT_CATEGORY_SIZES.LJ).toEqual(['26', '28', '30', '32']);
    expect(DEFAULT_CATEGORY_SIZES.GJ).toEqual(['28', '30', '32', '34', '36']);
    expect(DEFAULT_CATEGORY_SIZES.SA).toEqual(['Free']);
  });
});

describe('size row on a tag', () => {
  it("prints the category's whole list, in its order", () => {
    expect(tagSizeRange(['M', 'L', 'XL', 'XXL'], ['M'], 'm')).toEqual(['M', 'L', 'XL', 'XXL']);
  });
  it('adds the piece’s own size when the category list lacks it', () => {
    expect(tagSizeRange(['S', 'M', 'L', 'XL', 'XXL'], ['40'], '40')).toEqual(['S', 'M', 'L', 'XL', 'XXL', '40']);
  });
  it('falls back to the design’s sizes when the category has no list', () => {
    expect(tagSizeRange([], ['M', 'XL'], 'XL')).toEqual(['M', 'XL']);
    expect(tagSizeRange([], [], 'Free')).toEqual(['Free']);
  });
});
