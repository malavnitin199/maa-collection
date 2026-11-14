import { describe, expect, it } from 'vitest';
import { createScanBuffer } from './scanner-keystrokes';

function feed(buffer: ReturnType<typeof createScanBuffer>, text: string, start: number, gap: number) {
  let at = start;
  let result: string | null = null;
  for (const key of [...text.split(''), 'Enter']) {
    result = buffer.push(key, at);
    at += gap;
  }
  return result;
}

describe('createScanBuffer', () => {
  it('returns the code for a fast burst ending in Enter', () => {
    expect(feed(createScanBuffer(), 'MAA-TS-001', 0, 10)).toBe('MAA-TS-001');
  });

  it('ignores slow human typing', () => {
    expect(feed(createScanBuffer(), 'MAA-TS-001', 0, 300)).toBeNull();
  });

  it('ignores a lone Enter and too-short bursts', () => {
    const buffer = createScanBuffer();
    expect(buffer.push('Enter', 0)).toBeNull();
    expect(feed(buffer, 'AB', 1000, 10)).toBeNull();
  });

  it('ignores modifier keys inside a burst (scanners send Shift for capitals)', () => {
    const buffer = createScanBuffer();
    buffer.push('Shift', 0);
    buffer.push('M', 5);
    buffer.push('Shift', 10);
    buffer.push('A', 15);
    buffer.push('A', 20);
    expect(buffer.push('Enter', 25)).toBe('MAA');
  });

  it('starts fresh after a pause, dropping stale keys', () => {
    const buffer = createScanBuffer();
    buffer.push('x', 0);
    expect(feed(buffer, '8901111000014', 5000, 10)).toBe('8901111000014');
  });
});
