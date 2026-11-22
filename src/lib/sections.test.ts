import { describe, expect, it } from 'vitest';
import { fixedSectionKey, fixedSectionPlace, isFixedType, withFixedSections, type FixedSectionKey } from './sections';

/** Owner, 2026-11-22 (ADR-064): Men and Women are fixed collections, always in the list. */
const row = (name: string) => ({ name, fixed: fixedSectionKey(name) });
const standIn = (key: FixedSectionKey) => ({ name: `(${key})`, fixed: key });

describe('fixed collections (Men, Women)', () => {
  it('are known by their stored name, any letter case or spaces; nothing else is fixed', () => {
    expect(['Men', ' men ', 'MEN', 'Women', 'women'].map(fixedSectionKey)).toEqual(['men', 'men', 'men', 'women', 'women']);
    expect(['Boys', 'Girls', 'Kids', 'Mens', 'पुरुष', ''].map(fixedSectionKey)).toEqual([null, null, null, null, null, null]);
  });

  it('a missing one is put in: Men first, Women right after Men; the others keep their order', () => {
    expect(withFixedSections([row('Men'), row('Kids')], standIn).map((s) => s.name)).toEqual(['Men', '(women)', 'Kids']);
    expect(withFixedSections([row('Kids'), row('Men')], standIn).map((s) => s.name)).toEqual(['Kids', 'Men', '(women)']);
    expect(withFixedSections([row('Kids'), row('Women')], standIn).map((s) => s.name)).toEqual(['(men)', 'Kids', 'Women']);
    expect(withFixedSections([], standIn).map((s) => s.name)).toEqual(['(men)', '(women)']);
    const full = [row('Men'), row('Women'), row('Boys')];
    expect(withFixedSections(full, standIn)).toEqual(full);
    expect(fixedSectionPlace([row('Boys'), row('Men'), row('Kids')], 'women')).toBe(2);
    expect(fixedSectionPlace([row('Boys')], 'men')).toBe(0);
  });
});

/** Owner, 2026-11-22 (ADR-066): Jeans, Jacket and Shirt are fixed categories. */
describe('fixed categories (Jeans, Jacket, Shirt)', () => {
  it('are known by name, one or many, any case; nothing else is fixed', () => {
    expect(['Jeans', 'jeans ', 'JACKET', 'Jackets', 'Shirt', 'Shirts'].map(isFixedType)).toEqual([true, true, true, true, true, true]);
    expect(['T-Shirt', 'Gents Jeans', 'Ladies Jeans', 'Pajama', 'Jean', ''].map(isFixedType)).toEqual([false, false, false, false, false, false]);
  });
});
