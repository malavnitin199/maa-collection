import { describe, expect, it } from 'vitest';
import { designKey, groupDesigns, parseDesignKey, type DesignRow } from './design-groups';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
let n = 0;
const row = (over: Partial<DesignRow>): DesignRow => ({
  id: `id-${n++}`,
  name: 'Anarkali Kurta',
  supplierId: A,
  supplierName: 'Ganga Textiles',
  mrpPaise: 149900,
  pricePaise: 129900,
  size: 'M',
  color: 'Maroon',
  stock: 1,
  ...over,
});

describe('combined view: one design per name + company + MRP', () => {
  it('combines sizes and colours of one design, counting pieces per size and per colour', () => {
    const rows = [
      row({ size: 'XL', color: 'Navy', stock: 2 }),
      row({ size: 'M', color: 'Maroon', stock: 3 }),
      row({ size: 'L', color: 'Maroon', stock: 0 }),
      row({ size: 'm', color: ' navy ', stock: 1, pricePaise: 119900 }), // same size/colour, other spelling
    ];
    const [design, ...rest] = groupDesigns(rows);
    expect(rest).toHaveLength(0);
    expect(design.items).toHaveLength(4);
    // Opened, its items read by colour, then size in shop order.
    expect(design.items.map((r) => `${r.color.trim()} ${r.size}`)).toEqual(['navy m', 'Navy XL', 'Maroon M', 'Maroon L']);
    expect(design.sizes).toEqual([
      { size: 'M', pieces: 4 },
      { size: 'L', pieces: 0 },
      { size: 'XL', pieces: 2 },
    ]);
    expect(design.colors).toEqual([
      { color: 'Navy', pieces: 3 },
      { color: 'Maroon', pieces: 3 },
    ]);
    expect(design).toMatchObject({ name: 'Anarkali Kurta', supplierName: 'Ganga Textiles', mrpPaise: 149900, pieces: 6, minPricePaise: 119900, maxPricePaise: 129900 });
  });

  it('keeps designs apart when the name, the company or the MRP differs; keeps first-seen order', () => {
    const groups = groupDesigns([
      row({ name: 'Anarkali Kurta' }),
      row({ name: 'Anarkali Kurta', supplierId: B, supplierName: 'Rangoli' }),
      row({ name: 'Anarkali Kurta', mrpPaise: 159900, size: 'XXL' }), // a bigger size with its own MRP
      row({ name: 'anarkali  kurta', size: 'L' }), // same design, other spelling
      row({ name: 'Old kurta', supplierId: null, supplierName: null }),
    ]);
    expect(groups.map((g) => [g.supplierName, g.mrpPaise, g.items.length])).toEqual([
      ['Ganga Textiles', 149900, 2],
      ['Rangoli', 149900, 1],
      ['Ganga Textiles', 159900, 1],
      [null, 149900, 1],
    ]);
  });

  it('sizes follow shop order: letters, then numbers, then the rest as first seen', () => {
    const [design] = groupDesigns(['32', 'XL', 'Free', 'S', '28', 'Kids'].map((size) => row({ size })));
    expect(design.sizes.map((s) => s.size)).toEqual(['S', 'XL', '28', '32', 'Free', 'Kids']);
  });

  it('design keys survive a page address and refuse anything else', () => {
    const key = designKey(row({ name: '  Silk  Saree ' }));
    expect(key).toBe(`${A}~149900~silk saree`);
    expect(parseDesignKey(key)).toBe(key);
    expect(parseDesignKey(designKey(row({ supplierId: null })))).toBe('none~149900~anarkali kurta');
    expect(parseDesignKey('x~1~a')).toBeUndefined();
    expect(parseDesignKey(`${A}~12a~a`)).toBeUndefined();
    expect(parseDesignKey(undefined)).toBeUndefined();
  });
});
