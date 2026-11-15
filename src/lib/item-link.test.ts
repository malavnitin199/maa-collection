import { describe, expect, it } from 'vitest';
import { codeFromScan, itemLink } from './item-link';

describe('tag QR item links', () => {
  it('builds the link the QR code holds', () => {
    expect(itemLink('https://maa-collection-pi.vercel.app/', '2000000000017')).toBe('https://maa-collection-pi.vercel.app/i/2000000000017');
  });

  it('a scanned item link gives back the code, from any domain (old tags keep working)', () => {
    expect(codeFromScan('https://maa-collection-pi.vercel.app/i/2000000000017')).toBe('2000000000017');
    expect(codeFromScan(' http://localhost:3000/i/8901111000014/ ')).toBe('8901111000014');
    expect(codeFromScan('https://shop.example.in/maa/i/MAA-KU-001?x=1')).toBe('MAA-KU-001');
  });

  it('anything else is used as typed', () => {
    expect(codeFromScan(' 8901111000014 ')).toBe('8901111000014');
    expect(codeFromScan('MAA-TS-001')).toBe('MAA-TS-001');
    expect(codeFromScan('https://example.com/other/2000000000017')).toBe('https://example.com/other/2000000000017');
  });
});
