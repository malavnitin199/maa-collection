import { describe, expect, it } from 'vitest';
import { cleanSizeList, DEFAULT_CATEGORY_SIZES, mergeSizeEdit, tagSizeRange } from './size-lists';

describe('✎ on a category: only what the sheet changed (ADR-071)', () => {
  it('nothing changed: null (the list stays as it is today)', () => {
    expect(mergeSizeEdit(['S', 'M', 'L'], ['S', 'M'], ['M', 'S'])).toBeNull();
  });
  it('a size added elsewhere meanwhile stays; the sheet’s own add and remove apply', () => {
    // The sheet started from S, M, L (an old tile); today the list also has XL (someone's "+ Add size").
    expect(mergeSizeEdit(['S', 'M', 'L', 'XL'], ['S', 'M', 'L'], ['M', 'L', 'XXL'])).toEqual(['M', 'L', 'XL', 'XXL']);
  });
  it('letter case and spaces do not count as a change; shop order is kept', () => {
    expect(mergeSizeEdit(['28', '30'], ['28', '30'], [' 30', '28 '])).toBeNull();
    // Known sizes come back in shop order and the shop's spelling, as the size chips write them.
    expect(mergeSizeEdit(['m', 'l'], ['m', 'l'], ['M', 'L', 'S'])).toEqual(['S', 'M', 'L']);
  });
  it('removing every size empties the list', () => {
    expect(mergeSizeEdit(['Free'], ['Free'], [])).toEqual([]);
  });
});

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
