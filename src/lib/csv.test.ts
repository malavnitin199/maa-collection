import { describe, expect, it } from 'vitest';
import { csvCell, rupees, toCsv } from './csv';

describe('csv', () => {
  it('quotes commas, quotes and new lines; neutralises formulas', () => {
    expect(csvCell('Kurta, Blue')).toBe('"Kurta, Blue"');
    expect(csvCell('6" scarf')).toBe('"6"" scarf"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(null)).toBe('');
  });

  it('builds rows with a BOM and CRLF; money in rupees', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('﻿a,b\r\n1,x\r\n');
    expect(rupees(49900)).toBe('499.00');
    expect(rupees(null)).toBe('');
  });
});
