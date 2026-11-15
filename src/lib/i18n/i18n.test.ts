import { describe, expect, it } from 'vitest';
import { validateSaleDraft } from '@/features/inventory/inventory';
import { fill, isLocale, makeT, MESSAGES, plural, tEnglish, type MessageKey } from './index';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('Hindi has every English key, none empty, with the same {placeholders}', () => {
    const keys = Object.keys(MESSAGES.en) as MessageKey[];
    expect(Object.keys(MESSAGES.hi).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(MESSAGES.hi[key].trim(), key).not.toBe('');
      expect(placeholders(MESSAGES.hi[key]), key).toEqual(placeholders(MESSAGES.en[key]));
    }
  });

  it('Hindi lines are really in Devanagari (not English copied over), except shop words', () => {
    for (const [key, text] of Object.entries(MESSAGES.hi) as [MessageKey, string][]) {
      // Same as English on purpose (MRP, SKU, PIN, CSV…), or the switch button's "English".
      if (text === MESSAGES.en[key] || key === 'lang.switchTo') continue;
      expect(/[ऀ-ॿ]/.test(text), key).toBe(true);
    }
  });
});

describe('translate', () => {
  it('fills values and leaves unknown placeholders as typed', () => {
    expect(fill('Only {n} left in {place}.', { n: 3 })).toBe('Only 3 left in {place}.');
    const hi = makeT(MESSAGES.hi);
    expect(hi('error.onlyLeft', { n: 2 })).toBe('स्टॉक में सिर्फ़ 2 बचे हैं।');
    expect(tEnglish('scan.notFound', { code: 'X1' })).toBe('No item found for "X1".');
  });

  it('plurals: 1 pc / 2 pcs in English, पीस in Hindi', () => {
    expect(plural(tEnglish, 'my.pcs', 1)).toBe('1 pc');
    expect(plural(tEnglish, 'my.pcs', 2)).toBe('2 pcs');
    expect(plural(tEnglish, 'my.sales', 1)).toBe('1 sale');
    expect(plural(makeT(MESSAGES.hi), 'my.pcs', 5)).toBe('5 पीस');
  });

  it('only English and Hindi are accepted as languages', () => {
    expect(isLocale('hi')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('sale checks speak the person’s language (English by default)', () => {
    const limits = { stock: 3, mrpPaise: 49900 };
    expect(validateSaleDraft({ quantity: 4, unitPricePaise: 100 }, limits)).toBe('Only 3 left in stock.');
    expect(validateSaleDraft({ quantity: 1, unitPricePaise: 50000 }, limits, makeT(MESSAGES.hi))).toBe('बिक्री दाम MRP से ज़्यादा नहीं हो सकता।');
  });
});
