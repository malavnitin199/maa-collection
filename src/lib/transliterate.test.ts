import { describe, expect, it } from 'vitest';
import { convertLastWord, convertTrailingWord, hasDevanagari, toEnglish, toHindi } from './transliterate';

/** Typing in Hindi or English (2026-11-20): shop words from the list, letter rules for the rest, and back again. */
describe('toHindi', () => {
  it('uses the shop word list, whatever the letter case', () => {
    expect(toHindi('Chikan Kurta')).toBe('चिकन कुर्ता');
    expect(toHindi('SAREE')).toBe('साड़ी');
    expect(toHindi('Surat Textiles')).toBe('सूरत टेक्सटाइल्स');
    expect(toHindi('t-shirt')).toBe('टी-शर्ट');
  });

  it('spells other words by their letters', () => {
    expect(toHindi('kamal')).toBe('कमल');
    expect(toHindi('Ramesh')).toBe('रमेश');
    expect(toHindi('rani')).toBe('रानी'.replace('ा', '')); // rani → रनी (no long a typed)
    expect(toHindi('raani')).toBe('रानी');
    expect(toHindi('dhoti')).toBe('धोती');
    expect(toHindi('sadhu')).toBe('सधू');
    expect(toHindi('drum')).toBe('ड्रुम');
    expect(toHindi('Dal')).toBe('डल');
    expect(toHindi('pankaj')).toBe('पंकज');
    expect(toHindi('amma')).toBe('अम्मा');
  });

  it('leaves numbers, marks and Devanagari alone', () => {
    expect(toHindi('Kurta 2 pcs, M/L (कपड़ा) MRP')).toBe('कुर्ता 2 प्क्स, M/L (कपड़ा) MRP');
    expect(toHindi('')).toBe('');
    expect(toHindi('123')).toBe('123');
  });
});

describe('toEnglish', () => {
  it('uses the word list first, then letters, and capitalises words', () => {
    expect(toEnglish('चिकन कुर्ता')).toBe('Chikan Kurta');
    expect(toEnglish('साड़ी')).toBe('Saree');
    expect(toEnglish('रमेश')).toBe('Ramesh');
    expect(toEnglish('कमल')).toBe('Kamal');
    expect(toEnglish('पंकज')).toBe('Pankaj');
    expect(toEnglish('अम्मा')).toBe('Amma');
    expect(toEnglish('ज़री')).toBe('Zari');
    expect(toEnglish('१२ कुर्ती')).toBe('12 Kurti');
  });

  it('keeps English and marks as typed', () => {
    expect(toEnglish('Kurta M/L 2 pcs')).toBe('Kurta M/L 2 pcs');
  });
});

describe('while typing in Hindi', () => {
  it('converts the last English word once a space or mark follows it, and the trailing word on blur', () => {
    expect(convertLastWord('chikan ')).toBe('चिकन ');
    expect(convertLastWord('चिकन kurta, ')).toBe('चिकन कुर्ता, ');
    expect(convertLastWord('chikan')).toBe('chikan'); // still being typed
    expect(convertLastWord('चिकन ')).toBe('चिकन ');
    expect(convertTrailingWord('चिकन kurta')).toBe('चिकन कुर्ता');
    expect(convertTrailingWord('MRP 1299')).toBe('MRP 1299');
  });

  it('knows Devanagari when it sees it', () => {
    expect(hasDevanagari('कुर्ता')).toBe(true);
    expect(hasDevanagari('kurta')).toBe(false);
  });
});
