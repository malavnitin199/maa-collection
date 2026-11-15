import { describe, expect, it } from 'vitest';
import { forSpeech } from './voice';

describe('screen text → spoken text', () => {
  it('drops emoji and arrows, turns symbols into pauses or words', () => {
    expect(forSpeech('💡 Tab Sell → tap Scan · then ✓ done 🔊', 'en')).toBe('Tab Sell, tap Scan, then done');
    expect(forSpeech('New design in sizes × colours…', 'en')).toBe('New design in sizes by colours.');
    expect(forSpeech('साइज़ × रंग → सेव करें', 'hi')).toBe('साइज़ और रंग, सेव करें');
    expect(forSpeech('  ✎ Edit this item ,  fix it  ', 'en')).toBe('Edit this item, fix it');
  });
});
